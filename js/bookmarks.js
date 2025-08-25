// This file will handle all logic related to the chrome.bookmarks API.

function getBookmarks(callback) {
    chrome.bookmarks.getTree((bookmarkTree) => {
        callback(bookmarkTree);
    });
}

function getBookmarkFolders(callback) {
    const folders = [];
    getBookmarks(bookmarkTree => {
        function findFolders(node) {
            // A node is a folder if it doesn't have a URL
            if (!node.url) {
                folders.push({
                    id: node.id,
                    title: node.title || (node.id === '0' ? 'Root' : 'Unnamed Folder')
                });
                if (node.children) {
                    node.children.forEach(findFolders);
                }
            }
        }
        bookmarkTree.forEach(findFolders);
        callback(folders);
    });
}

function getBookmarksInFolder(folderId, callback) {
    chrome.bookmarks.getChildren(folderId, (children) => {
        callback(children || []);
    });
}

function deleteBookmark(id, callback) {
    chrome.bookmarks.remove(id, () => {
        if (callback) callback();
    });
}

function updateBookmark(id, changes, callback) {
    chrome.bookmarks.update(id, changes, () => {
        if (callback) callback();
    });
}
