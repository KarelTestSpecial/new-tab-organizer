const undoStack = [];

document.addEventListener('DOMContentLoaded', () => {
    const panelsContainer = document.getElementById('panels-container');

    // --- State Management ---
    const saveState = () => {
        const panels = [];
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
                    panel.cards.push({
                        id: cardEl.id,
                        text: cardEl.querySelector('p').textContent
                    });
                });
            }
            panels.push(panel);
        });
        chrome.storage.sync.set({ panelsState: panels });
    };

    const loadState = () => {
        chrome.storage.sync.get('panelsState', data => {
            panelsContainer.innerHTML = ''; // Clear before loading
            if (data.panelsState && data.panelsState.length > 0) {
                data.panelsState.forEach(panelState => {
                    const panelEl = createPanel(panelState, saveState);
                    panelsContainer.appendChild(panelEl);
                });
            } else {
                // If no state, create a default "To-Do" list
                const defaultPanelState = { id: `panel-${Date.now()}`, title: 'To-Do List', type: 'notes', cards: [] };
                const panelEl = createPanel(defaultPanelState, saveState);
                panelsContainer.appendChild(panelEl);
                saveState();
            }
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
    document.getElementById('add-notes-panel-btn').addEventListener('click', () => {
        const newPanelState = {
            id: `panel-${Date.now()}`,
            title: 'New Notes',
            type: 'notes',
            cards: []
        };
        const panelEl = createPanel(newPanelState, saveState);
        panelsContainer.appendChild(panelEl);
        saveState();
    });

    document.getElementById('add-bookmarks-panel-btn').addEventListener('click', () => {
        addPanelModal.classList.add('bookmark-mode');
        // Ensure the bookmarks radio is selected, which also shows the folder dropdown
        addPanelForm.elements['panel-type'].value = 'bookmarks';
        // Manually trigger change event to update UI, targeting the bookmarks radio specifically
        addPanelForm.querySelector('input[name="panel-type"][value="bookmarks"]').dispatchEvent(new Event('change'));
        addPanelModal.classList.remove('hidden');
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
                title = 'New Panel'; // Default for non-bookmark panels (e.g. notes)
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
        panelsContainer.appendChild(panelEl);
        saveState();

        addPanelModal.classList.add('hidden');
        addPanelModal.classList.remove('bookmark-mode'); // Reset mode
        addPanelForm.reset();
        bookmarkFolderGroup.classList.add('hidden');
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value;
            if (query) {
                window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        }
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


    // --- Initialization ---
    loadState();
});

// --- Functions called by settings.js ---
function renderBookmarks(element, bookmarks) {
    element.innerHTML = ''; // Clear existing bookmarks
    const fragment = document.createDocumentFragment();
    bookmarks.forEach(bookmark => {
        if (bookmark.url) {
            const link = document.createElement('a');
            link.href = bookmark.url;
            link.textContent = bookmark.title;
            link.className = 'bookmark-link';
            fragment.appendChild(link);
        }
    });
    element.appendChild(fragment);
}

function applySettings(settings) {
    if (!settings) return;
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    const sidebarBookmarks = document.getElementById('sidebar-bookmarks');
    const headerBookmarks = document.getElementById('header-bookmarks');
    if (settings.sidebarFolderId) {
        getBookmarksInFolder(settings.sidebarFolderId, (bookmarks) => renderBookmarks(sidebarBookmarks, bookmarks));
    } else {
        sidebarBookmarks.innerHTML = '<p style="padding: 8px;">Select a folder in settings.</p>';
    }
    if (settings.headerFolderId) {
        getBookmarksInFolder(settings.headerFolderId, (bookmarks) => renderBookmarks(headerBookmarks, bookmarks));
    } else {
        headerBookmarks.innerHTML = '';
    }
}
