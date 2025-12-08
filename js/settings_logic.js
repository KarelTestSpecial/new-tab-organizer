function getStorageKey(view) {
    if (view === 'B') return 'panelsState_B';
    if (view === 'C') return 'panelsState_C';
    return 'panelsState'; // Default for A
}

document.addEventListener('DOMContentLoaded', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');

    settingsBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.remove('hidden');
        } else {
            saveSettings();
        }
    });

    closeBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        loadSettings();
    });

    const sidebarFolderSelect = document.getElementById('sidebar-folder-select');

    sidebarFolderSelect.addEventListener('change', () => {
        tempSettings.sidebarFolderId = sidebarFolderSelect.value;
        const currentFontSize = dateFontSizeSlider ? `${dateFontSizeSlider.value}px` : '11px';
        applySettings({ ...tempSettings, dateFontSize: currentFontSize });
    });

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

    const themeBtn = document.getElementById('theme-toggle-btn');
    const clockToggleBtn = document.getElementById('clock-toggle-btn');
    const dateToggleBtn = document.getElementById('date-toggle-btn');
    // New Buttons
    const yearToggleBtn = document.getElementById('year-toggle-btn');
    const dayToggleBtn = document.getElementById('day-toggle-btn');

    // Date Settings Elements
    const dateFontSizeSlider = document.getElementById('date-font-size-slider');
    const dateFontSizeValue = document.getElementById('date-font-size-value');

    // Startup Checkboxes
    const startupCheckA = document.getElementById('startup-check-A');
    const startupCheckB = document.getElementById('startup-check-B');
    const startupCheckC = document.getElementById('startup-check-C');

    let tempSettings = {};

    function updateButtonText() {
        themeBtn.textContent = `Theme: ${tempSettings.theme === 'dark' ? 'Dark' : 'Light'}`;
        clockToggleBtn.textContent = `${tempSettings.showClock ? 'Hide' : 'Show'} Clock`;
        dateToggleBtn.textContent = `${tempSettings.showDate ? 'Hide' : 'Show'} Date`;

        // Year/Day logic
        yearToggleBtn.textContent = `${tempSettings.showYear ? 'Hide' : 'Show'} Year`;
        dayToggleBtn.textContent = `${tempSettings.showDayOfWeek ? 'Hide' : 'Show'} Day`;

        if (!tempSettings.showDate) {
            yearToggleBtn.disabled = true;
            yearToggleBtn.style.opacity = '0.5';
            dayToggleBtn.disabled = true;
            dayToggleBtn.style.opacity = '0.5';
        } else {
            yearToggleBtn.disabled = false;
            yearToggleBtn.style.opacity = '1';
            dayToggleBtn.disabled = false;
            dayToggleBtn.style.opacity = '1';
        }
    }

    themeBtn.addEventListener('click', () => {
        tempSettings.theme = tempSettings.theme === 'dark' ? 'light' : 'dark';
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    clockToggleBtn.addEventListener('click', () => {
        tempSettings.showClock = !tempSettings.showClock;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    dateToggleBtn.addEventListener('click', () => {
        tempSettings.showDate = !tempSettings.showDate;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    yearToggleBtn.addEventListener('click', () => {
        tempSettings.showYear = !tempSettings.showYear;
        updateButtonText();
        // Ensure we pass the current font size from the slider/tempSettings
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    dayToggleBtn.addEventListener('click', () => {
        tempSettings.showDayOfWeek = !tempSettings.showDayOfWeek;
        updateButtonText();
        // Ensure we pass the current font size from the slider/tempSettings
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    // Slider logic
    dateFontSizeSlider.addEventListener('input', () => {
        const size = dateFontSizeSlider.value;
        dateFontSizeValue.textContent = `${size}px`;
        // Apply immediately
        applySettings({ ...tempSettings, dateFontSize: `${size}px` });
    });

    function saveSettings() {
        // Validation: At least one startup checkbox must be checked.
        let valA = startupCheckA.checked;
        let valB = startupCheckB.checked;
        let valC = startupCheckC.checked;

        if (!valA && !valB && !valC) {
            valA = true;
            startupCheckA.checked = true; // Visual feedback
        }

        const settingsToSave = {
            ...tempSettings,
            sidebarFolderId: sidebarFolderSelect.value,
            // Date Settings
            dateFontSize: `${dateFontSizeSlider.value}px`,
            // Startup Settings
            startupA: valA,
            startupB: valB,
            startupC: valC
        };
        chrome.storage.local.set({ settings: settingsToSave }, () => {
            console.log('Settings saved');
            settingsPanel.classList.add('hidden');
            applySettings(settingsToSave);
        });
    }

    function loadSettings() {
        chrome.storage.local.get('settings', data => {
            const currentSettings = data.settings || {};
            tempSettings = {
                theme: currentSettings.theme || 'light',
                newPanelPosition: currentSettings.newPanelPosition || 'bottom',
                sidebarFolderId: currentSettings.sidebarFolderId || '',
                showClock: typeof currentSettings.showClock === 'boolean' ? currentSettings.showClock : true,
                showDate: typeof currentSettings.showDate === 'boolean' ? currentSettings.showDate : true,
                showYear: typeof currentSettings.showYear === 'boolean' ? currentSettings.showYear : true,
                showDayOfWeek: typeof currentSettings.showDayOfWeek === 'boolean' ? currentSettings.showDayOfWeek : true,
                startupA: typeof currentSettings.startupA === 'boolean' ? currentSettings.startupA : true, // Default True
                startupB: typeof currentSettings.startupB === 'boolean' ? currentSettings.startupB : false,
                startupC: typeof currentSettings.startupC === 'boolean' ? currentSettings.startupC : false
            };

            updateButtonText();
            sidebarFolderSelect.value = tempSettings.sidebarFolderId;

            // Startup Checkboxes
            if (startupCheckA) startupCheckA.checked = tempSettings.startupA;
            if (startupCheckB) startupCheckB.checked = tempSettings.startupB;
            if (startupCheckC) startupCheckC.checked = tempSettings.startupC;

            // Handle slider default
            let fontSize = currentSettings.dateFontSize || '11px';
            let numericSize = parseInt(fontSize.replace('px', '').replace('rem', '')); // basic parsing
            if (isNaN(numericSize)) numericSize = 11;

            dateFontSizeSlider.value = numericSize;
            dateFontSizeValue.textContent = `${numericSize}px`;

            applySettings({ ...tempSettings, dateFontSize: `${numericSize}px` });
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Data Management ---
    window.handleExport = (storageKey) => {
        chrome.storage.local.get([storageKey, 'settings'], (data) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                alert(`Error exporting data for ${storageKey}.`);
                return;
            }
            const exportData = {
                [storageKey]: data[storageKey] || [],
                settings: data.settings || {}
            };
            const dataString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `startpage-backup-${CURRENT_VIEW}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    };

    document.getElementById('export-data-btn').addEventListener('click', () => window.handleExport(STORAGE_KEY));

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
                if (data && typeof data[STORAGE_KEY] !== 'undefined' && typeof data.settings !== 'undefined') {
                    if (confirm(`Are you sure you want to import this data? Your current layout and settings for THIS VIEW will be overwritten.`)) {
                        const dataToImport = {
                            [STORAGE_KEY]: data[STORAGE_KEY],
                            settings: data.settings
                        };
                        chrome.storage.local.set(dataToImport, () => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                alert(`Error importing data for ${CURRENT_VIEW}.`);
                            } else {
                                alert(`Data for ${CURRENT_VIEW} imported successfully! The page will now reload.`);
                                location.reload();
                            }
                        });
                    }
                } else {
                    alert(`Invalid backup file for this view. Make sure you are using a "backup-${CURRENT_VIEW}" file.`);
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
            chrome.storage.local.get(STORAGE_KEY, (data) => {
                const currentPanels = data[STORAGE_KEY] || [];
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
                    chrome.storage.local.set({ [STORAGE_KEY]: currentPanels }, () => {
                        alert(`${newPanelsAdded} new bookmark panels have been added to ${CURRENT_VIEW}. The page will now reload.`);
                        location.reload();
                    });
                } else {
                    alert('No new bookmark folders to import.');
                }
            });
        });
    });

    populateFolderDropdowns();
    loadSettings();

    // --- Swap Logic ---
    const swapBtn = document.getElementById('swap-organizers-btn');
    const swapSelect1 = document.getElementById('swap-select-1');
    const swapSelect2 = document.getElementById('swap-select-2');

    swapBtn.addEventListener('click', () => {
        const view1 = swapSelect1.value;
        const view2 = swapSelect2.value;

        if (view1 === view2) {
            alert('Please select two different organizers to swap.');
            return;
        }

        if (!confirm(`Are you sure you want to swap the content of Organizer ${view1} and Organizer ${view2}?`)) {
            return;
        }

        const key1 = getStorageKey(view1);
        const key2 = getStorageKey(view2);

        chrome.storage.local.get([key1, key2], data => {
            const data1 = data[key1] || [];
            const data2 = data[key2] || [];

            chrome.storage.local.set({ [key1]: data2, [key2]: data1 }, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    alert('An error occurred while swapping the organizers. Please try again.');
                } else {
                    // --- New, robust refresh logic ---
                    const viewsToReload = [view1, view2];

                    viewsToReload.forEach(view => {
                        // If the view to reload is the current one, we'll handle it last.
                        if (view === CURRENT_VIEW) {
                            return;
                        }

                        // Find and reload the other tab(s).
                        const urlToReload = chrome.runtime.getURL(`panel${view}.html`);
                        chrome.tabs.query({ url: urlToReload }, (tabs) => {
                            if (tabs.length > 0) {
                                chrome.tabs.reload(tabs[0].id);
                            }
                        });
                    });

                    alert('Organizers have been swapped successfully! Pages will now reload to reflect changes.');

                    // If the current view was part of the swap, reload it now.
                    if (viewsToReload.includes(CURRENT_VIEW)) {
                        setTimeout(() => location.reload(), 150); // Delay to give other tabs time to process reload
                    }
                }
            });
        });
    });
});
