import re

html_files = ["panelA.html", "panelB.html", "panelC.html", "panelD.html"]

slider_html = """
                <!-- Row 3: Width & Font Size Sliders -->
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                        <label for="header-font-size-slider" style="margin:0; white-space: nowrap; font-size: 0.8rem;" data-i18n="label_header_font_size">Titles:</label>
                        <input type="range" id="header-font-size-slider" min="12" max="24" step="1" style="flex-grow: 1; cursor: pointer; min-width: 0;">
                        <span id="header-font-size-value" style="min-width: 38px; text-align: right; font-size: 0.8rem; flex-shrink: 0;">15px</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; margin-left: 15px;">
                        <label for="bookmark-font-size-slider" style="margin:0; white-space: nowrap; font-size: 0.8rem;" data-i18n="label_bookmark_font_size">Text:</label>
                        <input type="range" id="bookmark-font-size-slider" min="10" max="20" step="1" style="flex-grow: 1; cursor: pointer; min-width: 0;">
                        <span id="bookmark-font-size-value" style="min-width: 32px; text-align: right; font-size: 0.8rem; flex-shrink: 0;">12px</span>
                    </div>
                </div>
"""

for f in html_files:
    with open(f, "r") as file:
        content = file.read()
    
    if "header-font-size-slider" not in content:
        # Insert right after the color pickers
        content = content.replace(
            '<input type="color" id="input-bg-color-picker" title="Input/Dropdown Background" style="width: 26px; height: 26px; padding: 2px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--panel-bg); cursor: pointer;">\n                    </div>\n                </div>',
            '<input type="color" id="input-bg-color-picker" title="Input/Dropdown Background" style="width: 26px; height: 26px; padding: 2px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--panel-bg); cursor: pointer;">\n                    </div>\n                </div>' + slider_html
        )
        with open(f, "w") as file:
            file.write(content)

print("Added sliders.")
