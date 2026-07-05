import re

html_files = ["panelA.html", "panelB.html", "panelC.html", "panelD.html"]

export_section_html = """
            <!-- Section: Backup & Restore Panels -->
            <div class="settings-section" style="margin-bottom: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                <div style="font-size: 0.8rem; margin-bottom: 8px;">
                    <strong style="color: var(--text-color);">Backup & Restore View</strong><br>
                    <span style="opacity: 0.7;">Sla op welke panelen en bladwijzermappen er in dit venster getoond worden, en hun exacte positie. Dit is een layout-backup, geen backup van de bladwijzers zelf.</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" id="export-data-btn" class="settings-btn-item" data-i18n="btn_export_data" style="font-size: 0.8rem; padding: 5px 10px;">Export Data</button>
                    <button type="button" id="import-data-btn" class="settings-btn-item" data-i18n="btn_import_data" style="font-size: 0.8rem; padding: 5px 10px;">Import Data</button>
                </div>
            </div>
"""

for f in html_files:
    with open(f, "r") as file:
        content = file.read()
    
    # 1. Replace Sidebar Slider with Header Font Size Slider
    content = content.replace('id="sidebar-width-slider"', 'id="header-font-size-slider" min="12" max="24" step="1"')
    content = content.replace('for="sidebar-width-slider"', 'for="header-font-size-slider"')
    content = content.replace('data-i18n="label_sidebar_width">Sidebar:</label>', 'data-i18n="label_header_font_size">Titles:</label>')
    content = content.replace('id="sidebar-width-value"', 'id="header-font-size-value"')
    
    # 2. Add sidebar-resizer
    if '<div id="sidebar-resizer"></div>' not in content:
        content = content.replace('</aside>', '</aside>\n        <div id="sidebar-resizer"></div>')
    
    # 3. Move Export/Import section
    # Extract existing Section 2
    pattern_section2 = r'\s*<!-- Section 2: Import/Export.*?</div>\s*</div>\s*</div>'
    content = re.sub(pattern_section2, '', content, flags=re.DOTALL)
    
    # Inject before settings-footer
    if "Backup & Restore View" not in content:
        content = content.replace('<div class="settings-footer"', export_section_html + '\n            <div class="settings-footer"')

    with open(f, "w") as file:
        file.write(content)

# Update style.css
css_file = "css/style.css"
with open(css_file, "r") as f:
    css = f.read()

if "#sidebar-resizer" not in css:
    resizer_css = """
#sidebar-resizer {
    width: 6px;
    background-color: transparent;
    cursor: col-resize;
    position: relative;
    z-index: 100;
    transition: background-color 0.2s;
    margin-left: -3px;
    margin-right: -3px;
}
#sidebar-resizer:hover, #sidebar-resizer.dragging {
    background-color: var(--accent-color, #007bff);
}
"""
    css += resizer_css

css = re.sub(r'(\.panel-header\s+h2\s*{[^}]*?)font-size:\s*15px;', r'\1font-size: var(--header-font-size, 15px);', css)

with open(css_file, "w") as f:
    f.write(css)

# Update settings_logic.js
js_file = "js/settings_logic.js"
with open(js_file, "r") as f:
    js = f.read()

js = js.replace('sidebarWidthSlider', 'headerFontSizeSlider')
js = js.replace('sidebarWidthValue', 'headerFontSizeValue')
js = js.replace('sidebarWidth', 'headerFontSize')
js = js.replace("tempSettings.headerFontSize = parseInt(e.target.value);", "tempSettings.headerFontSize = e.target.value + 'px';\ndocument.documentElement.style.setProperty('--header-font-size', e.target.value + 'px');")
js = js.replace("headerFontSizeValue.textContent = (currentSettings.headerFontSize || 142) + 'px';", "const hfSize = currentSettings.headerFontSize ? parseInt(currentSettings.headerFontSize) : 15;\n                headerFontSizeSlider.value = hfSize;\n                headerFontSizeValue.textContent = hfSize + 'px';")
js = js.replace("if (window.updateSidebarWidthGlobally) window.updateSidebarWidthGlobally(parseInt(e.target.value));", "")

with open(js_file, "w") as f:
    f.write(js)

# Update app.js for resizer logic
app_file = "js/app.js"
with open(app_file, "r") as f:
    app_js = f.read()

app_js = app_js.replace("if (data.settings.sidebarWidth) window.currentSidebarWidth = data.settings.sidebarWidth;", "")
app_js = app_js.replace("window.currentSidebarWidth = changes.settings.newValue.sidebarWidth || 142;", "")
app_js = app_js.replace("if (data.settings.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', data.settings.bookmarkFontSize);", "if (data.settings.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', data.settings.bookmarkFontSize);\n        if (data.settings.headerFontSize) document.documentElement.style.setProperty('--header-font-size', data.settings.headerFontSize);")
app_js = app_js.replace("if (changes.settings.newValue.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', changes.settings.newValue.bookmarkFontSize);", "if (changes.settings.newValue.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', changes.settings.newValue.bookmarkFontSize);\n        if (changes.settings.newValue.headerFontSize) document.documentElement.style.setProperty('--header-font-size', changes.settings.newValue.headerFontSize);")

if "sidebar-resizer" not in app_js:
    resizer_logic = """
    // --- Draggable Sidebar Resizer ---
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    if (resizer && sidebar) {
        chrome.storage.local.get('sidebarWidth', (data) => {
            if (data.sidebarWidth) {
                window.currentSidebarWidth = data.sidebarWidth;
                sidebar.style.width = `${data.sidebarWidth}px`;
                sidebar.style.minWidth = `${data.sidebarWidth}px`;
                sidebar.style.flexBasis = `${data.sidebarWidth}px`;
                if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
            }
        });

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 120) newWidth = 120;
            if (newWidth > window.innerWidth / 2) newWidth = window.innerWidth / 2;
            
            sidebar.style.width = `${newWidth}px`;
            sidebar.style.minWidth = `${newWidth}px`;
            sidebar.style.flexBasis = `${newWidth}px`;
            window.currentSidebarWidth = newWidth;
            if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                chrome.storage.local.set({ sidebarWidth: window.currentSidebarWidth });
            }
        });
    }
"""
    app_js = app_js.replace("window.adjustSidebarWidth = function() {", resizer_logic + "\n    window.adjustSidebarWidth = function() {")

with open(app_file, "w") as f:
    f.write(app_js)

print("UI Updates completed.")
