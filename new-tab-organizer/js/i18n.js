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

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.getMessage(key);
            if (translation) {
                el.setAttribute('title', translation);
            }
        });

        document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
            const key = el.getAttribute('data-i18n-tooltip');
            const translation = this.getMessage(key) || key;
            el.setAttribute('data-tooltip', translation);
            this._attachTooltip(el, translation);
        });
    },

    _tooltipEl: null,

    _attachTooltip(el, text) {
        el.addEventListener('mouseenter', (e) => {
            const rect = el.getBoundingClientRect();
            const tip = document.createElement('div');
            tip.className = 'info-tooltip-fixed';
            tip.textContent = text;
            document.body.appendChild(tip);

            const tipRect = tip.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;

            let top;
            if (spaceBelow >= tipRect.height || spaceBelow >= spaceAbove) {
                top = rect.bottom + 8;
            } else {
                top = rect.top - tipRect.height - 8;
            }

            let left = rect.left + rect.width / 2 - tipRect.width / 2;
            if (left < 4) left = 4;
            if (left + tipRect.width > window.innerWidth - 4) {
                left = window.innerWidth - tipRect.width - 4;
            }

            tip.style.top = top + 'px';
            tip.style.left = left + 'px';
            requestAnimationFrame(() => tip.classList.add('visible'));

            this._tooltipEl = tip;
        });

        el.addEventListener('mouseleave', () => {
            if (this._tooltipEl) {
                this._tooltipEl.classList.remove('visible');
                setTimeout(() => {
                    if (this._tooltipEl && this._tooltipEl.parentNode) {
                        this._tooltipEl.parentNode.removeChild(this._tooltipEl);
                    }
                    this._tooltipEl = null;
                }, 200);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await I18N.init();
    I18N.translatePage();
    document.dispatchEvent(new Event('i18nReady'));
});
