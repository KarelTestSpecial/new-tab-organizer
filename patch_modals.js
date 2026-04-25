const fs = require('fs');
const path = require('path');

const localesDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/_locales/';
const htmlDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

const newTranslations = {
  en: {
    "label_select_specific_folders": { "message": "Select Specific Folders" },
    "btn_sort_root_folder": { "message": "Sort Root Folder" },
    "label_recursive": { "message": "Recursive" },
    "select_folders_prompt": { "message": "--Select folders (Ctrl+Click)--" },
    "label_import_subfolders": { "message": "Import subfolders as individual panels" },
    "label_position": { "message": "Position" },
    "label_top": { "message": "Top" },
    "label_bottom": { "message": "Bottom" },
    "btn_add": { "message": "Add" },
    "btn_create": { "message": "Create" },
    "btn_cancel_modal": { "message": "Cancel" }
  },
  nl: {
    "label_select_specific_folders": { "message": "Selecteer Specifieke Mappen" },
    "btn_sort_root_folder": { "message": "Sorteer Hoofdmap" },
    "label_recursive": { "message": "Recursief" },
    "select_folders_prompt": { "message": "--Selecteer mappen (Ctrl+Klik)--" },
    "label_import_subfolders": { "message": "Importeer submappen als individuele panelen" },
    "label_position": { "message": "Positie" },
    "label_top": { "message": "Boven" },
    "label_bottom": { "message": "Onder" },
    "btn_add": { "message": "Toevoegen" },
    "btn_create": { "message": "Aanmaken" },
    "btn_cancel_modal": { "message": "Annuleren" }
  },
  fr: {
    "label_select_specific_folders": { "message": "Sélectionner des dossiers spécifiques" },
    "btn_sort_root_folder": { "message": "Trier le dossier racine" },
    "label_recursive": { "message": "Récursif" },
    "select_folders_prompt": { "message": "--Sélectionner des dossiers (Ctrl+Clic)--" },
    "label_import_subfolders": { "message": "Importer les sous-dossiers comme panneaux individuels" },
    "label_position": { "message": "Position" },
    "label_top": { "message": "Haut" },
    "label_bottom": { "message": "Bas" },
    "btn_add": { "message": "Ajouter" },
    "btn_create": { "message": "Créer" },
    "btn_cancel_modal": { "message": "Annuler" }
  },
  de: {
    "label_select_specific_folders": { "message": "Bestimmte Ordner auswählen" },
    "btn_sort_root_folder": { "message": "Stammordner sortieren" },
    "label_recursive": { "message": "Rekursiv" },
    "select_folders_prompt": { "message": "--Ordner auswählen (Strg+Klick)--" },
    "label_import_subfolders": { "message": "Unterordner als einzelne Panels importieren" },
    "label_position": { "message": "Position" },
    "label_top": { "message": "Oben" },
    "label_bottom": { "message": "Unten" },
    "btn_add": { "message": "Hinzufügen" },
    "btn_create": { "message": "Erstellen" },
    "btn_cancel_modal": { "message": "Abbrechen" }
  },
  es: {
    "label_select_specific_folders": { "message": "Seleccionar carpetas específicas" },
    "btn_sort_root_folder": { "message": "Ordenar carpeta raíz" },
    "label_recursive": { "message": "Recursivo" },
    "select_folders_prompt": { "message": "--Seleccionar carpetas (Ctrl+Clic)--" },
    "label_import_subfolders": { "message": "Importar subcarpetas como paneles individuales" },
    "label_position": { "message": "Posición" },
    "label_top": { "message": "Arriba" },
    "label_bottom": { "message": "Abajo" },
    "btn_add": { "message": "Añadir" },
    "btn_create": { "message": "Crear" },
    "btn_cancel_modal": { "message": "Cancelar" }
  },
  pt: {
    "label_select_specific_folders": { "message": "Selecionar pastas específicas" },
    "btn_sort_root_folder": { "message": "Ordenar pasta raiz" },
    "label_recursive": { "message": "Recursivo" },
    "select_folders_prompt": { "message": "--Selecionar pastas (Ctrl+Clique)--" },
    "label_import_subfolders": { "message": "Importar subpastas como painéis individuais" },
    "label_position": { "message": "Posição" },
    "label_top": { "message": "Superior" },
    "label_bottom": { "message": "Inferior" },
    "btn_add": { "message": "Adicionar" },
    "btn_create": { "message": "Criar" },
    "btn_cancel_modal": { "message": "Cancelar" }
  }
};

