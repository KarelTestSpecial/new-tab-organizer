const undoStack = [];
const redoStack = []; // Global Redo Stack
window.redoStack = redoStack; // Expose for panels.js to clear it
window.bookmarkRefreshCallbacks = [];
// Global settings for the date, defaults
window.currentDateSettings = {
    showYear: true,
    showDayOfWeek: true,
    fontSize: '11px'
};

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
    // --- Startup Logic ---
    if (CURRENT_VIEW === 'A') {
        if (!window.sessionStorage.getItem('startupHandled')) {
            window.sessionStorage.setItem('startupHandled', 'true');
            chrome.storage.local.get('settings', (localData) => {
                const settings = localData.settings || {};
                const startupA = typeof settings.startupA === 'boolean' ? settings.startupA : true;
                const startupB = typeof settings.startupB === 'boolean' ? settings.startupB : false;
                const startupC = typeof settings.startupC === 'boolean' ? settings.startupC : false;

                if (!startupA) {
                    // User doesn't want A on startup.
                    if (startupB) {
                        // Redirect current tab A to B
                        window.location.replace('panelB.html');
                        if (startupC) {
                            chrome.tabs.create({ url: 'panelC.html', active: false });
                        }
                    } else if (startupC) {
                        // Redirect current tab A to C
                        window.location.replace('panelC.html');
                    }
                    // If all false, validation in settings should prevent this, but default A is fallback
                } else {
                    // A is wanted (and we are here). Open others if needed.
                    if (startupB) chrome.tabs.create({ url: 'panelB.html', active: false });
                    if (startupC) chrome.tabs.create({ url: 'panelC.html', active: false });
                }
            });
        }
    }

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
                addPanelToContainer(panelEl, 'bottom');
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
    const addNotesModal = document.getElementById('add-notes-panel-modal');
    const addBookmarksModal = document.getElementById('add-bookmarks-panel-modal');
    const notesForm = document.getElementById('add-notes-panel-form');
    const bookmarksForm = document.getElementById('add-bookmarks-panel-form');
    const panelFolderSelect = document.getElementById('panel-folder-select');

    function populateBookmarkFolderDropdown() {
        const currentFolder = panelFolderSelect.value;
        getBookmarkFolders(folders => {
            panelFolderSelect.innerHTML = '<option value="">--Select a folder--</option>';
            folders.forEach(folder => {
                if (folder.id === '0') return;
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.title;
                panelFolderSelect.appendChild(option);
            });
            panelFolderSelect.value = currentFolder;
        });
    }

    populateBookmarkFolderDropdown();

    // --- Bookmark Change Listener for Auto-Refresh ---
    const bookmarkChangeListener = () => {
        // This is a simple way to refresh. It could be more targeted.
        // For example, check if the changed node is a folder.
        populateBookmarkFolderDropdown();
    };

    chrome.bookmarks.onCreated.addListener(bookmarkChangeListener);
    chrome.bookmarks.onRemoved.addListener(bookmarkChangeListener);
    chrome.bookmarks.onChanged.addListener(bookmarkChangeListener);
    chrome.bookmarks.onMoved.addListener(bookmarkChangeListener);


    const addPanelToContainer = (panelEl, position) => {
        if (position === 'top') {
            panelsContainer.prepend(panelEl);
        } else {
            panelsContainer.appendChild(panelEl);
        }
        saveState();
    };

    document.getElementById('add-notes-panel-btn').addEventListener('click', () => {
        chrome.storage.local.get('notesPanelPosition', (data) => {
            const position = data.notesPanelPosition || 'bottom';
            notesForm.elements['notes-position'].value = position;
        });
        addNotesModal.classList.remove('hidden');
    });

    document.getElementById('add-bookmarks-panel-btn').addEventListener('click', () => {
        chrome.storage.local.get('bookmarksPanelPosition', (data) => {
            const position = data.bookmarksPanelPosition || 'bottom';
            bookmarksForm.elements['bookmarks-position'].value = position;
        });
        addBookmarksModal.classList.remove('hidden');
    });

    document.getElementById('quick-backup-btn').addEventListener('click', () => {
        if (window.handleExport) {
            window.handleExport(STORAGE_KEY);
        } else {
            alert('Could not perform export. Function not found.');
        }
    });

    addNotesModal.querySelector('.cancel-btn').addEventListener('click', () => {
        addNotesModal.classList.add('hidden');
    });

    addBookmarksModal.querySelector('.cancel-btn').addEventListener('click', () => {
        addBookmarksModal.classList.add('hidden');
    });

    document.getElementById('sort-bookmarks-popup-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to sort the bookmarks on your bookmark bar? This action cannot be undone.')) {
            chrome.storage.local.get('settings', (data) => {
                const settings = data.settings || {};
                const sortOptions = {
                    recursive: typeof settings.sortRecursively === 'boolean' ? settings.sortRecursively : false,
                    sortOrder: settings.sortOrder || 'mixed',
                };
                sortBookmarksOnBookmarkBar(sortOptions, () => {
                    alert('Bookmark bar has been sorted!');
                    // Also refresh the folder dropdown in case folder names were sorted
                    populateBookmarkFolderDropdown();
                });
            });
        }
    });

    notesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const position = notesForm.elements['notes-position'].value;
        chrome.storage.local.set({ notesPanelPosition: position });
        const newPanelState = {
            id: `panel-${Date.now()}`,
            title: 'New Notes',
            type: 'notes',
            cards: [{ id: `card-${Date.now()}`, text: 'New Card' }]
        };
        const panelEl = createPanel(newPanelState, saveState);
        addPanelToContainer(panelEl, position);
        addNotesModal.classList.add('hidden');
    });

    bookmarksForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const position = bookmarksForm.elements['bookmarks-position'].value;
        chrome.storage.local.set({ bookmarksPanelPosition: position });
        const folderId = panelFolderSelect.value;
        if (!folderId) {
            alert('Please select a bookmark folder.');
            return;
        }
        const title = panelFolderSelect.options[panelFolderSelect.selectedIndex].text;
        const newPanelState = {
            id: `panel-${Date.now()}`,
            title: title,
            type: 'bookmarks',
            folderId: folderId,
            cards: []
        };
        const panelEl = createPanel(newPanelState, saveState);
        addPanelToContainer(panelEl, position);
        addBookmarksModal.classList.add('hidden');
    });

    document.getElementById('bookmarks-title-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://bookmarks' });
    });

    // --- Move Panel Modal Logic ---
    const movePanelModal = document.getElementById('move-panel-modal');
    const movePanelForm = document.getElementById('move-panel-form');
    const movePanelTargetName = document.getElementById('move-panel-target-name');
    let movePanelId = null;
    let moveTargetView = null;

    window.showMovePanelModal = (panelId, targetView) => {
        movePanelId = panelId;
        moveTargetView = targetView;
        movePanelTargetName.textContent = targetView;

        // Load default preference (remembered choice)
        chrome.storage.local.get('settings', (data) => {
            const settings = data.settings || {};
            const position = settings.newPanelPosition || 'bottom'; // Default to bottom
            if (position === 'top') {
                movePanelForm.querySelector('input[value="top"]').checked = true;
            } else {
                movePanelForm.querySelector('input[value="bottom"]').checked = true;
            }
            movePanelModal.classList.remove('hidden');
        });
    };

    movePanelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedPosition = movePanelForm.querySelector('input[name="move-position"]:checked').value;

        // Save the choice as the new preference ("remember it")
        chrome.storage.local.get('settings', (data) => {
            const currentSettings = data.settings || {};
            currentSettings.newPanelPosition = selectedPosition;
            chrome.storage.local.set({ settings: currentSettings }, () => {
                // Perform the move
                if (window.movePanelToOrganizer) {
                    window.movePanelToOrganizer(movePanelId, CURRENT_VIEW, moveTargetView, selectedPosition);
                }
                movePanelModal.classList.add('hidden');
            });
        });
    });

    movePanelModal.querySelector('.cancel-btn').addEventListener('click', () => {
        movePanelModal.classList.add('hidden');
    });

    document.getElementById('history-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://history' });
    });

    // --- Undo Logic ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            // Check for focused text element first for immediate text undo
            // Must differentiate between Card Text (P) and Panel Title (H3)
            if (document.activeElement && document.activeElement.isContentEditable && document.activeElement.tagName === 'P') {
                const p = document.activeElement;
                const originalText = p.dataset.originalText;

                if (originalText !== undefined && p.textContent !== originalText) {
                    e.preventDefault();

                    // Manually construct the redo item for this specific focused-undo action
                    const redoItem = {
                        itemType: 'text-edit',
                        cardId: p.closest('.card').id,
                        oldText: originalText,
                        newText: p.textContent
                    };

                    p.textContent = originalText;

                    // Add to Redo Stack
                    redoStack.push(redoItem);
                    saveState();

                    return;
                }
            } else if (document.activeElement && document.activeElement.tagName === 'H3' && document.activeElement.isContentEditable) {
                // Check for focused panel title
                const h3 = document.activeElement;
                const originalText = h3.dataset.originalText;

                if (originalText !== undefined && h3.textContent !== originalText) {
                    e.preventDefault();

                    const panel = h3.closest('.panel');
                    const redoItem = {
                        itemType: 'panel-title-edit',
                        panelId: panel ? panel.dataset.id : null,
                        oldTitle: originalText,
                        newTitle: h3.textContent
                    };

                    h3.textContent = originalText;

                    redoStack.push(redoItem);
                    saveState();

                    return;
                }
            }

            e.preventDefault();
            if (undoStack.length > 0) {
                const undoItem = undoStack.pop();
                if (undoItem.itemType === 'panel') {
                    const newPanel = createPanel(undoItem.state, saveState);
                    const nextSibling = undoItem.nextSiblingId ? document.querySelector(`[data-id='${undoItem.nextSiblingId}']`) : null;
                    panelsContainer.insertBefore(newPanel, nextSibling);
                } else if (undoItem.itemType === 'card') {
                    // Undo deletion of a card
                    const parentPanel = document.querySelector(`[data-id='${undoItem.parentPanelId}']`);
                    if (parentPanel) {
                        const cardsContainer = parentPanel.querySelector('.cards-container');
                        if (cardsContainer) {
                            const newCard = createCard(cardsContainer, undoItem.state, saveState);
                            const nextSibling = undoItem.nextSiblingId ? document.getElementById(undoItem.nextSiblingId) : null;
                            cardsContainer.insertBefore(newCard, nextSibling);
                        }
                    }
                } else if (undoItem.itemType === 'text-edit') {
                    const card = document.getElementById(undoItem.cardId);
                    if (card) {
                        const p = card.querySelector('p');
                        if (p) {
                            p.textContent = undoItem.oldText;
                            if (!p.textContent && card.querySelector('img')) {
                                p.classList.add('hidden');
                            } else {
                                p.classList.remove('hidden');
                            }
                        }
                    }
                } else if (undoItem.itemType === 'create-card') {
                    const card = document.getElementById(undoItem.cardId);
                    if (card) {
                        card.remove();
                    }
                } else if (undoItem.itemType === 'panel-title-edit') {
                    const panel = document.querySelector(`[data-id='${undoItem.panelId}']`);
                    if (panel) {
                        const titleEl = panel.querySelector('.panel-header h3');
                        if (titleEl) {
                            titleEl.textContent = undoItem.oldTitle;
                        }
                    }
                } else if (undoItem.itemType === 'move-card') {
                    const card = document.getElementById(undoItem.cardId);
                    const destPanel = document.querySelector(`[data-id='${undoItem.sourceParentId}']`);
                    if (card && destPanel) {
                        const destContainer = destPanel.querySelector('.cards-container');
                        if (destContainer) {
                            card.remove(); // Fix: Remove before calculating index
                            const siblings = [...destContainer.children];
                            if (undoItem.sourceIndex >= siblings.length) {
                                destContainer.appendChild(card);
                            } else {
                                destContainer.insertBefore(card, siblings[undoItem.sourceIndex]);
                            }
                        }
                    }
                } else if (undoItem.itemType === 'move-panel') {
                    // Undo: Move panel back to oldIndex
                    const panel = document.querySelector(`[data-id='${undoItem.panelId}']`);
                    const panelsContainer = document.getElementById('panels-container');
                    if (panel && panelsContainer) {
                        // Note: Sortable mutates DOM, so undo means moving it back.
                        // We need to be careful with indices. oldIndex is where it WAS.
                        panel.remove(); // Fix: Remove before calculating index
                        const siblings = [...panelsContainer.children];
                        if (undoItem.oldIndex >= siblings.length) {
                            panelsContainer.appendChild(panel);
                        } else {
                            panelsContainer.insertBefore(panel, siblings[undoItem.oldIndex]);
                        }
                    }
                }

                // Add to Redo Stack
                redoStack.push(undoItem);

                saveState();
            }
        }

        // --- Redo Logic (Ctrl+Y) ---
        if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            if (redoStack.length > 0) {
                const redoItem = redoStack.pop();

                // Re-apply the action
                if (redoItem.itemType === 'panel') {
                    // Redo panel deletion = delete it again
                    // Actually, the undo item for 'panel' is the state to RESTORE it (undoing a deletion).
                    // So REDOING it means re-deleting it?
                    // Wait. 
                    // Undo: Deletion -> Restoration.
                    // The item in undoStack is the STATE to restore. 
                    // When we UNDO, we pop this item and create the panel.
                    // We push this item to REDO stack.
                    // When we REDO, we should DELETE the panel again?
                    // OR, does undoStack contain the ACTION that was done? 
                    // No, current implementation pushes the STATE needed to REVERSE the action.
                    // E.g. deletePanel -> pushes { itemType: 'panel', state: ... }
                    // Undo -> reconstructs panel.

                    // If we push the SAME item to redoStack, 'redoItem' is { itemType: 'panel', state: ... }
                    // Redoing the undo means: we just restored it, now we want to delete it again.
                    const panel = document.querySelector(`[data-id='${redoItem.state.id}']`);
                    if (panel) panel.remove();

                } else if (redoItem.itemType === 'card') {
                    // Undo was: restore deleted card.
                    // Redo: delete it again.
                    const card = document.getElementById(redoItem.state.id);
                    if (card) card.remove();

                } else if (redoItem.itemType === 'text-edit') {
                    // Undo: set text to oldText.
                    // Redo: set text to newText.
                    const card = document.getElementById(redoItem.cardId);
                    if (card) {
                        const p = card.querySelector('p');
                        if (p) {
                            p.textContent = redoItem.newText;
                            if (!p.textContent && card.querySelector('img')) {
                                p.classList.add('hidden');
                            } else {
                                p.classList.remove('hidden');
                            }

                            // BUG FIX: If this element is currently focused, update its originalText dataset
                            // so that blurring it later doesn't generate a duplicate undo item.
                            if (document.activeElement === p) {
                                p.dataset.originalText = redoItem.newText;
                            }
                        }
                    }
                } else if (redoItem.itemType === 'create-card') {
                    // Undo: delete the created card.
                    // Redo: re-create the card? 
                    // Wait. `create-card` undo logic was `card.remove()`.
                    // So we undid the creation (deleted it).
                    // Redoing means re-creating it?
                    // But the `undoItem` for create-card only has ID and parentID. It doesn't have the content state if it wasn't saved?
                    // Actually, if we just created it, it was empty/default. 
                    // IF we typed in it, we would have text-edit actions on top?
                    // Creating card puts { itemType: 'create-card' } logic implies we remove it.
                    // To REDO (re-create), we need the state?
                    // Currently `create-card` undo item has `cardId` and `parentPanelId`.
                    // It does NOT have the text/image content.
                    // IMPORTANT: If we want to support REDO of creation, we need to generate the default state or capture state?
                    // Since `create-card` is only pushed when we add a NEW card (default empty), re-creating default is fine!
                    // BUT what if we pasted an image? The undo logic removes it. 
                    // To REDO, we need that image data.
                    // The current `js/panels.js` logic for `create-card` (paste) DOES NOT store the image blob in the undo item.
                    // Limitation: Redoing a paste might fail if we don't have the data.
                    // I should probably accept this limitation or fix it.
                    // Given the request, I will implement what I can.
                    // If I create a new card with ID, it will be empty.
                    const parentPanel = document.querySelector(`[data-id='${redoItem.parentPanelId}']`);
                    if (parentPanel) {
                        const container = parentPanel.querySelector('.cards-container');
                        // We need to re-create it. 
                        // Note: We might be missing content for pasted images.
                        // We will attempt to find text-edits in previous stack? No.
                        // Simplest: just re-create empty or with default "New Card" text if it was a button click.
                        // We don't know if it was paste or click.
                        // However, if we undo a paste, the card is gone.
                        // If we redo, we put back an empty card? That's better than nothing, but not perfect.
                        const newCard = createCard(container, { id: redoItem.cardId, text: 'New Card' }, saveState);
                        container.appendChild(newCard);
                    }

                } else if (redoItem.itemType === 'move-card') {
                    // Undo: moved back to source.
                    // Redo: move to dest.
                    const card = document.getElementById(redoItem.cardId);
                    const destPanel = document.querySelector(`[data-id='${redoItem.destParentId}']`);
                    if (card && destPanel) {
                        const destContainer = destPanel.querySelector('.cards-container');
                        if (destContainer) {
                            card.remove(); // Fix: Remove before calculating index
                            const siblings = [...destContainer.children];
                            if (redoItem.destIndex >= siblings.length) {
                                destContainer.appendChild(card);
                            } else {
                                destContainer.insertBefore(card, siblings[redoItem.destIndex]);
                            }
                        }
                    }
                } else if (redoItem.itemType === 'panel-title-edit') {
                    // Redo: set to newTitle
                    const panel = document.querySelector(`[data-id='${redoItem.panelId}']`);
                    if (panel) {
                        const titleEl = panel.querySelector('.panel-header h3');
                        if (titleEl) {
                            titleEl.textContent = redoItem.newTitle;

                            // BUG FIX: If this element is currently focused, update its originalText dataset
                            if (document.activeElement === titleEl) {
                                titleEl.dataset.originalText = redoItem.newTitle;
                            }
                        }
                    }
                } else if (redoItem.itemType === 'move-panel') {
                    // Redo: Move panel to newIndex
                    const panel = document.querySelector(`[data-id='${redoItem.panelId}']`);
                    const panelsContainer = document.getElementById('panels-container');
                    if (panel && panelsContainer) {
                        panel.remove(); // Fix: Remove before calculating index
                        const siblings = [...panelsContainer.children];
                        if (redoItem.newIndex >= siblings.length) {
                            panelsContainer.appendChild(panel);
                        } else {
                            panelsContainer.insertBefore(panel, siblings[redoItem.newIndex]);
                        }
                    }
                }

                undoStack.push(redoItem);
                saveState();
            }
        }
    });

    // --- Clock and Date ---
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        const dateOptions = { month: 'long', day: 'numeric' };
        if (window.currentDateSettings.showDayOfWeek) {
            dateOptions.weekday = 'long';
        }
        if (window.currentDateSettings.showYear) {
            dateOptions.year = 'numeric';
        }

        const dateElement = document.getElementById('date');
        dateElement.textContent = now.toLocaleDateString([], dateOptions);
        dateElement.style.fontSize = window.currentDateSettings.fontSize;
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

    // Initial clock update is called by loadSettings in settings_logic.js potentially, 
    // or we just call it. But applySettings will also be called.
    // We'll trust applySettings to set the initial values properly before this runs 
    // repeatedly, but calling it once to show something is fine.
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
        onEnd: function (evt) {
            document.body.classList.remove('no-select');

            if (evt.oldIndex !== evt.newIndex) {
                undoStack.push({
                    itemType: 'move-panel',
                    panelId: evt.item.dataset.id,
                    oldIndex: evt.oldIndex,
                    newIndex: evt.newIndex
                });
                if (typeof redoStack !== 'undefined') redoStack.length = 0;
            }

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

    // Handle theme and custom colors
    if (settings.theme === 'custom') {
        document.documentElement.style.setProperty('--bg-color', settings.bgColor);
        document.documentElement.style.setProperty('--text-color', settings.textColor);
        document.documentElement.style.setProperty('--sidebar-bg', settings.sidebarBg);
        document.documentElement.style.setProperty('--panel-bg', settings.sidebarBg);
        document.documentElement.style.setProperty('--border-color', settings.accentColor);
        document.documentElement.style.setProperty('--accent-color', settings.accentColor);
    } else {
        // Clear custom styles when switching back to a predefined theme
        document.documentElement.style.setProperty('--bg-color', '');
        document.documentElement.style.setProperty('--text-color', '');
        document.documentElement.style.setProperty('--sidebar-bg', '');
        document.documentElement.style.setProperty('--panel-bg', '');
        document.documentElement.style.setProperty('--border-color', '');
        document.documentElement.style.setProperty('--accent-color', '');
    }
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');

    const clockElement = document.getElementById('clock');
    const dateElement = document.getElementById('date');
    if (clockElement) clockElement.style.display = settings.showClock ? 'block' : 'none';
    if (dateElement) dateElement.style.display = settings.showDate ? 'block' : 'none';

    // Update global date settings
    window.currentDateSettings = {
        showYear: typeof settings.showYear === 'boolean' ? settings.showYear : true,
        showDayOfWeek: typeof settings.showDayOfWeek === 'boolean' ? settings.showDayOfWeek : true,
        fontSize: settings.dateFontSize || '11px'
    };

    // Force clock update to apply new formats immediately
    if (dateElement) {
        // We need to call updateClock, but it's inside DOMContentLoaded closure.
        // However, we can duplicate the date update logic briefly here or expose updateClock.
        // Easier: Since updateClock relies on `window.currentDateSettings`, 
        // and it runs every second, it will update shortly.
        // To make it instant, we can try to re-run the logic if elements exist
        const now = new Date();
        const dateOptions = { month: 'long', day: 'numeric' };
        if (window.currentDateSettings.showDayOfWeek) {
            dateOptions.weekday = 'long';
        }
        if (window.currentDateSettings.showYear) {
            dateOptions.year = 'numeric';
        }
        dateElement.textContent = now.toLocaleDateString([], dateOptions);
        dateElement.style.fontSize = window.currentDateSettings.fontSize;
    }

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
