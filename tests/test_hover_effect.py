import os
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console messages and errors
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('panelA.html')

        # Navigate to the local HTML file
        await page.goto(f'file://{file_path}')

        # Mock the chrome extension APIs that are not available in a local file context
        await page.add_init_script("""
            window.chrome = {
                storage: {
                    local: {
                        get: (keys, callback) => {
                            console.log('chrome.storage.local.get called with:', keys);
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
                                            { id: 'card-1', text: 'This is a test card to check the hover effect on the delete button.' }
                                        ]
                                    }
                                ];
                            }

                            if (callback) {
                                console.log('Calling storage.local.get callback with:', data);
                                callback(data);
                            }
                        },
                        set: (data, callback) => {
                            console.log('chrome.storage.local.set called');
                            if (callback) {
                                callback();
                            }
                        }
                    }
                },
                bookmarks: {
                    onCreated: { addListener: () => {} },
                    onRemoved: { addListener: () => {} },
                    onChanged: { addListener: () => {} },
                    onMoved: { addListener: () => {} },
                    getSubTree: (id, callback) => {
                        if (callback) callback([{id: '1', title: 'Bookmarks Bar', children: []}]);
                    },
                    get: (id, callback) => {
                        if (callback) callback([]);
                    },
                    getChildren: (id, callback) => {
                        if(callback) callback([]);
                    },
                    getTree: (callback) => {
                        if(callback) callback([{id: '1', title: 'Bookmarks Bar', children: []}]);
                    },
                    removeTree: (id, callback) => { if(callback) callback(); },
                    update: (id, changes, callback) => { if(callback) callback(); }
                },
                runtime: {
                    getURL: (path) => path,
                    lastError: null
                },
                tabs: {
                    query: (query, callback) => {
                        if (callback) callback([]);
                    },
                    create: (options) => {},
                    reload: (tabId) => {},
                    update: (tabId, options) => {}
                }
            };
        """)

        # Reload the page for the mock to take effect
        await page.reload()

        # Wait for the panel and card to be rendered
        await page.wait_for_selector('.panel', timeout=5000)
        await page.wait_for_selector('.card')

        # Hover over the card to reveal the delete button
        await page.hover('.card')

        # Wait for the delete button to be visible
        await page.wait_for_selector('.card-delete-btn', state='visible')

        # Hover over the delete button
        await page.hover('.card-delete-btn')

        # Take a screenshot
        await page.screenshot(path='tests/delete_button_hover.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
