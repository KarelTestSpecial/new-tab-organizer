import os
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console messages and errors to help with debugging
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('panelA.html')

        # Mock the chrome extension APIs that are not available in a local file context
        await page.add_init_script("""
            window.chrome = {
                storage: {
                    local: {
                        get: (keys, callback) => {
                            let data = {};
                            const key = Array.isArray(keys) ? keys[0] : keys;
                            if (key === 'settings') {
                                data = { settings: {} };
                            } else if (key && key.startsWith('panelsState')) {
                                data[key] = [
                                    {
                                        id: 'panel-1',
                                        title: 'Test Panel',
                                        type: 'notes',
                                        cards: [
                                            { id: 'card-1', text: 'This is a test card to check hover effects.' }
                                        ]
                                    }
                                ];
                            }
                            if (callback) callback(data);
                        },
                        set: (data, callback) => { if (callback) callback(); }
                    }
                },
                bookmarks: {
                    onCreated: { addListener: () => {} },
                    onRemoved: { addListener: () => {} },
                    onChanged: { addListener: () => {} },
                    onMoved: { addListener: () => {} },
                    getSubTree: (id, callback) => { if (callback) callback([{id: '1', title: 'Bookmarks Bar', children: []}]); },
                    get: (id, callback) => { if (callback) callback([]); },
                    getChildren: (id, callback) => { if (callback) callback([]); },
                    getTree: (callback) => { if (callback) callback([{id: '1', title: 'Bookmarks Bar', children: []}]); },
                    removeTree: (id, callback) => { if(callback) callback(); },
                    update: (id, changes, callback) => { if(callback) callback(); }
                },
                runtime: { getURL: (path) => path, lastError: null },
                tabs: {
                    query: (query, callback) => { if (callback) callback([]); },
                    create: () => {},
                    reload: () => {},
                    update: () => {}
                }
            };
        """)

        # --- Test Light Theme ---
        await page.goto(f'file://{file_path}')
        await page.wait_for_selector('.panel')

        # Test Card Delete Button
        await page.hover('.card')
        await page.wait_for_selector('.card-delete-btn', state='visible')
        await page.hover('.card-delete-btn')
        await page.screenshot(path='tests/hover_card_delete_light.png')

        # Test Panel Delete Button
        await page.hover('.panel-header')
        await page.hover('.panel-delete-btn')
        await page.screenshot(path='tests/hover_panel_delete_light.png')

        # Test Add Card Button
        await page.hover('.add-card-btn')
        await page.screenshot(path='tests/hover_add_card_light.png')

        # --- Test Dark Theme ---
        await page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
        await page.wait_for_timeout(100) # Give styles a moment to apply

        # Test Card Delete Button (Dark)
        await page.hover('.card')
        await page.wait_for_selector('.card-delete-btn', state='visible')
        await page.hover('.card-delete-btn')
        await page.screenshot(path='tests/hover_card_delete_dark.png')

        # Test Panel Delete Button (Dark)
        await page.hover('.panel-header')
        await page.hover('.panel-delete-btn')
        await page.screenshot(path='tests/hover_panel_delete_dark.png')

        # Test Add Card Button (Dark)
        await page.hover('.add-card-btn')
        await page.screenshot(path='tests/hover_add_card_dark.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
