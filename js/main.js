const undoStack = [];
window.bookmarkRefreshCallbacks = [];

document.addEventListener('DOMContentLoaded', () => {
    const panelsContainer = document.getElementById('panels-container');

    // --- State Management ---
    const saveState = () => {
        const panels = [];
        const imagesToSaveLocally = {};
        const localImageKeysToRemove = [];

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
                        // This is an image card with a data URL that needs to be stored locally
                        imagesToSaveLocally[cardData.id] = img.src;
                        // In the sync data, we'll store a placeholder
                        cardData.imageUrl = 'local';
                    } else if (img) {
                        // This might be an image with a 'local' placeholder already, keep it
                        cardData.imageUrl = 'local';
                    }
                    panel.cards.push(cardData);
                });
            }
            panels.push(panel);
        });

        // Save image data to local storage
        if (Object.keys(imagesToSaveLocally).length > 0) {
            chrome.storage.local.set(imagesToSaveLocally);
        }

        // Save panel structure to sync storage
        chrome.storage.sync.set({ panelsState: panels });
    };

    const loadState = () => {
        chrome.storage.sync.get('panelsState', data => {
            panelsContainer.innerHTML = ''; // Clear before loading
            const panelsState = data.panelsState;

            if (panelsState && panelsState.length > 0) {
                const imageCardIds = [];
                panelsState.forEach(panel => {
                    if (panel.type === 'notes' && panel.cards) {
                        panel.cards.forEach(card => {
                            if (card.imageUrl === 'local') {
                                imageCardIds.push(card.id);
                            }
                        });
                    }
                });

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
                // If no state, create a default "To-Do" list
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
        // Ensure the bookmarks radio is selected, which also shows the folder dropdown
        addPanelForm.elements['panel-type'].value = 'bookmarks';
        // Manually trigger change event to update UI, targeting the bookmarks radio specifically
        addPanelForm.querySelector('input[name="panel-type"][value="bookmarks"]').dispatchEvent(new Event('change'));
        addPanelModal.classList.remove('hidden');
    });

    document.getElementById('quick-backup-btn').addEventListener('click', () => {
        // This function is defined in settings.js
        if (window.handleExport) {
            window.handleExport();
        } else {
            alert('Could not perform export. Function not found.');
        }
    });

    cancelAddPanelBtn.addEventListener('click', () => {
        addPanelModal.classList.add('hidden');
        addPanelModal.classList.remove('bookmark-mode'); // Reset mode
    });

    addPanelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let title = e.target.elements['panel-title-input'].value;
        // If in bookmark-mode, the type is always bookmarks. Otherwise, read from radio.
        const type = addPanelModal.classList.contains('bookmark-mode')
            ? 'bookmarks'
            : e.target.elements['panel-type'].value;

        if (!title) {
            if (type === 'bookmarks') {
                const folderSelect = e.target.elements['panel-folder-select'];
                if (folderSelect.value) { // Ensure a folder is selected
                    title = folderSelect.options[folderSelect.selectedIndex].text;
                } else {
                    title = 'New Bookmarks'; // Fallback if no folder is chosen
                }
            } else {
                    title = 'New Notes'; // Default for non-bookmark panels (e.g. notes)
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
        addPanelModal.classList.remove('bookmark-mode'); // Reset mode
        addPanelForm.reset();
        bookmarkFolderGroup.classList.add('hidden');
    });

    // Handle clicks on the sidebar title to open the bookmarks manager
    document.getElementById('bookmarks-title-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://bookmarks' });
    });

    // Handle clicks on the history icon to open the history page
    document.getElementById('history-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://history' });
    });

    // --- Panel Drag and Drop ---
    panelsContainer.addEventListener('dragstart', e => {
        // This listener is on the container to handle panel dragging.
        // It must NOT interfere with drag events from children (e.g., cards).
        // We only act if the drag's target is a .panel element itself.
        if (!e.target.classList.contains('panel')) {
            return; // Exit for card drags, etc.
        }

        const panel = e.target; // The target is the panel itself

        // Use a timeout to avoid visual glitches when the class is added
        setTimeout(() => {
            panel.classList.add('dragging');
        }, 0);

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
            saveState(); // Persist the new order
        }
    });

    function getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.panel:not(.dragging)')];

        // Find the panel that is visually closest to the cursor's position
        const closest = draggableElements.reduce((acc, child) => {
            const box = child.getBoundingClientRect();
            const offsetX = x - (box.left + box.width / 2);
            const offsetY = y - (box.top + box.height / 2);
            // Simple distance formula
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

            if (distance < acc.distance) {
                return { distance: distance, element: child };
            } else {
                return acc;
            }
        }, { distance: Number.POSITIVE_INFINITY });

        if (!closest.element) {
            return null; // No other elements to compare against
        }

        const closestBox = closest.element.getBoundingClientRect();
        const offset = x - (closestBox.left + closestBox.width / 2);

        if (offset < 0) {
            // Cursor is to the left of the closest element's center, so insert before it
            return closest.element;
        } else {
            // Cursor is to the right, so insert after it (by returning its next sibling)
            return closest.element.nextElementSibling;
        }
    }


    // --- Undo Logic ---
    document.addEventListener('keydown', (e) => {
        // We listen for both 'z' and 'Z' to account for Shift key.
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault(); // Prevent the browser's default undo action.

            if (undoStack.length > 0) {
                const undoItem = undoStack.pop();

                if (undoItem.itemType === 'panel') {
                    const newPanel = createPanel(undoItem.state, saveState);
                    const nextSibling = undoItem.nextSiblingId ? document.querySelector(`[data-id='${undoItem.nextSiblingId}']`) : null;
                    panelsContainer.insertBefore(newPanel, nextSibling); // If nextSibling is null, it appends to the end.
                } else if (undoItem.itemType === 'card') {
                    const parentPanel = document.querySelector(`[data-id='${undoItem.parentPanelId}']`);
                    if (parentPanel) {
                        const cardsContainer = parentPanel.querySelector('.cards-container');
                        if (cardsContainer) {
                             // createCard appends the card to the container, so we create it first.
                            const newCard = createCard(cardsContainer, undoItem.state, saveState);
                            // Then, we find its correct position and move it.
                            const nextSibling = undoItem.nextSiblingId ? document.getElementById(undoItem.nextSiblingId) : null;
                            cardsContainer.insertBefore(newCard, nextSibling);
                        }
                    }
                }
                // Save the state after restoring the item
                saveState();
            }
        }
    });


    // --- Clock and Date ---
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        document.getElementById('clock').textContent = timeString;
        document.getElementById('date').textContent = dateString;
    }

    // --- View Navigation ---
    function navigateToView(viewUrl, viewTitle) {
        // For View 1 (the New Tab Page), we must query by title as the URL is masked.
        if (viewUrl === 'startpage.html') {
            chrome.tabs.query({ title: viewTitle }, (tabs) => {
                if (tabs.length > 0) {
                    // Tab exists, focus it
                    chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                } else {
                    // Create a new tab, which will be overridden by the extension
                    chrome.tabs.create({});
                }
            });
            return;
        }

        // For other views, we can query by their unique URL.
        const targetUrl = chrome.runtime.getURL(viewUrl);
        chrome.tabs.query({ url: targetUrl }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: targetUrl });
            }
        });
    }

    document.getElementById('nav-view-1').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('startpage.html', 'Dashboard 1');
    });
    document.getElementById('nav-view-2').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('panelB.html', 'Dashboard 2');
    });
    document.getElementById('nav-view-3').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('panelC.html', 'Dashboard 3');
    });

    // Highlight the active view link
    document.getElementById('nav-view-1').classList.add('active-view-link');


    // --- Initialization ---
    loadState();
    updateClock();
    setInterval(updateClock, 1000); // Update every second
});

