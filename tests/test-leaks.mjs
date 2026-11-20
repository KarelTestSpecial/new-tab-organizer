// Regression test for the "growing cost" bug.
//
// applySettings() used to add three sidebar drag listeners and one refresh
// callback on every call, and createPanel() pushed another callback on every
// render. After enough saves, one drop ran N handlers and every bookmark change
// refreshed N detached panels. These checks pin the fixed behaviour:
//   - repeated applySettings() does not grow the registry
//   - re-rendering panels replaces their callbacks instead of stacking them
//   - a drop after many applies moves the bookmark exactly once
//   - colour pickers preview live but write to storage once, on change
//
// The shared shim has a no-op storage.onChanged, so this suite patches in a
// real emitter to exercise the cross-tab path too.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8797;
const CDP_PORT = 9367;
const PROFILE = join(tmpdir(), 'nto-profile-leaks');

const testSource = readFileSync(fileURLToPath(new URL('./test-link-lists.mjs', import.meta.url)), 'utf8');
let SHIM = testSource.slice(
    testSource.indexOf('const SHIM = `') + 'const SHIM = `'.length,
    testSource.indexOf('`;\n\ntry {')
);

// Count change listeners on the organizer-count select.
SHIM = SHIM.replace(
    'const store = (() => {',
    `const __origAdd = EventTarget.prototype.addEventListener;
window.__listenerLog = [];
EventTarget.prototype.addEventListener = function (type, fn, options) {
    if (this && this.id === 'organizer-count-select' && type === 'change') window.__listenerLog.push(1);
    return __origAdd.call(this, type, fn, options);
};
const store = (() => {`
);

// Real onChanged emitter.
SHIM = SHIM.replace(
    'storage: { local, onChanged: { addListener() {} } },',
    'storage: { local, onChanged: { addListener(fn) { (window.__onChanged = window.__onChanged || []).push(fn); } } },'
);
SHIM = SHIM.replace(
    'set(obj, cb) { Object.keys(obj).forEach((k) => { store[k] = clone(obj[k]); }); persist(); setTimeout(() => cb && cb(), 0); },',
    `set(obj, cb) {
            const changes = {};
            Object.keys(obj).forEach((k) => {
                changes[k] = { oldValue: clone(store[k]), newValue: clone(obj[k]) };
                store[k] = clone(obj[k]);
            });
            persist();
            setTimeout(() => {
                (window.__onChanged || []).forEach((fn) => { try { fn(changes, 'local'); } catch (e) { console.error(e); } });
                if (cb) cb();
            }, 0);
        },`
);

const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '--directory', EXT_DIR], { stdio: 'ignore' });
const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore' });

let failures = 0;
function check(name, condition, detail) {
    if (condition) console.log(`PASS  ${name}`);
    else { failures++; console.log(`FAIL  ${name}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`); }
}

async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
        }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const i = ++id; pending.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    return { ws, send };
}

