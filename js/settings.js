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

    function saveSettings() {
        const settings = {
            theme: themeSelect.value,
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
                themeSelect.value = data.settings.theme || 'light';
                sidebarFolderSelect.value = data.settings.sidebarFolderId || '';
                headerFolderSelect.value = data.settings.headerFolderId || '';
                applySettings(data.settings); // Apply loaded settings on page load
            }
        });
    }

    saveBtn.addEventListener('click', saveSettings);

    // --- Initialization ---
    populateFolderDropdowns();
    loadSettings();
});
