document.addEventListener('DOMContentLoaded', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');

    // --- Panel Visibility and Actions ---
    settingsBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            // If panel is hidden, show it
            settingsPanel.classList.remove('hidden');
        } else {
            // If panel is visible, save and close
            saveSettings();
        }
    });

    closeBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        // Revert any unsaved changes by reloading the saved settings
        loadSettings();
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
    const themeToggle = document.getElementById('theme-toggle');
    const newPanelPositionToggle = document.getElementById('new-panel-position-toggle');

    function saveSettings() {
        const settings = {
            theme: themeToggle.checked ? 'dark' : 'light',
            newPanelPosition: newPanelPositionToggle.checked ? 'top' : 'bottom',
            sidebarFolderId: sidebarFolderSelect.value,
            headerFolderId: headerFolderSelect.value
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
                // Set toggles
                themeToggle.checked = data.settings.theme === 'dark';
                newPanelPositionToggle.checked = data.settings.newPanelPosition === 'top';

                // Set dropdowns
                sidebarFolderSelect.value = data.settings.sidebarFolderId || '';
                headerFolderSelect.value = data.settings.headerFolderId || '';

                applySettings(data.settings); // Apply loaded settings on page load
            } else {
                // Default settings for first-time users
                themeToggle.checked = false; // Light mode
                newPanelPositionToggle.checked = false; // Add to bottom
            }
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Data Management ---
    // Make export function global to be accessible by main.js
    window.handleExport = () => {
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
    };

    const exportBtn = document.getElementById('export-data-btn');
    exportBtn.addEventListener('click', window.handleExport);

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

    const importAllBookmarksBtn = document.getElementById('import-all-bookmarks-btn');

    importAllBookmarksBtn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to add a new panel for every bookmark folder? This may add a large number of panels to your page.')) {
            return;
        }

        // 1. Get all bookmark folders
        chrome.bookmarks.getTree((tree) => {
            const folders = [];
            function findFolders(node) {
                if (node.children) {
                    // A folder must have children and at least one actual bookmark to be useful
                    if (node.children.some(child => child.url)) {
                        // We also don't want the root "Bookmarks Bar" etc. folders
                        if (node.id !== '0' && node.id !== '1' && node.id !== '2') {
                             folders.push({ id: node.id, title: node.title });
                        }
                    }
                    node.children.forEach(findFolders);
                }
            }
            findFolders(tree[0]);

            // 2. Get current panels state
            chrome.storage.sync.get('panelsState', (data) => {
                const currentPanels = data.panelsState || [];
                const existingFolderIds = new Set(currentPanels.map(p => p.folderId));
                let newPanelsAdded = 0;

                // 3. Add new panels for folders that don't already have one
                folders.forEach(folder => {
                    if (!existingFolderIds.has(folder.id)) {
                        const newPanelState = {
                            id: `panel-${Date.now()}-${folder.id}`,
                            title: folder.title,
                            type: 'bookmarks',
                            folderId: folder.id,
                            cards: []
                        };
                        currentPanels.push(newPanelState);
                        newPanelsAdded++;
                    }
                });

                if (newPanelsAdded > 0) {
                    // 4. Save the new state and reload
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
