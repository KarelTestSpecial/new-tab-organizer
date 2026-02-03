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

    // --- Element Definitions ---
    const sidebarFolderSelect = document.getElementById('sidebar-folder-select');
    const extensionRootFolderSelect = document.getElementById('extension-root-folder-select');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const batteryToggleBtn = document.getElementById('battery-toggle-btn');
    const clockToggleBtn = document.getElementById('clock-toggle-btn');
    const dateToggleBtn = document.getElementById('date-toggle-btn');
    const yearToggleBtn = document.getElementById('year-toggle-btn');
    const dayToggleBtn = document.getElementById('day-toggle-btn');

    const dateFontSizeSlider = document.getElementById('date-font-size-slider');
    const dateFontSizeValue = document.getElementById('date-font-size-value');

    const startupCheckA = document.getElementById('startup-check-A');
    const startupCheckB = document.getElementById('startup-check-B');
    const startupCheckC = document.getElementById('startup-check-C');

    const sortRecursivelyCheckbox = document.getElementById('sort-recursively-checkbox');
    const sortOrderRadios = document.querySelectorAll('input[name="sort-order"]');
    const sortBookmarksBtn = document.getElementById('sort-bookmarks-btn');

    const primaryColorPicker = document.getElementById('primary-color-picker');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const textColorPicker = document.getElementById('text-color-picker');
    const accentColorPicker = document.getElementById('accent-color-picker');

    // Check for battery presence
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            // In many browsers, desktops return 100% and charging with Infinity dischargingTime.
            // If we can't be sure, we keep it enabled, but if API fails or returns null, we disable.
            if (!battery) {
                batteryToggleBtn.disabled = true;
                batteryToggleBtn.title = "Battery status not available on this device";
            }
        });
    } else {
        batteryToggleBtn.disabled = true;
        batteryToggleBtn.title = "Battery API not supported in this browser";
    }

    let tempSettings = {};

    // --- Listeners ---
    settingsBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.remove('hidden');
        } else {
            saveSettings();
        }
    });

    const closeSettingsPanel = () => {
        settingsPanel.classList.add('hidden');
        loadSettings();
    };

    closeBtn.addEventListener('click', closeSettingsPanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
            closeSettingsPanel();
        }
    });

    sidebarFolderSelect.addEventListener('change', () => {
        tempSettings.sidebarFolderId = sidebarFolderSelect.value;
        const currentFontSize = dateFontSizeSlider ? `${dateFontSizeSlider.value}px` : '11px';
        applySettings({ ...tempSettings, dateFontSize: currentFontSize });
    });

    extensionRootFolderSelect.addEventListener('change', () => {
        tempSettings.rootFolderId = extensionRootFolderSelect.value;
    });

    batteryToggleBtn.addEventListener('click', () => {
        tempSettings.showBattery = !tempSettings.showBattery;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    function populateFolderDropdowns() {
        getBookmarkFolders(folders => {
            sidebarFolderSelect.innerHTML = '<option value="">Select a Sidebar Folder</option>';

            // Root Selector: Only two specific main folders
            extensionRootFolderSelect.innerHTML = '';
            const barOption = document.createElement('option');
            barOption.value = '1';
            barOption.textContent = 'Bookmark Bar';
            extensionRootFolderSelect.appendChild(barOption);

            const otherOption = document.createElement('option');
            otherOption.value = '2';
            otherOption.textContent = 'Other Bookmarks';
            extensionRootFolderSelect.appendChild(otherOption);

            folders.forEach(folder => {
                if (folder.id === '0') return;

                // Sidebar Option (remains recursive)
                const sidebarOption = document.createElement('option');
                sidebarOption.value = folder.id;
                sidebarOption.textContent = folder.title;
                sidebarFolderSelect.appendChild(sidebarOption);
            });

            if (tempSettings.sidebarFolderId) sidebarFolderSelect.value = tempSettings.sidebarFolderId;
            if (tempSettings.rootFolderId) extensionRootFolderSelect.value = tempSettings.rootFolderId;
        });
    }

    function updateButtonText() {
        let themeText = 'Light';
        if (tempSettings.theme === 'dark') {
            themeText = 'Dark';
        } else if (tempSettings.theme === 'custom') {
            themeText = 'Custom';
        }
        themeBtn.textContent = `Theme: ${themeText}`;
        clockToggleBtn.textContent = `${tempSettings.showClock ? 'Hide' : 'Show'} Clock`;
        batteryToggleBtn.textContent = `${tempSettings.showBattery ? 'Hide' : 'Show'} Battery`;
        dateToggleBtn.textContent = `${tempSettings.showDate ? 'Hide' : 'Show'} Date`;

        yearToggleBtn.textContent = `${tempSettings.showYear ? 'Hide' : 'Show'} Year`;
        dayToggleBtn.textContent = `${tempSettings.showDayOfWeek ? 'Hide' : 'Show'} Day`;

        const dateControlsDisabled = !tempSettings.showDate;
        yearToggleBtn.disabled = dateControlsDisabled;
        dayToggleBtn.disabled = dateControlsDisabled;

        // Add a visual hint if needed, though 'disabled' attribute usually handles this.
        yearToggleBtn.style.opacity = dateControlsDisabled ? '0.5' : '1';
        dayToggleBtn.style.opacity = dateControlsDisabled ? '0.5' : '1';
    }

    dateToggleBtn.addEventListener('click', () => {
        tempSettings.showDate = !tempSettings.showDate;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    clockToggleBtn.addEventListener('click', () => {
        tempSettings.showClock = !tempSettings.showClock;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    yearToggleBtn.addEventListener('click', () => {
        tempSettings.showYear = !tempSettings.showYear;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    dayToggleBtn.addEventListener('click', () => {
        tempSettings.showDayOfWeek = !tempSettings.showDayOfWeek;
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    themeBtn.addEventListener('click', () => {
        if (tempSettings.theme === 'light') {
            tempSettings.theme = 'dark';
        } else if (tempSettings.theme === 'dark') {
            tempSettings.theme = 'custom';
        } else {
            tempSettings.theme = 'light';
        }
        updateButtonText();
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    dateFontSizeSlider.addEventListener('input', () => {
        const size = `${dateFontSizeSlider.value}px`;
        dateFontSizeValue.textContent = size;
        applySettings({ ...tempSettings, dateFontSize: size });
    });

    primaryColorPicker.addEventListener('input', () => {
        tempSettings.primaryColor = primaryColorPicker.value;
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    bgColorPicker.addEventListener('input', () => {
        tempSettings.bgColor = bgColorPicker.value;
        tempSettings.sidebarBg = bgColorPicker.value;
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    textColorPicker.addEventListener('input', () => {
        tempSettings.textColor = textColorPicker.value;
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    accentColorPicker.addEventListener('input', () => {
        tempSettings.accentColor = accentColorPicker.value;
        applySettings({ ...tempSettings, dateFontSize: `${dateFontSizeSlider.value}px` });
    });

    function saveSettings() {
        let valA = startupCheckA.checked;
        let valB = startupCheckB.checked;
        let valC = startupCheckC.checked;

        if (!valA && !valB && !valC) {
            valA = true;
            startupCheckA.checked = true;
        }

        const settingsToSave = {
            ...tempSettings,
            sidebarFolderId: sidebarFolderSelect.value,
            rootFolderId: extensionRootFolderSelect.value,
            showBattery: tempSettings.showBattery,
            dateFontSize: `${dateFontSizeSlider.value}px`,
            startupA: valA,
            startupB: valB,
            startupC: valC,
            primaryColor: primaryColorPicker.value,
            bgColor: bgColorPicker.value,
            sidebarBg: bgColorPicker.value,
            textColor: textColorPicker.value,
            accentColor: accentColorPicker.value,
            sortRecursively: sortRecursivelyCheckbox.checked,
            sortOrder: document.querySelector('input[name="sort-order"]:checked').value,
        };
        chrome.storage.local.set({ settings: settingsToSave }, () => {
            settingsPanel.classList.add('hidden');
            applySettings(settingsToSave);
            if (window.populateBookmarkFolderDropdown) {
                window.populateBookmarkFolderDropdown();
            }
        });
    }

    sortBookmarksBtn.addEventListener('click', () => {
        const rootId = extensionRootFolderSelect.value || '1';
        if (confirm('Are you sure you want to sort the bookmarks in your selected Root folder? This action cannot be undone.')) {
            const sortOptions = {
                recursive: sortRecursivelyCheckbox.checked,
                sortOrder: document.querySelector('input[name="sort-order"]:checked').value,
            };
            sortBookmarksInFolder(rootId, sortOptions, () => {
                alert('Root folder has been sorted!');
                // Refresh both the settings dropdowns and the main page dropdown
                populateFolderDropdowns();
                if (tempSettings.sidebarFolderId === '1') {
                    loadSidebarBookmarks(tempSettings.sidebarFolderId);
                }
                if (window.populateBookmarkFolderDropdown) {
                    window.populateBookmarkFolderDropdown();
                }
            });
        }
    });

    function loadSettings() {
        chrome.storage.local.get('settings', data => {
            const currentSettings = data.settings || {};
            tempSettings = {
                theme: currentSettings.theme || 'light',
                newPanelPosition: currentSettings.newPanelPosition || 'bottom',
                sidebarFolderId: currentSettings.sidebarFolderId || '',
                rootFolderId: currentSettings.rootFolderId || '1',
                showBattery: typeof currentSettings.showBattery === 'boolean' ? currentSettings.showBattery : true,
                showClock: typeof currentSettings.showClock === 'boolean' ? currentSettings.showClock : true,
                showDate: typeof currentSettings.showDate === 'boolean' ? currentSettings.showDate : true,
                showYear: typeof currentSettings.showYear === 'boolean' ? currentSettings.showYear : true,
                showDayOfWeek: typeof currentSettings.showDayOfWeek === 'boolean' ? currentSettings.showDayOfWeek : true,
                startupA: typeof currentSettings.startupA === 'boolean' ? currentSettings.startupA : true,
                startupB: typeof currentSettings.startupB === 'boolean' ? currentSettings.startupB : false,
                startupC: typeof currentSettings.startupC === 'boolean' ? currentSettings.startupC : false,
                primaryColor: currentSettings.primaryColor || '#4a90e2',
                bgColor: currentSettings.bgColor || '#f0f2f5',
                sidebarBg: currentSettings.sidebarBg || '#ffffff',
                textColor: currentSettings.textColor || '#1c1e21',
                accentColor: currentSettings.accentColor || '#e0e0e0',
                sortRecursively: typeof currentSettings.sortRecursively === 'boolean' ? currentSettings.sortRecursively : false,
                sortOrder: currentSettings.sortOrder || 'mixed',
            };

            updateButtonText();
            sidebarFolderSelect.value = tempSettings.sidebarFolderId;
            extensionRootFolderSelect.value = tempSettings.rootFolderId;

            if (startupCheckA) startupCheckA.checked = tempSettings.startupA;
            if (startupCheckB) startupCheckB.checked = tempSettings.startupB;
            if (startupCheckC) startupCheckC.checked = tempSettings.startupC;

            let fontSize = currentSettings.dateFontSize || '11px';
            let numericSize = parseInt(fontSize.replace('px', '').replace('rem', ''));
            if (isNaN(numericSize)) numericSize = 11;

            dateFontSizeSlider.value = numericSize;
            dateFontSizeValue.textContent = `${numericSize}px`;

            primaryColorPicker.value = tempSettings.primaryColor;
            bgColorPicker.value = tempSettings.bgColor;
            textColorPicker.value = tempSettings.textColor;
            accentColorPicker.value = tempSettings.accentColor;

            sortRecursivelyCheckbox.checked = tempSettings.sortRecursively;
            const sortOrderInput = document.querySelector(`input[name="sort-order"][value="${tempSettings.sortOrder}"]`);
            if (sortOrderInput) sortOrderInput.checked = true;

            applySettings({ ...tempSettings, dateFontSize: `${numericSize}px` });
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get([STORAGE_KEY, 'settings'], (data) => {
            const panels = data[STORAGE_KEY] || [];
            const imageIds = [];

            // Scan for local images in notes panels
            panels.forEach(panel => {
                if (panel.type === 'notes' && panel.cards) {
                    panel.cards.forEach(card => {
                        if (card.imageUrl === 'local') {
                            imageIds.push(card.id);
                        }
                    });
                }
            });

            if (imageIds.length > 0) {
                chrome.storage.local.get(imageIds, (images) => {
                    const exportData = { ...data, ...images };
                    downloadJson(exportData);
                });
            } else {
                downloadJson(data);
            }
        });
    });

    function downloadJson(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `organizer-${CURRENT_VIEW}-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importBtn.addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm(`Are you sure you want to import this data? Your current layout and settings for THIS VIEW will be overwritten.`)) {

                    const panels = importedData[STORAGE_KEY] || [];
                    const bookmarkPanelFixes = [];

                    // Identify panels that need re-linking
                    panels.forEach(panel => {
                        if (panel.type === 'bookmarks' && panel.folderId) {
                            bookmarkPanelFixes.push(new Promise(resolve => {
                                // First check if ID exists and is a folder
                                chrome.bookmarks.get(panel.folderId, (results) => {
                                    if (chrome.runtime.lastError || !results || results.length === 0 || results[0].url) {
                                        // ID invalid or not a folder, try title matching
                                        findBookmarkFolderByTitle(panel.title, (folder) => {
                                            if (folder) {
                                                panel.folderId = folder.id;
                                            }
                                            resolve();
                                        });
                                    } else {
                                        resolve();
                                    }
                                });
                            }));
                        }
                    });

                    Promise.all(bookmarkPanelFixes).then(() => {
                        chrome.storage.local.set(importedData, () => {
                            alert(`Data for ${CURRENT_VIEW} imported successfully! The page will now reload.`);
                            location.reload();
                        });
                    });
                }
            } catch (err) {
                alert('Invalid backup file.');
            }
        };
        reader.readAsText(file);
        importFileInput.value = '';
    });

    document.getElementById('import-all-bookmarks-btn').addEventListener('click', () => {
        const rootId = extensionRootFolderSelect.value || '1';
        if (!confirm(`Are you sure you want to add a new panel for every subfolder of your selected Root folder to ${CURRENT_VIEW}?`)) {
            return;
        }

        getSubFolders(rootId, (folders) => {
            if (folders.length === 0) {
                alert('No subfolders found in the selected Root folder.');
                return;
            }

            chrome.storage.local.get(STORAGE_KEY, (data) => {
                const currentPanels = data[STORAGE_KEY] || [];
                const existingFolderIds = new Set(currentPanels.map(p => p.folderId));
                let newPanelsAdded = 0;

                folders.forEach((folder, index) => {
                    if (!existingFolderIds.has(folder.id)) {
                        currentPanels.push({
                            id: `panel-${Date.now()}-${index}`,
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
                    alert('All subfolders from this root are already present as panels in this view.');
                }
            });
        });
    });

    populateFolderDropdowns();
    loadSettings();
});

function adjustColor(hex, amount) {
    return hex;
}