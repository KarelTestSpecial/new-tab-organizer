const fs = require('fs');

const path = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/js/settings_logic.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /languageSelect\.addEventListener\('change', \(\) => \{\s*tempSettings\.language = languageSelect\.value;/,
    "languageSelect.addEventListener('change', () => {\n            tempSettings.language = languageSelect.value;\n            saveSettings(); // Immediate reload"
);

fs.writeFileSync(path, content);
console.log('Fixed immediate language change');
