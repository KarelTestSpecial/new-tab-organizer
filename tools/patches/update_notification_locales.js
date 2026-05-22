const fs = require('fs');
const path = require('path');

const localesDir = '/home/kareltestspecial/1-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/_locales';
const languages = ['nl', 'en', 'fr', 'de', 'es', 'pt'];

const newMessages = {
    nl: {
        notification_title: "New Tab Organizer bijgewerkt naar v",
        notification_message: "Nieuwe functies: Creëer direct nieuwe mappen vanuit de instellingen en verplaats je Organizer-mappen eenvoudig mee!"
    },
    en: {
        notification_title: "New Tab Organizer Updated to v",
        notification_message: "New features: Create new folders directly from settings and easily move your Organizer folders!"
    },
    fr: {
        notification_title: "New Tab Organizer mis à jour vers v",
        notification_message: "Nouvelles fonctionnalités : Créez de nouveaux dossiers directement depuis les paramètres et déplacez facilement vos dossiers Organizer !"
    },
    de: {
        notification_title: "New Tab Organizer aktualisiert auf v",
        notification_message: "Neue Funktionen: Erstellen Sie neue Ordner direkt aus den Einstellungen und verschieben Sie Ihre Organizer-Ordner ganz einfach!"
    },
    es: {
        notification_title: "New Tab Organizer actualizado a v",
        notification_message: "Nuevas funciones: ¡Cree carpetas nuevas directamente desde la configuración y mueva fácilmente sus carpetas de Organizer!"
    },
    pt: {
        notification_title: "New Tab Organizer atualizado para v",
        notification_message: "Novas funcionalidades: Crie novas pastas diretamente das configurações e mova facilmente suas pastas do Organizer!"
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
