// One definition of "order" for the whole extension.
//
// There used to be none: panels kept their own array order, the sidebar showed
// Chrome's order, the modals showed Chrome's pre-order walk, and six call sites
// each called localeCompare with their own options. That is why the same folder
// could appear in three different orders in three different places.
//
// This module is the single source. Two policies exist:
//   manual       - the user's own order, kept where it is stored
//   alphabetical - sorted by title, numeric-aware, case- and accent-insensitive
//
// It never writes to Chrome by itself. Applying a policy to a real Chrome folder
// is an explicit call to applyChromeOrder(), which the user triggers by choosing
// the policy - not a side effect of rendering.
(function () {
    'use strict';

    const MANUAL = 'manual';
    const ALPHABETICAL = 'alphabetical';

    function normalize(value) {
        return value === ALPHABETICAL ? ALPHABETICAL : MANUAL;
    }

    // Numeric-aware so "Map 2" comes before "Map 10", and accent-insensitive so
    // "Créatief" sorts next to "Creatief" instead of after "Z".
    function compareTitles(a, b) {
        const left = a && a.title !== undefined ? a.title : a;
        const right = b && b.title !== undefined ? b.title : b;
        return String(left == null ? '' : left).localeCompare(String(right == null ? '' : right), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    // Returns the input untouched for 'manual'. Callers can therefore always
    // call this instead of branching themselves.
    function sortByName(list, policy) {
        if (!Array.isArray(list)) return list;
        if (normalize(policy) === MANUAL) return list;
        return [...list].sort(compareTitles);
    }

    function orderingOf(settings) {
        if (settings && settings.ordering && typeof settings.ordering === 'object') return settings.ordering;
        return {};
    }

    function panelsPolicy(settings, view) {
        const panels = orderingOf(settings).panels;
        return normalize(panels && panels[view]);
    }

    function foldersPolicy(settings, view) {
        const folders = orderingOf(settings).folders;
        return normalize(folders && folders[view]);
    }

    function sidebarPolicy(settings) {
        return normalize(orderingOf(settings).sidebar);
    }

    function rootPolicy(settings) {
        return normalize(orderingOf(settings).root);
    }

    function anyAlphabetical(settings) {
        const o = orderingOf(settings);
        const views = window.getOrganizerViews ? window.getOrganizerViews() : [];
        if (normalize(o.sidebar) === ALPHABETICAL) return true;
        if (normalize(o.root) === ALPHABETICAL) return true;
        if (o.panels && Object.keys(o.panels).some((k) => normalize(o.panels[k]) === ALPHABETICAL)) return true;
        if (o.folders && Object.keys(o.folders).some((k) => normalize(o.folders[k]) === ALPHABETICAL)) return true;
        return views.length === 0 && false;
    }

    // --- Applying a policy to real Chrome folders -----------------------------

    // Sorts the children of every Chrome folder whose policy is 'alphabetical'.
    // The organizer folders are found by name under the root, because their ids
    // are not stored anywhere and change when Chrome re-creates them.
    function applyChromeOrder(settings, callback) {
        const rootId = (settings && settings.rootFolderId) || '1';
        const o = orderingOf(settings);
        const targets = [];

        if (normalize(o.root) === ALPHABETICAL) targets.push(rootId);
        if (settings && settings.sidebarFolderId && normalize(o.sidebar) === ALPHABETICAL) {
            targets.push(settings.sidebarFolderId);
        }

        const views = (window.getOrganizerViews ? window.getOrganizerViews() : [])
            .filter((view) => normalize(o.folders && o.folders[view]) === ALPHABETICAL);

        if (!targets.length && !views.length) {
            if (callback) callback();
            return;
        }

        const finish = () => {
            window.__orderingApplying = false;
            if (callback) callback();
        };

        const run = () => {
            // sortBookmarksInFolder only moves a node when its index is actually
            // wrong, so a second pass is a no-op. That is what keeps the
            // onMoved listener below from looping.
            let chain = Promise.resolve();
            targets.forEach((folderId) => {
                chain = chain.then(() => new Promise((resolve) => {
                    sortBookmarksInFolder(folderId, {
                        recursive: false,
                        sortOrder: 'mixed',
                        sortBookmarks: true
                    }, resolve);
                }));
            });
            chain.then(finish);
        };

        if (!views.length) {
            window.__orderingApplying = true;
            run();
            return;
        }

        chrome.bookmarks.getChildren(rootId, (children) => {
            views.forEach((view) => {
                const name = window.organizerFolderName ? window.organizerFolderName(view) : ('Organizer ' + view);
                const folder = (children || []).find((child) => !child.url && child.title === name);
                if (folder) targets.push(folder.id);
            });
            window.__orderingApplying = true;
            run();
        });
    }

    let applyTimer = null;

    function scheduleChromeOrder() {
        if (applyTimer) clearTimeout(applyTimer);
        applyTimer = setTimeout(() => {
            applyTimer = null;
            chrome.storage.local.get('settings', (data) => {
                applyChromeOrder((data && data.settings) || {}, () => {});
            });
        }, 500);
    }

    // Chrome reports every move, including our own. Re-applying is safe (the sort
    // is idempotent) but wasteful, so the flag suppresses the echo of our writes.
    function watchBookmarkChanges() {
        ['onCreated', 'onRemoved', 'onMoved'].forEach((eventName) => {
            const event = chrome.bookmarks && chrome.bookmarks[eventName];
            if (!event || !event.addListener) return;
            event.addListener(() => {
                if (window.__orderingApplying) return;
                scheduleChromeOrder();
            });
        });
    }

    window.ORDERING = {
        MANUAL,
        ALPHABETICAL,
        normalize,
        compareTitles,
        sortByName,
        orderingOf,
        panelsPolicy,
        foldersPolicy,
        sidebarPolicy,
        rootPolicy,
        anyAlphabetical,
        applyChromeOrder,
        scheduleChromeOrder,
        watchBookmarkChanges
    };
})();