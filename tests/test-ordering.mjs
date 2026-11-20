// Ordering policy test.
//
// Three things must hold at once:
//   - panels can be alphabetical while their stored (manual) order survives
//   - modal lists are alphabetical even when panels are manual
//   - a 'manual' folder policy never writes to Chrome
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8795;
const CDP_PORT = 9365;
const PROFILE = join(tmpdir(), 'nto-profile-ordering');

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
                { id: '10', title: 'Zebra', parentId: '1', children: [
                    { id: '13', title: 'Bravo', parentId: '10' },
                    { id: '14', title: 'Alpha', parentId: '10' }
                ] },
                { id: '11', title: 'alpha', parentId: '1', children: [] },
                { id: '12', title: 'Middle', parentId: '1', children: [] },
                { id: '15', title: 'Organizer A', parentId: '1', children: [
                    { id: '20', title: 'Zeta panel', parentId: '15' },
                    { id: '21', title: 'Alpha panel', parentId: '15' }
                ] },
                { id: '16', title: 'Sidebar', parentId: '1', children: [
                    { id: '30', title: 'zulu', parentId: '16', url: 'https://zulu.example/' },
                    { id: '31', title: 'alpha', parentId: '16', url: 'https://alpha.example/' }
                ] }
            ] },
            { id: '2', title: 'Other bookmarks', parentId: '0', children: [] }
        ]
    }];

    const allNodes = (nodes, out) => {
        const acc = out || [];
        (nodes || []).forEach((n) => { acc.push(n); if (n.children) allNodes(n.children, acc); });
        return acc;
    };
    const find = (id) => allNodes(tree).find((n) => n.id === String(id));
    window.__moveCalls = [];

    // Minimal bookmark event emitters, so the ordering listener can be tested.
    const emitters = {};
    const on = (name) => ({ addListener(fn) { (emitters[name] = emitters[name] || []).push(fn); } });
    const emit = (name, arg) => (emitters[name] || []).forEach((fn) => fn(arg));

    let seq = 0;
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
                setTimeout(() => cb(list.map(find).filter(Boolean)), 0);
            },
            search(q, cb) { setTimeout(() => cb([]), 0); },
            create(obj, cb) {
                const node = { id: 'n' + (++seq), title: obj.title, parentId: String(obj.parentId), url: obj.url };
                const parent = find(obj.parentId);
                if (parent) { parent.children = parent.children || []; parent.children.push(node); }
                emit('onCreated', clone(node));
                setTimeout(() => cb && cb(clone(node)), 0);
            },
            move(id, dest, cb) {
                const node = find(id);
                if (!node) { if (cb) setTimeout(() => cb(), 0); return; }
                const oldParent = find(node.parentId);
                if (oldParent && oldParent.children) oldParent.children = oldParent.children.filter((c) => c.id !== node.id);
                if (dest && dest.parentId !== undefined && dest.parentId !== null) node.parentId = String(dest.parentId);
                const newParent = find(node.parentId);
                if (newParent) {
                    newParent.children = newParent.children || [];
                    let index = dest && Number.isInteger(dest.index) ? dest.index : newParent.children.length;
                    index = Math.max(0, Math.min(index, newParent.children.length));
                    newParent.children.splice(index, 0, node);
                }
                if (dest && dest.title !== undefined) node.title = dest.title;
                window.__moveCalls.push({ id: String(id), index: dest ? dest.index : undefined, title: node.title });
                emit('onMoved', { id: String(id), parentId: node.parentId });
                setTimeout(() => cb && cb(clone(node)), 0);
            },
            update(id, changes, cb) { const n = find(id); if (n) Object.assign(n, changes); setTimeout(() => cb && cb(n ? clone(n) : undefined), 0); },
            remove(id, cb) { setTimeout(() => cb && cb(), 0); },
            removeTree(id, cb) { setTimeout(() => cb && cb(), 0); },
            onCreated: on('onCreated'), onRemoved: on('onRemoved'), onChanged: on('onChanged'),
            onMoved: on('onMoved'), onChildrenReordered: { addListener() {} }, onImportEnded: { addListener() {} }
        },
        tabs: {
            create(opts, cb) { setTimeout(() => cb && cb({ id: ++seq }), 0); },
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
        store.panelsState = [
            { id: 'panel-1', title: 'Beta', type: 'notes', cards: [] },
            { id: 'panel-2', title: 'Alpha', type: 'notes', cards: [] },
            { id: 'panel-3', title: 'Gamma', type: 'notes', cards: [] }
        ];
        store.settings = {
            theme: 'light', organizerCount: 1, sidebarFolderId: '16',
            rootFolderId: '1', useOrganizerFolders: false,
            ordering: { sidebar: 'manual', root: 'manual', panels: {}, folders: {} }
        };
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

    const seedSettings = async (ordering) => {
        await evaluate(send, `
            const current = (await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings || {}))));
            const ordering = ${JSON.stringify(ordering)};
            await new Promise((res) => chrome.storage.local.set({
                settings: Object.assign({}, current, { ordering })
            }, res));
            return true;
        `);
    };

    const navigate = async () => {
        await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A` });
        await sleep(1500);
    };

    // --- 1. Manual is the default and keeps the stored panel order ---
    await navigate();
    let state = await evaluate(send, `
        const titles = [...document.querySelectorAll('#panels-container .panel h3')].map((h) => h.textContent);
        return { titles, stored: await new Promise((res) => chrome.storage.local.get('panelsState', (d) => res(d.panelsState || []))) };
    `);
    check('manual is the default panel order',
        JSON.stringify(state.titles) === JSON.stringify(['Beta', 'Alpha', 'Gamma']), state.titles);
    const handleDisplay = await evaluate(send, `
        const handle = document.querySelector('.drag-handle');
        return handle ? getComputedStyle(handle).display : 'missing';
    `);
    check('the drag handle is visible in manual mode', handleDisplay !== 'none', handleDisplay);

    // --- 2. Alphabetical panels, stored order untouched ---
    await seedSettings({ sidebar: 'manual', root: 'manual', panels: { A: 'alphabetical' }, folders: {} });
    await navigate();
    state = await evaluate(send, `
        const titles = [...document.querySelectorAll('#panels-container .panel h3')].map((h) => h.textContent);
        return {
            titles,
            stored: (await new Promise((res) => chrome.storage.local.get('panelsState', (d) => res(d.panelsState || [])))).map((p) => p.title),
            handle: getComputedStyle(document.querySelector('.drag-handle')).display
        };
    `);
    check('alphabetical panels render A-Z', JSON.stringify(state.titles) === JSON.stringify(['Alpha', 'Beta', 'Gamma']), state.titles);
    check('the drag handle is hidden in alphabetical mode', state.handle === 'none', state.handle);
    check('the stored manual order survives the sorted view',
        JSON.stringify(state.stored) === JSON.stringify(['Beta', 'Alpha', 'Gamma']), state.stored);

    // --- 3. Adding a panel must not persist the alphabetical view ---
    await evaluate(send, `
        document.getElementById('add-notes-panel-btn').click();
        await new Promise((r) => setTimeout(r, 100));
        document.getElementById('add-notes-panel-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 250));
        return true;
    `);
    state = await evaluate(send, `
        const stored = await new Promise((res) => chrome.storage.local.get('panelsState', (d) => res(d.panelsState || [])));
        const titles = [...document.querySelectorAll('#panels-container .panel h3')].map((h) => h.textContent);
        return { stored: stored.map((p) => p.title), titles };
    `);
    check('saving with alphabetical panels keeps the original order at the front',
        JSON.stringify(state.stored.slice(0, 3)) === JSON.stringify(['Beta', 'Alpha', 'Gamma']), state.stored);
    check('the new panel is appended last in storage', state.stored[3] === 'New Notes', state.stored);

    // --- 4. Modal lists are alphabetical even when panels are manual ---
    await seedSettings({ sidebar: 'manual', root: 'manual', panels: {}, folders: {} });
    await navigate();
    const modal = await evaluate(send, `
        document.getElementById('add-bookmarks-panel-btn').click();
        await new Promise((r) => setTimeout(r, 200));
        document.getElementById('panel-folder-select').__folderPicker.open();
        await new Promise((r) => setTimeout(r, 120));
        const pop = [...document.querySelectorAll('.folder-picker-popover')].find((p) => !p.classList.contains('hidden'));
        const titles = [...pop.querySelectorAll('.folder-picker-row-title')].map((el) => el.textContent);
        return { count: titles.length, titles, picker: Boolean(document.getElementById('panel-folder-select').__folderPicker) };
    `);
    check('the add-bookmark modal uses the searchable picker', modal.picker === true, modal);
    const sorted = modal.titles.every((title, i) => i === 0
        || modal.titles[i - 1].localeCompare(title, undefined, { numeric: true, sensitivity: 'base' }) <= 0);
    check('modal folder lists are alphabetical', sorted === true, modal.titles);
    check('the modal shows nested folders too', modal.count >= 6, modal.count);

    // --- 5. Multi-select ---
    const multi = await evaluate(send, `
        const pop = () => [...document.querySelectorAll('.folder-picker-popover')].find((p) => !p.classList.contains('hidden'));
        const pick = (title) => [...pop().querySelectorAll('.folder-picker-row')]
            .find((r) => r.querySelector('.folder-picker-row-title').textContent === title);
        pick('Middle').click();
        await new Promise((r) => setTimeout(r, 30));
        pick('alpha').click();
        await new Promise((r) => setTimeout(r, 30));
        const values = document.getElementById('panel-folder-select').__folderPicker.getValues();
        const stillOpen = !pop().classList.contains('hidden');
        return { values, stillOpen };
    `);
    check('multi-select keeps the popover open', multi.stillOpen === true, multi);
    check('two folders can be selected at once', multi.values.length === 2, multi.values);

    // --- 6. Manual folder policy never writes to Chrome ---
    await navigate();
    const manualMoves = await evaluate(send, `
        window.__moveCalls.length = 0;
        await new Promise((r) => setTimeout(r, 300));
        return window.__moveCalls.filter((c) => c.index !== undefined).length;
    `);
    check('a manual folder policy never reorders Chrome', manualMoves === 0, manualMoves);

    // --- 7. Alphabetical folder policy sorts the real Chrome folder ---
    await seedSettings({
        sidebar: 'manual', root: 'manual', panels: {},
        folders: { A: 'alphabetical' }
    });
    await navigate();
    const chromeOrder = await evaluate(send, `
        const bar = window.__shim.find('1');
        const organizer = bar.children.find((c) => c.title === 'Organizer A');
        return {
            titles: organizer.children.map((c) => c.title),
            sortingMoves: window.__moveCalls.filter((c) => c.index !== undefined).length
        };
    `);
    check('the Organizer A folder is sorted in Chrome itself',
        JSON.stringify(chromeOrder.titles) === JSON.stringify(['Alpha panel', 'Zeta panel']), chromeOrder.titles);
    check('the sort is done by moving nodes into place', chromeOrder.sortingMoves > 0, chromeOrder.sortingMoves);

    // --- 8. Sorting is idempotent: a second pass does not move anything ---
    const secondPass = await evaluate(send, `
        window.__moveCalls.length = 0;
        window.ORDERING.applyChromeOrder({
            rootFolderId: '1', sidebarFolderId: '16',
            ordering: { sidebar: 'manual', root: 'manual', panels: {}, folders: { A: 'alphabetical' } }
        }, () => {});
        await new Promise((r) => setTimeout(r, 400));
        return window.__moveCalls.filter((c) => c.index !== undefined).length;
    `);
    check('re-applying an already sorted folder moves nothing', secondPass === 0, secondPass);

    // --- 9. Sidebar policy ---
    await seedSettings({
        sidebar: 'alphabetical', root: 'manual', panels: {}, folders: {}
    });
    await navigate();
    const sidebar = await evaluate(send, `
        const badge = document.getElementById('sidebar-order-badge');
        const items = [...document.querySelectorAll('#sidebar-bookmarks .bookmark-item')];
        return {
            badgeVisible: Boolean(badge) && !badge.hidden,
            draggable: items.map((i) => i.draggable),
            titles: items.map((i) => i.querySelector('a').textContent)
        };
    `);
    check('the sorted sidebar shows an A-Z badge', sidebar.badgeVisible === true, sidebar);
    check('sidebar links are not draggable while sorted',
        sidebar.draggable.length > 0 && sidebar.draggable.every((d) => d === false), sidebar.draggable);
    check('the sidebar list itself is sorted A-Z',
        JSON.stringify(sidebar.titles) === JSON.stringify(['alpha', 'zulu']), sidebar.titles);

    // --- 10. Ordering settings UI ---
    await navigate();
    const ui = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 220));
        const rows = document.querySelectorAll('#ordering-organizers .settings-ordering-grid-row');
        const first = rows[0];
        return {
            rows: rows.length,
            selects: first ? first.querySelectorAll('select').length : 0,
            sidebarOptions: [...document.querySelectorAll('#ordering-sidebar option')].map((o) => o.value)
        };
    `);
    check('the ordering card shows one row per organizer', ui.rows === 1, ui);
    check('each organizer row has a panels and a Chrome-folder policy', ui.selects === 2, ui);
    check('the sidebar policy is a two-way choice',
        JSON.stringify(ui.sidebarOptions) === JSON.stringify(['manual', 'alphabetical']), ui.sidebarOptions);

    const saved = await evaluate(send, `
        document.getElementById('ordering-sidebar').value = 'alphabetical';
        document.getElementById('save-settings-btn').click();
        await new Promise((r) => setTimeout(r, 350));
        const settings = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        return settings.ordering || {};
    `);
    check('the sidebar policy is saved', saved.sidebar === 'alphabetical', saved);

    // --- 11. Create-folder field inside the form ---
    await navigate();
    const created = await evaluate(send, `
        document.getElementById('add-bookmarks-panel-btn').click();
        await new Promise((r) => setTimeout(r, 220));
        document.getElementById('new-bookmark-folder-name').value = 'Nieuwe map';
        document.getElementById('create-new-bookmark-folder-btn').click();
        await new Promise((r) => setTimeout(r, 450));
        const all = [];
        const walk = (n) => { all.push(n); (n.children || []).forEach(walk); };
        walk(window.__shim.tree[0]);
        const panels = await new Promise((res) => chrome.storage.local.get('panelsState', (d) => res(d.panelsState || [])));
        return {
            created: all.some((n) => n.title === 'Nieuwe map'),
            panelTitles: panels.map((p) => p.title)
        };
    `);
    check('the create-folder field still works inside the form', created.created === true, created);
    check('the new folder becomes a panel', created.panelTitles.includes('Nieuwe map'), created.panelTitles);

    // --- 12. Saving an alphabetical policy applies it immediately ---
    await seedSettings({ sidebar: 'manual', root: 'manual', panels: {}, folders: {} });
    await navigate();
    await evaluate(send, `
        await new Promise((res) => chrome.bookmarks.create({ parentId: '15', title: 'Aardvark' }, res));
        return true;
    `);
    const afterSave = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 250));
        const row = document.querySelector('#ordering-organizers .settings-ordering-grid-row');
        row.querySelectorAll('select')[1].value = 'alphabetical';
        document.getElementById('save-settings-btn').click();
        await new Promise((r) => setTimeout(r, 700));
        const settings = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        return {
            titles: window.__shim.find('15').children.map((c) => c.title),
            folders: settings.ordering.folders
        };
    `);
    check('saving an alphabetical policy sorts Chrome immediately',
        JSON.stringify(afterSave.titles) === JSON.stringify(['Aardvark', 'Alpha panel', 'Zeta panel']), afterSave.titles);
    check('the folder policy is persisted', afterSave.folders.A === 'alphabetical', afterSave.folders);

    // --- 13. "Sort now" applies the on-screen policy without saving ---
    await seedSettings({ sidebar: 'manual', root: 'manual', panels: {}, folders: {} });
    await navigate();
    const sortedNow = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 250));
        const row = document.querySelector('#ordering-organizers .settings-ordering-grid-row');
        row.querySelectorAll('select')[1].value = 'alphabetical';
        document.getElementById('ordering-apply-btn').click();
        await new Promise((r) => setTimeout(r, 700));
        return {
            titles: window.__shim.find('15').children.map((c) => c.title),
            status: document.getElementById('ordering-status').textContent
        };
    `);
    check('"Sort now" sorts the Chrome folder', sortedNow.titles[0] === 'Alpha panel', sortedNow.titles);
    check('"Sort now" reports what it did', /Sorted 1 folder/.test(sortedNow.status), sortedNow.status);

    // --- 14. A folder created while the policy is active is sorted automatically ---
    await seedSettings({
        sidebar: 'manual', root: 'manual', panels: {},
        folders: { A: 'alphabetical' }
    });
    await navigate();
    await evaluate(send, `
        await new Promise((res) => chrome.bookmarks.create({ parentId: '15', title: 'Aardvark' }, res));
        await new Promise((r) => setTimeout(r, 1400));
        return true;
    `);
    const autoSorted = await evaluate(send, `
        return window.__shim.find('15').children.map((c) => c.title);
    `);
    check('a newly created folder is sorted automatically',
        JSON.stringify(autoSorted) === JSON.stringify(['Aardvark', 'Alpha panel', 'Zeta panel']), autoSorted);

    // --- 15. The two organizer-folder checkboxes stay in sync ---
    await evaluate(send, `
        const current = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        current.useOrganizerFolders = true;
        await new Promise((res) => chrome.storage.local.set({ settings: current }, res));
        window.alert = () => {};
        return true;
    `);
    await navigate();
    const sync1 = await evaluate(send, `
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 250));
        const settingsToggle = document.getElementById('use-organizer-folders-toggle').checked;
        document.getElementById('close-settings-btn').click();
        await new Promise((r) => setTimeout(r, 150));
        document.getElementById('add-bookmarks-panel-btn').click();
        await new Promise((r) => setTimeout(r, 300));
        const modalToggle = document.getElementById('modal-use-organizer-folders-toggle').checked;
        return { settingsToggle, modalToggle };
    `);
    check('the settings checkbox reflects the stored setting after a reload',
        sync1.settingsToggle === true, sync1);
    check('the modal checkbox mirrors the same setting', sync1.modalToggle === true, sync1);

    const sync2 = await evaluate(send, `
        window.alert = () => {};
        window.confirm = () => true;
        document.getElementById('modal-use-organizer-folders-toggle').click(); // off
        await new Promise((r) => setTimeout(r, 400));
        const settingsToggle = document.getElementById('use-organizer-folders-toggle').checked;
        document.querySelector('#add-bookmarks-panel-modal .cancel-btn').click();
        await new Promise((r) => setTimeout(r, 200));
        document.getElementById('settings-btn').click();
        await new Promise((r) => setTimeout(r, 250));
        const shownInSettings = document.getElementById('use-organizer-folders-toggle').checked;
        document.getElementById('save-settings-btn').click();
        await new Promise((r) => setTimeout(r, 500));
        const stored = await new Promise((res) => chrome.storage.local.get('settings', (d) => res(d.settings)));
        return { settingsToggle, shownInSettings, stored: stored.useOrganizerFolders };
    `);
    check('turning it off in the modal updates the settings checkbox',
        sync2.settingsToggle === false, sync2);
    check('the setting stays off after saving from the settings panel',
        sync2.stored === false, sync2);

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