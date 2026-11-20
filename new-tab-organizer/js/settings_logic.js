function getStorageKey(view) {
    return window.getStorageKeyForView(view);
}

document.addEventListener('DOMContentLoaded', () => {
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

    const dateFontSizeSlider = document.getElementById('date-font-size-slider');
    const headerFontSizeSlider = document.getElementById('header-font-size-slider');
    const headerFontSizeValue = document.getElementById('header-font-size-value');
    const bookmarkFontSizeSlider = document.getElementById('bookmark-font-size-slider');
    const bookmarkFontSizeValue = document.getElementById('bookmark-font-size-value');
    const dateFontSizeValue = document.getElementById('date-font-size-value');

    const startupContainer = document.getElementById('startup-views-container');
    const layoutContainer = document.getElementById('layout-views-container');
    const organizerCountSelect = document.getElementById('organizer-count-select');

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
    let sidebarFolderPicker = null;

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


    if (headerFontSizeSlider) {
        headerFontSizeSlider.addEventListener('input', (e) => {
            headerFontSizeValue.textContent = e.target.value + 'px';
            tempSettings.headerFontSize = e.target.value + 'px';
document.documentElement.style.setProperty('--header-font-size', e.target.value + 'px');
            
        });
    }
    if (bookmarkFontSizeSlider) {
        bookmarkFontSizeSlider.addEventListener('input', (e) => {
            bookmarkFontSizeValue.textContent = e.target.value + 'px';
            tempSettings.bookmarkFontSize = e.target.value + 'px';
            document.documentElement.style.setProperty('--bookmark-font-size', e.target.value + 'px');
        });
    }
    if (useOrganizerFoldersToggle) {
        useOrganizerFoldersToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                const confirmed = confirm("We use the principle: What you see in the extension is what you have in Chrome.\n\nOne folder per organizer (" + getOrganizerViews().map(v => 'Organizer ' + v).join(', ') + ") will be created in Chrome Bookmarks. When you move panels via right-click or swap, the corresponding folders in Chrome will also be moved.\n\nDo you agree?");
                if (confirmed) {
                    tempSettings.useOrganizerFolders = true;
                    const rootId = extensionRootFolderSelect.value || '1';
                    window.ensureOrganizerFolders(rootId, () => {
                        window.ensureSidebarFolder(rootId, tempSettings, () => {
                            chrome.storage.local.set({ foldersUpgradeDone: true }, () => {
                                saveSettings(false);
                            });
                        });
                    });
                } else {
                    e.target.checked = false;
                    tempSettings.useOrganizerFolders = false;
                    saveSettings(false);
                }
            } else {
                alert("Automatic folder moving is disabled. Your existing Organizer folders have NOT been removed.");
                tempSettings.useOrganizerFolders = false;
                saveSettings(false);
            }
        });
    }

    if (sidebarFolderSelect) {
        sidebarFolderSelect.addEventListener('change', () => {
            if (sidebarFolderSelect.value === '__new_folder__') {
                const promptMsg = "Please provide a name for the new folder." || 'Vul een naam in voor de nieuwe map:';
                const name = prompt(promptMsg);
                if (name && name.trim()) {
                    const parentId = tempSettings.useOrganizerFolders ? (tempSettings.rootFolderId || '1') : '2';
                    chrome.bookmarks.create({ parentId: parentId, title: name.trim() }, (newFolder) => {
                        if (chrome.runtime.lastError) {
                            alert(("Error creating folder: " || 'Fout bij het aanmaken van de map: ') + chrome.runtime.lastError.message);
                            setSidebarFolderValue(tempSettings.sidebarFolderId || '');
                            return;
                        }
                        tempSettings.sidebarFolderId = newFolder.id;
                        // Refilling the list is asynchronous, so make the new
                        // folder the selected value before saveSettings reads it.
                        setSidebarFolderValue(newFolder.id);
                        populateFolderDropdowns();
                        saveSettings(false);
                    });
                } else {
                    setSidebarFolderValue(tempSettings.sidebarFolderId || '');
                }
            } else {
                tempSettings.sidebarFolderId = sidebarFolderSelect.value;
                saveSettings(false);
            }
        });
    }

    function moveFoldersList(foldersList, destinationParentId, callback) {
        if (!foldersList || foldersList.length === 0) {
            if (callback) callback();
            return;
        }

        let moveChain = Promise.resolve();
        foldersList.forEach(folder => {
            moveChain = moveChain.then(() => new Promise(resolve => {
                chrome.bookmarks.move(folder.id, { parentId: destinationParentId }, () => {
                    resolve();
                });
            }));
        });

        moveChain.then(() => {
            if (callback) callback();
        });
    }

    if (extensionRootFolderSelect) {
        extensionRootFolderSelect.addEventListener('change', () => {
            const newRootId = extensionRootFolderSelect.value;
            const oldRootId = tempSettings.rootFolderId || '1';
            
            if (newRootId === oldRootId) return;

            const isChecked = useOrganizerFoldersToggle && useOrganizerFoldersToggle.checked;

            const proceedSave = () => {
                tempSettings.rootFolderId = newRootId;
                saveSettings(false);
                updateCheckboxText();
            };

            if (isChecked) {
                const organizerNames = getOrganizerViews().map(v => 'Organizer ' + v).join(', ');
                const wantToMove = confirm('Do you want to move the existing organizer folders (' + organizerNames + ') to the new root folder?');
                if (wantToMove) {
                    chrome.bookmarks.getChildren(oldRootId, (children) => {
                        if (chrome.runtime.lastError || !children) {
                            chrome.bookmarks.getTree((tree) => {
                                const foundFolders = [];
                                function traverse(node) {
                                    if (!node.url && isOrganizerFolderTitle(node.title)) {
                                        foundFolders.push(node);
                                    }
                                    if (node.id === tempSettings.sidebarFolderId) {
                                        foundFolders.push(node);
                                    }
                                    if (node.children) node.children.forEach(traverse);
                                }
                                if (tree && tree[0]) traverse(tree[0]);

                                moveFoldersList(foundFolders, newRootId, proceedSave);
                            });
                            return;
                        }

                        const foldersToMove = children.filter(c => !c.url && isOrganizerFolderTitle(c.title));
                        const sidebarChild = children.find(c => c.id === tempSettings.sidebarFolderId);
                        if (sidebarChild) foldersToMove.push(sidebarChild);
                        moveFoldersList(foldersToMove, newRootId, proceedSave);
                    });
                } else {
                    proceedSave();
                }
            } else {
                proceedSave();
            }
        });
    }

    batteryToggleBtn.addEventListener('click', () => {
        tempSettings.showBattery = !tempSettings.showBattery;
        saveSettings(false);
    });

    function updateCheckboxText() {
        const toggleLabelSpan = document.getElementById('organizer-folders-toggle-label');
        if (!toggleLabelSpan || !extensionRootFolderSelect) return;

        const baseText = 'Manage Organizer folders + Sidebar folder in Chrome Bookmarks';
        const selectedIndex = extensionRootFolderSelect.selectedIndex;

        if (selectedIndex <= 0 || !extensionRootFolderSelect.value) {
            toggleLabelSpan.textContent = baseText;
            return;
        }

        const selectedText = extensionRootFolderSelect.options[selectedIndex].text;
        toggleLabelSpan.textContent = baseText.replace('Chrome Bookmarks', selectedText);
    }

    function setSidebarFolderValue(value) {
        const next = value == null ? '' : String(value);
        sidebarFolderSelect.value = next;
        if (sidebarFolderPicker) sidebarFolderPicker.setValue(next);
    }

    function populateFolderDropdowns() {
        if (!sidebarFolderPicker) {
            sidebarFolderPicker = window.FolderPicker.create(sidebarFolderSelect, {
                emptyLabel: 'Select a Sidebar Folder',
                allowNewFolder: true
            });
        }

        getBookmarkFolders(folders => {
            // Root Selector: Only specific main folders
            extensionRootFolderSelect.innerHTML = '<option value="">' + "Select Root Folder" + '</option>';
            const barOption = document.createElement('option');
            barOption.value = '1';

            const otherOption = document.createElement('option');
            otherOption.value = '2';

            barOption.textContent = 'Bookmark Bar';
            otherOption.textContent = 'Other Bookmarks';

            extensionRootFolderSelect.appendChild(barOption);
            extensionRootFolderSelect.appendChild(otherOption);

            // The sidebar list rebuilds the hierarchy and adds the search box;
            // the flat <select> it replaces lives on as the hidden value holder.
            sidebarFolderPicker.setFolders(folders, tempSettings.sidebarFolderId || '');

            if (extensionRootFolderSelect && tempSettings.rootFolderId) extensionRootFolderSelect.value = tempSettings.rootFolderId;

            updateCheckboxText();
        });
    }

        function updateButtonText() {
        if (clockToggleBtn) {
            clockToggleBtn.textContent = "Clock";
            clockToggleBtn.classList.toggle('active', tempSettings.showClock);
        }
        if (dateToggleBtn) {
            dateToggleBtn.textContent = "Date";
            dateToggleBtn.classList.toggle('active', tempSettings.showDate);
        }
        if (dayToggleBtn) {
            dayToggleBtn.textContent = "Day";
            dayToggleBtn.classList.toggle('active', tempSettings.showDayOfWeek);
        }
        if (yearToggleBtn) {
            yearToggleBtn.textContent = "Year";
            yearToggleBtn.classList.toggle('active', tempSettings.showYear);
        }
        if (batteryToggleBtn) {
            batteryToggleBtn.textContent = "Battery";
            batteryToggleBtn.classList.toggle('active', tempSettings.showBattery);
        }

        if (themeBtn) {
            let icon = '🎨';
            if (tempSettings.theme === 'light') icon = '☀️';
            else if (tempSettings.theme === 'dark') icon = '🌙';

            const themeMsg = tempSettings.theme === 'light' ? "Light" :
                             tempSettings.theme === 'dark' ? "Dark" :
                             "Custom";
            
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
        const readList = (container) => {
            const values = [];
            if (!container) return values;
            container.querySelectorAll('input[type="checkbox"]').forEach(input => values.push(input.checked));
            return values;
        };

        // Named so they cannot be shadowed by the tempSettings spread below.
        let startupChecks = readList(startupContainer);
        if (startupChecks.length === 0 || !startupChecks.some(Boolean)) {
            startupChecks = getOrganizerViews().map((view, index) => (index === 0 ? true : false));
            if (startupContainer) {
                const boxes = startupContainer.querySelectorAll('input[type="checkbox"]');
                startupChecks.forEach((checked, index) => {
                    if (boxes[index]) boxes[index].checked = checked;
                });
            }
        }
        const rowLayoutChecks = readList(layoutContainer);
        let markFont = bookmarkFontSizeSlider ? parseInt(bookmarkFontSizeSlider.value) : 12;

        const settingsToSave = {
            ...tempSettings,
            sidebarFolderId: sidebarFolderSelect.value,
            rootFolderId: extensionRootFolderSelect.value,
            showBattery: tempSettings.showBattery,
            dateFontSize: `${dateFontSizeSlider.value}px`,
            headerFontSize: tempSettings.headerFontSize,
            bookmarkFontSize: `${markFont}px`,
            organizerCount: tempSettings.organizerCount,
            useOrganizerFolders: tempSettings.useOrganizerFolders,

            bgColor: bgColorPicker.value,
            sidebarBg: bgColorPicker.value,
            textColor: textColorPicker.value,
            btnColor: btnColorPicker.value,
            borderColor: borderColorPicker.value,
        };

        // Lists are written for new code; the per-letter booleans stay in sync so
        // older settings files and the startup check keep working.
        writeViewSetting(settingsToSave, 'startup', startupChecks);
        writeViewSetting(settingsToSave, 'layoutRow', rowLayoutChecks);

        chrome.storage.local.set({ settings: settingsToSave }, () => {
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
                organizerCount: typeof currentSettings.organizerCount === 'number' ? currentSettings.organizerCount : ORGANIZERS.DEFAULT_COUNT,
                startupViews: getStartupViews(currentSettings),
                rowLayoutViews: getRowLayoutViews(currentSettings),
                useOrganizerFolders: typeof currentSettings.useOrganizerFolders === 'boolean' ? currentSettings.useOrganizerFolders : false,

                bgColor: currentSettings.bgColor || '#f0f2f5',
                sidebarBg: currentSettings.sidebarBg || '#ffffff',
                textColor: currentSettings.textColor || '#1c1e21',
                btnColor: currentSettings.btnColor || currentSettings.accentColor || '#f0f0f0',
                borderColor: currentSettings.borderColor || currentSettings.accentColor || '#dddfe2',
                inputBgColor: currentSettings.inputBgColor || (currentSettings.theme === 'dark' ? '#333333' : '#ffffff'),
            };

            updateButtonText();
            setSidebarFolderValue(tempSettings.sidebarFolderId);
            extensionRootFolderSelect.value = tempSettings.rootFolderId;
            updateCheckboxText();

            renderOrganizerSettingsControls(getOrganizerViews(), currentSettings);

            if (organizerCountSelect) {
                organizerCountSelect.addEventListener('change', () => {
                    const nextCount = parseInt(organizerCountSelect.value, 10);
                    chrome.storage.local.get('settings', (data) => {
                        const settings = data.settings || {};
                        settings.organizerCount = nextCount;

                        const views = getOrganizerViewsForCount(nextCount);
                        const startupViews = views.map((view, index) => startupSettingValue(settings, index));
                        const rowLayoutViews = views.map((view) => rowLayoutSettingValue(settings, view));
                        settings.startupViews = startupViews;
                        settings.rowLayoutViews = rowLayoutViews;
                        writeViewSetting(settings, 'startup', startupViews);
                        writeViewSetting(settings, 'layoutRow', rowLayoutViews);

                        chrome.storage.local.set({ settings: settings }, () => location.reload());
                    });
                });
            }

            // The checkbox listeners are bound by renderOrganizerSettingsControls,
            // which calls this handler once per change. Binding them again here
            // would save twice and the first save would overwrite the second.
            window.onOrganizerViewSettingChanged = () => saveSettings(false);

            let fontSize = currentSettings.dateFontSize || '11px';
            let numericSize = parseInt(fontSize.replace('px', '').replace('rem', ''));
            if (isNaN(numericSize)) numericSize = 11;

            dateFontSizeSlider.value = numericSize;
            dateFontSizeValue.textContent = `${numericSize}px`;

            if (headerFontSizeSlider) {
                let hfSize = currentSettings.headerFontSize ? parseInt(currentSettings.headerFontSize.replace('px', '')) : 15;
                if (isNaN(hfSize)) hfSize = 15;
                headerFontSizeSlider.value = hfSize;
                headerFontSizeValue.textContent = `${hfSize}px`;
            }

            if (bookmarkFontSizeSlider) {
                let bmSize = currentSettings.bookmarkFontSize ? parseInt(currentSettings.bookmarkFontSize.replace('px', '')) : 12;
                if (isNaN(bmSize)) bmSize = 12;
                bookmarkFontSizeSlider.value = bmSize;
                bookmarkFontSizeValue.textContent = `${bmSize}px`;
            }


            bgColorPicker.value = tempSettings.bgColor;
            textColorPicker.value = tempSettings.textColor;
            btnColorPicker.value = tempSettings.btnColor;
            borderColorPicker.value = tempSettings.borderColor;



            let hfSize = currentSettings.headerFontSize ? parseInt(currentSettings.headerFontSize.replace('px', '')) : 15;
            let bmSize = currentSettings.bookmarkFontSize ? parseInt(currentSettings.bookmarkFontSize.replace('px', '')) : 12;
            if (isNaN(hfSize)) hfSize = 15;
            if (isNaN(bmSize)) bmSize = 12;
            applySettings({ ...tempSettings, dateFontSize: `${numericSize}px`, headerFontSize: `${hfSize}px`, bookmarkFontSize: `${bmSize}px` });
        });
    }

    if (saveBtn) saveBtn.addEventListener('click', () => saveSettings(true));

    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get([STORAGE_KEY, 'settings', 'linkLists'], (data) => {
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
                if (confirm("Are you sure you want to import this data? Your current layout and settings for THIS VIEW will be overwritten.")) {

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
                            alert("Data imported successfully! The page will now reload.");
                            location.reload();
                        });
                    });
                }
            } catch (err) {
                alert("Invalid backup file.");
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
            if (swapSelect1 && swapSelect2) {
                const views = getOrganizerViews();
                renderSwapOptions(swapSelect1, views);
                renderSwapOptions(swapSelect2, views);
            }
            const view1 = swapSelect1.value;
            const view2 = swapSelect2.value;

            if (view1 === view2) {
                alert("Please select two different organizers to swap.");
                return;
            }

            if (confirm("Are you sure you want to swap the contents?")) {
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
                            alert("Content swapped successfully. The page will now reload.");
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

    // The sidebar folder can be renamed during startup (5.7 created it as
    // 'Zijbalk'), and that may land after this first fill.
    window.addEventListener('sidebarfolderrenamed', () => {
        if (sidebarFolderPicker) populateFolderDropdowns();
    });

    populateFolderDropdowns();
    loadSettings();
});

function adjustColor(hex, amount) {
    return hex;
}