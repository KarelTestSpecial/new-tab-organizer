const fs = require('fs');
const path = require('path');

const localesDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/_locales/';
const htmlDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

const newTranslations = {
  en: {
    "add_notes_title": { "message": "Add New Notes Panel" },
    "label_notes_name": { "message": "Panel Name" },
    "placeholder_notes_name": { "message": "Notes title" }
  },
  nl: {
    "add_notes_title": { "message": "Nieuw Notitiepaneel Toevoegen" },
    "label_notes_name": { "message": "Paneelnaam" },
    "placeholder_notes_name": { "message": "Notitietitel" }
  },
  fr: {
    "add_notes_title": { "message": "Ajouter un nouveau panneau de notes" },
    "label_notes_name": { "message": "Nom du panneau" },
    "placeholder_notes_name": { "message": "Titre des notes" }
  },
  de: {
    "add_notes_title": { "message": "Neues Notizen-Panel hinzufügen" },
    "label_notes_name": { "message": "Panel-Name" },
    "placeholder_notes_name": { "message": "Notizentitel" }
  },
  es: {
    "add_notes_title": { "message": "Añadir nuevo panel de notas" },
    "label_notes_name": { "message": "Nombre del panel" },
    "placeholder_notes_name": { "message": "Título de las notas" }
  },
  pt: {
    "add_notes_title": { "message": "Adicionar novo painel de notas" },
    "label_notes_name": { "message": "Nome do painel" },
    "placeholder_notes_name": { "message": "Título das notas" }
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

    html = html.replace(/<h2 style="margin-bottom: 20px;">Add New Notes Panel<\/h2>/g, '<h2 style="margin-bottom: 20px;" data-i18n="add_notes_title">Add New Notes Panel</h2>');
    html = html.replace(/<label for="new-notes-panel-name" style="margin: 0; font-weight: bold;">Panel Name<\/label>/g, '<label for="new-notes-panel-name" style="margin: 0; font-weight: bold;" data-i18n="label_notes_name">Panel Name</label>');
    html = html.replace(/placeholder="Notes title"/g, 'data-i18n-placeholder="placeholder_notes_name" placeholder="Notes title"');

    fs.writeFileSync(filePath, html);
});

console.log('Finished updating notes modal translations');
