const fs = require('fs');

const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/js/';

let app = fs.readFileSync(dir + 'app.js', 'utf8');
app = app.replace(/"Vul een naam in voor de nieuwe map\."/, "I18N.getMessage('alert_provide_name')");
app = app.replace(/"Fout bij het aanmaken van de map: "/, "I18N.getMessage('alert_error_creating')");
app = app.replace(/'Please select at least one bookmark folder\.'/, "I18N.getMessage('alert_select_one_folder')");
app = app.replace(/"Let op: alle mappen worden in de root geplaatst van de Organizer map \(ook submappen\) , eventuele boomstructuren gaan verloren -- alles wordt één vlakke structuur met alle mappen naast elkaar zonder submappen. Ga je akkoord, dan wordt de mappenstructuur effectief platgemaakt in Chrome. Wil je doorgaan\?"/, "I18N.getMessage('confirm_flattening')");
app = app.replace(/'Remove this panel\?'/, "I18N.getMessage('confirm_delete_panel')");
fs.writeFileSync(dir + 'app.js', app);

let settingsLogic = fs.readFileSync(dir + 'settings_logic.js', 'utf8');
settingsLogic = settingsLogic.replace(/"We hanteren het principe: Wat je in de extensie ziet, is wat je in Chrome hebt\.\\n\\n4 mappen \(Organizer A, B, C, D\) worden aangemaakt in Chrome Bookmarks. Wanneer je straks panelen verplaatst via rechtsklik of de swap-knop, zullen ook de bijbehorende mappen in Chrome verplaatst worden\.\\n\\nGa je akkoord\?"/, "I18N.getMessage('confirm_enable_folders')");
settingsLogic = settingsLogic.replace(/"Automatisch verplaatsen van mappen is uitgeschakeld\. Je bestaande Organizer mappen zijn \(nog\) niet verwijderd\."/, "I18N.getMessage('alert_auto_move_off')");
settingsLogic = settingsLogic.replace(/`Are you sure you want to import this data\? Your current layout and settings for THIS VIEW will be overwritten\.`/, "I18N.getMessage('confirm_import_overwrite')");
settingsLogic = settingsLogic.replace(/`Data for \${CURRENT_VIEW} imported successfully! The page will now reload.`/, "I18N.getMessage('alert_import_success')");
settingsLogic = settingsLogic.replace(/'Invalid backup file\.'/, "I18N.getMessage('alert_invalid_backup')");
settingsLogic = settingsLogic.replace(/"Please select two different organizers to swap\."/, "I18N.getMessage('alert_select_two_different')");
settingsLogic = settingsLogic.replace(/`Are you sure you want to swap the contents of Organizer \${view1} and Organizer \${view2}\?`/, "I18N.getMessage('confirm_swap')");
settingsLogic = settingsLogic.replace(/`Content swapped successfully between \${view1} and \${view2}\. The page will now reload.`/, "I18N.getMessage('alert_swap_success')");

// Also add settings loading for language dropdown
const langLoad = `
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.value = tempSettings.language || 'auto';
        languageSelect.addEventListener('change', () => {
            tempSettings.language = languageSelect.value;
            // Immediate effect requires reload, but we'll let saveSettings handle it
        });
    }
`;
if (!settingsLogic.includes('languageSelect')) {
    settingsLogic = settingsLogic.replace(/function loadSettings\(\) {[\s\S]*?tempSettings = {[\s\S]*?};/, match => match + "\n" + langLoad);
    settingsLogic = settingsLogic.replace(/useOrganizerFolders: tempSettings.useOrganizerFolders,/, "useOrganizerFolders: tempSettings.useOrganizerFolders,\n            language: tempSettings.language,");
}

fs.writeFileSync(dir + 'settings_logic.js', settingsLogic);
console.log('Updated JS files');
