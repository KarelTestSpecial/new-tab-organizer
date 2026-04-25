const fs = require('fs');
const path = require('path');

const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

// 1. Add new translations
const newTranslations = {
  en: {
    "btn_hide_clock": { "message": "Hide Clock" },
    "btn_show_clock": { "message": "Show Clock" },
    "btn_hide_date": { "message": "Hide Date" },
    "btn_show_date": { "message": "Show Date" },
    "btn_hide_day": { "message": "Hide Day" },
    "btn_show_day": { "message": "Show Day" },
    "btn_hide_year": { "message": "Hide Year" },
    "btn_show_year": { "message": "Show Year" },
    "btn_theme_light": { "message": "Theme: Light" },
    "btn_theme_dark": { "message": "Theme: Dark" },
    "btn_theme_custom": { "message": "Theme: Custom" },
    "btn_hide_battery": { "message": "Hide Battery" },
    "btn_show_battery": { "message": "Show Battery" },
    "label_date_size": { "message": "Date Size:" },
    "btn_export_data": { "message": "Export Data" },
    "btn_import_data": { "message": "Import Data" },
    "btn_cancel": { "message": "Cancel" },
    "label_on_startup": { "message": "on startup:" }
  },
  nl: {
    "btn_hide_clock": { "message": "Verberg Klok" },
    "btn_show_clock": { "message": "Toon Klok" },
    "btn_hide_date": { "message": "Verberg Datum" },
    "btn_show_date": { "message": "Toon Datum" },
    "btn_hide_day": { "message": "Verberg Dag" },
    "btn_show_day": { "message": "Toon Dag" },
    "btn_hide_year": { "message": "Verberg Jaar" },
    "btn_show_year": { "message": "Toon Jaar" },
    "btn_theme_light": { "message": "Thema: Licht" },
    "btn_theme_dark": { "message": "Thema: Donker" },
    "btn_theme_custom": { "message": "Thema: Aangepast" },
    "btn_hide_battery": { "message": "Verberg Batterij" },
    "btn_show_battery": { "message": "Toon Batterij" },
    "label_date_size": { "message": "Datumgrootte:" },
    "btn_export_data": { "message": "Exporteer Data" },
    "btn_import_data": { "message": "Importeer Data" },
    "btn_cancel": { "message": "Annuleren" },
    "label_on_startup": { "message": "bij opstarten:" }
  },
  fr: {
    "btn_hide_clock": { "message": "Masquer l'horloge" },
    "btn_show_clock": { "message": "Afficher l'horloge" },
    "btn_hide_date": { "message": "Masquer la date" },
    "btn_show_date": { "message": "Afficher la date" },
    "btn_hide_day": { "message": "Masquer le jour" },
    "btn_show_day": { "message": "Afficher le jour" },
    "btn_hide_year": { "message": "Masquer l'année" },
    "btn_show_year": { "message": "Afficher l'année" },
    "btn_theme_light": { "message": "Thème : Clair" },
    "btn_theme_dark": { "message": "Thème : Sombre" },
    "btn_theme_custom": { "message": "Thème : Personnalisé" },
    "btn_hide_battery": { "message": "Masquer la batterie" },
    "btn_show_battery": { "message": "Afficher la batterie" },
    "label_date_size": { "message": "Taille de la date :" },
    "btn_export_data": { "message": "Exporter les données" },
    "btn_import_data": { "message": "Importer les données" },
    "btn_cancel": { "message": "Annuler" },
    "label_on_startup": { "message": "au démarrage :" }
  },
  de: {
    "btn_hide_clock": { "message": "Uhr verbergen" },
    "btn_show_clock": { "message": "Uhr anzeigen" },
    "btn_hide_date": { "message": "Datum verbergen" },
    "btn_show_date": { "message": "Datum anzeigen" },
    "btn_hide_day": { "message": "Tag verbergen" },
    "btn_show_day": { "message": "Tag anzeigen" },
    "btn_hide_year": { "message": "Jahr verbergen" },
    "btn_show_year": { "message": "Jahr anzeigen" },
    "btn_theme_light": { "message": "Design: Hell" },
    "btn_theme_dark": { "message": "Design: Dunkel" },
    "btn_theme_custom": { "message": "Design: Benutzerdefiniert" },
    "btn_hide_battery": { "message": "Batterie verbergen" },
    "btn_show_battery": { "message": "Batterie anzeigen" },
    "label_date_size": { "message": "Datumsgröße:" },
    "btn_export_data": { "message": "Daten exportieren" },
    "btn_import_data": { "message": "Daten importieren" },
    "btn_cancel": { "message": "Abbrechen" },
    "label_on_startup": { "message": "beim Start:" }
  },
  es: {
    "btn_hide_clock": { "message": "Ocultar reloj" },
    "btn_show_clock": { "message": "Mostrar reloj" },
    "btn_hide_date": { "message": "Ocultar fecha" },
    "btn_show_date": { "message": "Mostrar fecha" },
    "btn_hide_day": { "message": "Ocultar día" },
    "btn_show_day": { "message": "Mostrar día" },
    "btn_hide_year": { "message": "Ocultar año" },
    "btn_show_year": { "message": "Mostrar año" },
    "btn_theme_light": { "message": "Tema: Claro" },
    "btn_theme_dark": { "message": "Tema: Oscuro" },
    "btn_theme_custom": { "message": "Tema: Personalizado" },
    "btn_hide_battery": { "message": "Ocultar batería" },
    "btn_show_battery": { "message": "Mostrar batería" },
    "label_date_size": { "message": "Tamaño de la fecha:" },
    "btn_export_data": { "message": "Exportar datos" },
    "btn_import_data": { "message": "Importar datos" },
    "btn_cancel": { "message": "Cancelar" },
    "label_on_startup": { "message": "al iniciar:" }
  },
  pt: {
    "btn_hide_clock": { "message": "Ocultar relógio" },
    "btn_show_clock": { "message": "Mostrar relógio" },
    "btn_hide_date": { "message": "Ocultar data" },
    "btn_show_date": { "message": "Mostrar data" },
    "btn_hide_day": { "message": "Ocultar dia" },
    "btn_show_day": { "message": "Mostrar dia" },
    "btn_hide_year": { "message": "Ocultar ano" },
    "btn_show_year": { "message": "Mostrar ano" },
    "btn_theme_light": { "message": "Tema: Claro" },
    "btn_theme_dark": { "message": "Tema: Escuro" },
    "btn_theme_custom": { "message": "Tema: Personalizado" },
    "btn_hide_battery": { "message": "Ocultar bateria" },
    "btn_show_battery": { "message": "Mostrar bateria" },
    "label_date_size": { "message": "Tamanho da data:" },
    "btn_export_data": { "message": "Exportar dados" },
    "btn_import_data": { "message": "Importar dados" },
    "btn_cancel": { "message": "Cancelar" },
    "label_on_startup": { "message": "na inicialização:" }
  }
};

