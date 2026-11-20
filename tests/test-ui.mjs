// UI checks that are easy to regress silently:
//   - every panel has a keyboard-reachable actions menu (the ⋮ button)
//   - a bookmark title containing a quote still opens the edit form
//   - modals expose dialog semantics
//   - settings are live: changing a control persists without a save click
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8799;
const CDP_PORT = 9369;
const PROFILE = join(tmpdir(), 'nto-profile-ui');

const testSource = readFileSync(fileURLToPath(new URL('./test-ordering.mjs', import.meta.url)), 'utf8');
const SHIM_START = testSource.indexOf('const SHIM = `') + 'const SHIM = `'.length;
const SHIM = testSource.slice(SHIM_START, testSource.indexOf('`;', SHIM_START));

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

    await navigate();
    await evaluate(send, `
        await new Promise((res) => chrome.storage.local.set({
            settings: { sidebarFolderId: '16', rootFolderId: '1', useOrganizerFolders: false, ordering: {} }
        }, res));
        return true;
    `);
    await navigate();

    // --- 1. Every panel has a keyboard-reachable actions button ---
    const menu = await evaluate(send, `
        const button = document.querySelector('.panel-menu-btn');
        if (!button) return { found: false };
        button.click();
        await new Promise((r) => setTimeout(r, 100));
        const menu = document.getElementById('panel-context-menu');
        const items = menu ? [...menu.querySelectorAll('.context-menu-item')].map((i) => i.textContent) : [];
        return {
            found: true,
            label: button.getAttribute('aria-label'),
            open: Boolean(menu),
            items
        };
    `);
    check('every panel has an actions button', menu.found, menu);
    check('the actions button is labelled', menu.label === 'Panel actions', menu.label);
    check('the actions menu opens', menu.open, menu);
    check('the actions menu lists the other organizers',
        menu.items.some((label) => /^Move to Organizer B$/.test(label)), menu.items);

    // --- 2. A quote in a bookmark title still opens the edit form ---
    const quoted = await evaluate(send, `
        window.__errs = [];
        window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
        await new Promise((res) => chrome.bookmarks.create({ parentId: "16", title: 'Say "hello" now', url: "https://example.com/quoted" }, res));
        await new Promise((r) => setTimeout(r, 150));
        if (window.bookmarkRefreshCallbacks) window.bookmarkRefreshCallbacks.forEach((cb) => cb());
        await new Promise((r) => setTimeout(r, 300));

        const items = [...document.querySelectorAll('#sidebar-bookmarks .bookmark-item')].map((el) => el.textContent);
        const all = [];
        const walk = (n) => { all.push(n); (n.children || []).forEach(walk); };
        walk(window.__shim.tree[0]);
        const item = [...document.querySelectorAll('#sidebar-bookmarks .bookmark-item')]
            .find((el) => el.textContent.includes('Say "hello" now'));
        if (!item) return { found: false, errs: window.__errs, items, titles: all.map((n) => n.title).filter(Boolean), folder: document.getElementById('sidebar-bookmarks').dataset.folderId };
        item.querySelector('.edit-bookmark-btn').click();
        const input = item.querySelector('.edit-title');
        return {
            found: true,
            hasForm: Boolean(input),
            value: input ? input.value : null,
            errs: window.__errs
        };
    `);
    check('a bookmark with a quote can be edited', quoted.found && quoted.hasForm, quoted);
    check('the quote survives in the edit field', quoted.value === 'Say "hello" now', quoted.value);
    check('editing a quoted title raises no error', quoted.errs.length === 0, quoted.errs);

    // --- 3. Modals expose dialog semantics ---
    const aria = await evaluate(send, `
        const modal = document.getElementById('add-bookmarks-panel-modal');
        return {
            role: modal.getAttribute('role'),
            ariaModal: modal.getAttribute('aria-modal')
        };
    `);
    check('modals declare role=dialog', aria.role === 'dialog', aria);
    check('modals declare aria-modal', aria.ariaModal === 'true', aria);

    // --- 4. Settings are live: no save click needed ---
    const live = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 300));
        const select = document.getElementById('ordering-sidebar');
        select.value = 'alphabetical';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        const stored = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        return {
            doneLabel: document.getElementById('save-settings-btn').textContent.trim(),
            closeLabel: document.getElementById('close-settings-btn').textContent.trim(),
            sidebar: stored.ordering && stored.ordering.sidebar
        };
    `);
    check('the save button is now labelled Done', live.doneLabel === 'Done', live.doneLabel);
    check('cancel is now labelled Close', live.closeLabel === 'Close', live.closeLabel);
    check('an ordering change persists without a save click',
        live.sidebar === 'alphabetical', live);

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