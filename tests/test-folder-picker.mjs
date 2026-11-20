// Folder picker test: hierarchy, alphabetical order, search, selection,
// keyboard, and the 5.7 -> 6.0 'Zijbalk' -> 'Sidebar' rename.
//
// Drives the real page in headless Chrome over HTTP with a chrome.* shim.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8793;
const CDP_PORT = 9363;
const PROFILE = join(tmpdir(), 'nto-profile-folders');

// A tree shaped like a real one: three roots, nesting two levels deep, and a
// legacy 'Zijbalk' folder (id 14) under the Bookmark bar.
const SHIM = `
(() => {
    const clone = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v));
    const store = (() => {
        try { const raw = sessionStorage.getItem('__shim_store'); if (raw) return JSON.parse(raw); } catch (e) {}
        return {};
    })();
    const persist = () => { try { sessionStorage.setItem('__shim_store', JSON.stringify(store)); } catch (e) {} };

    const tree = [{
        id: '0', title: '', children: [
            { id: '1', title: 'Bookmark bar', parentId: '0', children: [
                { id: '10', title: 'Werk', parentId: '1', children: [
                    { id: '11', title: 'Projecten', parentId: '10', children: [
                        { id: '12', title: 'Alpha', parentId: '11', url: 'https://alpha.example/' }
                    ] },
                    { id: '13', title: 'Archief', parentId: '10' }
                ] },
                { id: '14', title: 'Zijbalk', parentId: '1' },
                { id: '15', title: 'Persoonlijk', parentId: '1' }
            ] },
            { id: '2', title: 'Other bookmarks', parentId: '0', children: [
                { id: '20', title: 'Créatief', parentId: '2' },
                { id: '21', title: 'Recepten', parentId: '2' }
            ] },
            { id: '3', title: 'Mobile bookmarks', parentId: '0' }
        ]
    }];

    const allNodes = (nodes, out) => {
        const acc = out || [];
        (nodes || []).forEach((n) => { acc.push(n); if (n.children) allNodes(n.children, acc); });
        return acc;
    };
    const find = (id) => allNodes(tree).find((n) => n.id === String(id));

    // Tests (and nothing else) can inject folders that survive a page reload.
    try {
        const extra = JSON.parse(sessionStorage.getItem('__shim_extra') || '[]');
        extra.forEach((node) => {
            const parent = find(node.parentId);
            if (parent) { parent.children = parent.children || []; parent.children.push(node); }
        });
    } catch (e) { /* ignore */ }

    let tabSeq = 0;
    const local = {
        get(keys, cb) {
            const out = {};
            const add = (k) => { if (k in store) out[k] = clone(store[k]); };
            if (keys === null || keys === undefined) Object.keys(store).forEach(add);
            else if (typeof keys === 'string') add(keys);
            else if (Array.isArray(keys)) keys.forEach(add);
            else if (typeof keys === 'object') Object.keys(keys).forEach((k) => {
                if (k in store) out[k] = clone(store[k]); else out[k] = keys[k];
            });
            setTimeout(() => cb && cb(out), 0);
        },
        set(obj, cb) { Object.keys(obj).forEach((k) => { store[k] = clone(obj[k]); }); persist(); setTimeout(() => cb && cb(), 0); },
        remove(keys, cb) { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]); persist(); setTimeout(() => cb && cb(), 0); },
        clear(cb) { Object.keys(store).forEach((k) => delete store[k]); persist(); setTimeout(() => cb && cb(), 0); }
    };

    window.chrome = {
        runtime: {
            id: 'test-extension', lastError: undefined,
            getURL: (p) => location.origin + '/' + p,
            getManifest: () => ({ manifest_version: 3 }),
            onMessage: { addListener() {} }, onInstalled: { addListener() {} }
        },
        storage: { local, onChanged: { addListener() {} } },
        bookmarks: {
            getTree(cb) { setTimeout(() => cb(clone(tree)), 0); },
            getChildren(id, cb) {
                const node = find(id);
                setTimeout(() => cb(node && node.children ? clone(node.children) : []), 0);
            },
            getSubTree(id, cb) { const n = find(id); setTimeout(() => cb(n ? [clone(n)] : []), 0); },
            get(ids, cb) {
                const list = Array.isArray(ids) ? ids : [ids];
                const found = list.map(find).filter(Boolean);
                setTimeout(() => cb(found), 0);
            },
            search(q, cb) { setTimeout(() => cb([]), 0); },
            create(obj, cb) {
                const node = { id: 'n' + (++tabSeq), title: obj.title, parentId: String(obj.parentId), url: obj.url };
                const parent = find(obj.parentId);
                if (parent) { parent.children = parent.children || []; parent.children.push(node); }
                setTimeout(() => cb && cb(clone(node)), 0);
            },
            move(id, dest, cb) {
                const node = find(id);
                if (!node) { if (cb) setTimeout(() => cb(), 0); return; }
                if (dest && dest.parentId !== undefined && dest.parentId !== null) {
                    const oldParent = find(node.parentId);
                    if (oldParent && oldParent.children) oldParent.children = oldParent.children.filter((c) => c.id !== node.id);
                    node.parentId = String(dest.parentId);
                    const newParent = find(node.parentId);
                    if (newParent) { newParent.children = newParent.children || []; newParent.children.push(node); }
                }
                if (dest && dest.title !== undefined) node.title = dest.title;
                setTimeout(() => cb && cb(clone(node)), 0);
            },
            update(id, changes, cb) { const n = find(id); if (n) Object.assign(n, changes); setTimeout(() => cb && cb(n ? clone(n) : undefined), 0); },
            remove(id, cb) { const n = find(id); if (n && n.parentId) { const p = find(n.parentId); if (p && p.children) p.children = p.children.filter((c) => c.id !== n.id); } setTimeout(() => cb && cb(), 0); },
            removeTree(id, cb) { setTimeout(() => cb && cb(), 0); },
            onCreated: { addListener() {} }, onRemoved: { addListener() {} }, onChanged: { addListener() {} },
            onMoved: { addListener() {} }, onChildrenReordered: { addListener() {} }, onImportEnded: { addListener() {} }
        },
        tabs: {
            create(opts, cb) { setTimeout(() => cb && cb({ id: ++tabSeq }), 0); },
            query(q, cb) { setTimeout(() => cb([]), 0); },
            update(id, opts, cb) { setTimeout(() => cb && cb(), 0); },
            reload(id, cb) { setTimeout(() => cb && cb(), 0); }
        },
        i18n: { getMessage: () => '', getUILanguage: () => 'en-US' },
        windows: {
            update(id, i, cb) { setTimeout(() => cb && cb({ id }), 0); },
            getCurrent(cb) { setTimeout(() => cb({ id: 1 }), 0); },
            get(id, cb) { setTimeout(() => cb({ id }), 0); },
            getAll(cb) { setTimeout(() => cb([{ id: 1 }]), 0); },
            create(o, cb) { setTimeout(() => cb({ id: 1 }), 0); }
        }
    };

    const asNoop = (prop) => prop === 'then' ? undefined : (...args) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') setTimeout(() => cb({}), 0);
    };
    const wrap = (value) => {
        if (value === null || value === undefined || typeof value !== 'object') return value;
        return new Proxy(value, { get: (t, p) => (p in t ? t[p] : asNoop(p)) });
    };
    window.chrome = new Proxy(window.chrome, {
        get: (target, prop) => (prop in target ? wrap(target[prop]) : asNoop(prop))
    });

    if (!sessionStorage.getItem('__shim_store')) {
        store.foldersUpgradeDone = true;
        store.panelsState = [{ id: 'panel-1', title: 'Bookmark bar', type: 'bookmarks', folderId: '1', bookmarkOrder: [] }];
        store.settings = { theme: 'light', organizerCount: 2, sidebarFolderId: '15', useOrganizerFolders: false };
        persist();
    }
    window.__shim = { tree, find };
})();
`;

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

