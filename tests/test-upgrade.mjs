// First-run upgrade dialog: it is the third entry point to the shared
// organizer-folder toggle (Settings and the add-bookmark modal are covered by
// test-ordering.mjs). Submitting it must create the folders and persist both
// the setting and the "upgrade done" marker.
//
// The ordering shim seeds a finished setup for its own tests; that would make
// the first-run dialog skip itself, so this suite strips that seed and starts
// from empty storage.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8801;
const CDP_PORT = 9371;
const PROFILE = join(tmpdir(), 'nto-profile-upgrade');
rmSync(PROFILE, { recursive: true, force: true });

const testSource = readFileSync(fileURLToPath(new URL('./test-ordering.mjs', import.meta.url)), 'utf8');
const SHIM_START = testSource.indexOf('const SHIM = `') + 'const SHIM = `'.length;
let SHIM = testSource.slice(SHIM_START, testSource.indexOf('`;', SHIM_START));

const seedStart = SHIM.indexOf("    if (!sessionStorage.getItem('__shim_store')) {");
if (seedStart !== -1) {
    const seedEnd = SHIM.indexOf('\n    }\n', seedStart) + '\n    }\n'.length;
    SHIM = SHIM.slice(0, seedStart) + SHIM.slice(seedEnd);
}

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

    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A` });
    await sleep(1600);

    const shown = await evaluate(send, `
        const modal = document.getElementById('upgrade-modal');
        return { visible: modal ? !modal.classList.contains('hidden') : false };
    `);
    check('the first-run upgrade dialog is shown', shown.visible, shown);

    const result = await evaluate(send, `
        document.getElementById('upgrade-root-select').value = '1';
        document.getElementById('upgrade-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 900));

        const settings = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings || {})));
        const upgradeDone = await new Promise((res) => chrome.storage.local.get('foldersUpgradeDone', (d) => res(d.foldersUpgradeDone)));

        const titles = [];
        const walk = (n) => { titles.push(n.title); (n.children || []).forEach(walk); };
        walk(window.__shim.tree[0]);

        return {
            useOrganizerFolders: settings.useOrganizerFolders,
            rootFolderId: settings.rootFolderId,
            upgradeDone,
            folders: ['Organizer B', 'Organizer C', 'Organizer D', 'Organizer E', 'Organizer F']
                .filter((name) => titles.includes(name))
        };
    `);

    check('the upgrade persists useOrganizerFolders', result.useOrganizerFolders === true, result);
    check('the upgrade persists the chosen root', result.rootFolderId === '1', result);
    check('the upgrade marks itself done', result.upgradeDone === true, result);
    check('the missing organizer folders are created',
        result.folders.length === 5, result.folders);

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