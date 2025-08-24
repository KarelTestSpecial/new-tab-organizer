import os
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console messages to see what's happening
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('startpage.html')
        page.goto(f'file://{file_path}')

        # Wait for the initial panel to load
        expect(page.locator('.panel')).to_have_count(1)
        expect(page.locator('.panel h3')).to_have_text("To-Do List")

        # Click the button to add a new notes panel
        page.locator("#add-notes-panel-btn").click()

        # Because chrome.storage is unavailable, the fallback should append the panel.
        # We expect to see two panels now.
        expect(page.locator('.panel')).to_have_count(2)

        # The last panel should be the new one.
        last_panel_heading = page.locator('.panel:last-child h3')
        expect(last_panel_heading).to_have_text("New Notes")

        # Take screenshot for verification
        screenshot_path = "jules-scratch/verification/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run_verification()
