import re

html_files = ["panelA.html", "panelB.html", "panelC.html", "panelD.html"]
checkbox_html = """
                                <label style="cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; margin-top: 5px;">
                                    <input type="checkbox" id="sort-bookmarks-popup-checkbox"> <span data-i18n="label_sort_bookmarks">Sorteer ook bladwijzers (niet enkel mappen)</span>
                                </label>"""

for f in html_files:
    with open(f, "r") as file:
        content = file.read()
    if "sort-bookmarks-popup-checkbox" not in content:
        pattern = r'(<input type="checkbox" id="sort-recursive-popup-checkbox"[^>]*>\s*<span[^>]*>[^<]*</span>\s*</label>)'
        content = re.sub(pattern, r'\1' + checkbox_html, content)
        with open(f, "w") as file:
            file.write(content)

app_file = "js/app.js"
with open(app_file, "r") as file:
    app_js = file.read()

if "sortBookmarks:" not in app_js:
    app_js = app_js.replace(
        "const isRecursive = document.getElementById('sort-recursive-popup-checkbox').checked;",
        "const isRecursive = document.getElementById('sort-recursive-popup-checkbox').checked;\n            const sortBookmarks = document.getElementById('sort-bookmarks-popup-checkbox') ? document.getElementById('sort-bookmarks-popup-checkbox').checked : false;"
    )
    app_js = app_js.replace(
        "                    sortOrder: settings.sortOrder || 'mixed',",
        "                    sortOrder: settings.sortOrder || 'mixed',\n                    sortBookmarks: sortBookmarks,"
    )
    with open(app_file, "w") as file:
        file.write(app_js)

print("Add sort checkbox completed.")
