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

    let tempSettings = {};

    function updateButtonText() {
        themeBtn.textContent = `Theme: ${tempSettings.theme === 'dark' ? 'Dark' : 'Light'}`;
        panelPositionBtn.textContent = `Add New Panels: ${tempSettings.newPanelPosition === 'top' ? 'Top' : 'Bottom'}`;
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
            };

            updateButtonText();
            sidebarFolderSelect.value = tempSettings.sidebarFolderId;

            applySettings(tempSettings);
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Data Management ---
    window.handleExport = () => {
        chrome.storage.sync.get(null, (data) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                alert('Error exporting data.');
                return;
            }
            const exportData = {
                panelsState: data.panelsState || [],
                settings: data.settings || {}
            };
            const dataString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `startpage-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
                if (data && typeof data.panelsState !== 'undefined' && typeof data.settings !== 'undefined') {
                    if (confirm('Are you sure you want to import this data? Your current layout and settings will be overwritten.')) {
                        chrome.storage.sync.clear(() => {
                            chrome.storage.sync.set(data, () => {
                                if (chrome.runtime.lastError) {
                                    console.error(chrome.runtime.lastError);
                                    alert('Error importing data.');
                                } else {
                                    alert('Data imported successfully! The page will now reload.');
                                    location.reload();
                                }
                            });
                        });
                    }
                } else {
                    alert('Invalid backup file.');
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
        if (!confirm('Are you sure you want to add a new panel for every bookmark folder?')) {
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
            chrome.storage.sync.get('panelsState', (data) => {
                const currentPanels = data.panelsState || [];
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
                    chrome.storage.sync.set({ panelsState: currentPanels }, () => {
                        alert(`${newPanelsAdded} new bookmark panels have been added. The page will now reload.`);
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
