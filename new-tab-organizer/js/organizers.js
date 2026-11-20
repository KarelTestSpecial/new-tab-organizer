// Single source of truth for the organizers (views) the extension supports.
// Letters are the identity: they key the storage keys, the nav order and the
// Chrome bookmark folder names ("Organizer A"). The number of organizers is
// user-configurable, so nothing below the helpers may hardcode a letter.

(function () {
    'use strict';

    const DEFAULT_COUNT = 6;
    const MAX_COUNT = 26;

    function toLetter(index) {
        return String.fromCharCode(65 + index); // 0 -> A
    }

    function letterToIndex(letter) {
        return String(letter || '').toUpperCase().charCodeAt(0) - 65;
    }

    function getOrganizerCount() {
        return new Promise((resolve) => {
            chrome.storage.local.get('settings', (data) => {
                const stored = data.settings && data.settings.organizerCount;
                let count = parseInt(stored, 10);
                if (isNaN(count)) count = DEFAULT_COUNT;
                count = Math.min(MAX_COUNT, Math.max(1, count));
                resolve(count);
            });
        });
    }

    // Default state (A on, B-E off) used for settings that have no explicit value.
    function defaultStartupEnabled(index) {
        return index === 0;
    }

    function defaultRowLayout(index) {
        void index;
        return false;
    }

    // Reads both the new list-shaped settings and the legacy per-letter booleans.
    function readSettingList(settings, name, fallback) {
        if (!settings) return [];
        const value = settings[name];
        if (Array.isArray(value)) return value.slice();
        const legacy = [];
        for (let i = 0; i < MAX_COUNT; i++) {
            const key = name + toLetter(i);
            if (typeof settings[key] === 'boolean') legacy.push(settings[key]);
            else break;
        }
        if (legacy.length === 0) return [];
        void fallback;
        return legacy;
    }

    function writeSettingList(target, name, list) {
        if (!target) return;
        target[name] = list.slice();
    }

    function storageKeyForView(view) {
        return view === 'A' ? 'panelsState' : 'panelsState_' + view;
    }

    function organizerFolderName(view) {
        return 'Organizer ' + view;
    }

    // Normalizes whatever this file or a previous version produced into a plain
    // file name, so callers only ever deal with panel.html.
    function viewFileName(view) {
        return 'panel' + view + '.html';
    }

    function isOrganizerFolderTitle(title, viewCount) {
        const names = new Set();
        for (let i = 0; i < viewCount; i++) names.add(organizerFolderName(toLetter(i)));
        return names.has(title);
    }

    function makePanelUrl(view) {
        return 'panel.html?view=' + view;
    }

    function enabledViews(count) {
        const views = [];
        for (let i = 0; i < count; i++) views.push(toLetter(i));
        return views;
    }

    function getOrganizerStorageKeys() {
        const keys = [];
        for (let i = 0; i < MAX_COUNT; i++) keys.push(storageKeyForView(toLetter(i)));
        return keys;
    }

    function startupValue(settings, index) {
        const legacy = settings ? settings['startup' + toLetter(index)] : undefined;
        if (typeof legacy === 'boolean') return legacy;
        const list = settings && settings.startupViews;
        if (Array.isArray(list) && typeof list[index] === 'boolean') return list[index];
        return defaultStartupEnabled(index);
    }

    function rowLayoutValue(settings, view) {
        const index = letterToIndex(view);
        const legacy = settings ? settings['layoutRow' + view] : undefined;
        if (typeof legacy === 'boolean') return legacy;
        const list = settings && settings.rowLayoutViews;
        if (Array.isArray(list) && typeof list[index] === 'boolean') return list[index];
        return defaultRowLayout(index);
    }

    function viewsForCount(count) {
        const views = [];
        for (let i = 0; i < count; i++) views.push(toLetter(i));
        return views;
    }

    // Both the "On startup" and "Row layout" settings are lists in storage but
    // are also written as startupA/layoutRowA for backwards compatibility.
    // Settings hold both shapes: `startupViews` / `layoutRowViews` for new code
    // and `startupA` / `layoutRowC` for anything that still reads per letter.
    function writeViewSetting(settings, name, list) {
        const listKey = name === 'startup' ? 'startupViews' : 'rowLayoutViews';
        settings[listKey] = list.map(Boolean);
        for (let i = 0; i < list.length; i++) {
            settings[name + toLetter(i)] = !!list[i];
        }
    }

    window.ORGANIZERS = {
        DEFAULT_COUNT,
        MAX_COUNT,
        toLetter,
        letterToIndex,
        getOrganizerCount,
        enabledViews,
        getOrganizerStorageKeys,
        defaultStartupEnabled,
        defaultRowLayout,
        readSettingList,
        writeSettingList,
        writeViewSetting,
        storageKeyForView,
        organizerFolderName,
        viewFileName,
        isOrganizerFolderTitle,
        makePanelUrl,
        startupValue,
        rowLayoutValue,
        viewsForCount
    };

    window.getStorageKeyForView = storageKeyForView;
    window.organizerFolderName = organizerFolderName;
    window.organizerViewFileName = viewFileName;

    // --- Global helpers used by app.js, panels.js and settings_logic.js ---

    // Kept in sync with chrome.storage settings by renderOrganizerControls().
    window.organizerViews = [];

    window.getOrganizerViews = function () {
        if (window.organizerViews.length) return window.organizerViews.slice();
        return enabledViews(DEFAULT_COUNT);
    };

    window.isOrganizerFolderTitle = function (title) {
        return window.getOrganizerViews().some(view => organizerFolderName(view) === title);
    };

    window.getRowLayout = function (settings, view) {
        return rowLayoutValue(settings, view);
    };

    // List-shaped reads: one boolean per enabled organizer, in view order.
    window.getStartupViews = function (settings) {
        return getOrganizerViews().map((view) => startupValue(settings, letterToIndex(view)));
    };

    window.getRowLayoutViews = function (settings) {
        return getOrganizerViews().map((view) => rowLayoutValue(settings, view));
    };

    window.getOrganizerViewsForCount = viewsForCount;
    window.startupSettingValue = startupValue;
    window.rowLayoutSettingValue = rowLayoutValue;
    window.writeViewSetting = writeViewSetting;

    // swap selects only ever list the organizers that currently exist
    window.renderSwapOptions = function (select, views) {
        if (!select) return;
        const current = select.value;
        buildViewOptions(select, views, current);
    };

    // --- Settings UI rendering ---

    function buildCountOptions(select, currentCount) {
        select.innerHTML = '';
        for (let i = 1; i <= MAX_COUNT; i++) {
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = String(i);
            select.appendChild(option);
        }
        select.value = String(currentCount);
    }

    function buildViewOptions(select, views, selectedView) {
        select.innerHTML = '';
        views.forEach(view => {
            const option = document.createElement('option');
            option.value = view;
            option.textContent = 'Organizer ' + view;
            select.appendChild(option);
        });
        if (selectedView) select.value = selectedView;
    }

    function renderStartupAndLayout(container, views, name, isChecked) {
        container.innerHTML = '';
        views.forEach((view, index) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = name + '-check-' + view;
            input.dataset.view = view;
            input.dataset.index = String(index);
            input.checked = isChecked(view, index);
            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + view));
            container.appendChild(label);
        });
    }

    // Both kinds of row are checkboxes, so the label markup is shared.
    function bindViewCheckboxes(container) {
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                if (typeof window.onOrganizerViewSettingChanged === 'function') {
                    window.onOrganizerViewSettingChanged();
                }
            });
        });
    }

    window.bindOrganizerViewCheckboxes = bindViewCheckboxes;

    window.renderOrganizerSidebarNav = function (views, currentView) {
        const nav = document.getElementById('sidebar-view-nav');
        if (!nav) return;
        nav.innerHTML = '';
        views.forEach(view => {
            const link = document.createElement('a');
            link.href = ORGANIZERS.makePanelUrl(view);
            link.id = 'nav-view-' + (letterToIndex(view) + 1);
            link.textContent = view;
            if (view === currentView) link.classList.add('active-view-link');
            nav.appendChild(link);
        });
    };

    window.renderOrganizerSettingsControls = function (views, settings) {
        const startupContainer = document.getElementById('startup-views-container');
        const layoutContainer = document.getElementById('layout-views-container');
        const countSelect = document.getElementById('organizer-count-select');
        const swap1 = document.getElementById('swap-select-1');
        const swap2 = document.getElementById('swap-select-2');

        if (countSelect) buildCountOptions(countSelect, views.length);
        if (startupContainer) {
            renderStartupAndLayout(startupContainer, views, 'startup', (view, index) => startupValue(settings, index));
        }
        if (layoutContainer) {
            renderStartupAndLayout(layoutContainer, views, 'layoutRow', (view, index) => {
                const legacy = settings ? settings['layoutRow' + view] : undefined;
                if (typeof legacy === 'boolean') return legacy;
                const list = settings && settings.rowLayoutViews;
                if (Array.isArray(list) && typeof list[index] === 'boolean') return list[index];
                return false;
            });
        }
        if (swap1) buildViewOptions(swap1, views, 'A');
        if (swap2) buildViewOptions(swap2, views, views[1] || 'B');

        bindViewCheckboxes(startupContainer);
        bindViewCheckboxes(layoutContainer);
    };
})();