const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '--directory', EXT_DIR], { stdio: 'ignore' });
const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore' });

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

    const navigate = async (query) => {
        await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A${query || ''}` });
        await sleep(1400);
    };

    await navigate();

    // --- Open the settings panel ---
    await evaluate(send, `document.getElementById('settings-btn').click(); return true;`);
    await sleep(200);

    const initial = await evaluate(send, `
        const picker = document.querySelector('.folder-picker');
        const select = document.getElementById('sidebar-folder-select');
        const trigger = document.querySelector('.folder-picker-trigger-label');
        return {
            hasPicker: Boolean(picker),
            nativeHidden: select.classList.contains('folder-picker-native'),
            triggerLabel: trigger ? trigger.textContent : null,
            selectValue: select.value,
            optionCount: select.options.length,
            hasNewOption: [...select.options].some((o) => o.value === '__new_folder__')
        };
    `);
    check('the sidebar select was replaced by a picker', initial.hasPicker === true, initial);
    check('the native select stays as the hidden value holder', initial.nativeHidden === true, initial);
    check('the trigger shows the stored folder, not a placeholder', initial.triggerLabel === 'Persoonlijk', initial);
    check('the hidden select keeps the stored value', initial.selectValue === '15', initial);
    check('the hidden select mirrors the folders and the new-folder entry',
        initial.optionCount >= 7 && initial.hasNewOption === true, initial);

    // --- Open and inspect the hierarchy ---
    const tree = await evaluate(send, `
        document.querySelector('.folder-picker-trigger').click();
        await new Promise((r) => setTimeout(r, 60));
        const rows = [...document.querySelectorAll('.folder-picker-row')].map((row) => ({
            value: row.dataset.value,
            title: row.querySelector('.folder-picker-row-title').textContent,
            depth: parseInt(row.style.paddingLeft, 10) || 0,
            kind: row.dataset.kind || 'folder'
        }));
        return { open: !document.getElementById('open-links-modal'), rows, expanded: document.querySelector('.folder-picker-trigger').getAttribute('aria-expanded') };
    `);
    const titles = tree.rows.map((r) => r.title);
    const order = tree.rows.filter((r) => r.kind === 'folder').map((r) => r.title);

    check('the picker opens', tree.expanded === 'true', tree);
    const idx = (title) => order.indexOf(title);
    check('the three roots are sorted alphabetically',
        idx('Bookmark bar') < idx('Mobile bookmarks') && idx('Mobile bookmarks') < idx('Other bookmarks'), order);
    check('folders inside the Bookmark bar are sorted, not in tree order',
        idx('Persoonlijk') < idx('Werk') && idx('Werk') < idx('Zijbalk'), order);
    check('nesting is expressed as indentation, not as flat text',
        tree.rows.find((r) => r.title === 'Werk').depth === 25 &&
        tree.rows.find((r) => r.title === 'Projecten').depth === 40, tree.rows);
    check('"Werk" comes before its own child "Projecten"',
        idx('Werk') < idx('Projecten'), order);
    check('the selected folder is marked as current',
        tree.rows.find((r) => r.value === '15').title === 'Persoonlijk', tree.rows);

    // --- Layout ---
    const layout = await evaluate(send, `
        const pop = document.querySelector('.folder-picker-popover');
        const r = pop.getBoundingClientRect();
        return {
            parentIsBody: pop.parentElement === document.body,
            top: Math.round(r.top), bottom: Math.round(r.bottom),
            left: Math.round(r.left), right: Math.round(r.right),
            width: Math.round(r.width), height: Math.round(r.height),
            vw: window.innerWidth, vh: window.innerHeight
        };
    `);
    check('the popover lives on <body>, not inside the transformed panel', layout.parentIsBody === true, layout);
    check('the popover fits inside the viewport',
        layout.top >= 0 && layout.bottom <= layout.vh && layout.left >= 0 && layout.right <= layout.vw, layout);
    check('the popover is wide enough to read the paths', layout.width >= 280, layout);

    // --- Search ---
    const search = await evaluate(send, `
        const input = document.querySelector('.folder-picker-input');
        const type = async (text) => {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 40));
            return [...document.querySelectorAll('.folder-picker-row')].map((row) => ({
                title: row.querySelector('.folder-picker-row-title').textContent,
                path: row.querySelector('.folder-picker-row-path')?.textContent || ''
            }));
        };
        return {
            byPath: await type('arch'),
            byTitle: await type('project'),
            folded: await type('creatief'),
            none: await type('zzzz'),
            cleared: await type('')
        };
    `);

    check('search matches a nested folder by name',
        JSON.stringify(search.byPath) === JSON.stringify([{ title: 'Archief', path: 'Bookmark bar  ›  Werk' }]), search.byPath);
    check('a folder whose title matches ranks above one that merely matches its path',
        search.byTitle[0].title === 'Projecten' && search.byTitle[0].path === 'Bookmark bar  ›  Werk', search.byTitle);
    check('search ignores diacritics ("creatief" finds "Créatief")',
        search.folded.length === 1 && search.folded[0].title === 'Créatief', search.folded);
    check('a query with no match says so instead of showing everything',
        search.none.length === 0, search.none);
    check('clearing the query restores the full tree', search.cleared.length > 6, search.cleared.length);

    // --- Selecting ---
    const afterSelect = await evaluate(send, `
        const row = [...document.querySelectorAll('.folder-picker-row')].find((r) => r.dataset.value === '10');
        row.click();
        await new Promise((r) => setTimeout(r, 120));
        const select = document.getElementById('sidebar-folder-select');
        return {
            selectValue: select.value,
            trigger: document.querySelector('.folder-picker-trigger-label').textContent,
            closed: document.querySelector('.folder-picker-popover').classList.contains('hidden'),
            stored: (await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)))).sidebarFolderId
        };
    `);
    check('clicking a folder updates the hidden select', afterSelect.selectValue === '10', afterSelect);
    check('clicking a folder updates the trigger label', afterSelect.trigger === 'Werk', afterSelect);
    check('clicking a folder closes the popover', afterSelect.closed === true, afterSelect);
    check('the choice is saved to settings',
        afterSelect.stored === '10', afterSelect.stored);

    // --- Keyboard ---
    const keyboard = await evaluate(send, `
        const trigger = document.querySelector('.folder-picker-trigger');
        const input = document.querySelector('.folder-picker-input');
        trigger.click();
        await new Promise((r) => setTimeout(r, 40));
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 20));
        const activeBefore = document.querySelector('.folder-picker-row.is-active')?.dataset.value;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 120));
        const select = document.getElementById('sidebar-folder-select');
        return { activeBefore, selectValue: select.value, trigger: document.querySelector('.folder-picker-trigger-label').textContent };
    `);
    check('arrow keys move an active row', Boolean(keyboard.activeBefore), keyboard);
    check('Enter picks the active row', keyboard.selectValue !== '10' && keyboard.selectValue === keyboard.activeBefore, keyboard);

    // --- Escape closes only the picker, not the settings panel ---
    const escape = await evaluate(send, `
        document.querySelector('.folder-picker-trigger').click();
        await new Promise((r) => setTimeout(r, 40));
        document.querySelector('.folder-picker-input').focus();
        document.querySelector('.folder-picker-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 40));
        return {
            pickerClosed: document.querySelector('.folder-picker-popover').classList.contains('hidden'),
            panelStillOpen: !document.getElementById('settings-panel').classList.contains('hidden')
        };
    `);
    check('Escape closes the picker', escape.pickerClosed === true, escape);
    check('Escape does not also close the settings panel', escape.panelStillOpen === true, escape);

    // --- Clicking outside closes ---
    const outside = await evaluate(send, `
        document.querySelector('.folder-picker-trigger').click();
        await new Promise((r) => setTimeout(r, 40));
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 40));
        return document.querySelector('.folder-picker-popover').classList.contains('hidden');
    `);
    check('a click outside closes the picker', outside === true, outside);

    // --- "+ New folder..." still routes through the settings change handler ---
    const newFolder = await evaluate(send, `
        window.prompt = () => 'Nieuwe map';
        document.querySelector('.folder-picker-trigger').click();
        await new Promise((r) => setTimeout(r, 40));
        const row = [...document.querySelectorAll('.folder-picker-row')].find((r) => r.dataset.value === '__new_folder__');
        row.click();
        await new Promise((r) => setTimeout(r, 250));
        const stored = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        const node = stored.sidebarFolderId ? await new Promise((res) => chrome.bookmarks.get(stored.sidebarFolderId, res)) : [];
        return { id: stored.sidebarFolderId, title: node[0] ? node[0].title : null };
    `);
    check('"+ New folder…" creates the folder and selects it', newFolder.title === 'Nieuwe map', newFolder);

    // --- Migration: 5.7 created the folder as 'Zijbalk' ---
    await evaluate(send, `
        await new Promise((res) => chrome.storage.local.set({
            settings: { theme: 'light', organizerCount: 2, sidebarFolderId: '14', useOrganizerFolders: false }
        }, res));
        return true;
    `);
    await navigate();
    await sleep(300);

    const migrated = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 180));
        document.querySelector('.folder-picker-trigger').click();
        await new Promise((r) => setTimeout(r, 60));
        const node = await new Promise((res) => chrome.bookmarks.get('14', res));
        const stored = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        const rows = [...document.querySelectorAll('.folder-picker-row')].map((r) => r.querySelector('.folder-picker-row-title').textContent);
        return {
            title: node[0] ? node[0].title : null,
            sidebarFolderId: stored.sidebarFolderId,
            trigger: document.querySelector('.folder-picker-trigger-label').textContent,
            hasZijbalk: rows.includes('Zijbalk'),
            hasSidebar: rows.includes('Sidebar')
        };
    `);
    check("the legacy 'Zijbalk' folder is renamed to 'Sidebar'", migrated.title === 'Sidebar', migrated);
    check('the rename keeps the stored folder id', migrated.sidebarFolderId === '14', migrated);
    check("the dropdown shows 'Sidebar' and no longer 'Zijbalk'",
        migrated.hasSidebar === true && migrated.hasZijbalk === false, migrated);
    check('the trigger shows the new name', migrated.trigger === 'Sidebar', migrated);

    // --- A folder that is already called Sidebar must not be renamed onto ---
    await evaluate(send, `
        sessionStorage.setItem('__shim_extra', JSON.stringify([{ id: '16', title: 'Sidebar', parentId: '1' }]));
        await new Promise((res) => chrome.storage.local.set({
            settings: { theme: 'light', organizerCount: 2, sidebarFolderId: '14', useOrganizerFolders: false }
        }, res));
        return true;
    `);
    await navigate();
    await sleep(300);
    const noClash = await evaluate(send, `
        const node = await new Promise((res) => chrome.bookmarks.get('14', res));
        return node[0] ? node[0].title : null;
    `);
    check('an existing "Sidebar" folder is not clobbered by the rename',
        noClash === 'Zijbalk', noClash);

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