document.addEventListener('DOMContentLoaded', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');

    // --- Panel Visibility and Actions ---
    settingsBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.remove('hidden');
        } else {
            saveSettings();
        }
    });

    closeBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        loadSettings(); // Revert any unsaved changes
    });

    // --- Populate Bookmark Folders ---
    const sidebarFolderSelect = document.getElementById('sidebar-folder-select');

    function populateFolderDropdowns() {
        getBookmarkFolders(folders => {
            sidebarFolderSelect.innerHTML = '<option value="">--Select a folder--</option>';
            folders.forEach(folder => {
                if (folder.id === '0') return;
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.title;
                sidebarFolderSelect.appendChild(option);
            });
        });
    }

    // --- Settings State Management ---
    const themeBtn = document.getElementById('theme-toggle-btn');
    const panelPositionBtn = document.getElementById('panel-position-toggle-btn');
    const clockToggleBtn = document.getElementById('clock-toggle-btn');
    const dateToggleBtn = document.getElementById('date-toggle-btn');

    let tempSettings = {};

    function updateButtonText() {
        themeBtn.textContent = `Theme: ${tempSettings.theme === 'dark' ? 'Dark' : 'Light'}`;
        panelPositionBtn.textContent = `Add New Panels: ${tempSettings.newPanelPosition === 'top' ? 'Top' : 'Bottom'}`;
        clockToggleBtn.textContent = `${tempSettings.showClock ? 'Hide' : 'Show'} Clock`;
        dateToggleBtn.textContent = `${tempSettings.showDate ? 'Hide' : 'Show'} Date`;
    }

    themeBtn.addEventListener('click', () => {
        tempSettings.theme = tempSettings.theme === 'dark' ? 'light' : 'dark';
        updateButtonText();
        applySettings(tempSettings);
    });

    panelPositionBtn.addEventListener('click', () => {
        tempSettings.newPanelPosition = tempSettings.newPanelPosition === 'top' ? 'bottom' : 'top';
        updateButtonText();
    });

    clockToggleBtn.addEventListener('click', () => {
        tempSettings.showClock = !tempSettings.showClock;
        updateButtonText();
        applySettings(tempSettings);
    });

    dateToggleBtn.addEventListener('click', () => {
        tempSettings.showDate = !tempSettings.showDate;
        updateButtonText();
        applySettings(tempSettings);
    });

    function saveSettings() {
        const settingsToSave = {
            ...tempSettings,
            sidebarFolderId: sidebarFolderSelect.value,
        };
        // Remove undefined properties before saving
        delete settingsToSave.headerFolderId;

        chrome.storage.sync.set({ settings: settingsToSave }, () => {
            console.log('Settings saved');
            settingsPanel.classList.add('hidden');
            applySettings(settingsToSave);
        });
    }

    function loadSettings() {
        chrome.storage.sync.get('settings', data => {
            const currentSettings = data.settings || {};
            tempSettings = {
                theme: currentSettings.theme || 'light',
                newPanelPosition: currentSettings.newPanelPosition || 'bottom',
                sidebarFolderId: currentSettings.sidebarFolderId || '',
                showClock: typeof currentSettings.showClock === 'boolean' ? currentSettings.showClock : true,
                showDate: typeof currentSettings.showDate === 'boolean' ? currentSettings.showDate : true,
            };

            updateButtonText();
            sidebarFolderSelect.value = tempSettings.sidebarFolderId;

            applySettings(tempSettings);
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Data Management (View C) ---
    window.handleExport = () => {
        chrome.storage.sync.get(['panelsState_C', 'settings'], (data) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                alert('Error exporting data for View C.');
                return;
            }
            const exportData = {
                panelsState_C: data.panelsState_C || [],
                settings: data.settings || {} // Settings are shared, but good to back them up.
            };
            const dataString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `startpage-backup-C-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    };

    document.getElementById('export-data-btn').addEventListener('click', window.handleExport);

    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    importBtn.addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Check for the correct panel state key for View C
                if (data && typeof data.panelsState_C !== 'undefined' && typeof data.settings !== 'undefined') {
                    if (confirm('Are you sure you want to import this data? Your current layout and settings for THIS VIEW will be overwritten.')) {
                        // IMPORTANT: Do NOT clear sync storage. Only set the keys for this view.
                        const dataToImport = {
                            panelsState_C: data.panelsState_C,
                            settings: data.settings // Overwrite settings as well
                        };
                        chrome.storage.sync.set(dataToImport, () => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                alert('Error importing data for View C.');
                            } else {
                                alert('Data for View C imported successfully! The page will now reload.');
                                location.reload();
                            }
                        });
                    }
                } else {
                    alert('Invalid backup file for View C. Make sure you are using a "backup-C" file.');
                }
            } catch (error) {
                alert('Error reading backup file.');
            } finally {
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('import-all-bookmarks-btn').addEventListener('click', () => {
        if (!confirm('Are you sure you want to add a new panel for every bookmark folder to this view?')) {
            return;
        }
        chrome.bookmarks.getTree((tree) => {
            const folders = [];
            function findFolders(node) {
                if (node.children) {
                    if (node.children.some(child => child.url) && node.id !== '0' && node.id !== '1' && node.id !== '2') {
                        folders.push({ id: node.id, title: node.title });
                    }
                    node.children.forEach(findFolders);
                }
            }
            findFolders(tree[0]);
            // Use the correct state for View C
            chrome.storage.sync.get('panelsState_C', (data) => {
                const currentPanels = data.panelsState_C || [];
                const existingFolderIds = new Set(currentPanels.map(p => p.folderId));
                let newPanelsAdded = 0;
                folders.forEach(folder => {
                    if (!existingFolderIds.has(folder.id)) {
                        currentPanels.push({
                            id: `panel-${Date.now()}-${folder.id}`,
                            title: folder.title,
                            type: 'bookmarks',
                            folderId: folder.id,
                            cards: []
                        });
                        newPanelsAdded++;
                    }
                });
                if (newPanelsAdded > 0) {
                    // Save to the correct state for View C
                    chrome.storage.sync.set({ panelsState_C: currentPanels }, () => {
                        alert(`${newPanelsAdded} new bookmark panels have been added to View C. The page will now reload.`);
                        location.reload();
                    });
                } else {
                    alert('No new bookmark folders to import.');
                }
            });
        });
    });

    // --- Initialization ---
    populateFolderDropdowns();
    loadSettings();
});
