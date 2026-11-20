// Lightweight hover tooltips for elements that carry a data-tooltip attribute.
// Keeps the tooltip inside the viewport and removes itself on mouseleave.

(function () {
    'use strict';

    let tooltipElement = null;

    function attachTooltip(el) {
        el.addEventListener('mouseenter', () => {
            const rect = el.getBoundingClientRect();
            const tip = document.createElement('div');
            tip.className = 'info-tooltip-fixed';
            tip.textContent = el.getAttribute('data-tooltip') || '';
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

            tooltipElement = tip;
        });

        el.addEventListener('mouseleave', () => {
            if (!tooltipElement) return;
            tooltipElement.classList.remove('visible');
            setTimeout(() => {
                if (tooltipElement && tooltipElement.parentNode) {
                    tooltipElement.parentNode.removeChild(tooltipElement);
                }
                tooltipElement = null;
            }, 200);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-tooltip]').forEach(attachTooltip);
    });
})();
