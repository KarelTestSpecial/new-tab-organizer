const undoStack = [];
window.bookmarkRefreshCallbacks = [];

// --- View Identification ---
function getCurrentView() {
    const filename = window.location.pathname.split('/').pop();
    if (filename.startsWith('panelA')) return 'A';
    if (filename.startsWith('panelB')) return 'B';
    if (filename.startsWith('panelC')) return 'C';
    return 'A'; // Default to A
}

function getStorageKey(view) {
    if (view === 'B') return 'panelsState_B';
    if (view === 'C') return 'panelsState_C';
    return 'panelsState'; // Default for A
}

const CURRENT_VIEW = getCurrentView();
const STORAGE_KEY = getStorageKey(CURRENT_VIEW);

document.addEventListener('DOMContentLoaded', () => {
    const panelsContainer = document.getElementById('panels-container');

    // --- State Management ---
    const saveState = () => {
        const panels = [];
        const imagesToSaveLocally = {};

        document.querySelectorAll('.panel').forEach(panelEl => {
            const panel = {
                id: panelEl.dataset.id,
                title: panelEl.querySelector('h3').textContent,
                type: panelEl.dataset.type,
                folderId: panelEl.dataset.folderId,
                cards: []
            };

            if (panel.type === 'notes') {
                panelEl.querySelectorAll('.card').forEach(cardEl => {
                    const cardData = {
                        id: cardEl.id,
                        text: cardEl.querySelector('p').textContent,
                        imageUrl: null
                    };
                    const img = cardEl.querySelector('img');
                    if (img && img.src.startsWith('data:image')) {
                        imagesToSaveLocally[cardData.id] = img.src;
                        cardData.imageUrl = 'local';
                    } else if (img) {
                        cardData.imageUrl = 'local';
                    }
                    panel.cards.push(cardData);
                });
            }
            panels.push(panel);
        });

        if (Object.keys(imagesToSaveLocally).length > 0) {
            chrome.storage.local.set(imagesToSaveLocally);
        }

        chrome.storage.local.set({ [STORAGE_KEY]: panels });
    };

    const loadState = () => {
        chrome.storage.local.get(STORAGE_KEY, data => {
            panelsContainer.innerHTML = '';
            const panelsState = data[STORAGE_KEY];

            if (panelsState && panelsState.length > 0) {
                const imageCardIds = panelsState.flatMap(p => p.type === 'notes' && p.cards ? p.cards.filter(c => c.imageUrl === 'local').map(c => c.id) : []);

                if (imageCardIds.length > 0) {
                    chrome.storage.local.get(imageCardIds, localImages => {
                        panelsState.forEach(panel => {
                            if (panel.type === 'notes' && panel.cards) {
                                panel.cards.forEach(card => {
                                    if (localImages[card.id]) {
                                        card.imageUrl = localImages[card.id];
                                    }
                                });
                            }
                        });
                        renderPanels(panelsState);
                    });
                } else {
                    renderPanels(panelsState);
                }
            } else {
                const defaultPanelState = { id: `panel-${Date.now()}`, title: 'To-Do List', type: 'notes', cards: [] };
                const panelEl = createPanel(defaultPanelState, saveState);
                addPanelToContainer(panelEl);
            }
        });
    };

    const renderPanels = (panelsState) => {
        panelsState.forEach(panelState => {
            const panelEl = createPanel(panelState, saveState);
            panelsContainer.appendChild(panelEl);
        });
    };

    // --- Modal Logic ---
    const addPanelModal = document.getElementById('add-panel-modal');
    const addPanelForm = document.getElementById('add-panel-form');
    const cancelAddPanelBtn = document.getElementById('cancel-add-panel-btn');
    const bookmarkFolderGroup = document.getElementById('bookmark-folder-group');
    const panelFolderSelect = document.getElementById('panel-folder-select');

    addPanelForm.elements['panel-type'].forEach(radio => {
        radio.addEventListener('change', (e) => {
            bookmarkFolderGroup.classList.toggle('hidden', e.target.value !== 'bookmarks');
        });
    });

    getBookmarkFolders(folders => {
        folders.forEach(folder => {
            if (folder.id === '0') return;
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.title;
            panelFolderSelect.appendChild(option);
        });
    });

    // --- Event Listeners ---
    const addPanelToContainer = (panelEl) => {
        chrome.storage.local.get('settings', (data) => {
            const position = data.settings?.newPanelPosition || 'bottom';
            if (position === 'top') {
                panelsContainer.prepend(panelEl);
            } else {
                panelsContainer.appendChild(panelEl);
            }
            saveState();
        });
    };

    document.getElementById('add-notes-panel-btn').addEventListener('click', () => {
        const newPanelState = {
            id: `panel-${Date.now()}`,
            title: 'New Notes',
            type: 'notes',
            cards: []
        };
        const panelEl = createPanel(newPanelState, saveState);
        addPanelToContainer(panelEl);
    });

    document.getElementById('add-bookmarks-panel-btn').addEventListener('click', () => {
        addPanelModal.classList.add('bookmark-mode');
        addPanelForm.elements['panel-type'].value = 'bookmarks';
        addPanelForm.querySelector('input[name="panel-type"][value="bookmarks"]').dispatchEvent(new Event('change'));
        addPanelModal.classList.remove('hidden');
    });

    document.getElementById('quick-backup-btn').addEventListener('click', () => {
        if (window.handleExport) {
            window.handleExport(STORAGE_KEY);
        } else {
            alert('Could not perform export. Function not found.');
        }
    });

    cancelAddPanelBtn.addEventListener('click', () => {
        addPanelModal.classList.add('hidden');
        addPanelModal.classList.remove('bookmark-mode');
    });

    addPanelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let title = e.target.elements['panel-title-input'].value;
        const type = addPanelModal.classList.contains('bookmark-mode') ? 'bookmarks' : e.target.elements['panel-type'].value;

        if (!title) {
            if (type === 'bookmarks') {
                const folderSelect = e.target.elements['panel-folder-select'];
                title = folderSelect.value ? folderSelect.options[folderSelect.selectedIndex].text : 'New Bookmarks';
            } else {
                title = 'New Notes';
            }
        }

        const newPanelState = {
            id: `panel-${Date.now()}`,
            title: title,
            type: type,
            cards: []
        };

        if (type === 'bookmarks') {
            newPanelState.folderId = e.target.elements['panel-folder-select'].value;
            if (!newPanelState.folderId) {
                alert('Please select a bookmark folder.');
                return;
            }
        }

        const panelEl = createPanel(newPanelState, saveState);
        addPanelToContainer(panelEl);

        addPanelModal.classList.add('hidden');
        addPanelModal.classList.remove('bookmark-mode');
        addPanelForm.reset();
        bookmarkFolderGroup.classList.add('hidden');
    });

    document.getElementById('bookmarks-title-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://bookmarks' });
    });

    document.getElementById('history-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://history' });
    });

    // --- Undo Logic ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (undoStack.length > 0) {
                const undoItem = undoStack.pop();
                if (undoItem.itemType === 'panel') {
                    const newPanel = createPanel(undoItem.state, saveState);
                    const nextSibling = undoItem.nextSiblingId ? document.querySelector(`[data-id='${undoItem.nextSiblingId}']`) : null;
                    panelsContainer.insertBefore(newPanel, nextSibling);
                } else if (undoItem.itemType === 'card') {
                    const parentPanel = document.querySelector(`[data-id='${undoItem.parentPanelId}']`);
                    if (parentPanel) {
                        const cardsContainer = parentPanel.querySelector('.cards-container');
                        if (cardsContainer) {
                            const newCard = createCard(cardsContainer, undoItem.state, saveState);
                            const nextSibling = undoItem.nextSiblingId ? document.getElementById(undoItem.nextSiblingId) : null;
                            cardsContainer.insertBefore(newCard, nextSibling);
                        }
                    }
                }
                saveState();
            }
        }
    });

    // --- Clock and Date ---
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('date').textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // --- View Navigation ---
    function navigateToView(viewUrl) {
        const targetUrl = chrome.runtime.getURL(viewUrl);

        // First, query for the specific extension URL.
        chrome.tabs.query({ url: targetUrl }, (tabs) => {
            if (tabs.length > 0) {
                // Found the specific tab. Reload and focus it.
                const tabToFocus = tabs[0];
                chrome.tabs.reload(tabToFocus.id);
                chrome.tabs.update(tabToFocus.id, { active: true });
                chrome.windows.update(tabToFocus.windowId, { focused: true });
            } else {
                // If not found, and we are trying to open Panel A, check for a 'newtab' page to reuse.
                if (viewUrl.includes('panelA')) {
                    chrome.tabs.query({ url: 'chrome://newtab/' }, (newTabs) => {
                        if (newTabs.length > 0) {
                            // Found a 'newtab' page, so update it to become our Panel A.
                            const tabToUpdate = newTabs[0];
                            chrome.tabs.update(tabToUpdate.id, { url: targetUrl, active: true });
                            chrome.windows.update(tabToUpdate.windowId, { focused: true });
                        } else {
                            // No specific Panel A tab and no 'newtab' to reuse. Create a new one.
                            chrome.tabs.create({ url: targetUrl });
                        }
                    });
                } else {
                    // For Panel B or C, if they don't exist, just create them.
                    chrome.tabs.create({ url: targetUrl });
                }
            }
        });
    }

    document.getElementById('nav-view-1').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('panelA.html');
    });
    document.getElementById('nav-view-2').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('panelB.html');
    });
    document.getElementById('nav-view-3').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('panelC.html');
    });

    // Highlight the active view link
    document.getElementById(`nav-view-${CURRENT_VIEW === 'A' ? 1 : CURRENT_VIEW === 'B' ? 2 : 3}`).classList.add('active-view-link');

    // --- Bookmark Change Listener ---
    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
        if (changeInfo.title) {
            const panel = document.querySelector(`.panel[data-folder-id='${id}']`);
            if (panel) {
                const titleElement = panel.querySelector('h3');
                if (titleElement) {
                    titleElement.textContent = changeInfo.title;
                }
                saveState();
            }
        }
    });

    // --- Initialization ---
    loadState();
    updateClock();
    setInterval(updateClock, 1000);

    new Sortable(panelsContainer, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        forceFallback: true,
        onStart: function () {
            document.body.classList.add('no-select');
        },
        onEnd: function () {
            document.body.classList.remove('no-select');
            saveState();
        },
    });
});

