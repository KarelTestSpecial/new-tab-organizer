import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8765;
const CDP_PORT = 9335;
const PROFILE = join(tmpdir(), 'nto-profile-shim');

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

// The shim runs in every page, but the data must survive navigation just like
// real chrome.storage.local does, so it is kept in sessionStorage.
const SHIM = `
(() => {
    const store = (() => {
        try {
            const raw = sessionStorage.getItem('__shim_store');
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {};
    })();
    const persist = () => {
        try { sessionStorage.setItem('__shim_store', JSON.stringify(store)); } catch (e) { /* ignore */ }
    };
    const clone = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v));
    const local = {
        get(keys, cb) {
            const out = {};
            const add = (k) => { if (k in store) out[k] = clone(store[k]); };
            if (keys === null || keys === undefined) Object.keys(store).forEach(add);
            else if (typeof keys === 'string') add(keys);
            else if (Array.isArray(keys)) keys.forEach(add);
            else if (typeof keys === 'object') Object.keys(keys).forEach((k) => {
                if (k in store) out[k] = clone(store[k]);
                else out[k] = keys[k];
            });
            setTimeout(() => cb && cb(out), 0);
        },
        set(obj, cb) { Object.keys(obj).forEach((k) => { store[k] = clone(obj[k]); }); persist(); setTimeout(() => cb && cb(), 0); },
        remove(keys, cb) {
            const list = Array.isArray(keys) ? keys : [keys];
            list.forEach((k) => delete store[k]);
            persist();
            setTimeout(() => cb && cb(), 0);
        },
        clear(cb) { Object.keys(store).forEach((k) => delete store[k]); persist(); setTimeout(() => cb && cb(), 0); }
    };

    const tree = [{
        id: '0', title: '', children: [{
            id: '1', title: 'Bookmark bar', children: [
                { id: '10', parentId: '1', title: 'Example Site', url: 'https://example.com/' },
                { id: '11', parentId: '1', title: 'Docs Guide', url: 'https://docs.example.com/guide' },
                { id: '12', parentId: '1', title: 'Sub folder', children: [
                    { id: '13', parentId: '12', title: 'Nested', url: 'https://nested.example.com/' }
                ] }
            ]
        }]
    }];
    const flatten = (nodes, out) => { nodes.forEach((n) => { out.push(n); if (n.children) flatten(n.children, out); }); return out; };
    const allNodes = () => flatten(clone(tree), []);

    // A page reload creates a new JS context, so tab creation is counted in
    // sessionStorage to survive the reload the startup redirect performs.
    window.__createdTabs = [];
    try {
        const raw = sessionStorage.getItem('__shim_tabs');
        if (raw) window.__createdTabs = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    window.chrome = {
        runtime: {
            id: 'test-extension',
            lastError: undefined,
            getURL: (p) => location.origin + '/' + p,
            getManifest: () => ({ manifest_version: 3 }),
            onMessage: { addListener() {} },
            onInstalled: { addListener() {} }
        },
        storage: { local, onChanged: { addListener() {} } },
        bookmarks: {
            getTree(cb) { setTimeout(() => cb(clone(tree)), 0); },
            getChildren(id, cb) {
                const node = allNodes().find((n) => n.id === id);
                setTimeout(() => cb(node && node.children ? clone(node.children) : []), 0);
            },
            getSubTree(id, cb) {
                const node = allNodes().find((n) => n.id === id);
                setTimeout(() => cb(node ? [clone(node)] : []), 0);
            },
            get(ids, cb) {
                const list = Array.isArray(ids) ? ids : [ids];
                const found = allNodes().filter((n) => list.includes(n.id));
                setTimeout(() => cb(found), 0);
            },
            search(query, cb) { setTimeout(() => cb([]), 0); },
            create(obj, cb) { setTimeout(() => cb && cb({ id: '99', title: obj.title, url: obj.url }), 0); },
            update(id, changes, cb) { setTimeout(() => cb && cb({ id }), 0); },
            move(id, dest, cb) { setTimeout(() => cb && cb({ id }), 0); },
            remove(id, cb) { setTimeout(() => cb && cb(), 0); },
            removeTree(id, cb) { setTimeout(() => cb && cb(), 0); },
            onCreated: { addListener() {} },
            onRemoved: { addListener() {} },
            onChanged: { addListener() {} },
            onMoved: { addListener() {} },
            onChildrenReordered: { addListener() {} },
            onImportEnded: { addListener() {} }
        },
        tabs: {
            create(opts, cb) {
                window.__createdTabs.push(opts && opts.url);
                try { sessionStorage.setItem('__shim_tabs', JSON.stringify(window.__createdTabs)); } catch (e) { /* ignore */ }
                setTimeout(() => cb && cb({ id: window.__createdTabs.length }), 0);
            },
            query(q, cb) { setTimeout(() => cb([]), 0); },
            update(id, opts, cb) { setTimeout(() => cb && cb(), 0); },
            reload(id, cb) { setTimeout(() => cb && cb(), 0); }
        },
        i18n: { getMessage: () => '', getUILanguage: () => 'en-US' },
        windows: {
            update(id, info, cb) { setTimeout(() => cb && cb({ id }), 0); },
            getCurrent(cb) { setTimeout(() => cb && cb({ id: 1 }), 0); },
            get(id, cb) { setTimeout(() => cb && cb({ id }), 0); },
            getAll(cb) { setTimeout(() => cb && cb([{ id: 1 }]), 0); },
            create(obj, cb) { setTimeout(() => cb && cb({ id: 1 }), 0); }
        },
        runtimeId: 'test-extension'
    };

    // Any chrome API this page calls that the shim does not implement must still
    // exist, otherwise a DOMContentLoaded handler throws halfway through and the
    // rest of the initialization silently never runs.
    const asNoop = (prop) => {
        if (prop === 'then') return undefined;
        return (...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') setTimeout(() => cb({}), 0);
            return undefined;
        };
    };
    const wrap = (value) => {
        if (value === null || value === undefined) return value;
        if (typeof value === 'function') return value;
        if (typeof value !== 'object') return value;
        return new Proxy(value, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return asNoop(prop);
            }
        });
    };
    window.chrome = new Proxy(window.chrome, {
        get(target, prop) {
            if (prop in target) return wrap(target[prop]);
            return asNoop(prop);
        }
    });

    // First run only: seed a bookmark panel so the organizer has a drag source.
    // On later loads the sessionStorage store must win, otherwise every reload
    // would reset settings and wipe whatever the test just stored.
    if (!sessionStorage.getItem('__shim_store')) {
        store.panelsState = [{ id: 'panel-1', title: 'Bookmark bar', type: 'bookmarks', folderId: '1', bookmarkOrder: [] }];
        store.settings = { theme: 'light' };
        persist();
    }
})();
`;

