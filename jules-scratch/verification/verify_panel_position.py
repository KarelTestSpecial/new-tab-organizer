import os
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('startpage.html')
        page.goto(f'file://{file_path}')

        # --- Test 1: Add panel to start ---

        # 1. Open settings and change position to "start"
        page.get_by_role("button", name="Settings").click()
        page.get_by_label("Add new panels to the:").select_option("start")
        page.get_by_role("button", name="Save and Close").click()

        # 2. Add a new panel
        page.locator("#add-notes-panel-btn").click()

        # 3. Assert the new panel is the first one
        # The default "To-Do List" should now be the second panel
        first_panel_heading = page.locator('.panel:first-child h3')
        expect(first_panel_heading).to_have_text("New Notes")

        # --- Test 2: Add panel to end ---

        # 4. Open settings and change position back to "end"
        page.get_by_role("button", name="Settings").click()
        page.get_by_label("Add new panels to the:").select_option("end")
        page.get_by_role("button", name="Save and Close").click()

        # 5. Add another new panel
        page.locator("#add-notes-panel-btn").click()

        # 6. Assert the second new panel is at the end
        # There should be three panels now: New Notes, To-Do List, New Notes
        last_panel_heading = page.locator('.panel:last-child h3')
        expect(last_panel_heading).to_have_text("New Notes")

        # 7. Take screenshot for final verification
        screenshot_path = "jules-scratch/verification/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run_verification()
