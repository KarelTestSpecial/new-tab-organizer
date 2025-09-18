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

        chrome.storage.sync.set({ [STORAGE_KEY]: panels });
    };

    const loadState = () => {
        chrome.storage.sync.get(STORAGE_KEY, data => {
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
        chrome.storage.sync.get('settings', (data) => {
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

    // --- Panel Drag and Drop ---
    panelsContainer.addEventListener('dragstart', e => {
        if (!e.target.classList.contains('panel')) return;
        const panel = e.target;
        setTimeout(() => panel.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panel.dataset.id);
    });

    panelsContainer.addEventListener('dragend', e => {
        const draggingPanel = document.querySelector('.panel.dragging');
        if (draggingPanel) {
            draggingPanel.classList.remove('dragging');
        }
    });

    panelsContainer.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingPanel = document.querySelector('.panel.dragging');
        if (!draggingPanel) return;
        const afterElement = getDragAfterElement(panelsContainer, e.clientX, e.clientY);
        if (afterElement == null) {
            panelsContainer.appendChild(draggingPanel);
        } else {
            panelsContainer.insertBefore(draggingPanel, afterElement);
        }
    });

    panelsContainer.addEventListener('drop', e => {
        e.preventDefault();
        const draggingPanel = document.querySelector('.panel.dragging');
        if (draggingPanel) {
            draggingPanel.classList.remove('dragging');
            saveState();
        }
    });

    function getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.panel:not(.dragging)')];
        const closest = draggableElements.reduce((acc, child) => {
            const box = child.getBoundingClientRect();
            const distance = Math.sqrt(Math.pow(x - (box.left + box.width / 2), 2) + Math.pow(y - (box.top + box.height / 2), 2));
            return distance < acc.distance ? { distance: distance, element: child } : acc;
        }, { distance: Number.POSITIVE_INFINITY });

        if (!closest.element) return null;

        const closestBox = closest.element.getBoundingClientRect();
        return x < closestBox.left + closestBox.width / 2 ? closest.element : closest.element.nextElementSibling;
    }

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
        chrome.tabs.query({ url: targetUrl }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.reload(tabs[0].id);
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: targetUrl });
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

    // --- Initialization ---
    loadState();
    updateClock();
    setInterval(updateClock, 1000);
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
                parentPanel.classList.add('editing');
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
                            parentPanel.classList.remove('editing');
                            if (refreshCallback) refreshCallback();
                        });
                    } else {
                        parentPanel.classList.remove('editing');
                        if (refreshCallback) refreshCallback();
                    }
                });
                item.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                    parentPanel.classList.remove('editing');
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
