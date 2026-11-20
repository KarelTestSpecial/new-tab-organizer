import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8771;
const CDP_PORT = 9341;
const PROFILE = join(tmpdir(), 'nto-profile-orgs');

const testSource = readFileSync(fileURLToPath(new URL('./test-link-lists.mjs', import.meta.url)), 'utf8');
const SHIM = testSource.slice(
    testSource.indexOf('const SHIM = `') + 'const SHIM = `'.length,
    testSource.indexOf('`;\n\ntry {')
);

const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '--directory', EXT_DIR], { stdio: 'ignore' });
const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
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
    let version;
    for (let i = 0; i < 40; i++) {
        try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; }
        catch { await sleep(250); }
    }
    if (!version) throw new Error('chrome did not start');

    const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const { ws, send } = await connect(target.webSocketDebuggerUrl);
    await send('Runtime.enable');
    const pageErrors = [];
    ws.addEventListener('message', (ev) => {
        try {
            const m = JSON.parse(ev.data);
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                pageErrors.push((d.exception && d.exception.description) || d.text);
            }
        } catch (e) { /* ignore */ }
    });
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
    await loadOnce('?view=A');

    async function loadOnce(query) {
        await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html${query}` });
        await sleep(1200);
    }

    const loadPage = async (query) => {
        await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html${query}` });
        await sleep(1200);
        // A navigate replaces the execution context, so re-install the shim the
        // same way the browser does: it runs again on the next document.
    };

    // The extension always writes a complete settings object, so tests must too.
    const setSettings = async (body) => {
        await evaluate(send, `
            const current = (await new Promise(r => chrome.storage.local.get('settings', d => r(d.settings)))) || {};
            const next = Object.assign({}, current, ${body});
            chrome.storage.local.set({ settings: next });
            return true;
        `);
    };

    // ---------- Default (6 organizers) ----------
    await setSettings(`{ theme: 'light' }`);
    await loadPage('?view=A');

    const defaults = await evaluate(send, `
        return {
            view: getCurrentView(),
            storageKey: getStorageKey(getCurrentView()),
            views: window.getOrganizerViews(),
            navLinks: [...document.querySelectorAll('#sidebar-view-nav a')].map(a => a.textContent),
            activeNav: [...document.querySelectorAll('#sidebar-view-nav a.active-view-link')].map(a => a.textContent),
            startupBoxes: [...document.querySelectorAll('#startup-views-container input')].map(i => i.dataset.view),
            layoutBoxes: [...document.querySelectorAll('#layout-views-container input')].map(i => i.dataset.view),
            countOptions: [...document.querySelectorAll('#organizer-count-select option')].map(o => o.value),
            swapOptions: [...document.querySelectorAll('#swap-select-1 option')].map(o => o.value)
        };
    `);
    check('view A is read from ?view=A', defaults.view === 'A', defaults.view);
    check('storage key for A is panelsState', defaults.storageKey === 'panelsState', defaults.storageKey);
    check('default organizer count is 6', defaults.views.join('') === 'ABCDEF', defaults.views);
    check('nav renders one link per organizer', defaults.navLinks.join('') === 'ABCDEF', defaults.navLinks);
    check('nav marks only the current view', defaults.activeNav.join('') === 'A', defaults.activeNav);
    check('startup checkboxes follow the view list', defaults.startupBoxes.join('') === 'ABCDEF', defaults.startupBoxes);
    check('row layout checkboxes follow the view list', defaults.layoutBoxes.join('') === 'ABCDEF', defaults.layoutBoxes);
    check('count selector offers 1-26', defaults.countOptions.length === 26 && defaults.countOptions[0] === '1', defaults.countOptions);
    check('swap selects list the 6 organizers', defaults.swapOptions.join('') === 'ABCDEF', defaults.swapOptions);

    // ---------- Upgrade dialog lists the current organizers, not a fixed A-D ----------
    const upgrade = await evaluate(send, `
        const modal = document.getElementById('upgrade-modal');
        const wasHidden = modal.classList.contains('hidden');
        modal.classList.remove('hidden');
        // The dialog text is filled when the upgrade check runs, so re-run it by
        // invoking the same rendering path through a fresh load instead.
        const summaryBefore = (document.getElementById('upgrade-organizer-summary') || {}).textContent || '';
        return { summaryBefore, wasHidden };
    `);
    console.log('UPGRADE SUMMARY (default 6):', upgrade.summaryBefore.trim());
    check('upgrade dialog names the organizer range (A-F)',
        upgrade.summaryBefore.includes('(A\u2013F)') || upgrade.summaryBefore.includes('(A-F)'),
        upgrade.summaryBefore);

    // ---------- A different letter keeps its own storage ----------
    await loadPage('?view=C');
    const viewC = await evaluate(send, `
        return { view: getCurrentView(), key: getStorageKey(getCurrentView()), activeNav: [...document.querySelectorAll('#sidebar-view-nav a.active-view-link')].map(a => a.textContent) };
    `);
    check('view C resolves from the query string', viewC.view === 'C', viewC.view);
    check('view C uses panelsState_C', viewC.key === 'panelsState_C', viewC.key);
    check('nav highlights C', viewC.activeNav.join('') === 'C', viewC.activeNav);

    // A legacy panelC.html tab must redirect to ?view=C
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panelC.html` });
    await sleep(1200);
    const legacy = await evaluate(send, `return { href: location.href, view: getCurrentView() };`);
    check('legacy panelC.html redirects to panel.html?view=C', legacy.href.includes('view=C') && legacy.view === 'C', legacy);

    // ---------- Fewer organizers: E disappears, A-D data is untouched ----------
    await setSettings(`{ theme: 'light', organizerCount: 3 }`);
    await evaluate(send, `chrome.storage.local.set({ panelsState_E: [{ id: 'x' }] }); return true;`);
    await loadPage('?view=A');
    const reduced = await evaluate(send, `
        return {
            views: window.getOrganizerViews(),
            navLinks: [...document.querySelectorAll('#sidebar-view-nav a')].map(a => a.textContent),
            startupBoxes: [...document.querySelectorAll('#startup-views-container input')].map(i => i.dataset.view),
            swapOptions: [...document.querySelectorAll('#swap-select-1 option')].map(o => o.value)
        };
    `);
    check('organizerCount 3 limits the views', reduced.views.join('') === 'ABC', reduced.views);
    check('nav shrinks to 3', reduced.navLinks.join('') === 'ABC', reduced.navLinks);
    check('startup checkboxes shrink to 3', reduced.startupBoxes.join('') === 'ABC', reduced.startupBoxes);
    check('swap selects shrink to 3', reduced.swapOptions.join('') === 'ABC', reduced.swapOptions);

    const storedE = await evaluate(send, `return !!(await new Promise(r => chrome.storage.local.get('panelsState_E', d => r(d.panelsState_E))));`);
    check('hidden organizer data is kept in storage', storedE === true, storedE);

    // ---------- More organizers ----------
    await setSettings(`{ theme: 'light', organizerCount: 7 }`);
    await loadPage('?view=G');
    const expanded = await evaluate(send, `
        return {
            view: getCurrentView(),
            key: getStorageKey(getCurrentView()),
            navLinks: [...document.querySelectorAll('#sidebar-view-nav a')].map(a => a.textContent),
            startupBoxes: [...document.querySelectorAll('#startup-views-container input')].map(i => i.dataset.view)
        };
    `);
    check('organizerCount 7 adds views', expanded.navLinks.join('') === 'ABCDEFG', expanded.navLinks);
    check('view G resolves', expanded.view === 'G', expanded.view);
    check('view G uses panelsState_G', expanded.key === 'panelsState_G', expanded.key);

    // ---------- Settings: startup / layout toggles persist ----------
    const toggled = await evaluate(send, `
        const snap = () => ({
            startup: [...document.querySelectorAll('#startup-views-container input')].map(i => i.checked),
            layout: [...document.querySelectorAll('#layout-views-container input')].map(i => i.checked)
        });
        document.querySelectorAll('#startup-views-container input').forEach(i => { i.checked = false; });
        document.querySelectorAll('#startup-views-container input')[1].checked = true;
        document.querySelectorAll('#layout-views-container input')[2].checked = true;
        document.getElementById('save-settings-btn').click();
        await new Promise(r => setTimeout(r, 400));
        const saved = await new Promise(r => chrome.storage.local.get('settings', d => r(d.settings)));
        return {
            startup: saved.startupViews || [],
            layout: saved.rowLayoutViews || [],
            count: saved.organizerCount
        };
    `);
    check('saved startup list has one entry per organizer', Array.isArray(toggled.startup) && toggled.startup.length === 7, toggled.startup);
    check('startup B is on, the rest off', toggled.startup.join(',') === 'false,true,false,false,false,false,false', toggled.startup);
    check('row layout C is on', toggled.layout[2] === true, toggled.layout);
    check('organizerCount is saved', toggled.count === 7, toggled.count);

    // ---------- Changing the count stores the new size and reloads ----------
    // The change handler reloads the page, so the storage assertions run in the
    // reloaded context (the shim keeps its store in sessionStorage).
    await evaluate(send, `
        const select = document.getElementById('organizer-count-select');
        select.value = '6';
        select.dispatchEvent(new Event('change'));
        return true;
    `);
    await loadPage('?view=A');

    const countChanged = await evaluate(send, `
        const saved = await new Promise(r => chrome.storage.local.get('settings', d => r(d.settings)));
        return { count: saved.organizerCount, startup: saved.startupViews, layout: saved.rowLayoutViews };
    `);
    check('changing the count stores organizerCount', countChanged.count === 6, countChanged.count);
    check('startup list resized to 6', countChanged.startup.length === 6, countChanged.startup);
    check('row layout list resized to 6', countChanged.layout.length === 6, countChanged.layout);

    const resizedNav = await evaluate(send, `return [...document.querySelectorAll('#sidebar-view-nav a')].map(a => a.textContent);`);
    check('page reloads with the new organizer count', resizedNav.join('') === 'ABCDEF', resizedNav);

    // ---------- Row layout for the current view is applied ----------
    await setSettings(`{ theme: 'light', organizerCount: 5, layoutRowC: true }`);
    await loadPage('?view=C');
    const rowApplied = await evaluate(send, `return document.getElementById('panels-container').classList.contains('row-layout');`);
    check('row layout of organizer C is applied', rowApplied === true, rowApplied);

    // ---------- Context menu lists the other organizers ----------
    const contextMenu = await evaluate(send, `
        const header = document.querySelector('.panel .panel-header');
        header.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        const items = [...document.querySelectorAll('#panel-context-menu .context-menu-item')].map(i => i.textContent);
        return items;
    `);
    check('context menu lists the other 4 organizers', contextMenu.filter(t => t.startsWith('Move to Organizer')).join(',') === 'Move to Organizer A,Move to Organizer B,Move to Organizer D,Move to Organizer E', contextMenu);

    // ---------- Startup: A stays, the other enabled organizers open as tabs ----------
    await evaluate(send, `
        const store = JSON.parse(sessionStorage.getItem('__shim_store'));
        store.panelsState = [{ id: 'panel-1', title: 'Bookmark bar', type: 'bookmarks', folderId: '1', bookmarkOrder: [] }];
        store.settings = {
            theme: 'light', organizerCount: 5,
            startupViews: [true, true, true, true, true],
            startupA: true, startupB: true, startupC: true, startupD: true, startupE: true
        };
        sessionStorage.setItem('__shim_store', JSON.stringify(store));
        window.__createdTabs.length = 0;
        sessionStorage.setItem('__shim_tabs', '[]');
        sessionStorage.removeItem('startupHandled');
        return true;
    `);
    await loadPage('?view=A');
    const startup = await evaluate(send, `
        return { tabs: window.__createdTabs, href: location.href };
    `);
    check('startup opens the other 4 organizers as background tabs',
        startup.tabs.length === 4 && startup.tabs.every(u => u.startsWith('panel.html?view=')),
        startup.tabs);
    check('startup keeps organizer A in the current tab', startup.href.includes('view=A'), startup.href);

    // A is off, B on: the current tab redirects to B and C-E open as tabs.
    await evaluate(send, `
        const store = JSON.parse(sessionStorage.getItem('__shim_store'));
        store.settings = {
            theme: 'light', organizerCount: 5,
            startupViews: [false, true, true, true, true],
            startupA: false, startupB: true, startupC: true, startupD: true, startupE: true
        };
        sessionStorage.setItem('__shim_store', JSON.stringify(store));
        window.__createdTabs.length = 0;
        sessionStorage.setItem('__shim_tabs', '[]');
        sessionStorage.removeItem('startupHandled');
        return true;
    `);
    await loadPage('?view=A');
    const redirected = await evaluate(send, `
        return { tabs: window.__createdTabs, href: location.href };
    `);
    check('startup redirects to the first enabled organizer', redirected.href.includes('view=B'), redirected.href);
    // The redirect reloads the page as ?view=B, which triggers startup again:
    // the 3 tabs come from that second run.
    check('startup opens only the remaining organizers',
        redirected.tabs.length === 3 && redirected.tabs.every(u => u.includes('view=') && !u.includes('view=A') && !u.includes('view=B')),
        redirected.tabs);

    ws.close();
} catch (error) {
    failures++;
    console.error('ERROR', error.stack);
} finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);