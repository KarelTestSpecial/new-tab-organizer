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
    document.getElementById('add-panel-btn').addEventListener('click', () => {
        addPanelModal.classList.remove('hidden');
    });

    cancelAddPanelBtn.addEventListener('click', () => {
        addPanelModal.classList.add('hidden');
    });

    addPanelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = e.target.elements['panel-title-input'].value;
        const type = e.target.elements['panel-type'].value;

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
        if (e.target.classList.contains('drag-handle')) {
            const panel = e.target.closest('.panel');
            panel.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        } else {
            // If not dragging from the handle, prevent drag
            e.preventDefault();
        }
    });

    panelsContainer.addEventListener('dragend', e => {
        const panel = e.target.closest('.panel');
        if (panel) {
            panel.classList.remove('dragging');
        }
    });

    panelsContainer.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingPanel = document.querySelector('.panel.dragging');
        if (!draggingPanel) return;

        const afterElement = getDragAfterElement(panelsContainer, e.clientX);
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

    function getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.panel:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }


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
