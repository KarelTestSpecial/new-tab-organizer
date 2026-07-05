import re

files = [
    "js/app.js",
    "js/bookmarks.js",
    "js/settings_logic.js",
    "js/panels.js"
]

for filepath in files:
    with open(filepath, "r") as f:
        content = f.read()
    
    # We will just do a simple replace for common patterns that don't check lastError
    content = content.replace("chrome.bookmarks.getSubTree(parentId, (results) => {\n                    const folders", "chrome.bookmarks.getSubTree(parentId, (results) => {\n                    if (chrome.runtime.lastError) return callback && callback([]);\n                    const folders")
    content = content.replace("chrome.bookmarks.getTree((tree) => {\n            const foundFolders", "chrome.bookmarks.getTree((tree) => {\n            if (chrome.runtime.lastError) return;\n            const foundFolders")
    content = content.replace("chrome.bookmarks.getChildren(rootId, (children) => {\n            if (!children) return;", "chrome.bookmarks.getChildren(rootId, (children) => {\n            if (chrome.runtime.lastError || !children) return;")
    content = content.replace("chrome.bookmarks.get(panel.folderId, (results) => {\n                                    if (!results", "chrome.bookmarks.get(panel.folderId, (results) => {\n                                    if (chrome.runtime.lastError || !results")
    content = content.replace("chrome.bookmarks.getSubTree(fId, (results) => {\n                        if (results", "chrome.bookmarks.getSubTree(fId, (results) => {\n                        if (chrome.runtime.lastError || !results")
    
    # Check for getting children without lastError check
    content = content.replace("chrome.bookmarks.getChildren(folderId, (children) => {\n        if (!children) return;", "chrome.bookmarks.getChildren(folderId, (children) => {\n        if (chrome.runtime.lastError || !children) return;")
    content = content.replace("chrome.bookmarks.getChildren(parentId, (children) => {\n        if (!children)", "chrome.bookmarks.getChildren(parentId, (children) => {\n        if (chrome.runtime.lastError || !children)")
    content = content.replace("chrome.bookmarks.getChildren(nodeId, (children) => {\n            if (!children", "chrome.bookmarks.getChildren(nodeId, (children) => {\n            if (chrome.runtime.lastError || !children")
    
    with open(filepath, "w") as f:
        f.write(content)

print("Fixed errors")
