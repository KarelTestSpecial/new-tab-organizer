document.addEventListener('DOMContentLoaded', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');

    // --- Toggle Panel Visibility ---
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    // --- Populate Bookmark Folders ---
    const sidebarFolderSelect = document.getElementById('sidebar-folder-select');
    const headerFolderSelect = document.getElementById('header-folder-select');

    function populateFolderDropdowns() {
        getBookmarkFolders(folders => {
            // Clear existing options except the first one
            sidebarFolderSelect.innerHTML = '<option value="">--Select a folder--</option>';
            headerFolderSelect.innerHTML = '<option value="">--Select a folder--</option>';

            folders.forEach(folder => {
                if (folder.id === '0') return; // Skip the root folder which isn't a real folder
                const option1 = document.createElement('option');
                option1.value = folder.id;
                option1.textContent = folder.title;
                sidebarFolderSelect.appendChild(option1);

                const option2 = document.createElement('option');
                option2.value = folder.id;
                option2.textContent = folder.title;
                headerFolderSelect.appendChild(option2);
            });
        });
    }

    // --- Save and Load Settings ---
    const themeSelect = document.getElementById('theme-select');
    const newPanelPositionSelect = document.getElementById('new-panel-position-select');

    function saveSettings() {
        const settings = {
            theme: themeSelect.value,
            sidebarFolderId: sidebarFolderSelect.value,
            headerFolderId: headerFolderSelect.value,
            newPanelPosition: newPanelPositionSelect.value
        };
        chrome.storage.sync.set({ settings }, () => {
            console.log('Settings saved');
            settingsPanel.classList.add('hidden');
            applySettings(settings); // Apply settings immediately after saving
        });
    }

    function loadSettings() {
        chrome.storage.sync.get('settings', data => {
            if (data.settings) {
                themeSelect.value = data.settings.theme || 'light';
                sidebarFolderSelect.value = data.settings.sidebarFolderId || '';
                headerFolderSelect.value = data.settings.headerFolderId || '';
                newPanelPositionSelect.value = data.settings.newPanelPosition || 'end';
                applySettings(data.settings); // Apply loaded settings on page load
            }
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Data Management ---
    const exportBtn = document.getElementById('export-data-btn');

    exportBtn.addEventListener('click', () => {
        // Get all data from storage
        chrome.storage.sync.get(null, (data) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                alert('Error exporting data.');
                return;
            }

            // We don't want to export everything, e.g. internal chrome sync state
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
    });

    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    importBtn.addEventListener('click', () => {
        importFileInput.click(); // Trigger the hidden file input
    });

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            try {
                const data = JSON.parse(text);

                // Basic validation
                if (data && typeof data.panelsState !== 'undefined' && typeof data.settings !== 'undefined') {
                    if (confirm('Are you sure you want to import this data? Your current layout and settings will be overwritten.')) {
                        // Clear existing data before setting new data to avoid merging issues
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
                    alert('Invalid backup file. The file does not contain the expected data (panelsState and settings).');
                }
            } catch (error) {
                console.error('Error parsing backup file:', error);
                alert('Error reading backup file. It may be corrupted or not a valid JSON file.');
            } finally {
                // Reset the file input so the user can select the same file again if needed
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    // --- Initialization ---
    populateFolderDropdowns();
    loadSettings();
});