try {
    let version;
    for (let i = 0; i < 40; i++) {
        try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; }
        catch { await sleep(250); }
    }
    if (!version) throw new Error('chrome did not start');

    const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${HTTP_PORT}/panel.html?view=A`, { method: 'PUT' })).json();
    const { ws, send } = await connect(target.webSocketDebuggerUrl);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A` });
    await sleep(1500);

    const boot = await evaluate(send, `
        return {
            href: location.href,
            hasModal: !!document.getElementById('open-links-modal'),
            hasButton: !!document.getElementById('open-links-btn'),
            modalHidden: document.getElementById('open-links-modal').classList.contains('hidden'),
            panelBookmarks: document.querySelectorAll('#panels-container .bookmark-item').length,
            errors: window.__pageErrors || []
        };
    `);
    check('page loads with extension scripts', boot.hasModal && boot.hasButton, boot);
    check('modal starts hidden', boot.modalHidden === true);
    check('bookmark panel rendered for drag source', boot.panelBookmarks === 2, boot.panelBookmarks);

    // --- Drag source: the bookmark item must expose its bookmark id ---
    const dragSource = await evaluate(send, `
        const item = document.querySelector('#panels-container .bookmark-item');
        const dt = new DataTransfer();
        const event = new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true });
        item.dispatchEvent(event);
        return { id: item.dataset.id, transferred: dt.getData('text/plain'), types: [...dt.types] };
    `);
    check('dragstart exposes the bookmark id', dragSource.transferred === dragSource.id, dragSource);

    // --- Open modal ---
    const opened = await evaluate(send, `
        document.getElementById('open-links-btn').click();
        await new Promise(r => setTimeout(r, 150));
        const modal = document.getElementById('open-links-modal');
        return {
            visible: !modal.classList.contains('hidden'),
            listsVisible: !modal.querySelector('[data-view="lists"]').classList.contains('hidden'),
            emptyShown: !document.getElementById('open-links-empty').classList.contains('hidden'),
            title: modal.querySelector('h2').textContent.trim()
        };
    `);
    check('button opens the modal', opened.visible === true);
    check('lists tab is the default view', opened.listsVisible === true);
    check('empty state shown without lists', opened.emptyShown === true);
    check('modal title is filled in', opened.title.length > 0 && opened.title !== 'open_links_title', opened.title);

    // --- Build view ---
    const buildView = await evaluate(send, `
        document.getElementById('open-links-new-btn').click();
        await new Promise(r => setTimeout(r, 60));
        const modal = document.getElementById('open-links-modal');
        return {
            buildVisible: !modal.querySelector('[data-view="build"]').classList.contains('hidden'),
            listsHidden: modal.querySelector('[data-view="lists"]').classList.contains('hidden'),
            focused: document.activeElement && document.activeElement.id
        };
    `);
    check('"new list" switches to the build tab', buildView.buildVisible && buildView.listsHidden, buildView);
    check('name input gets focus', buildView.focused === 'open-links-name-input', buildView.focused);

    // Regression: the browser silently refuses a drop when the dropzone asks for
    // an effect the drag source never allowed, and never fires `drop`. Dispatching
    // a drop event by hand hides that completely, so the two sides of the
    // handshake are recorded by wrapping the DataTransfer accessors.
    const handshake = await evaluate(send, `
        const recorded = { allowed: null, requested: null };
        const proto = Object.getPrototypeOf(new DataTransfer());
        const descAllowed = Object.getOwnPropertyDescriptor(proto, 'effectAllowed');
        const descDrop = Object.getOwnPropertyDescriptor(proto, 'dropEffect');
        Object.defineProperty(proto, 'effectAllowed', {
            configurable: true,
            get: descAllowed.get,
            set(value) { recorded.allowed = value; return descAllowed.set.call(this, value); }
        });
        Object.defineProperty(proto, 'dropEffect', {
            configurable: true,
            get: descDrop.get,
            set(value) { recorded.requested = value; return descDrop.set.call(this, value); }
        });

        const item = document.querySelector('#panels-container .bookmark-item');
        const dt = new DataTransfer();
        item.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));

        const zone = document.getElementById('open-links-dropzone');
        zone.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));

        delete proto.effectAllowed;
        delete proto.dropEffect;
        return recorded;
    `);
    const allowedList = String(handshake.allowed || '').split(',').map(v => v.trim());
    const arms = allowedList.length > 0 && allowedList[0] !== '';
    check('drag source declares what it allows', arms === true, handshake);
    check('dropzone requests an effect the source allows',
        arms && (allowedList.includes('all') || allowedList.includes(handshake.requested)),
        handshake);

    // --- Drop the dragged bookmark into the dropzone ---
    const drop = await evaluate(send, `
        const item = document.querySelector('#panels-container .bookmark-item');
        const sourceDt = new DataTransfer();
        item.dispatchEvent(new DragEvent('dragstart', { dataTransfer: sourceDt, bubbles: true, cancelable: true }));
        const zone = document.getElementById('open-links-dropzone');
        zone.dispatchEvent(new DragEvent('drop', { dataTransfer: sourceDt, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 250));
        const rows = [...document.querySelectorAll('#open-links-items .open-links-item')];
        return {
            count: rows.length,
            title: rows[0] && rows[0].querySelector('.open-links-item-title').textContent,
            url: rows[0] && rows[0].querySelector('.open-links-item-url').textContent,
            countLabel: document.getElementById('open-links-count').textContent
        };
    `);
    check('dropping a panel bookmark adds an item', drop.count === 1, drop);
    check('item keeps the bookmark title', drop.title === 'Example Site', drop.title);
    check('item keeps the bookmark url', drop.url === 'https://example.com/', drop.url);
    check('counter shows one link', drop.countLabel.includes('1'), drop.countLabel);

    // --- Dropzone visual feedback ---
    const feedback = await evaluate(send, `
        const zone = document.getElementById('open-links-dropzone');
        zone.dispatchEvent(new DragEvent('dragover', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true }));
        const active = zone.classList.contains('drag-over');
        zone.dispatchEvent(new DragEvent('dragleave', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true }));
        return { active, cleared: !zone.classList.contains('drag-over') };
    `);
    check('dragover highlights the dropzone', feedback.active === true, feedback);
    check('dragleave clears the highlight', feedback.cleared === true, feedback);

    // --- Duplicate guard ---
    const duplicate = await evaluate(send, `
        const dt = new DataTransfer();
        dt.setData('text/plain', 'https://example.com/');
        document.getElementById('open-links-dropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 200));
        const toast = document.getElementById('open-links-toast');
        return {
            count: document.querySelectorAll('#open-links-items .open-links-item').length,
            toast: toast.textContent,
            visible: toast.classList.contains('visible')
        };
    `);
    check('duplicate link is not added', duplicate.count === 1, duplicate);
    check('duplicate shows a toast', duplicate.visible && duplicate.toast.length > 0, duplicate);

    // --- Drop a bare URL (dragging the <a> itself) ---
    const urlDrop = await evaluate(send, `
        const dt = new DataTransfer();
        dt.setData('text/plain', 'www.example.org/page');
        document.getElementById('open-links-dropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 150));
        const rows = [...document.querySelectorAll('#open-links-items .open-links-item')];
        return {
            count: rows.length,
            url: rows[1] && rows[1].querySelector('.open-links-item-url').textContent,
            title: rows[1] && rows[1].querySelector('.open-links-item-title').textContent
        };
    `);
    check('bare url drop is accepted', urlDrop.count === 2, urlDrop);
    check('bare url is normalised', urlDrop.url === 'https://www.example.org/page', urlDrop.url);
    check('bare url gets a fallback title', urlDrop.title === 'example.org', urlDrop.title);

    // --- Save ---
    const saved = await evaluate(send, `
        document.getElementById('open-links-name-input').value = 'Testlijst';
        document.getElementById('open-links-save-btn').click();
        await new Promise(r => setTimeout(r, 300));
        const stored = (await new Promise(r => chrome.storage.local.get('linkLists', d => r(d.linkLists)))) || [];
        const modal = document.getElementById('open-links-modal');
        return {
            stored: stored.length,
            name: stored[0] && stored[0].name,
            items: stored[0] && stored[0].items.length,
            listsVisible: !modal.querySelector('[data-view="lists"]').classList.contains('hidden'),
            rows: document.querySelectorAll('.open-links-list-row').length,
            emptyHidden: document.getElementById('open-links-empty').classList.contains('hidden')
        };
    `);
    check('list is persisted to storage', saved.stored === 1 && saved.name === 'Testlijst', saved);
    check('persisted list keeps both items', saved.items === 2, saved.items);
    check('returns to the lists tab after saving', saved.listsVisible && saved.rows === 1, saved);
    check('empty state hidden once a list exists', saved.emptyHidden === true);

    // --- Open all links ---
    const openAll = await evaluate(send, `
        window.__createdTabs = [];
        document.querySelector('.open-links-list-open').click();
        await new Promise(r => setTimeout(r, 200));
        const toast = document.getElementById('open-links-toast');
        return {
            tabs: window.__createdTabs,
            toast: toast.textContent,
            visible: toast.classList.contains('visible')
        };
    `);
    check('clicking a list name opens every link', Array.isArray(openAll.tabs) && openAll.tabs.length === 2, openAll.tabs);
    check('opened links are the stored urls', openAll.tabs.includes('https://example.com/') && openAll.tabs.includes('https://www.example.org/page'), openAll.tabs);
    check('opening reports the tab count', openAll.visible && /2/.test(openAll.toast), openAll);

    // --- Edit ---
    const edit = await evaluate(send, `
        document.querySelector('.open-links-list-actions .open-links-icon-btn').click();
        await new Promise(r => setTimeout(r, 60));
        const modal = document.getElementById('open-links-modal');
        return {
            buildVisible: !modal.querySelector('[data-view="build"]').classList.contains('hidden'),
            name: document.getElementById('open-links-name-input').value,
            items: document.querySelectorAll('#open-links-items .open-links-item').length
        };
    `);
    check('edit prefills name and items', edit.buildVisible && edit.name === 'Testlijst' && edit.items === 2, edit);

    // --- Remove item ---
    const removed = await evaluate(send, `
        document.querySelector('#open-links-items .open-links-item-remove').click();
        await new Promise(r => setTimeout(r, 60));
        return {
            items: document.querySelectorAll('#open-links-items .open-links-item').length,
            countLabel: document.getElementById('open-links-count').textContent
        };
    `);
    check('remove drops exactly one item', removed.items === 1, removed);
    check('counter follows the removal', removed.countLabel.includes('1'), removed.countLabel);

    // --- Validation: empty name ---
    const noName = await evaluate(send, `
        document.getElementById('open-links-name-input').value = '   ';
        document.getElementById('open-links-save-btn').click();
        await new Promise(r => setTimeout(r, 60));
        return document.getElementById('open-links-toast').textContent;
    `);
    check('saving without a name is refused', noName.length > 0, noName);

    // --- Validation: no items ---
    const noItems = await evaluate(send, `
        document.getElementById('open-links-name-input').value = 'Leeg';
        document.querySelector('#open-links-items .open-links-item-remove').click();
        document.getElementById('open-links-save-btn').click();
        await new Promise(r => setTimeout(r, 60));
        const stored = (await new Promise(r => chrome.storage.local.get('linkLists', d => r(d.linkLists)))) || [];
        return { toast: document.getElementById('open-links-toast').textContent, stored: stored.length };
    `);
    check('saving an empty list is refused', noItems.stored === 1, noItems);

    // --- Reorder with internal drag ---
    const reorder = await evaluate(send, `
        document.getElementById('open-links-new-btn').click();
        await new Promise(r => setTimeout(r, 50));
        document.getElementById('open-links-name-input').value = 'Volgorde';
        const zone = document.getElementById('open-links-dropzone');
        const add = (title, url) => {
            const dt = new DataTransfer();
            dt.setData('text/plain', url);
            zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        };
        add('A', 'https://a.example/');
        await new Promise(r => setTimeout(r, 60));
        add('B', 'https://b.example/');
        await new Promise(r => setTimeout(r, 60));
        add('C', 'https://c.example/');
        await new Promise(r => setTimeout(r, 60));
        const items = [...document.querySelectorAll('#open-links-items .open-links-item')];
        const firstUrl = items[0].querySelector('.open-links-item-url').textContent;
        items[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 20));
        const last = items[items.length - 1].getBoundingClientRect();
        zone.dispatchEvent(new DragEvent('drop', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true, clientY: last.bottom + 10 }));
        await new Promise(r => setTimeout(r, 60));
        const after = [...document.querySelectorAll('#open-links-items .open-links-item')];
        return {
            count: after.length,
            lastUrl: after[after.length - 1].querySelector('.open-links-item-url').textContent,
            firstUrl
        };
    `);
    check('internal drag moves the item to the end',
        reorder.count === 3 && reorder.lastUrl === reorder.firstUrl,
        reorder);

    // --- Delete ---
    const deleted = await evaluate(send, `
        window.confirm = () => true;
        const modal = document.getElementById('open-links-modal');
        modal.querySelectorAll('.open-links-view').forEach(s => s.classList.toggle('hidden', s.dataset.view !== 'lists'));
        document.querySelector('.open-links-list-actions .open-links-icon-btn:last-child').click();
        await new Promise(r => setTimeout(r, 300));
        const stored = (await new Promise(r => chrome.storage.local.get('linkLists', d => r(d.linkLists)))) || [];
        return { stored: stored.length, rows: document.querySelectorAll('.open-links-list-row').length };
    `);
    check('delete removes the list from storage', deleted.stored === 0 && deleted.rows === 0, deleted);

    // --- Close ---
    const closed = await evaluate(send, `
        document.querySelector('#open-links-modal .modal-close-btn').click();
        await new Promise(r => setTimeout(r, 60));
        return document.getElementById('open-links-modal').classList.contains('hidden');
    `);
    check('X closes the modal', closed === true);

    // --- Drop guard ---
    const guard = await evaluate(send, `
        document.getElementById('open-links-btn').click();
        await new Promise(r => setTimeout(r, 150));
        const dt = new DataTransfer();
        dt.setData('text/plain', 'https://evil.example/');
        const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
        document.getElementById('main-content').dispatchEvent(event);
        return { prevented: event.defaultPrevented, href: location.href };
    `);
    check('drop outside the dropzone is cancelled (no page navigation)', guard.prevented === true, guard);

    ws.close();
} catch (error) {
    failures++;
    console.error('ERROR', error.message);
} finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
