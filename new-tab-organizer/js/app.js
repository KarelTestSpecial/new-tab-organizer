const undoStack = [];
const redoStack = []; // Global Redo Stack
window.redoStack = redoStack; // Expose for panels.js to clear it
// A registry, not a list: sidebar and every bookmark panel register one refresh
// function under a stable key. A Map replaces the entry with the same key, so
// re-rendering a panel or re-applying settings cannot stack duplicates.
window.bookmarkRefreshCallbacks = new Map();

window.currentSidebarWidth = 142;
window.updateSidebarWidthGlobally = function(w) {
    window.currentSidebarWidth = w;
    if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
};
chrome.storage.local.get('settings', data => {
    if (data.settings) {
        
        if (data.settings.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', data.settings.bookmarkFontSize);
        if (data.settings.headerFontSize) document.documentElement.style.setProperty('--header-font-size', data.settings.headerFontSize);
    }
});
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    const next = changes.settings && changes.settings.newValue;
    if (next) {
        if (next.bookmarkFontSize) document.documentElement.style.setProperty('--bookmark-font-size', next.bookmarkFontSize);
        if (next.headerFontSize) document.documentElement.style.setProperty('--header-font-size', next.headerFontSize);
        if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
        // Any open organizer tab follows settings changed in another tab, so two
        // organizers side by side do not drift apart. applySettings() does not
        // write to storage, so this cannot loop.
        if (typeof applySettings === 'function' && document.getElementById('sidebar-bookmarks')) {
            applySettings(next);
        }
    }

    if (changes.sidebarWidth && changes.sidebarWidth.newValue) {
        window.currentSidebarWidth = changes.sidebarWidth.newValue;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.width = `${changes.sidebarWidth.newValue}px`;
            sidebar.style.minWidth = `${changes.sidebarWidth.newValue}px`;
            sidebar.style.flexBasis = `${changes.sidebarWidth.newValue}px`;
        }
        if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
    }
});

// Global settings for the date, defaults
window.currentDateSettings = {
    showYear: true,
    showDayOfWeek: true,
    fontSize: '11px'
};

// --- Organizer Configuration ---
// Every organizer is addressed by letter. The number of organizers is a setting
// (1-26), so all UI that used to hardcode A-D is rendered from this list.
function renderOrganizerConfiguration(settings) {
    const views = window.getOrganizerViews();
    window.organizerSettingsSnapshot = settings;
    window.renderOrganizerSidebarNav(views, CURRENT_VIEW);
    window.renderOrganizerSettingsControls(views, settings);
}

// --- View Identification ---
// Organizers are addressed by letter (?view=B). The old panelB.html files are
// still accepted so existing tabs and bookmarks keep working.
function getCurrentView() {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get('view') || '').toUpperCase();
    if (/^[A-Z]$/.test(requested)) return requested;

    const filename = window.location.pathname.split('/').pop();
    const match = filename.match(/^panel([A-Z])\.html$/i);
    if (match) return match[1].toUpperCase();

    return 'A'; // Default to A
}

function getStorageKey(view) {
    return window.getStorageKeyForView(view);
}

const CURRENT_VIEW = getCurrentView();
const STORAGE_KEY = getStorageKey(CURRENT_VIEW);

// --- Smart Folder Checker and Organizer Helper ---
window.ensureOrganizerFolders = function(rootId, callback) {
    chrome.bookmarks.getTree((tree) => {
        if (chrome.runtime.lastError || !tree || !tree[0]) {
            // Fallback to simple creation/checking if tree traversal fails
            chrome.bookmarks.getChildren(rootId, (children) => {
                if (chrome.runtime.lastError) {
                    if (callback) callback();
                    return;
                }
                const views = getOrganizerViews();
                let promises = views.map(v => {
                    return new Promise((resolve) => {
                        const folderName = `Organizer ${v}`;
                        const exists = children.some(c => !c.url && c.title === folderName);
                        if (!exists) {
                            chrome.bookmarks.create({ parentId: rootId, title: folderName }, () => resolve());
                        } else {
                            resolve();
                        }
                    });
                });
                Promise.all(promises).then(() => {
                    if (callback) callback();
                });
            });
            return;
        }

        const foundFolders = {};
        function traverse(node) {
            if (!node.url && isOrganizerFolderTitle(node.title)) {
                foundFolders[node.title] = node;
            }
            if (node.children) node.children.forEach(traverse);
        }
        traverse(tree[0]);

        const views = getOrganizerViews();
        let promises = views.map(v => {
            return new Promise((resolve) => {
                const folderName = `Organizer ${v}`;
                const existingFolder = foundFolders[folderName];
                if (existingFolder) {
                    if (existingFolder.parentId === rootId) {
                        // Already in correct root
                        resolve();
                    } else {
                        // Move existing folder (keeps all bookmarks inside it!)
                        chrome.bookmarks.move(existingFolder.id, { parentId: rootId }, () => {
                            resolve();
                        });
                    }
                } else {
                    // Create new empty folder
                    chrome.bookmarks.create({ parentId: rootId, title: folderName }, () => {
                        resolve();
                    });
                }
            });
        });

        Promise.all(promises).then(() => {
            if (callback) callback();
        });
    });
};

// 5.7 created the sidebar folder under its translated name ('Zijbalk' for
// Dutch); 6.0 calls it 'Sidebar'. Rename it in place so the id, and every
// bookmark inside it, survives - only the title changes.
window.migrateLegacySidebarFolder = function (callback) {
    chrome.storage.local.get('settings', (data) => {
        const sidebarId = (data.settings || {}).sidebarFolderId;
        if (!sidebarId) {
            if (callback) callback(false);
            return;
        }

        chrome.bookmarks.get(sidebarId, (results) => {
            const node = !chrome.runtime.lastError && results && results[0];
            if (!node || !/^zijbalk$/i.test((node.title || '').trim())) {
                if (callback) callback(false);
                return;
            }

            chrome.bookmarks.getChildren(node.parentId, (children) => {
                // Never rename onto an existing 'Sidebar' folder: that would
                // either fail or create a confusing duplicate.
                const clash = (children || []).some((child) =>
                    child.id !== sidebarId && /^sidebar$/i.test((child.title || '').trim()));
                if (clash) {
                    if (callback) callback(false);
                    return;
                }

                chrome.bookmarks.move(sidebarId, { title: 'Sidebar' }, () => {
                    if (chrome.runtime.lastError) {
                        if (callback) callback(false);
                        return;
                    }
                    window.dispatchEvent(new Event('sidebarfolderrenamed'));
                    if (callback) callback(true);
                });
            });
        });
    });
};

