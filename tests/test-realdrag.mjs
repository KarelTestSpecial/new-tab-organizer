// Real drag & drop test: drives actual mouse input through CDP so the browser
// performs its own effectAllowed/dropEffect negotiation. Synthetic DragEvents
// cannot catch that class of bug.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXT_DIR = fileURLToPath(new URL('../new-tab-organizer', import.meta.url));
const HTTP_PORT = 8791;
const CDP_PORT = 9361;
const PROFILE = join(tmpdir(), 'nto-profile-realdrag');

const testSource = readFileSync(fileURLToPath(new URL('./test-link-lists.mjs', import.meta.url)), 'utf8');
const SHIM = testSource.slice(
    testSource.indexOf('const SHIM = `') + 'const SHIM = `'.length,
    testSource.indexOf('`;\n\ntry {')
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
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/panel.html?view=A` });
    await sleep(1800);

    // Open the modal and the build tab, and report the geometry of both ends.
    await evaluate(send, `
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        document.getElementById('open-links-btn').click();
        await new Promise(r => setTimeout(r, 200));
        document.getElementById('open-links-new-btn').click();
        await new Promise(r => setTimeout(r, 120));
        return true;
    `);

    const geo = await evaluate(send, `
        const item = document.querySelector('#panels-container .bookmark-item');
        const link = item && item.querySelector('a');
        const zone = document.getElementById('open-links-dropzone');
        const r = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
                     cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2) };
        };
        return {
            item: r(item), link: r(link), zone: r(zone),
            itemDraggable: item ? item.draggable : null,
            linkTag: link ? link.tagName : null,
            linkDraggable: link ? link.draggable : null,
            zoneTopEl: zone ? (document.elementFromPoint(r(zone).cx, r(zone).cy) || {}).id : null
        };
    `);
    console.log('geometry:', geo);

    const src = geo.item;
    const dst = geo.zone;
    if (!src || !dst) throw new Error('drag source or dropzone not found');

    // Real mouse drag: press on the bookmark, move in steps, release on the zone.
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: src.cx, y: src.cy, button: 'none' });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: src.cx, y: src.cy, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
    for (let step = 1; step <= 12; step++) {
        const x = src.cx + ((dst.cx - src.cx) * step) / 12;
        const y = src.cy + ((dst.cy - src.cy) * step) / 12;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        await sleep(30);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dst.cx, y: dst.cy, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(500);

    const result = await evaluate(send, `
        const rows = [...document.querySelectorAll('#open-links-items .open-links-item')];
        return {
            count: rows.length,
            title: rows[0] && rows[0].querySelector('.open-links-item-title').textContent,
            url: rows[0] && rows[0].querySelector('.open-links-item-url').textContent
        };
    `);
    check('a real mouse drag adds the bookmark to the list', result.count === 1, result);
    check('the dragged bookmark keeps its url', result.url === 'https://example.com/', result);

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