Object.keys(newTranslations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'messages.json');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let json = JSON.parse(content);
    Object.assign(json, newTranslations[lang]);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  }
});

const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];
files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    html = html.replace(/<label for="panel-folder-select" style="margin: 0; font-weight: bold;">Select Specific Folders<\/label>/g, '<label for="panel-folder-select" style="margin: 0; font-weight: bold;" data-i18n="label_select_specific_folders">Select Specific Folders</label>');
    html = html.replace(/<button type="button" id="sort-bookmarks-popup-btn" class="settings-btn-item" style="padding: 5px 12px; font-size: 0\.85rem; font-weight: bold;">Sort Root Folder<\/button>/g, '<button type="button" id="sort-bookmarks-popup-btn" class="settings-btn-item" style="padding: 5px 12px; font-size: 0.85rem; font-weight: bold;" data-i18n="btn_sort_root_folder">Sort Root Folder</button>');
    html = html.replace(/<input type="checkbox" id="sort-recursive-popup-checkbox">\s*Recursive/g, '<input type="checkbox" id="sort-recursive-popup-checkbox"> <span data-i18n="label_recursive">Recursive</span>');
    html = html.replace(/<option value="">--Select folders \(Ctrl\+Click\)--<\/option>/g, '<option value="" data-i18n="select_folders_prompt">--Select folders (Ctrl+Click)--</option>');
    html = html.replace(/<input type="checkbox" id="import-subfolders-checkbox">\s*Import subfolders as individual panels/g, '<input type="checkbox" id="import-subfolders-checkbox"> <span data-i18n="label_import_subfolders">Import subfolders as individual panels</span>');
    html = html.replace(/<input type="checkbox" id="import-recursive-checkbox">\s*Recursive/g, '<input type="checkbox" id="import-recursive-checkbox"> <span data-i18n="label_recursive">Recursive</span>');
    html = html.replace(/<span style="font-weight: bold; font-size: 0\.9rem;">Position<\/span>/g, '<span style="font-weight: bold; font-size: 0.9rem;" data-i18n="label_position">Position</span>');
    html = html.replace(/<input type="radio" name="bookmarks-position" value="top">\s*Top/g, '<input type="radio" name="bookmarks-position" value="top"> <span data-i18n="label_top">Top</span>');
    html = html.replace(/<input type="radio" name="bookmarks-position" value="bottom" checked>\s*Bottom/g, '<input type="radio" name="bookmarks-position" value="bottom" checked> <span data-i18n="label_bottom">Bottom</span>');
    html = html.replace(/<button type="submit" style="min-width: 80px; font-weight: bold;">Add<\/button>/g, '<button type="submit" style="min-width: 80px; font-weight: bold;" data-i18n="btn_add">Add</button>');
    html = html.replace(/<button type="button" class="cancel-btn" style="min-width: 80px;">Cancel<\/button>/g, '<button type="button" class="cancel-btn" style="min-width: 80px;" data-i18n="btn_cancel_modal">Cancel</button>');
    html = html.replace(/<button type="submit">Create<\/button>/g, '<button type="submit" data-i18n="btn_create">Create</button>');
    html = html.replace(/<button type="button" class="cancel-btn">Cancel<\/button>/g, '<button type="button" class="cancel-btn" data-i18n="btn_cancel_modal">Cancel</button>');

    fs.writeFileSync(filePath, html);
});

console.log('Finished updating modal translations');