window.ensureSidebarFolder = function(rootId, settingsObj, callback) {
    const findOrCreateSidebar = () => {
        const folderName = 'Sidebar';
        chrome.bookmarks.create({ parentId: rootId, title: folderName }, (newFolder) => {
            if (!chrome.runtime.lastError && newFolder) {
                settingsObj.sidebarFolderId = newFolder.id;
            }
            if (callback) callback();
        });
    };

    const sidebarId = settingsObj.sidebarFolderId;
    if (!sidebarId) {
        findOrCreateSidebar();
        return;
    }

    chrome.bookmarks.get(sidebarId, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
            findOrCreateSidebar();
        } else if (results[0].parentId !== rootId) {
            chrome.bookmarks.move(sidebarId, { parentId: rootId }, () => {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Renaming is async, so it can finish after the settings dropdown was
    // filled; settings_logic listens for the event and refills it.
    window.migrateLegacySidebarFolder();

    // --- Organizer configuration (count + views) ---
    // The view list is needed before any nav link or folder check runs.
    chrome.storage.local.get('settings', (data) => {
        const settings = data.settings || {};
        let count = parseInt(settings.organizerCount, 10);
        if (isNaN(count)) count = ORGANIZERS.DEFAULT_COUNT;
        count = Math.min(ORGANIZERS.MAX_COUNT, Math.max(1, count));

        const views = [];
        for (let i = 0; i < count; i++) views.push(ORGANIZERS.toLetter(i));
        window.organizerViews = views;

        renderOrganizerConfiguration(settings);
    });

    // --- Organizer Folders Upgrade Logic ---
    chrome.storage.local.get(['foldersUpgradeDone', 'settings'], (data) => {
        if (!data.foldersUpgradeDone) {
            const settings = data.settings || {};
            const rootId = settings.rootFolderId || '1'; // Default to Bookmark Bar

            chrome.bookmarks.getChildren(rootId, (children) => {
                if (chrome.runtime.lastError) return; // Silent fail if root folder doesn't exist
                const views = getOrganizerViews();
                const allExist = views.every(v => children.some(c => !c.url && c.title === `Organizer ${v}`));

                if (!allExist) {
                    const upgradeModal = document.getElementById('upgrade-modal');
                    const upgradeForm = document.getElementById('upgrade-form');
                    const upgradeRootSelect = document.getElementById('upgrade-root-select');
                    const upgradeCancelBtn = document.getElementById('upgrade-cancel-btn');
                    const upgradeSummary = document.getElementById('upgrade-organizer-summary');

                    if (upgradeModal && upgradeForm && upgradeRootSelect) {
                        upgradeRootSelect.innerHTML = '';
                        const barOption = document.createElement('option');
                        barOption.value = '1';
                        barOption.textContent = 'Bookmark Bar';

                        const otherOption = document.createElement('option');
                        otherOption.value = '2';
                        otherOption.textContent = 'Other Bookmarks';

                        upgradeRootSelect.appendChild(barOption);
                        upgradeRootSelect.appendChild(otherOption);

                        upgradeRootSelect.value = rootId; // Default selection = current setting

                        // The number of organizers is configurable, so the list of
                        // folder names in the dialog has to follow it.
                        if (upgradeSummary) {
                            const range = views.length > 3
                                ? views[0] + '\u2013' + views[views.length - 1]
                                : views.join(', ');
                            upgradeSummary.textContent = views.length === 1
                                ? 'Upgrade: Your organizer gets its own folder in Chrome Bookmarks.'
                                : 'Upgrade: Each organizer (' + range + ') gets its own folder in Chrome Bookmarks.';
                        }

                        upgradeModal.classList.remove('hidden');

                        const handleSubmit = (e) => {
                            e.preventDefault();
                            const selectedRoot = upgradeRootSelect.value;
                            settings.rootFolderId = selectedRoot;

                            // The dialog itself is the confirmation, so skip the
                            // generic one. Persist after the folders exist, so a
                            // freshly created Sidebar id is saved too.
                            window.setOrganizerFoldersEnabled(true, {
                                settings,
                                rootId: selectedRoot,
                                confirm: false,
                                done: (ok) => {
                                    if (!ok) return;
                                    chrome.storage.local.set({ settings, foldersUpgradeDone: true }, () => {
                                        upgradeModal.classList.add('hidden');
                                        if (window.populateBookmarkFolderDropdown) {
                                            window.populateBookmarkFolderDropdown(); // Refresh UI
                                        }
                                    });
                                }
                            });
                        };

                        // Use a named function to avoid duplicate listeners if executed multiple times
                        upgradeForm.onsubmit = handleSubmit;

                        upgradeCancelBtn.onclick = () => {
                            upgradeModal.classList.add('hidden');
                            chrome.storage.local.set({ foldersUpgradeDone: true });
                        };
                    }
                } else {
                    // They already exist, just mark as done
                    chrome.storage.local.set({ foldersUpgradeDone: true });
                }
            });
        }
    });

    // --- Startup Logic ---
    // The new tab always loads organizer A, so that is the tab to keep. If A is
    // not wanted, this tab is redirected to the first organizer that is; the
    // rest of the enabled organizers open in background tabs.
    if (CURRENT_VIEW === 'A') {
        chrome.storage.local.get('settings', (localData) => {
            const settings = localData.settings || {};
            const enabledViews = getStartupViews(settings)
                .map((enabled, index) => (enabled ? ORGANIZERS.toLetter(index) : null))
                .filter(Boolean);

            const keepView = enabledViews.includes('A') ? 'A' : enabledViews[0];

            if (keepView && keepView !== 'A') {
                window.location.replace(ORGANIZERS.makePanelUrl(keepView));
            }

            enabledViews
                .filter(view => view !== keepView)
                .forEach(view => chrome.tabs.create({ url: ORGANIZERS.makePanelUrl(view), active: false }));
        });
    }

    const panelsContainer = document.getElementById('panels-container');

    // --- State Management ---
    const saveState = () => {
        chrome.storage.local.get(STORAGE_KEY, (data) => {
            const existingPanels = data[STORAGE_KEY] || [];
            const panels = [];
            const imagesToSaveLocally = {};

            document.querySelectorAll('.panel').forEach(panelEl => {
                const panelId = panelEl.dataset.id;
                const existingPanel = existingPanels.find(p => p.id === panelId);

                const panel = {
                    id: panelId,
                    title: panelEl.querySelector('h3').textContent,
                    type: panelEl.dataset.type,
                    folderId: panelEl.dataset.folderId,
                    cards: [],
                    bookmarkOrder: (existingPanel && existingPanel.bookmarkOrder) ? existingPanel.bookmarkOrder : []
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

            // The DOM can be showing an alphabetical view while the stored order
            // is the user's own. Saving the DOM order would silently replace it,
            // so switching back to Manual would lose the original order.
            if (window.ORDERING && window.ORDERING.panelsPolicy(window.__orderingSettings || {}, CURRENT_VIEW) === window.ORDERING.ALPHABETICAL) {
                const orderMap = new Map(existingPanels.map((panel, index) => [panel.id, index]));
                panels.sort((a, b) => {
                    const ai = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
                    const bi = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });
            }

            chrome.storage.local.set({ [STORAGE_KEY]: panels });
        });
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

    let panelsSortable = null;

    const panelsPolicy = () => (window.ORDERING
        ? window.ORDERING.panelsPolicy(window.__orderingSettings || {}, CURRENT_VIEW)
        : 'manual');

    const renderPanels = (panelsState) => {
        const policy = panelsPolicy();
        const ordered = window.ORDERING ? window.ORDERING.sortByName(panelsState, policy) : panelsState;
        const alphabetical = window.ORDERING && policy === window.ORDERING.ALPHABETICAL;

        // createPanel() registers one refresh callback per bookmark panel. Drop
        // the previous set first: otherwise every re-render leaves the old
        // closures behind, each doing work against a detached DOM node.
        if (window.bookmarkRefreshCallbacks) {
            [...window.bookmarkRefreshCallbacks.keys()]
                .filter((key) => key.startsWith('panel:'))
                .forEach((key) => window.bookmarkRefreshCallbacks.delete(key));
        }

        panelsContainer.innerHTML = '';
        ordered.forEach(panelState => {
            const panelEl = createPanel(panelState, saveState);
            panelsContainer.appendChild(panelEl);
        });

        // A list that is sorted on every render must not accept drops: the next
        // render would undo them and the drag would look broken.
        window.__lastPanelsPolicy = Boolean(alphabetical);
        if (panelsSortable) panelsSortable.option('disabled', Boolean(alphabetical));
    };

    // Called when the ordering policy changes in settings, so the visible order
    // follows without a reload.
    window.refreshPanelOrder = () => {
        chrome.storage.local.get(STORAGE_KEY, (data) => {
            renderPanels(data[STORAGE_KEY] || []);
        });
    };

    // --- Modal Logic ---
    const addNotesModal = document.getElementById('add-notes-panel-modal');
    const addBookmarksModal = document.getElementById('add-bookmarks-panel-modal');
    const notesForm = document.getElementById('add-notes-panel-form');
    const bookmarksForm = document.getElementById('add-bookmarks-panel-form');
    const panelFolderSelect = document.getElementById('panel-folder-select');
    let panelFolderPicker = null;
    let usedFolderIdsRef = new Set();

    function currentPanelFolderIds() {
        return panelFolderPicker ? panelFolderPicker.getValues() : [];
    }

    function currentPanelFolderTitle(id) {
        return panelFolderPicker ? panelFolderPicker.getTitle(id) : '';
    }

    function populateBookmarkFolderDropdown() {
        chrome.storage.local.get(['settings', STORAGE_KEY], (data) => {
            const settings = data.settings || {};
            const targetRootId = settings.rootFolderId || '1';

            const existingPanels = data[STORAGE_KEY] || [];
            const usedFolderIds = new Set();
            existingPanels.forEach(panel => {
                if (panel.type === 'bookmarks' && panel.folderId) {
                    usedFolderIds.add(panel.folderId);
                }
            });
            usedFolderIdsRef = usedFolderIds;

            const skipIds = new Set();
            if (settings.sidebarFolderId) skipIds.add(settings.sidebarFolderId);

            function getFoldersRecursive(parentId, depth, callback) {
                chrome.bookmarks.getSubTree(parentId, (results) => {
                    if (chrome.runtime.lastError) return callback && callback([]);
                    const folders = [];
                    function traverse(node, currentDepth) {
                        if (!node.url) {
                            if (node.id !== parentId) {
                                folders.push({
                                    id: node.id,
                                    title: node.title || 'Unnamed',
                                    depth: currentDepth
                                });
                            }
                            if (node.children) {
                                node.children.forEach(child => traverse(child, currentDepth + 1));
                            }
                        }
                    }
                    if (results && results[0]) {
                        traverse(results[0], 0);
                    }
                    callback(folders);
                });
            }

            getFoldersRecursive(targetRootId, 0, folders => {
                const visible = folders.filter(folder => !skipIds.has(folder.id));

                if (!panelFolderPicker) {
                    panelFolderPicker = window.FolderPicker.create(panelFolderSelect, {
                        multi: true,
                        allowNewFolder: false,
                        emptyLabel: 'Pick folders…',
                        searchPlaceholder: 'Search folders…',
                        isUsed: (id) => usedFolderIdsRef.has(id)
                    });
                }

                // Keep the current selection across refreshes, but drop ids that
                // no longer exist (deleted folder, different root).
                const wanted = currentPanelFolderIds().filter(id => visible.some(folder => folder.id === id));
                panelFolderPicker.setFolders(visible, wanted);
            });
        });
    }
    window.populateBookmarkFolderDropdown = populateBookmarkFolderDropdown;

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
        // Focus the Create button so user can immediately press Enter
        const notesSubmitBtn = document.querySelector('#add-notes-panel-form button[type="submit"]');
        if (notesSubmitBtn) {
            setTimeout(() => notesSubmitBtn.focus(), 10);
        }
    });

    document.getElementById('add-bookmarks-panel-btn').addEventListener('click', () => {
        chrome.storage.local.get(['bookmarksPanelPosition', 'settings'], (data) => {
            const position = data.bookmarksPanelPosition || 'bottom';
            bookmarksForm.elements['bookmarks-position'].value = position;
            
            // Sync modal toggle with settings
            const useFolders = data.settings && data.settings.useOrganizerFolders;
            const modalToggle = document.getElementById('modal-use-organizer-folders-toggle');
            if (modalToggle) modalToggle.checked = !!useFolders;
        });
        addBookmarksModal.classList.remove('hidden');
        // Reset recursive checkbox
        document.getElementById('import-subfolders-checkbox').checked = false;
        document.getElementById('import-recursive-checkbox').checked = false;
        document.getElementById('recursive-import-label').classList.add('hidden');
        document.getElementById('sort-bookmarks-popup-btn').textContent = 'Sort Root Folder';
        // Reset create folder input
        const newFolderInput = document.getElementById('new-bookmark-folder-name');
        if (newFolderInput) newFolderInput.value = '';
        // Focus the selection field immediately so it's ready for interaction
        setTimeout(() => panelFolderSelect.focus(), 10);
    });

    // Handle modal toggle change (Sync with settings)
    const modalFolderToggle = document.getElementById('modal-use-organizer-folders-toggle');
    if (modalFolderToggle) {
        modalFolderToggle.addEventListener('change', (e) => {
            const enable = e.target.checked;
            chrome.storage.local.get('settings', (data) => {
                const settings = data.settings || {};
                const rootId = settings.rootFolderId || '1';

                window.setOrganizerFoldersEnabled(enable, {
                    settings,
                    rootId,
                    done: (ok) => {
                        modalFolderToggle.checked = Boolean(settings.useOrganizerFolders);
                        if (ok && enable) {
                            chrome.storage.local.set({ settings, foldersUpgradeDone: true }, () => {
                                if (window.populateBookmarkFolderDropdown) window.populateBookmarkFolderDropdown();
                            });
                        } else {
                            chrome.storage.local.set({ settings }, () => {
                                if (window.populateBookmarkFolderDropdown) window.populateBookmarkFolderDropdown();
                            });
                        }
                    }
                });
            });
        });
    }

    const createNewFolderBtn = document.getElementById('create-new-bookmark-folder-btn');
    const newFolderNameInput = document.getElementById('new-bookmark-folder-name');

    // Global variable to track the last active panel folder
    window.lastActivePanelFolderId = null;

    // Track clicks on panels to update the active folder
    document.addEventListener('click', (e) => {
        const panel = e.target.closest('.panel');
        if (panel && panel.dataset.type === 'bookmarks' && panel.dataset.folderId) {
            window.lastActivePanelFolderId = panel.dataset.folderId;
        }
    });

    if (createNewFolderBtn && newFolderNameInput) {
        createNewFolderBtn.addEventListener('click', () => {
            const folderName = newFolderNameInput.value.trim();
            if (!folderName) {
                alert("Please provide a name for the new folder.");
                return;
            }

            chrome.storage.local.get('settings', (data) => {
                const settings = data.settings || {};
                const isFoldersEnabled = settings.useOrganizerFolders;
                const baseRootId = settings.rootFolderId || '1';

                const createFolderAndPanel = (parentId) => {
                    chrome.bookmarks.create({ parentId: parentId, title: folderName }, (newFolder) => {
                        if (chrome.runtime.lastError) {
                            alert("Error creating folder: " + chrome.runtime.lastError.message);
                            return;
                        }
                        // Add as a panel to the current view
                        const position = bookmarksForm.elements['bookmarks-position'].value || 'bottom';
                        // Save the preference
                        chrome.storage.local.set({ 'bookmarksPanelPosition': position });

                        const newPanelState = {
                            id: `panel-${Date.now()}-${newFolder.id}-`,
                            title: newFolder.title,
                            type: 'bookmarks',
                            folderId: newFolder.id,
                            cards: []
                        };
                        const panelEl = createPanel(newPanelState, saveState);
                        addPanelToContainer(panelEl, position);
                        if (window.populateBookmarkFolderDropdown) window.populateBookmarkFolderDropdown();
                        
                        // No implicit sort here. Creating a folder used to reorder
                        // the parent in Chrome unconditionally, which silently
                        // destroyed the user's own order. Whether a folder is
                        // kept alphabetical is the ordering policy now
                        // (js/ordering.js), not a side effect of adding a panel.
                        
                        // Don't close modal, just clear input
                        newFolderNameInput.value = '';
                    });
                };

                // Determine parent folder for new bookmark folder
                
                // 1. First priority: if user clicked on a bookmark panel, use that folder
                if (window.lastActivePanelFolderId) {
                    createFolderAndPanel(window.lastActivePanelFolderId);
                    return;
                }
                
                // 2. Second priority: try to find or create the Organizer folder for current view
                const destFolderName = `Organizer ${CURRENT_VIEW}`;
                
                // First try to find existing Organizer folder
                chrome.bookmarks.search({ title: destFolderName }, (results) => {
                    if (chrome.runtime.lastError) {
                        createFolderAndPanel(baseRootId);
                        return;
                    }
                    
                    const folders = (results || []).filter(r => !r.url);
                    
                    // Try to find exact match under the current baseRootId
                    let destFolder = folders.find(f => f.title.trim() === destFolderName && f.parentId === baseRootId);
                    
                    // If not found, try to find any folder that matches the name exactly
                    if (!destFolder) {
                        destFolder = folders.find(f => f.title.trim() === destFolderName);
                    }
                    
                    if (destFolder) {
                        createFolderAndPanel(destFolder.id);
                    } else {
                        // Organizer folder doesn't exist - create it and then create the new folder inside
                        chrome.bookmarks.create({ parentId: baseRootId, title: destFolderName }, (newOrganizerFolder) => {
                            if (chrome.runtime.lastError) {
                                // If we can't create Organizer folder, fallback to baseRootId
                                createFolderAndPanel(baseRootId);
                                return;
                            }
                            // Now create the user's new folder inside the newly created Organizer folder
                            createFolderAndPanel(newOrganizerFolder.id);
                        });
                    }
                });
            });
        });
    }

    document.getElementById('import-subfolders-checkbox').addEventListener('change', (e) => {
        const recursiveLabel = document.getElementById('recursive-import-label');
        if (e.target.checked) {
            recursiveLabel.classList.remove('hidden');
        } else {
            recursiveLabel.classList.add('hidden');
        }
    });

    panelFolderSelect.addEventListener('change', () => {
        const selectedCount = currentPanelFolderIds().length;
        document.getElementById('sort-bookmarks-popup-btn').textContent = selectedCount > 0
            ? 'Sort ' + selectedCount + ' folder' + (selectedCount === 1 ? '' : 's')
            : 'Sort root folder';
    });



    document.getElementById('quick-backup-btn').addEventListener('click', () => {
        chrome.storage.local.get([STORAGE_KEY, 'settings'], (data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `organizer-${CURRENT_VIEW}-backup.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    

    



    document.getElementById('sort-bookmarks-popup-btn').addEventListener('click', () => {
        const stateKeys = ['settings'].concat(getOrganizerStorageKeys());
        chrome.storage.local.get(stateKeys, (data) => {
            const settings = data.settings || {};
            const rootId = settings.rootFolderId || '1';
            
            const selectedFolderIds = currentPanelFolderIds();
            const isRecursive = document.getElementById('sort-recursive-popup-checkbox').checked;
            const sortBookmarks = document.getElementById('sort-bookmarks-popup-checkbox') ? document.getElementById('sort-bookmarks-popup-checkbox').checked : false;
            
            const foldersToSort = selectedFolderIds.length > 0 ? selectedFolderIds : [rootId];
            const targetName = selectedFolderIds.length > 0 ? "selected folder(s)" : (rootId === '1' ? 'Bookmark Bar' : 'Other Bookmarks');

            // Find all active bookmark panel folder IDs across all views to exclude them from recursive/general sorting
            const activeFolderIds = [];
            getOrganizerStorageKeys().forEach(key => {
                const panels = data[key] || [];
                panels.forEach(panel => {
                    if (panel.type === 'bookmarks' && panel.folderId) {
                        activeFolderIds.push(panel.folderId);
                    }
                });
            });

            if (confirm(`Are you sure you want to sort the subfolders within the ${targetName}? This action cannot be undone.`)) {
                const sortOptions = {
                    recursive: isRecursive,
                    sortOrder: settings.sortOrder || 'mixed',
                    sortBookmarks: sortBookmarks,
                    excludeFolderIds: activeFolderIds
                };
                
                let sortChain = Promise.resolve();
                foldersToSort.forEach(folderId => {
                    sortChain = sortChain.then(() => new Promise(resolve => {
                        sortBookmarksInFolder(folderId, sortOptions, resolve);
                    }));
                });

                sortChain.then(() => {
                    // Refresh the folder dropdown so the new order is visible
                    populateBookmarkFolderDropdown();
                    // Also refresh any active bookmark panels/sidebar
                    if (window.bookmarkRefreshCallbacks) {
                        window.bookmarkRefreshCallbacks.forEach(cb => cb());
                    }
                });
            }
        });
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
        chrome.storage.local.get('settings', (settingsData) => {
            const settings = settingsData.settings || {};
            const sidebarFolderId = settings.sidebarFolderId;
            const position = bookmarksForm.elements['bookmarks-position'].value;
            const importSubfolders = document.getElementById('import-subfolders-checkbox').checked;
            const isRecursive = document.getElementById('import-recursive-checkbox').checked;
            chrome.storage.local.set({ bookmarksPanelPosition: position });

            const folderIds = currentPanelFolderIds();

            const hasOrganizer = folderIds.some(id => window.isOrganizerFolderTitle(currentPanelFolderTitle(id)));
            if (hasOrganizer) {
                alert('Organizer folders cannot be added as bookmark panels. Select them only for sorting.');
                return;
            }

            if (folderIds.length === 0) {
                alert("Please select at least one bookmark folder.");
                return;
            }

            if (settings.useOrganizerFolders) {
                const confirmed = confirm("Note: all folders will be placed in the root of the Organizer folder (including subfolders), any tree structures will be lost -- everything will become one flat structure with all folders next to each other without subfolders. If you agree, the folder structure will be effectively flattened in Chrome. Do you want to continue?");
                if (!confirmed) {
                    return;
                }
            }

            const moveFolderIfEnabled = (fId) => {
                if (settings.useOrganizerFolders) {
                    const rootId = settings.rootFolderId || '1';
                    const destFolderName = `Organizer ${CURRENT_VIEW}`;
                    chrome.bookmarks.getChildren(rootId, (children) => {
                        if (chrome.runtime.lastError) return;
                        const destFolder = children.find(c => !c.url && c.title === destFolderName);
                        if (destFolder) {
                            chrome.bookmarks.move(fId, { parentId: destFolder.id });
                        }
                    });
                }
            };

            const addPanel = (fId, title, indexSuffix = '') => {
                const newPanelState = {
                    id: `panel-${Date.now()}-${fId}-${indexSuffix}`,
                    title: title,
                    type: 'bookmarks',
                    folderId: fId,
                    cards: []
                };
                const panelEl = createPanel(newPanelState, saveState);
                addPanelToContainer(panelEl, position);
                moveFolderIfEnabled(fId);
            };

            if (importSubfolders) {
                let foldersProcessed = 0;
                folderIds.forEach((fId) => {
                    // Also import the parent folder itself
                    const parentTitle = currentPanelFolderTitle(fId);
                    addPanel(fId, parentTitle, 'parent');

                    chrome.bookmarks.getSubTree(fId, (results) => {
                        if (chrome.runtime.lastError || !results && results[0] && results[0].children) {
                            const processNode = (node) => {
                                if (!node.url) {
                                    // skip sidebar folder
                                    if (node.id === sidebarFolderId) return;
                                    if (node.title && node.title.toLowerCase() === 'zijbalk') return; // Fallback

                                    addPanel(node.id, node.title, node.id);

                                    if (isRecursive && node.children) {
                                        node.children.forEach(processNode);
                                    }
                                }
                            };

                            results[0].children.forEach(processNode);
                        }

                        foldersProcessed++;
                        if (foldersProcessed === folderIds.length) {
                            if (panelFolderPicker) panelFolderPicker.close();
                            if (panelFolderPicker) panelFolderPicker.close();
                addBookmarksModal.classList.add('hidden');
                            document.getElementById('import-subfolders-checkbox').checked = false;
                            document.getElementById('import-recursive-checkbox').checked = false;
                            document.getElementById('recursive-import-label').classList.add('hidden');
                        }
                    });
                });
            } else {
                folderIds.forEach((fId, index) => {
                    const title = currentPanelFolderTitle(fId);
                    addPanel(fId, title, index);
                });
                if (panelFolderPicker) panelFolderPicker.close();
                addBookmarksModal.classList.add('hidden');
            }
        });
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

    

    document.getElementById('history-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://history' });
    });

    // --- Delete Folder Modal Logic ---
    const deleteFolderModal = document.getElementById('delete-folder-modal');
    const deleteFolderForm = document.getElementById('delete-folder-form');
    const deleteFolderName = document.getElementById('delete-folder-name');
    const deleteConfirmInput = document.getElementById('delete-folder-confirmation-input');
    const confirmDeleteBtn = document.getElementById('confirm-delete-folder-btn');
    let panelIdToDelete = null;
    let folderNameToConfirm = '';

    window.showDeleteFolderModal = (panelId, folderName) => {
        panelIdToDelete = panelId;
        folderNameToConfirm = folderName;
        deleteFolderName.textContent = folderName;
        deleteConfirmInput.value = '';
        confirmDeleteBtn.disabled = true;
        deleteFolderModal.classList.remove('hidden');
        deleteConfirmInput.focus();
    };

    deleteConfirmInput.addEventListener('input', () => {
        confirmDeleteBtn.disabled = deleteConfirmInput.value.trim() !== folderNameToConfirm;
    });

    

    deleteFolderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (deleteConfirmInput.value.trim() !== folderNameToConfirm) {
            alert('The folder name does not match. Deletion cancelled.');
            return;
        }

        const panelEl = document.querySelector(`.panel[data-id='${panelIdToDelete}']`);
        if (panelEl && panelEl.dataset.folderId) {
            chrome.bookmarks.removeTree(panelEl.dataset.folderId, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    alert(`Error deleting bookmark folder: ${chrome.runtime.lastError.message}`);
                } else {
                    panelEl.remove();
                    saveState();
                    alert(`Folder "${folderNameToConfirm}" has been deleted.`);
                }
            });
        }
        deleteFolderModal.classList.add('hidden');
    });

    // Global pointerdown listener to clear focus and selection when clicking on empty space
    document.addEventListener('pointerdown', (e) => {
        // Find if they clicked on any interactive or card element
        const isInteractive = e.target.closest('.card, .bookmark-item, button, input, select, textarea, h3, a, .context-menu');
        
        if (!isInteractive) {
            // Clicked on empty space! Clear focus and text selections
            if (document.activeElement && document.activeElement.isContentEditable) {
                document.activeElement.blur();
            }
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
            
            // If they clicked on a container that might auto-focus children (like the panel or cards container),
            // prevent the default focus behavior.
            // DO NOT prevent default if clicking the drag-handle, as it breaks SortableJS pointer events.
            if (e.target.closest('#panels-container, .cards-container, .panel') && !e.target.closest('.drag-handle')) {
                e.preventDefault();
            }
        }
    });

    // Unified Modal Close (X button and Cancel button)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('cancel-btn') || e.target.classList.contains('modal-close-btn')) {
            const modal = e.target.closest('.modal');
            if (modal) {
                // The popover lives on <body>, so hiding the modal would leave it.
                if (panelFolderPicker) panelFolderPicker.close();
                modal.classList.add('hidden');
            }
        }
    });

    // --- Undo Logic ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close all modals
            document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
            if (panelFolderPicker) panelFolderPicker.close();
            // Close settings panel
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel) settingsPanel.classList.add('hidden');
        }

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

    // --- Clock, Date and Battery ---
    function updateBattery() {
        const batteryElement = document.getElementById('battery');
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                function displayBattery() {
                    const level = Math.round(battery.level * 100);
                    const isCharging = battery.charging;
                    batteryElement.textContent = `${level}%${isCharging ? ' ⚡' : ''}`;
                }
                displayBattery();
                battery.addEventListener('levelchange', displayBattery);
                battery.addEventListener('chargingchange', displayBattery);
            });
        } else {
            batteryElement.style.display = 'none';
        }
    }

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

        const batteryElement = document.getElementById('battery');
        if (batteryElement) {
            batteryElement.style.fontSize = window.currentDateSettings.fontSize;
        }

        updateBattery();
    }

    // --- View Navigation ---
    function organizerTabUrl(view) {
        return chrome.runtime.getURL('panel.html') + '?view=' + view;
    }

    // chrome.tabs.query({url}) does not match URLs with a query string reliably,
    // so all extension tabs are listed and matched on the base path instead.
    function findOrganizerTab(view, callback) {
        const basePath = chrome.runtime.getURL('panel.html');
        chrome.tabs.query({}, (tabs) => {
            const matches = (tabs || []).filter((tab) => {
                if (!tab.url || !tab.url.startsWith(basePath)) return false;
                if (tab.url === basePath) return view === 'A';
                return new URL(tab.url).searchParams.get('view') === view;
            });
            callback(matches);
        });
    }

    function focusTab(tab) {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    }

    function navigateToView(view, isCtrlClick) {
        if (!isCtrlClick) {
            window.location.href = '?view=' + view;
            return;
        }

        findOrganizerTab(view, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.reload(tabs[0].id);
                focusTab(tabs[0]);
                return;
            }

            // Nothing open for this organizer. For organizer A there is usually a
            // new-tab page we can turn into the organizer instead of opening another tab.
            if (view === 'A') {
                chrome.tabs.query({ url: 'chrome://newtab/' }, (newTabs) => {
                    if (newTabs.length > 0) {
                        chrome.tabs.update(newTabs[0].id, { url: organizerTabUrl('A'), active: true });
                        chrome.windows.update(newTabs[0].windowId, { focused: true });
                    } else {
                        chrome.tabs.create({ url: organizerTabUrl('A') });
                    }
                });
            } else {
                chrome.tabs.create({ url: organizerTabUrl(view) });
            }
        });
    }

    window.getOrganizerViews().forEach((view, index) => {
        const link = document.getElementById('nav-view-' + (index + 1));
        if (!link) return;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToView(view, e.ctrlKey || e.metaKey);
        });
    });

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
    initSidebarDropTarget();
    loadState();

    // Chrome folders whose policy is 'alphabetical' are kept that way. This is
    // the only place that writes a folder order back to Chrome.
    window.ORDERING.watchBookmarkChanges();
    chrome.storage.local.get('settings', (data) => {
        window.ORDERING.applyChromeOrder((data && data.settings) || {});
    });

    // Initial clock update is called by loadSettings in settings_logic.js potentially, 
    // or we just call it. But applySettings will also be called.
    // We'll trust applySettings to set the initial values properly before this runs 
    // repeatedly, but calling it once to show something is fine.
    updateClock();
    setInterval(updateClock, 1000);

    panelsSortable = new Sortable(panelsContainer, {
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

    // --- Dynamic Sidebar Adjustment ---
    
    // --- Draggable Sidebar Resizer ---
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    if (resizer && sidebar) {
        chrome.storage.local.get('sidebarWidth', (data) => {
            if (data.sidebarWidth) {
                window.currentSidebarWidth = data.sidebarWidth;
                sidebar.style.width = `${data.sidebarWidth}px`;
                sidebar.style.minWidth = `${data.sidebarWidth}px`;
                sidebar.style.flexBasis = `${data.sidebarWidth}px`;
                if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
            }
        });

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 120) newWidth = 120;
            if (newWidth > window.innerWidth / 2) newWidth = window.innerWidth / 2;
            
            sidebar.style.width = `${newWidth}px`;
            sidebar.style.minWidth = `${newWidth}px`;
            sidebar.style.flexBasis = `${newWidth}px`;
            window.currentSidebarWidth = newWidth;
            if (typeof adjustSidebarWidth === 'function') adjustSidebarWidth();
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                chrome.storage.local.set({ sidebarWidth: window.currentSidebarWidth });
            }
        });
    }

    window.adjustSidebarWidth = function() {
        requestAnimationFrame(() => {
            if (!window.adjustSidebarWidth) window.adjustSidebarWidth = window.adjustSidebarWidth || adjustSidebarWidth;
            const sidebar = document.getElementById('sidebar');
            const panelsContainer = document.getElementById('panels-container');
            if (!sidebar || !panelsContainer) return;

            // Updated User Constraints
            const minSidebar = window.currentSidebarWidth || 142; // Configurable
            const maxSidebar = minSidebar + 83; // Soft target
            const absoluteMaxSidebar = minSidebar + 138; // Hard cap

            const panelWidth = 300;
            const gap = 10;
            const basePadding = 10; // CSS default padding
            const scrollbarBuffer = 12;

            const windowWidth = window.innerWidth;

            // 1. Calculate MAX columns possible with the NARROWEST sidebar
            // Available = Total - MinSidebar - (LeftPad + RightPad) - Scrollbar
            const availableForContentAtMin = windowWidth - minSidebar - (basePadding * 2) - scrollbarBuffer;

            let cols = Math.floor((availableForContentAtMin + gap) / (panelWidth + gap));
            cols = Math.max(1, cols);

            // 2. Calculate the exact width strictly needed for these columns
            const requiredPanelWidth = cols * panelWidth + (cols - 1) * gap;

            // 3. Calculate TOTAL remaining space
            // This is the pool of pixels we can distribute
            let totalExcessSpace = windowWidth - requiredPanelWidth - minSidebar - (basePadding * 2) - scrollbarBuffer;

            if (totalExcessSpace < 0) totalExcessSpace = 0;

            // 4. Distribute space logic (3-way split)
            // Weights:
            // Gap Left (Padding Left): 40%
            // Gap between panels: 20%
            // Right Margin: 40% (implicit via paddingRight)

            let paddingLeftExtra = totalExcessSpace * 0.40;
            let gapExtraPool = totalExcessSpace * 0.20;
            let paddingRightExtra = totalExcessSpace * 0.40;

            // Calculate new Sidebar Width (fixed to user choice)
            let targetSidebarWidth = minSidebar;

            // Calculate new Padding Left
            const targetPaddingLeft = basePadding + paddingLeftExtra;

            // Calculate new Gap between panels
            let targetGap = gap;
            if (cols > 1) {
                targetGap = gap + (gapExtraPool / (cols - 1));
            }

            // Calculate Padding Right
            const targetPaddingRight = basePadding + paddingRightExtra;

            // Apply styles
            sidebar.style.width = `${targetSidebarWidth}px`;
            sidebar.style.minWidth = `${targetSidebarWidth}px`;
            sidebar.style.flexBasis = `${targetSidebarWidth}px`;
            sidebar.style.maxWidth = 'none';

            panelsContainer.style.paddingLeft = `${targetPaddingLeft}px`;
            panelsContainer.style.paddingRight = `${targetPaddingRight}px`;
            panelsContainer.style.columnGap = `${targetGap}px`;
            panelsContainer.style.rowGap = `${gap}px`; // Keep vertical gap constant
        });
    }

    // Initialize and Listen
    // Run immediately and on resize
    adjustSidebarWidth();
    window.addEventListener('resize', adjustSidebarWidth);

    // Also run after a short delay to catch any layout shifts after CSS load
    setTimeout(adjustSidebarWidth, 100);
});

// --- Functions called by settings_logic.js ---
function renderBookmarks(element, bookmarks, folderId, refreshCallback) {
    element.innerHTML = '';
    if (!bookmarks || bookmarks.length === 0) {
        element.innerHTML = '<p class="empty-folder-message">' + "This folder is empty." + '</p>';
        return;
    }
    // An alphabetically sorted list cannot be reordered by dragging; allowing it
    // would silently undo the user's drop on the next render.
    const sortedAlphabetically = Boolean(element.classList && element.classList.contains('order-alphabetical'));
    const fragment = document.createDocumentFragment();
    bookmarks.forEach(bookmark => {
        if (bookmark.url) {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.dataset.id = bookmark.id;
            item.draggable = !sortedAlphabetically;

            if (!sortedAlphabetically) {
                item.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('text/plain', bookmark.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setTimeout(() => item.classList.add('dragging'), 0);
                });
                item.addEventListener('dragend', () => item.classList.remove('dragging'));
            }

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
                const titleInput = item.querySelector('.edit-title');
                const urlInput = item.querySelector('.edit-url');
                const saveBtn = item.querySelector('.save-bookmark-btn');
                const cancelBtn = item.querySelector('.cancel-edit-btn');

                const saveBookmarkChanges = () => {
                    const newTitle = titleInput.value.trim();
                    const newUrl = urlInput.value.trim();
                    titleInput.blur();
                    urlInput.blur();
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
                };

                const cancelBookmarkEdit = () => {
                    titleInput.blur();
                    urlInput.blur();
                    if (parentPanel) {
                        parentPanel.classList.remove('editing');
                    } else {
                        item.classList.remove('sidebar-editing');
                    }
                    if (refreshCallback) refreshCallback();
                };

                saveBtn.addEventListener('click', saveBookmarkChanges);
                cancelBtn.addEventListener('click', cancelBookmarkEdit);

                const handleKeyDown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveBookmarkChanges();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelBookmarkEdit();
                    }
                };

                titleInput.addEventListener('keydown', handleKeyDown);
                urlInput.addEventListener('keydown', handleKeyDown);
                titleInput.focus();
                titleInput.select();
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

// Bound once. applySettings() runs on every change; binding drag listeners
// there would stack a new set of handlers on every save.
function initSidebarDropTarget() {
    const sidebarBookmarks = document.getElementById('sidebar-bookmarks');
    if (!sidebarBookmarks) return;

    sidebarBookmarks.addEventListener('dragover', e => {
        if (sidebarBookmarks.classList.contains('order-alphabetical')) return;
        e.preventDefault();
        sidebarBookmarks.classList.add('drag-over');
    });
    sidebarBookmarks.addEventListener('dragleave', () => sidebarBookmarks.classList.remove('drag-over'));
    sidebarBookmarks.addEventListener('drop', e => {
        e.preventDefault();
        sidebarBookmarks.classList.remove('drag-over');
        // Sorted A–Z: a drop would be overwritten on the next render.
        if (sidebarBookmarks.classList.contains('order-alphabetical')) return;
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
}

function applySettings(settings) {
    if (!settings) return;

    // Ordering is read by the render paths, so they need the current settings
    // without another storage round-trip.
    window.__orderingSettings = settings;

    const alphabeticalPanels = Boolean(window.ORDERING
        && window.ORDERING.panelsPolicy(settings, CURRENT_VIEW) === window.ORDERING.ALPHABETICAL);
    if (window.__lastPanelsPolicy !== alphabeticalPanels) {
        window.__lastPanelsPolicy = alphabeticalPanels;
        if (typeof window.refreshPanelOrder === 'function') window.refreshPanelOrder();
    }

    const sidebarAlphabetical = Boolean(window.ORDERING
        && window.ORDERING.sidebarPolicy(settings) === window.ORDERING.ALPHABETICAL);
    document.body.classList.toggle('panels-alphabetical', alphabeticalPanels);

    const sidebarEl = document.getElementById('sidebar-bookmarks');
    if (sidebarEl) {
        const wasSorted = sidebarEl.classList.contains('order-alphabetical');
        sidebarEl.classList.toggle('order-alphabetical', sidebarAlphabetical);
        sidebarEl.title = sidebarAlphabetical ? 'Sorted A–Z (drag is off)' : '';
        // The class decides whether items are draggable, so re-render when it flips.
        if (wasSorted !== sidebarAlphabetical && window.bookmarkRefreshCallbacks) {
            window.bookmarkRefreshCallbacks.forEach((cb) => cb());
        }
    }

    // Without a visible hint, a disabled drag handle looks like a bug.
    const sidebarHeader = document.getElementById('sidebar-header');
    let badge = document.getElementById('sidebar-order-badge');
    if (!badge && sidebarHeader) {
        badge = document.createElement('span');
        badge.id = 'sidebar-order-badge';
        badge.className = 'order-badge';
        badge.title = 'This list is sorted A–Z';
        sidebarHeader.appendChild(badge);
    }
    if (badge) {
        badge.textContent = sidebarAlphabetical ? 'A–Z' : '';
        badge.hidden = !sidebarAlphabetical;
    }

    const container = document.getElementById('panels-container');
    if (container) {
        const isRowLayout = getRowLayout(settings, CURRENT_VIEW);
        if (isRowLayout) {
            container.classList.add('row-layout');
        } else {
            container.classList.remove('row-layout');
        }
    }

    // Handle theme and custom colors
    if (settings.theme === 'custom') {
        document.documentElement.style.setProperty('--bg-color', settings.bgColor);
        document.documentElement.style.setProperty('--text-color', settings.textColor);
        document.documentElement.style.setProperty('--sidebar-bg', settings.sidebarBg);
        document.documentElement.style.setProperty('--panel-bg', settings.sidebarBg);
        document.documentElement.style.setProperty('--border-color', settings.borderColor);
        document.documentElement.style.setProperty('--accent-color', settings.btnColor);
        document.documentElement.style.setProperty('--input-bg', settings.inputBgColor || (settings.theme === 'dark' ? '#333333' : '#ffffff'));

    } else {
        // Clear custom styles when switching back to a predefined theme
        document.documentElement.style.setProperty('--bg-color', '');
        document.documentElement.style.setProperty('--text-color', '');
        document.documentElement.style.setProperty('--sidebar-bg', '');
        document.documentElement.style.setProperty('--panel-bg', '');
        document.documentElement.style.setProperty('--border-color', '');
        document.documentElement.style.setProperty('--accent-color', '');
        document.documentElement.style.setProperty('--input-bg', '');
    }
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');

    const clockElement = document.getElementById('clock');
    const dateElement = document.getElementById('date');
    const batteryElement = document.getElementById('battery');
    if (clockElement) clockElement.style.display = settings.showClock ? 'block' : 'none';
    if (dateElement) dateElement.style.display = settings.showDate ? 'block' : 'none';
    if (batteryElement) {
        batteryElement.style.display = settings.showBattery ? 'block' : 'none';
        batteryElement.style.fontSize = settings.dateFontSize || '11px';
    }

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
    if (sidebarBookmarks) {
        if (settings.sidebarFolderId) {
            sidebarBookmarks.dataset.folderId = settings.sidebarFolderId;
            const refreshSidebar = () => {
                getBookmarksInFolder(settings.sidebarFolderId, (bookmarks) => {
                    // Sorted for display only: Chrome keeps its own order unless
                    // the folder policy says otherwise.
                    const policy = window.ORDERING
                        ? window.ORDERING.sidebarPolicy(window.__orderingSettings || settings)
                        : 'manual';
                    const ordered = window.ORDERING ? window.ORDERING.sortByName(bookmarks, policy) : bookmarks;
                    renderBookmarks(sidebarBookmarks, ordered, settings.sidebarFolderId, refreshSidebar);
                }, 'Sidebar');
            };
            // Replaces any previous sidebar entry instead of adding one.
            window.bookmarkRefreshCallbacks.set('sidebar', refreshSidebar);
            // Re-fetch only when the folder actually changed; a theme tweak
            // must not hit the bookmarks API again.
            if (window.__lastSidebarFolderId !== settings.sidebarFolderId) {
                window.__lastSidebarFolderId = settings.sidebarFolderId;
                refreshSidebar();
            }
        } else {
            delete sidebarBookmarks.dataset.folderId;
            window.__lastSidebarFolderId = null;
            window.bookmarkRefreshCallbacks.delete('sidebar');
            sidebarBookmarks.innerHTML = '<p style="padding: 8px;">' + "Select a folder in settings." + '</p>';
        }
    }
}
