import os, re

# HTML files
html_files = ["panelA.html", "panelB.html", "panelC.html", "panelD.html"]
html_sliders = """                <!-- Row 3: Width & Font Size Sliders -->
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                        <label for="sidebar-width-slider" style="margin:0; white-space: nowrap; font-size: 0.8rem;" data-i18n="label_sidebar_width">Sidebar:</label>
                        <input type="range" id="sidebar-width-slider" min="120" max="350" step="5" style="flex-grow: 1; cursor: pointer; min-width: 0;">
                        <span id="sidebar-width-value" style="min-width: 38px; text-align: right; font-size: 0.8rem; flex-shrink: 0;">142px</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; margin-left: 15px;">
                        <label for="bookmark-font-size-slider" style="margin:0; white-space: nowrap; font-size: 0.8rem;" data-i18n="label_bookmark_font_size">Text:</label>
                        <input type="range" id="bookmark-font-size-slider" min="10" max="20" step="1" style="flex-grow: 1; cursor: pointer; min-width: 0;">
                        <span id="bookmark-font-size-value" style="min-width: 32px; text-align: right; font-size: 0.8rem; flex-shrink: 0;">12px</span>
                    </div>
                </div>"""

for f in html_files:
    with open(f, "r") as file:
        content = file.read()
    if "sidebar-width-slider" not in content:
        pattern = r'(<input type="color" id="input-bg-color-picker"[^>]*>\s*</div>\s*</div>)'
        content = re.sub(pattern, r'\1\n' + html_sliders, content)
        with open(f, "w") as file:
            file.write(content)

# Update style.css
css_file = "css/style.css"
with open(css_file, "r") as f:
    css = f.read()

# Replace hardcoded font sizes with CSS variables in .card p, .bookmark-item .bookmark-link
css = css.replace("font-size: 12px;", "font-size: var(--bookmark-font-size, 12px);")

# Update .folder-item .folder-title which uses 13px probably?
css = re.sub(r'(\.folder-title\s*{[^}]*?)font-size:\s*13px;', r'\1font-size: var(--bookmark-font-size, 13px);', css)

with open(css_file, "w") as f:
    f.write(css)

# Update settings_logic.js
js_file = "js/settings_logic.js"
with open(js_file, "r") as f:
    js = f.read()

if "sidebarWidthSlider" not in js:
    js = js.replace(
        "const dateFontSizeSlider = document.getElementById('date-font-size-slider');",
        "const dateFontSizeSlider = document.getElementById('date-font-size-slider');\n    const sidebarWidthSlider = document.getElementById('sidebar-width-slider');\n    const sidebarWidthValue = document.getElementById('sidebar-width-value');\n    const bookmarkFontSizeSlider = document.getElementById('bookmark-font-size-slider');\n    const bookmarkFontSizeValue = document.getElementById('bookmark-font-size-value');"
    )
    
    js = js.replace(
        "        let valD = startupCheckD.checked;",
        "        let valD = startupCheckD.checked;\n        let sideWidth = sidebarWidthSlider ? parseInt(sidebarWidthSlider.value) : 142;\n        let markFont = bookmarkFontSizeSlider ? parseInt(bookmarkFontSizeSlider.value) : 12;"
    )
    
    js = js.replace(
        "            dateFontSize: `${dateFontSizeSlider.value}px`,",
        "            dateFontSize: `${dateFontSizeSlider.value}px`,\n            sidebarWidth: sideWidth,\n            bookmarkFontSize: `${markFont}px`,"
    )
    
    listeners = """
            if (sidebarWidthSlider) {
                sidebarWidthSlider.value = currentSettings.sidebarWidth || 142;
                sidebarWidthValue.textContent = (currentSettings.sidebarWidth || 142) + 'px';
            }
            if (bookmarkFontSizeSlider) {
                const bfSize = currentSettings.bookmarkFontSize ? parseInt(currentSettings.bookmarkFontSize) : 12;
                bookmarkFontSizeSlider.value = bfSize;
                bookmarkFontSizeValue.textContent = bfSize + 'px';
            }
"""
    js = js.replace(
        "            if (dateFontSizeSlider) {",
        listeners + "            if (dateFontSizeSlider) {"
    )
    
    event_listeners = """
    if (sidebarWidthSlider) {
        sidebarWidthSlider.addEventListener('input', (e) => {
            sidebarWidthValue.textContent = e.target.value + 'px';
            tempSettings.sidebarWidth = parseInt(e.target.value);
            if (window.updateSidebarWidthGlobally) window.updateSidebarWidthGlobally(parseInt(e.target.value));
        });
    }
    if (bookmarkFontSizeSlider) {
        bookmarkFontSizeSlider.addEventListener('input', (e) => {
            bookmarkFontSizeValue.textContent = e.target.value + 'px';
            tempSettings.bookmarkFontSize = e.target.value + 'px';
            document.documentElement.style.setProperty('--bookmark-font-size', e.target.value + 'px');
        });
    }
"""
    js = js.replace(
        "    if (useOrganizerFoldersToggle) {",
        event_listeners + "    if (useOrganizerFoldersToggle) {"
    )
    with open(js_file, "w") as f:
        f.write(js)

# Update app.js
app_file = "js/app.js"
with open(app_file, "r") as f:
    app_js = f.read()

if "window.updateSidebarWidthGlobally" not in app_js:
    inject_global = """
window.currentSidebarWidth = 142;
window.updateSidebarWidthGlobally = function(w) {
    window.currentSidebarWidth = w;
    if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
};
chrome.storage.local.get('settings', data => {
    if (data.settings) {
        if (data.settings.sidebarWidth) window.currentSidebarWidth = data.settings.sidebarWidth;
        if (data.settings.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', data.settings.bookmarkFontSize);
    }
});
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings && changes.settings.newValue) {
        window.currentSidebarWidth = changes.settings.newValue.sidebarWidth || 142;
        if (changes.settings.newValue.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', changes.settings.newValue.bookmarkFontSize);
        if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
    }
});
"""
    app_js = app_js.replace(
        "// Global settings for the date, defaults",
        inject_global + "\n// Global settings for the date, defaults"
    )
    
    app_js = app_js.replace(
        "const minSidebar = 142; // User set this manually",
        "const minSidebar = window.currentSidebarWidth || 142; // Configurable"
    )
    app_js = app_js.replace(
        "const maxSidebar = 225; // Soft target",
        "const maxSidebar = minSidebar + 83; // Soft target"
    )
    app_js = app_js.replace(
        "const absoluteMaxSidebar = 280; // Hard cap",
        "const absoluteMaxSidebar = minSidebar + 138; // Hard cap"
    )
    
    app_js = app_js.replace(
        "function adjustSidebarWidth() {",
        "window.adjustSidebarWidth = function() {"
    )
    app_js = app_js.replace(
        "        requestAnimationFrame(() => {",
        "        requestAnimationFrame(() => {\n            if (!window.adjustSidebarWidth) window.adjustSidebarWidth = window.adjustSidebarWidth || adjustSidebarWidth;"
    )

    with open(app_file, "w") as f:
        f.write(app_js)

print("Updates completed.")