// --- Functions called by settings.js ---
function renderBookmarks(element, bookmarks, folderId, refreshCallback) {
    element.innerHTML = ''; // Clear existing bookmarks
    const fragment = document.createDocumentFragment();

    if (!bookmarks || bookmarks.length === 0) {
        element.innerHTML = '<p class="empty-folder-message">This folder is empty.</p>';
        return;
    }

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

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            const link = document.createElement('a');
            link.href = bookmark.url;
            link.textContent = bookmark.title;
            link.className = 'bookmark-link';
            item.appendChild(link);

            const actions = document.createElement('div');
            actions.className = 'bookmark-actions';

            const editButton = document.createElement('button');
            editButton.textContent = 'e';
            editButton.className = 'edit-bookmark-btn';
            editButton.title = 'Edit bookmark';
            editButton.addEventListener('click', () => {
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
                            if (refreshCallback) refreshCallback();
                        });
                    }
                });

                item.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                    if (refreshCallback) refreshCallback();
                });
            });
            actions.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'x';
            deleteButton.className = 'delete-bookmark-btn';
            deleteButton.title = 'Delete bookmark';
            deleteButton.addEventListener('click', () => {
                if (window.confirm(`Are you sure you want to delete "${bookmark.title}"?`)) {
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

    // Theme
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');

    // Clock and Date Visibility
    const clockElement = document.getElementById('clock');
    const dateElement = document.getElementById('date');
    if (clockElement) {
        clockElement.style.display = settings.showClock ? 'block' : 'none';
    }
    if (dateElement) {
        dateElement.style.display = settings.showDate ? 'block' : 'none';
    }

    // Sidebar Bookmarks
    const sidebarBookmarks = document.getElementById('sidebar-bookmarks');
    sidebarBookmarks.addEventListener('dragover', e => {
        e.preventDefault();
        sidebarBookmarks.classList.add('drag-over');
    });
    sidebarBookmarks.addEventListener('dragleave', () => {
        sidebarBookmarks.classList.remove('drag-over');
    });
    sidebarBookmarks.addEventListener('drop', e => {
        e.preventDefault();
        sidebarBookmarks.classList.remove('drag-over');
        const bookmarkId = e.dataTransfer.getData('text/plain');
        const destinationFolderId = sidebarBookmarks.dataset.folderId;

        if (!bookmarkId || !destinationFolderId) return;

        // Find the drop index
        const afterElement = getBookmarkDragAfterElement(sidebarBookmarks, e.clientY);
        const children = [...sidebarBookmarks.querySelectorAll('.bookmark-item')];
        const dropIndex = afterElement ? children.indexOf(afterElement) : children.length;

        moveBookmark(bookmarkId, { parentId: destinationFolderId, index: dropIndex }, () => {
            // Refresh all bookmark panels/sidebar
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
        // Register this refresh function globally
        window.bookmarkRefreshCallbacks.push(refreshSidebar);
        refreshSidebar();
    } else {
        delete sidebarBookmarks.dataset.folderId;
        sidebarBookmarks.innerHTML = '<p style="padding: 8px;">Select a folder in settings.</p>';
    }
}