const localesDir = path.join(dir, '_locales');
Object.keys(newTranslations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'messages.json');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let json = JSON.parse(content);
    Object.assign(json, newTranslations[lang]);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  }
});

// 2. HTML Updates
const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];
files.forEach(file => {
    const filePath = path.join(dir, file);
    let html = fs.readFileSync(filePath, 'utf8');
    
    html = html.replace(/<label for="date-font-size-slider" style="margin:0; white-space: nowrap; font-size: 0\.8rem;">Date Size:<\/label>/g, '<label for="date-font-size-slider" style="margin:0; white-space: nowrap; font-size: 0.8rem;" data-i18n="label_date_size">Date Size:</label>');
    html = html.replace(/<button type="button" id="export-data-btn" class="settings-btn-item">Export Data<\/button>/g, '<button type="button" id="export-data-btn" class="settings-btn-item" data-i18n="btn_export_data">Export Data</button>');
    html = html.replace(/<button type="button" id="import-data-btn" class="settings-btn-item">Import Data<\/button>/g, '<button type="button" id="import-data-btn" class="settings-btn-item" data-i18n="btn_import_data">Import Data</button>');
    html = html.replace(/<button type="button" id="close-settings-btn" class="settings-btn-item">Cancel<\/button>/g, '<button type="button" id="close-settings-btn" class="settings-btn-item" data-i18n="btn_cancel">Cancel</button>');
    html = html.replace(/<span style="opacity: 0\.7; margin-right: 5px;">on startup:<\/span>/g, '<span style="opacity: 0.7; margin-right: 5px;" data-i18n="label_on_startup">on startup:</span>');
    html = html.replace(/>Show Clock</, ' data-i18n="btn_show_clock">Show Clock<');
    html = html.replace(/>Show Date</, ' data-i18n="btn_show_date">Show Date<');
    html = html.replace(/>Show Day</, ' data-i18n="btn_show_day">Show Day<');
    html = html.replace(/>Show Year</, ' data-i18n="btn_show_year">Show Year<');
    html = html.replace(/>Theme: Light</, ' data-i18n="btn_theme_light">Theme: Light<');
    html = html.replace(/>Show Battery</, ' data-i18n="btn_show_battery">Show Battery<');

    fs.writeFileSync(filePath, html);
});

