const fs = require('fs');

const path = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/js/settings_logic.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add language to tempSettings initialization
if (!content.includes("language: currentSettings.language || 'auto'")) {
    content = content.replace(/accentColor: currentSettings.accentColor \|\| '#e0e0e0',/, "accentColor: currentSettings.accentColor || '#e0e0e0',\n                language: currentSettings.language || 'auto',");
}

// 2. Add original language tracking
if (!content.includes('let originalLanguage =')) {
    content = content.replace(/let tempSettings = {};/, "let tempSettings = {};\n    let originalLanguage = 'auto';");
    content = content.replace(/tempSettings = {/, "originalLanguage = currentSettings.language || 'auto';\n            tempSettings = {");
}

// 3. Reload if language changed in saveSettings
if (!content.includes('if (originalLanguage !== settingsToSave.language)')) {
    content = content.replace(/chrome.storage.local.set\(\{ settings: settingsToSave \}, \(\) => \{/, 
        `chrome.storage.local.set({ settings: settingsToSave }, () => {
            if (originalLanguage !== settingsToSave.language) {
                location.reload();
                return;
            }`);
}

fs.writeFileSync(path, content);
console.log('Fixed settings_logic.js');