// --- Functions called by settings_logic.js ---
function renderBookmarks(element, bookmarks, folderId, refreshCallback) {
    element.innerHTML = '';
    if (!bookmarks || bookmarks.length === 0) {
        element.innerHTML = '<p class="empty-folder-message">This folder is empty.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    bookmarks.forEach(bookmark => {
        if (bookmark.url) {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.dataset.id = bookmark.id;
            item.draggable = true;

            item.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', bookmark.id);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));

            const link = document.createElement('a');
            link.href = bookmark.url;
            link.textContent = bookmark.title;
            link.className = 'bookmark-link';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: link.href });
            });
            item.appendChild(link);

            const actions = document.createElement('div');
            actions.className = 'bookmark-actions';

            const editButton = document.createElement('button');
            editButton.textContent = 'e';
            editButton.className = 'edit-bookmark-btn';
            editButton.title = 'Edit bookmark';
            editButton.addEventListener('click', () => {
                const parentPanel = item.closest('.panel');
                if (parentPanel) {
                    parentPanel.classList.add('editing');
                } else {
                    item.classList.add('sidebar-editing');
                }
                const currentTitle = link.textContent;
                const currentUrl = link.href;
                item.innerHTML = `
                    <div class="edit-form">
                        <input type="text" class="edit-title" value="${currentTitle}">
                        <input type="text" class="edit-url" value="${currentUrl}">
                        <button class="save-bookmark-btn">Save</button>
                        <button class="cancel-edit-btn">Cancel</button>
                    </div>
                `;
                item.querySelector('.save-bookmark-btn').addEventListener('click', () => {
                    const newTitle = item.querySelector('.edit-title').value.trim();
                    const newUrl = item.querySelector('.edit-url').value.trim();
                    if (newTitle && newUrl) {
                        updateBookmark(bookmark.id, { title: newTitle, url: newUrl }, () => {
                            if (parentPanel) {
                                parentPanel.classList.remove('editing');
                            } else {
                                item.classList.remove('sidebar-editing');
                            }
                            if (refreshCallback) refreshCallback();
                        });
                    } else {
                        if (parentPanel) {
                            parentPanel.classList.remove('editing');
                        } else {
                            item.classList.remove('sidebar-editing');
                        }
                        if (refreshCallback) refreshCallback();
                    }
                });
                item.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                    if (parentPanel) {
                        parentPanel.classList.remove('editing');
                    } else {
                        item.classList.remove('sidebar-editing');
                    }
                    if (refreshCallback) refreshCallback();
                });
            });
            actions.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'x';
            deleteButton.className = 'delete-bookmark-btn';
            deleteButton.title = 'Delete bookmark';
            deleteButton.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete "${bookmark.title}"?`)) {
                    deleteBookmark(bookmark.id, () => {
                        if (refreshCallback) refreshCallback();
                    });
                }
            });
            actions.appendChild(deleteButton);
            item.appendChild(actions);
            fragment.appendChild(item);
        }
    });
    element.appendChild(fragment);
}

function applySettings(settings) {
    if (!settings) return;
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    const clockElement = document.getElementById('clock');
    const dateElement = document.getElementById('date');
    if (clockElement) clockElement.style.display = settings.showClock ? 'block' : 'none';
    if (dateElement) dateElement.style.display = settings.showDate ? 'block' : 'none';

    const sidebarBookmarks = document.getElementById('sidebar-bookmarks');
    sidebarBookmarks.addEventListener('dragover', e => {
        e.preventDefault();
        sidebarBookmarks.classList.add('drag-over');
    });
    sidebarBookmarks.addEventListener('dragleave', () => sidebarBookmarks.classList.remove('drag-over'));
    sidebarBookmarks.addEventListener('drop', e => {
        e.preventDefault();
        sidebarBookmarks.classList.remove('drag-over');
        const bookmarkId = e.dataTransfer.getData('text/plain');
        const destinationFolderId = sidebarBookmarks.dataset.folderId;
        if (!bookmarkId || !destinationFolderId) return;
        const afterElement = getBookmarkDragAfterElement(sidebarBookmarks, e.clientY);
        const children = [...sidebarBookmarks.querySelectorAll('.bookmark-item')];
        const dropIndex = afterElement ? children.indexOf(afterElement) : children.length;
        moveBookmark(bookmarkId, { parentId: destinationFolderId, index: dropIndex }, () => {
            window.bookmarkRefreshCallbacks.forEach(cb => cb());
        });
    });

    if (settings.sidebarFolderId) {
        sidebarBookmarks.dataset.folderId = settings.sidebarFolderId;
        const refreshSidebar = () => {
            getBookmarksInFolder(settings.sidebarFolderId, (bookmarks) => {
                renderBookmarks(sidebarBookmarks, bookmarks, settings.sidebarFolderId, refreshSidebar);
            });
        };
        window.bookmarkRefreshCallbacks.push(refreshSidebar);
        refreshSidebar();
    } else {
        delete sidebarBookmarks.dataset.folderId;
        sidebarBookmarks.innerHTML = '<p style="padding: 8px;">Select a folder in settings.</p>';
    }
}
