const fs = require('fs');
const path = require('path');

const localesDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/_locales/';

const newTranslations = {
  en: {
    "this_folder_empty": { "message": "This folder is empty." },
    "select_folder_settings": { "message": "Select a folder in settings." },
    "save_current_setup": { "message": "Save your current setup" },
    "move_panels_rightclick": { "message": "Move Individual Panels by Rightclicking Panel Header" },
    "select_sidebar_folder": { "message": "Select a Sidebar Folder" }
  },
  nl: {
    "this_folder_empty": { "message": "Deze map is leeg." },
    "select_folder_settings": { "message": "Selecteer een map in de instellingen." },
    "save_current_setup": { "message": "Sla je huidige layout op" },
    "move_panels_rightclick": { "message": "Verplaats individuele panelen door rechts te klikken op de titel" },
    "select_sidebar_folder": { "message": "Selecteer een Zijbalk Map" }
  },
  fr: {
    "this_folder_empty": { "message": "Ce dossier est vide." },
    "select_folder_settings": { "message": "Sélectionnez un dossier dans les paramètres." },
    "save_current_setup": { "message": "Enregistrez votre configuration actuelle" },
    "move_panels_rightclick": { "message": "Déplacez les panneaux en faisant un clic droit sur l'en-tête" },
    "select_sidebar_folder": { "message": "Sélectionnez un dossier de barre latérale" }
  },
  de: {
    "this_folder_empty": { "message": "Dieser Ordner ist leer." },
    "select_folder_settings": { "message": "Wählen Sie einen Ordner in den Einstellungen." },
    "save_current_setup": { "message": "Speichern Sie Ihr aktuelles Setup" },
    "move_panels_rightclick": { "message": "Verschieben Sie einzelne Panels durch Rechtsklick auf den Header" },
    "select_sidebar_folder": { "message": "Wählen Sie einen Seitenleisten-Ordner" }
  },
  es: {
    "this_folder_empty": { "message": "Esta carpeta está vacía." },
    "select_folder_settings": { "message": "Seleccione una carpeta en la configuración." },
    "save_current_setup": { "message": "Guarde su configuración actual" },
    "move_panels_rightclick": { "message": "Mueva paneles individuales haciendo clic derecho en el encabezado" },
    "select_sidebar_folder": { "message": "Seleccione una carpeta de la barra lateral" }
  },
  pt: {
    "this_folder_empty": { "message": "Esta pasta está vazia." },
    "select_folder_settings": { "message": "Selecione uma pasta nas configurações." },
    "save_current_setup": { "message": "Salve sua configuração atual" },
    "move_panels_rightclick": { "message": "Mova painéis clicando com o botão direito no cabeçalho" },
    "select_sidebar_folder": { "message": "Selecione uma pasta da barra lateral" }
  }
};

Object.keys(newTranslations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'messages.json');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let json = JSON.parse(content);
    
    // Add new translations
    Object.assign(json, newTranslations[lang]);
    
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
    console.log('Updated ' + lang);
  }
});
