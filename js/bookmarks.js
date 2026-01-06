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

/**
 * Sorts the bookmarks on the bookmark bar based on provided options.
 * @param {object} options - The sorting options.
 * @param {boolean} options.recursive - Whether to sort subfolders as well.
 * @param {string} options.sortOrder - 'mixed' or 'foldersFirst'.
 * @param {function} callback - Function to call when sorting is complete.
 */
function sortBookmarksOnBookmarkBar(options, callback) {
    const bookmarkBarId = '1'; // The ID for the bookmark bar is always '1'

    const sortChildrenOfNode = (nodeId, done) => {
        chrome.bookmarks.getChildren(nodeId, (children) => {
            if (!children) {
                if (done) done();
                return;
            }

            const sortedChildren = [...children].sort((a, b) => {
                const aIsFolder = !a.url;
                const bIsFolder = !b.url;

                if (options.sortOrder === 'foldersFirst') {
                    if (aIsFolder && !bIsFolder) return -1;
                    if (!aIsFolder && bIsFolder) return 1;
                }

                return a.title.localeCompare(b.title);
            });

            // Move bookmarks one by one
            let moveChain = Promise.resolve();
            sortedChildren.forEach((node, index) => {
                moveChain = moveChain.then(() => new Promise(resolve => {
                    chrome.bookmarks.move(node.id, { parentId: nodeId, index: index }, resolve);
                }));
            });

            moveChain.then(() => {
                if (options.recursive) {
                    const subfolders = sortedChildren.filter(child => !child.url);
                    let subfolderChain = Promise.resolve();
                    subfolders.forEach(folder => {
                        subfolderChain = subfolderChain.then(() => new Promise(resolve => {
                            sortChildrenOfNode(folder.id, resolve);
                        }));
                    });
                    subfolderChain.then(done);
                } else {
                    if (done) done();
                }
            });
        });
    };

    sortChildrenOfNode(bookmarkBarId, callback);
}

function moveBookmark(id, destination, callback) {
    // destination should be an object like { parentId: '...', index: ... }
    chrome.bookmarks.move(id, destination, () => {
        if (callback) callback();
    });
}

function updateBookmark(id, changes, callback) {
    chrome.bookmarks.update(id, changes, () => {
        if (callback) callback();
    });
}
