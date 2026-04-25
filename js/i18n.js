// Localization System with Manual Override
const I18N = {
    currentMessages: null,

    async init() {
        return new Promise((resolve) => {
            chrome.storage.local.get('settings', async (data) => {
                const settings = data.settings || {};
                const lang = settings.language || 'auto';
                
                if (lang === 'auto') {
                    this.currentMessages = null;
                    resolve();
                } else {
                    try {
                        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
                        const response = await fetch(url);
                        this.currentMessages = await response.json();
                    } catch (e) {
                        console.error("Failed to load language: ", lang, e);
                        this.currentMessages = null;
                    }
                    resolve();
                }
            });
        });
    },

    getMessage(key) {
        if (this.currentMessages && this.currentMessages[key]) {
            return this.currentMessages[key].message;
        }
        return chrome.i18n.getMessage(key);
    },

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.getMessage(key);
            if (translation) {
                el.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.getMessage(key);
            if (translation) {
                el.setAttribute('placeholder', translation);
            }
        });
    }
};

// Wait for i18n to load before translating the document
document.addEventListener('DOMContentLoaded', async () => {
    await I18N.init();
    I18N.translatePage();
    document.dispatchEvent(new Event('i18nReady'));
});
