import os
import re
from playwright.sync_api import sync_playwright, expect

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Mock Chrome API
        page.add_init_script("""
            window.chrome = {
                storage: {
                    local: {
                        get: (keys, callback) => {
                            let data = {};
                            const keyList = Array.isArray(keys) ? keys : [keys];

                            keyList.forEach(k => {
                                if (k === 'settings') {
                                    data.settings = {};
                                } else if (k && k.startsWith('panelsState')) {
                                    // Inject a test panel so we can right-click it
                                    data[k] = [
                                        {
                                            id: 'test-panel',
                                            title: 'Test Panel',
                                            type: 'notes',
                                            cards: []
                                        }
                                    ];
                                }
                            });

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
                    create: (obj) => { console.log('chrome.tabs.create', obj); },
                    reload: () => {},
                    update: () => {},
                    onUpdated: { addListener: () => {} },
                    onActivated: { addListener: () => {} },
                },
                windows: {
                    update: () => {}
                }
            };
        """)

        # Load Panel A
        file_path = os.path.abspath('panelA.html')
        file_url = f'file://{file_path}'

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # Wait for the panel to be loaded
        panel = page.locator('.panel').first
        expect(panel).to_be_visible()

        # Right click the header (specifically the drag handle area)
        header = panel.locator('.panel-header')
        header.click(button='right')

        # Verify Context Menu
        context_menu = page.locator('#panel-context-menu')
        expect(context_menu).to_be_visible()

        # Verify "Move to Organizer D"
        move_option_d = context_menu.get_by_text("Move to Organizer D")
        expect(move_option_d).to_be_visible()
        print("Verified: 'Move to Organizer D' option exists in context menu.")

        # Verify "Move to Organizer B" and "C" are also there
        expect(context_menu.get_by_text("Move to Organizer B")).to_be_visible()
        expect(context_menu.get_by_text("Move to Organizer C")).to_be_visible()

        # Verify "Move to Organizer A" is NOT there (since we are on A)
        expect(context_menu.get_by_text("Move to Organizer A")).not_to_be_visible()

        # Screenshot
        page.screenshot(path='verification/context_menu_verified.png')
        print("Screenshot saved to verification/context_menu_verified.png")

        browser.close()

if __name__ == '__main__':
    main()
