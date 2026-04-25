const fs = require('fs');
const path = require('path');

const localesDir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/_locales';
const languages = ['nl', 'en', 'fr', 'de', 'es', 'pt'];

const newMessages = {
    nl: {
        notification_title: "New Tab Organizer bijgewerkt naar v",
        notification_message: "Nieuwe functies: Volledige meertalige ondersteuning en verbeterde datumweergave in de zijbalk!"
    },
    en: {
        notification_title: "New Tab Organizer Updated to v",
        notification_message: "New features: Full multilingual support and improved date display in the sidebar!"
    },
    fr: {
        notification_title: "New Tab Organizer mis à jour vers v",
        notification_message: "Nouvelles fonctionnalités : Support multilingue complet et affichage de la date amélioré !"
    },
    de: {
        notification_title: "New Tab Organizer aktualisiert op v",
        notification_message: "Neue Funktionen: Volle mehrsprachige Unterstützung und verbesserte Datumsanzeige!"
    },
    es: {
        notification_title: "New Tab Organizer actualizado a v",
        notification_message: "Nuevas funciones: Soporte multilingue completo y visualización de fecha mejorada."
    },
    pt: {
        notification_title: "New Tab Organizer atualizado para v",
        notification_message: "Novas funcionalidades: Suporte multilíngue completo e exibição de data aprimorada!"
    }
};

languages.forEach(lang => {
    const filePath = path.join(localesDir, lang, 'messages.json');
    if (fs.existsSync(filePath)) {
        const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        messages.notification_title = { message: newMessages[lang].notification_title };
        messages.notification_message = { message: newMessages[lang].notification_message };
        fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    }
});

console.log('Update notification messages added to all locales.');
