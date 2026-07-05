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

old_export_section_regex = r'\s*<!-- Section 2: Import/Export.*?<button type="button" id="import-data-btn".*?</button>\s*</div>\s*</div>'

for f in html_files:
    with open(f, "r") as file:
        content = file.read()
    
    # Replace slider
    content = content.replace('id="sidebar-width-slider" min="120" max="350" step="5"', 'id="header-font-size-slider" min="12" max="24" step="1"')
    content = content.replace('for="sidebar-width-slider"', 'for="header-font-size-slider"')
    content = content.replace('data-i18n="label_sidebar_width">Sidebar:</label>', 'data-i18n="label_header_font_size">Titles:</label>')
    content = content.replace('id="sidebar-width-value"', 'id="header-font-size-value"')
    content = content.replace('142px</span>', '15px</span>')
    
    # Add sidebar-resizer
    if '<div id="sidebar-resizer"></div>' not in content:
        content = content.replace('</aside>', '</aside>\n        <div id="sidebar-resizer"></div>')
    
    # Move Export/Import section
    if "Backup & Restore View" not in content:
        content = re.sub(old_export_section_regex, '', content, flags=re.DOTALL)
        content = content.replace('<div class="settings-footer"', export_section_html + '\n            <div class="settings-footer"')

    with open(f, "w") as file:
        file.write(content)

print("HTML fix completed.")
