const fs = require('fs');
const path = require('path');

const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';
const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    content = content.replace(/Save your current<br>setup/, '<span data-i18n="save_current_setup">Save your current setup</span>');
    content = content.replace(/>Move Individual Panels by Rightclicking Panel Header&nbsp;&nbsp;&nbsp;</, ' data-i18n="move_panels_rightclick">Move Individual Panels by Rightclicking Panel Header&nbsp;&nbsp;&nbsp;<');
    content = content.replace(/<option value="">Select a Sidebar Folder<\/option>/, '<option value="" data-i18n="select_sidebar_folder">Select a Sidebar Folder</option>');

    fs.writeFileSync(filePath, content);
    console.log('Updated ' + file);
});

// Update app.js
const appPath = path.join(dir, 'js/app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(/>This folder is empty\.</g, `>' + I18N.getMessage('this_folder_empty') + '<`);
appContent = appContent.replace(/>Select a folder in settings\.</g, `>' + I18N.getMessage('select_folder_settings') + '<`);

fs.writeFileSync(appPath, appContent);
console.log('Updated app.js');
