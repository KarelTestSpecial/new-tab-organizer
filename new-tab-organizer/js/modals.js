// Modal behaviour that used to be missing: focus handling, Escape, backdrop
// close and a Tab trap. The page still shows and hides modals with the
// `hidden` class; this observes that and adds the rest.
(function () {
    'use strict';

    const FOCUSABLE = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    // Deleting a bookmark folder is destructive, so a stray click outside must
    // not dismiss it. It still has Cancel and Escape.
    const NO_BACKDROP_CLOSE = new Set(['delete-folder-modal']);

    let lastOutside = null;

    const allModals = () => Array.from(document.querySelectorAll('.modal'));

    const topModal = () => {
        const open = allModals().filter((modal) => !modal.classList.contains('hidden'));
        return open.length ? open[open.length - 1] : null;
    };

    const focusables = (modal) => Array.from(modal.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);

    // Remember the element that was focused before a modal opened, so closing
    // can put the user back where they were.
    document.addEventListener('focusin', (event) => {
        if (!event.target.closest('.modal')) lastOutside = event.target;
    });

    const observer = new MutationObserver((records) => {
        records.forEach((record) => {
            const modal = record.target;
            const hidden = modal.classList.contains('hidden');
            const wasHidden = modal.dataset.wasHidden === '1';
            if (hidden === wasHidden) return;
            modal.dataset.wasHidden = hidden ? '1' : '0';

            if (hidden) {
                if (lastOutside && document.contains(lastOutside)) {
                    lastOutside.focus();
                    lastOutside = null;
                }
                return;
            }

            // Wait until the element is visible before focusing it. Prefer a
            // form field over the close button.
            setTimeout(() => {
                const preferred = modal.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
                const items = focusables(modal);
                if (preferred) preferred.focus();
                else if (items.length) items[0].focus();
            }, 0);
        });
    });

    allModals().forEach((modal) => {
        modal.dataset.wasHidden = modal.classList.contains('hidden') ? '1' : '0';
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    // Backdrop click. Uses click (not mousedown) so it cannot fall through to
    // whatever sits underneath the modal.
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList && target.classList.contains('modal') && !NO_BACKDROP_CLOSE.has(target.id)) {
            target.classList.add('hidden');
        }
    });

    // Keep Tab inside the topmost open modal.
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const modal = topModal();
        if (!modal) return;
        const items = focusables(modal);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
})();