async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', {
        expression: `(async () => { ${expression} })()`,
        awaitPromise: true,
        returnByValue: true,
    });
    if (result.exceptionDetails) {
        throw new Error('page exception: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result.value;
}

try {
    for (let i = 0; i < 40; i++) {
        try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; }
        catch { await sleep(250); }
    }

    const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const { ws, send } = await connect(target.webSocketDebuggerUrl);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });

    const navigate = async () => {
        await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A` });
        await sleep(1400);
    };

    // First load installs the shim; then seed settings and load again.
    await navigate();
    await evaluate(send, `
        await new Promise((res) => chrome.storage.local.set({
            settings: { sidebarFolderId: '1', rootFolderId: '1', useOrganizerFolders: false, ordering: {} },
            panelsState: [
                { id: 'p1', title: 'One', type: 'bookmarks', folderId: '12', cards: [] },
                { id: 'p2', title: 'Two', type: 'bookmarks', folderId: '12', cards: [] }
            ]
        }, res));
        return true;
    `);
    await navigate();

    // --- 1. Repeated applySettings does not grow the registry ---
    const base = await evaluate(send, `
        const before = window.bookmarkRefreshCallbacks.size;
        const s = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        for (let i = 0; i < 25; i++) window.applySettings(s);
        return { before, after: window.bookmarkRefreshCallbacks.size, keys: [...window.bookmarkRefreshCallbacks.keys()] };
    `);
    check('repeated applySettings does not grow the refresh registry', base.after === base.before, base);
    check('the sidebar has exactly one refresh callback',
        base.keys.filter((k) => k === 'sidebar').length === 1, base.keys);

    // --- 2. Re-rendering panels replaces their callbacks ---
    const rerender = await evaluate(send, `
        for (let i = 0; i < 5; i++) {
            window.refreshPanelOrder();
            await new Promise((r) => setTimeout(r, 150));
        }
        const keys = [...window.bookmarkRefreshCallbacks.keys()];
        return { size: window.bookmarkRefreshCallbacks.size, panelKeys: keys.filter((k) => k.startsWith('panel:')) };
    `);
    check('re-rendering panels does not stack refresh callbacks',
        rerender.panelKeys.length === 2, rerender);
    check('each panel has exactly one callback',
        new Set(rerender.panelKeys).size === rerender.panelKeys.length, rerender.panelKeys);

    // --- 3. A drop after many settings applies moves the bookmark once ---
    const drop = await evaluate(send, `
        window.__dropMoves = 0;
        window.moveBookmark = (id, dest, cb) => { window.__dropMoves++; if (cb) cb(); };
        const s = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        for (let i = 0; i < 10; i++) window.applySettings(s);
        const el = document.getElementById('sidebar-bookmarks');
        const dt = new DataTransfer();
        dt.setData('text/plain', '10');
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: 40 }));
        await new Promise((r) => setTimeout(r, 100));
        return { moves: window.__dropMoves, items: el.querySelectorAll('.bookmark-item').length };
    `);
    check('a drop after many applies moves the bookmark exactly once', drop.moves === 1, drop);

    // --- 4. Storage changes from another tab do not stack callbacks ---
    const crossTab = await evaluate(send, `
        const before = window.bookmarkRefreshCallbacks.size;
        for (let i = 0; i < 10; i++) {
            await new Promise((res) => chrome.storage.local.set({
                settings: { sidebarFolderId: '1', rootFolderId: '1', useOrganizerFolders: false, ordering: {} }
            }, res));
        }
        await new Promise((r) => setTimeout(r, 250));
        return { before, after: window.bookmarkRefreshCallbacks.size };
    `);
    check('storage changes do not stack callbacks', crossTab.after === crossTab.before, crossTab);

    // --- 5. Colour picker: live preview, one write ---
    const color = await evaluate(send, `
        const origSet = chrome.storage.local.set.bind(chrome.storage.local);
        window.__settingsWrites = 0;
        chrome.storage.local.set = (obj, cb) => {
            if (obj && 'settings' in obj) window.__settingsWrites++;
            return origSet(obj, cb);
        };
        const picker = document.getElementById('bg-color-picker');
        picker.value = '#123456';
        for (let i = 0; i < 20; i++) picker.dispatchEvent(new Event('input', { bubbles: true }));
        const liveVar = document.documentElement.style.getPropertyValue('--bg-color');
        const writesDuringInput = window.__settingsWrites;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 350));
        const stored = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        return { writesDuringInput, liveVar, writesAfterChange: window.__settingsWrites, stored: stored.bgColor };
    `);
    check('dragging a colour picker writes nothing', color.writesDuringInput === 0, color);
    check('the colour previews live', color.liveVar === '#123456', color.liveVar);
    check('one change event writes once', color.writesAfterChange === 1, color.writesAfterChange);
    check('the colour is persisted', color.stored === '#123456', color.stored);

    // --- 6. Reopening Settings must not stack the organizer-count listener ---
    const listeners = await evaluate(send, `
        for (let i = 0; i < 5; i++) {
            document.getElementById('settings-btn').click();
            await new Promise((r) => setTimeout(r, 150));
            document.getElementById('close-settings-btn').click();
            await new Promise((r) => setTimeout(r, 150));
        }
        return window.__listenerLog.length;
    `);
    check('reopening Settings does not stack the organizer-count listener',
        listeners === 1, listeners);

    ws.close();
} catch (e) {
    failures++;
    console.error('ERROR', e.stack);
} finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);