// 3. JS Updates: DOMContentLoaded -> i18nReady
const appPath = path.join(dir, 'js/app.js');
let appJs = fs.readFileSync(appPath, 'utf8');
appJs = appJs.replace(/document\.addEventListener\('DOMContentLoaded'/g, "document.addEventListener('i18nReady'");
fs.writeFileSync(appPath, appJs);

const settingsPath = path.join(dir, 'js/settings_logic.js');
let setJs = fs.readFileSync(settingsPath, 'utf8');
setJs = setJs.replace(/document\.addEventListener\('DOMContentLoaded'/g, "document.addEventListener('i18nReady'");

// Update updateButtonText() inside settings_logic.js to use I18N
const updateButtonTextReplacement = `function updateButtonText() {
        clockToggleBtn.textContent = tempSettings.showClock ? I18N.getMessage('btn_hide_clock') : I18N.getMessage('btn_show_clock');
        dateToggleBtn.textContent = tempSettings.showDate ? I18N.getMessage('btn_hide_date') : I18N.getMessage('btn_show_date');
        dayToggleBtn.textContent = tempSettings.showDayOfWeek ? I18N.getMessage('btn_hide_day') : I18N.getMessage('btn_show_day');
        yearToggleBtn.textContent = tempSettings.showYear ? I18N.getMessage('btn_hide_year') : I18N.getMessage('btn_show_year');
        batteryToggleBtn.textContent = tempSettings.showBattery ? I18N.getMessage('btn_hide_battery') : I18N.getMessage('btn_show_battery');

        if (tempSettings.theme === 'light') {
            themeToggleBtn.textContent = I18N.getMessage('btn_theme_light');
        } else if (tempSettings.theme === 'dark') {
            themeToggleBtn.textContent = I18N.getMessage('btn_theme_dark');
        } else {
            themeToggleBtn.textContent = I18N.getMessage('btn_theme_custom');
        }
    }`;

setJs = setJs.replace(/function updateButtonText\(\) \{[\s\S]*?\n    \}/, updateButtonTextReplacement);

// Fix populateBookmarkFolderDropdown to translate "Select a Sidebar Folder"
const populateReplacement = `sidebarFolderSelect.innerHTML = '<option value="">' + I18N.getMessage('select_sidebar_folder') + '</option>';`;
setJs = setJs.replace(/sidebarFolderSelect\.innerHTML = '<option value="">Select a Sidebar Folder<\/option>';/g, populateReplacement);

fs.writeFileSync(settingsPath, setJs);

console.log('Finished updating buttons and init events');
