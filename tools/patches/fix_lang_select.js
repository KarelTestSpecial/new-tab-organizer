const fs = require('fs');
const path = require('path');

const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];
const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

const langSelectHtml = `
            <!-- Language Selector -->
            <div class="settings-section" style="padding-bottom: 10px; border-bottom: 1px solid var(--border-color); margin-bottom: 15px;">
                <div class="form-group" style="margin: 0; display: flex; align-items: center;">
                    <label data-i18n="settings_language" style="margin-right: 10px;">Taal (Language):</label>
                    <select id="language-select" class="settings-select" style="min-width: 150px; padding: 5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--panel-bg); color: var(--text-color);">
                        <option value="auto" data-i18n="settings_language_auto">Auto (Browser Default)</option>
                        <option value="en">English</option>
                        <option value="nl">Nederlands</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="es">Español</option>
                        <option value="pt">Português</option>
                    </select>
                </div>
            </div>`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('id="language-select"')) {
        content = content.replace(/<div id="settings-panel" class="hidden">/, `<div id="settings-panel" class="hidden">${langSelectHtml}`);
        fs.writeFileSync(filePath, content);
        console.log('Added language selector to ' + file);
    } else {
        console.log('Language selector already exists in ' + file);
    }
});
