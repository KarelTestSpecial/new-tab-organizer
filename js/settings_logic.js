function getStorageKey(view) {
    if (view === 'B') return 'panelsState_B';
    if (view === 'C') return 'panelsState_C';
    if (view === 'D') return 'panelsState_D';
    return 'panelsState'; // Default for A
}

document.addEventListener('i18nReady', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const closeX = document.getElementById('close-settings-x');

    // --- Element Definitions ---
    const sidebarFolderSelect = document.getElementById('sidebar-folder-select');
    const extensionRootFolderSelect = document.getElementById('extension-root-folder-select');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const batteryToggleBtn = document.getElementById('battery-toggle-btn');
    const clockToggleBtn = document.getElementById('clock-toggle-btn');
    const dateToggleBtn = document.getElementById('date-toggle-btn');
    const yearToggleBtn = document.getElementById('year-toggle-btn');
    const dayToggleBtn = document.getElementById('day-toggle-btn');
    const languageSelect = document.getElementById('language-select');

    const dateFontSizeSlider = document.getElementById('date-font-size-slider');
    const dateFontSizeValue = document.getElementById('date-font-size-value');

    const startupCheckA = document.getElementById('startup-check-A');
    const startupCheckB = document.getElementById('startup-check-B');
    const startupCheckC = document.getElementById('startup-check-C');
    const startupCheckD = document.getElementById('startup-check-D');

    const useOrganizerFoldersToggle = document.getElementById('use-organizer-folders-toggle');

    const bgColorPicker = document.getElementById('bg-color-picker');
    const textColorPicker = document.getElementById('text-color-picker');
    const btnColorPicker = document.getElementById('btn-color-picker');
    const borderColorPicker = document.getElementById('border-color-picker');
    const inputBgColorPicker = document.getElementById('input-bg-color-picker');

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
    let originalLanguage = 'auto';

    // --- Listeners ---
    settingsBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.remove('hidden');
        } else {
            saveSettings(true);
        }
    });

    const closeSettingsPanel = () => {
        settingsPanel.classList.add('hidden');
        loadSettings();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSettingsPanel);
    if (closeX) closeX.addEventListener('click', closeSettingsPanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
            closeSettingsPanel();
        }
    });

    if (useOrganizerFoldersToggle) {
        useOrganizerFoldersToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                const confirmed = confirm(I18N.getMessage('confirm_enable_folders'));
                if (confirmed) {
                    tempSettings.useOrganizerFolders = true;
                    const rootId = extensionRootFolderSelect.value || '1';
                    chrome.bookmarks.getChildren(rootId, (children) => {
                        if (chrome.runtime.lastError) return;
                        ['A', 'B', 'C', 'D'].forEach(v => {
                            const folderName = `Organizer ${v}`;
                            const exists = children.some(c => !c.url && c.title === folderName);
                            if (!exists) {
                                chrome.bookmarks.create({ parentId: rootId, title: folderName });
                            }
                        });
                        // Mark upgrade modal as done so it doesn't show up again
                        chrome.storage.local.set({ foldersUpgradeDone: true });
                        saveSettings(false);
                    });
                } else {
                    e.target.checked = false;
                    tempSettings.useOrganizerFolders = false;
                    saveSettings(false);
                }
            } else {
                alert(I18N.getMessage('alert_auto_move_off'));
                tempSettings.useOrganizerFolders = false;
                saveSettings(false);
            }
        });
    }

    sidebarFolderSelect.addEventListener('change', () => {
        tempSettings.sidebarFolderId = sidebarFolderSelect.value;
        saveSettings(false);
    });

    extensionRootFolderSelect.addEventListener('change', () => {
        tempSettings.rootFolderId = extensionRootFolderSelect.value;
        saveSettings(false);
    });

    batteryToggleBtn.addEventListener('click', () => {
        tempSettings.showBattery = !tempSettings.showBattery;
        saveSettings(false);
    });

    function populateFolderDropdowns() {
        getBookmarkFolders(folders => {
            sidebarFolderSelect.innerHTML = '<option value="">' + I18N.getMessage('select_sidebar_folder') + '</option>';

            // Root Selector: Only specific main folders
            extensionRootFolderSelect.innerHTML = '<option value="">' + I18N.getMessage('select_root_folder') + '</option>';
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
        if (clockToggleBtn) {
            clockToggleBtn.textContent = I18N.getMessage('btn_show_clock');
            clockToggleBtn.classList.toggle('active', tempSettings.showClock);
        }
        if (dateToggleBtn) {
            dateToggleBtn.textContent = I18N.getMessage('btn_show_date');
            dateToggleBtn.classList.toggle('active', tempSettings.showDate);
        }
        if (dayToggleBtn) {
            dayToggleBtn.textContent = I18N.getMessage('btn_show_day');
            dayToggleBtn.classList.toggle('active', tempSettings.showDayOfWeek);
        }
        if (yearToggleBtn) {
            yearToggleBtn.textContent = I18N.getMessage('btn_show_year');
            yearToggleBtn.classList.toggle('active', tempSettings.showYear);
        }
        if (batteryToggleBtn) {
            batteryToggleBtn.textContent = I18N.getMessage('btn_show_battery');
            batteryToggleBtn.classList.toggle('active', tempSettings.showBattery);
        }

        if (themeBtn) {
            let icon = '🎨';
            if (tempSettings.theme === 'light') icon = '☀️';
            else if (tempSettings.theme === 'dark') icon = '🌙';

            const themeMsg = tempSettings.theme === 'light' ? I18N.getMessage('btn_theme_light') :
                             tempSettings.theme === 'dark' ? I18N.getMessage('btn_theme_dark') :
                             I18N.getMessage('btn_theme_custom');
            
            themeBtn.innerHTML = `${icon} ${themeMsg}`;
            themeBtn.classList.toggle('active', tempSettings.theme !== 'light');
        }
    }

    dateToggleBtn.addEventListener('click', () => {
        tempSettings.showDate = !tempSettings.showDate;
        saveSettings(false);
    });

    clockToggleBtn.addEventListener('click', () => {
        tempSettings.showClock = !tempSettings.showClock;
        saveSettings(false);
    });

    yearToggleBtn.addEventListener('click', () => {
        tempSettings.showYear = !tempSettings.showYear;
        saveSettings(false);
    });

    dayToggleBtn.addEventListener('click', () => {
        tempSettings.showDayOfWeek = !tempSettings.showDayOfWeek;
        saveSettings(false);
    });

    themeBtn.addEventListener('click', () => {
        if (tempSettings.theme === 'light') {
            tempSettings.theme = 'dark';
        } else if (tempSettings.theme === 'dark') {
            tempSettings.theme = 'custom';
        } else {
            tempSettings.theme = 'light';
        }
        saveSettings(false);
    });

    dateFontSizeSlider.addEventListener('input', () => {
        const size = `${dateFontSizeSlider.value}px`;
        dateFontSizeValue.textContent = size;
        saveSettings(false);
    });



    bgColorPicker.addEventListener('input', () => {
        tempSettings.bgColor = bgColorPicker.value;
        tempSettings.sidebarBg = bgColorPicker.value;
        tempSettings.theme = 'custom';
        saveSettings(false);
    });

    textColorPicker.addEventListener('input', () => {
        tempSettings.textColor = textColorPicker.value;
        tempSettings.theme = 'custom';
        saveSettings(false);
    });

    btnColorPicker.addEventListener('input', () => {
        tempSettings.btnColor = btnColorPicker.value;
        tempSettings.theme = 'custom';
        saveSettings(false);
    });

    borderColorPicker.addEventListener('input', () => {
        tempSettings.borderColor = borderColorPicker.value;
        tempSettings.theme = 'custom';
        saveSettings(false);
    });

    function saveSettings(hidePanel = false) {
        let valA = startupCheckA.checked;
        let valB = startupCheckB.checked;
        let valC = startupCheckC.checked;
        let valD = startupCheckD.checked;

        if (!valA && !valB && !valC && !valD) {
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
            startupD: valD,
            useOrganizerFolders: tempSettings.useOrganizerFolders,
            language: tempSettings.language,

            bgColor: bgColorPicker.value,
            sidebarBg: bgColorPicker.value,
            textColor: textColorPicker.value,
            btnColor: btnColorPicker.value,
            borderColor: borderColorPicker.value,

        };
        chrome.storage.local.set({ settings: settingsToSave }, () => {
            if (originalLanguage !== settingsToSave.language) {
                location.reload();
                return;
            }
            if (hidePanel) {
                settingsPanel.classList.add('hidden');
            }
            updateButtonText();
            applySettings(settingsToSave);
            if (window.populateBookmarkFolderDropdown) {
                window.populateBookmarkFolderDropdown();
            }
        });
    }



    function loadSettings() {
        chrome.storage.local.get('settings', data => {
            const currentSettings = data.settings || {};
            originalLanguage = currentSettings.language || 'auto';
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
                startupD: typeof currentSettings.startupD === 'boolean' ? currentSettings.startupD : false,
                useOrganizerFolders: typeof currentSettings.useOrganizerFolders === 'boolean' ? currentSettings.useOrganizerFolders : false,

                bgColor: currentSettings.bgColor || '#f0f2f5',
                sidebarBg: currentSettings.sidebarBg || '#ffffff',
                textColor: currentSettings.textColor || '#1c1e21',
                btnColor: currentSettings.btnColor || currentSettings.accentColor || '#f0f0f0',
                borderColor: currentSettings.borderColor || currentSettings.accentColor || '#dddfe2',
                inputBgColor: currentSettings.inputBgColor || (currentSettings.theme === 'dark' ? '#333333' : '#ffffff'),
                language: currentSettings.language || 'auto',

            };

    if (languageSelect) {
        languageSelect.value = tempSettings.language || 'auto';
        languageSelect.addEventListener('change', () => {
            tempSettings.language = languageSelect.value;
            saveSettings(false); // Immediate reload if language changed
        });
    }


            updateButtonText();
            sidebarFolderSelect.value = tempSettings.sidebarFolderId;
            extensionRootFolderSelect.value = tempSettings.rootFolderId;

            if (startupCheckA) {
                startupCheckA.checked = tempSettings.startupA;
                startupCheckA.addEventListener('change', () => saveSettings(false));
            }
            if (startupCheckB) {
                startupCheckB.checked = tempSettings.startupB;
                startupCheckB.addEventListener('change', () => saveSettings(false));
            }
            if (startupCheckC) {
                startupCheckC.checked = tempSettings.startupC;
                startupCheckC.addEventListener('change', () => saveSettings(false));
            }
            if (startupCheckD) {
                startupCheckD.checked = tempSettings.startupD;
                startupCheckD.addEventListener('change', () => saveSettings(false));
            }
            if (useOrganizerFoldersToggle) useOrganizerFoldersToggle.checked = tempSettings.useOrganizerFolders;

            let fontSize = currentSettings.dateFontSize || '11px';
            let numericSize = parseInt(fontSize.replace('px', '').replace('rem', ''));
            if (isNaN(numericSize)) numericSize = 11;

            dateFontSizeSlider.value = numericSize;
            dateFontSizeValue.textContent = `${numericSize}px`;


            bgColorPicker.value = tempSettings.bgColor;
            textColorPicker.value = tempSettings.textColor;
            btnColorPicker.value = tempSettings.btnColor;
            borderColorPicker.value = tempSettings.borderColor;



            applySettings({ ...tempSettings, dateFontSize: `${numericSize}px` });
        });
    }

    if (saveBtn) saveBtn.addEventListener('click', () => saveSettings(true));

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
                if (confirm(I18N.getMessage('confirm_import_overwrite'))) {

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
                            alert(I18N.getMessage('alert_import_success'));
                            location.reload();
                        });
                    });
                }
            } catch (err) {
                alert(I18N.getMessage('alert_invalid_backup'));
            }
        };
        reader.readAsText(file);
        importFileInput.value = '';
    });

    // --- Swap Organizers Logic ---
    const swapOrganizersBtn = document.getElementById('swap-organizers-btn');
    const swapSelect1 = document.getElementById('swap-select-1');
    const swapSelect2 = document.getElementById('swap-select-2');

    if (swapOrganizersBtn) {
        swapOrganizersBtn.addEventListener('click', () => {
            const view1 = swapSelect1.value;
            const view2 = swapSelect2.value;

            if (view1 === view2) {
                alert(I18N.getMessage('alert_select_two_different'));
                return;
            }

            if (confirm(I18N.getMessage('confirm_swap'))) {
                // Determine storage keys
                const getKey = (v) => v === 'A' ? 'panelsState' : `panelsState_${v}`;
                const key1 = getKey(view1);
                const key2 = getKey(view2);
                
                chrome.storage.local.get([key1, key2, 'settings'], (data) => {
                    const panels1 = data[key1] || [];
                    const panels2 = data[key2] || [];
                    const isFoldersEnabled = data.settings && data.settings.useOrganizerFolders;
                    const rootId = (data.settings && data.settings.rootFolderId) || '1';

                    const performDataSwap = () => {
                        const newData = {};
                        newData[key1] = panels2;
                        newData[key2] = panels1;

                        chrome.storage.local.set(newData, () => {
                            alert(I18N.getMessage('alert_swap_success'));
                            location.reload();
                        });
                    };

                    if (isFoldersEnabled) {
                        // Rename physical folders
                        chrome.bookmarks.getChildren(rootId, (children) => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                performDataSwap(); // fallback
                                return;
                            }
                            
                            const name1 = `Organizer ${view1}`;
                            const name2 = `Organizer ${view2}`;
                            
                            const folder1 = children.find(c => !c.url && c.title === name1);
                            const folder2 = children.find(c => !c.url && c.title === name2);
                            
                            if (folder1 && folder2) {
                                // Swap using a temporary name to avoid collisions
                                const tempName = `Organizer_TEMP_${Date.now()}`;
                                chrome.bookmarks.update(folder1.id, { title: tempName }, () => {
                                    chrome.bookmarks.update(folder2.id, { title: name1 }, () => {
                                        chrome.bookmarks.update(folder1.id, { title: name2 }, () => {
                                            performDataSwap();
                                        });
                                    });
                                });
                            } else {
                                performDataSwap(); // one or both folders missing
                            }
                        });
                    } else {
                        performDataSwap();
                    }
                });
            }
        });
    }

    populateFolderDropdowns();
    loadSettings();
});

function adjustColor(hex, amount) {
    return hex;
}