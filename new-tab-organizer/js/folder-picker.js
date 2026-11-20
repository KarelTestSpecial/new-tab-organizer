// Searchable, hierarchical bookmark-folder picker.
//
// A native <select> can only show a flat list, and Chrome returns the bookmark
// tree as a flat pre-order list, so the settings dropdown used to read as
// "Werk", "Projecten", "Zijbalk", ... with no indication of where anything
// lives. This module rebuilds the hierarchy, shows it indented, and adds a
// search box on top.
//
// The original <select> stays in the DOM as the value holder: existing code
// keeps reading `.value` and listening for `change`, and this module only
// supplies the UI and keeps both in sync. That is deliberate - it means the
// settings save logic did not have to change.
(function () {
    'use strict';

    const NEW_FOLDER_VALUE = '__new_folder__';

    // Lowercase + strip diacritics, so "creatie" also matches "Crea­ti­ev".
    function fold(value) {
        return String(value == null ? '' : value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function compareTitles(a, b) {
        return String(a.title).localeCompare(String(b.title), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    // --- Hierarchy ------------------------------------------------------------

    function buildTree(folders) {
        const nodes = new Map();

        (folders || []).forEach((folder) => {
            if (!folder || folder.id == null) return;
            const id = String(folder.id);
            if (id === '0') return; // the virtual root, never a real choice
            nodes.set(id, {
                id,
                title: folder.title || 'Unnamed Folder',
                parentId: folder.parentId == null ? null : String(folder.parentId),
                children: []
            });
        });

        if (!nodes.size) return [];

        // Without parent ids there is nothing to nest, so the list stays flat.
        const hasParents = [...nodes.values()].some((node) => node.parentId !== null);
        const roots = [];

        nodes.forEach((node) => {
            const parent = node.parentId !== null ? nodes.get(node.parentId) : null;
            // `parent !== node` guards against a folder that lists itself as its
            // own parent, which would drop it out of the tree entirely.
            if (parent && parent !== node && hasParents) parent.children.push(node);
            else roots.push(node);
        });

        const sortRec = (list) => {
            list.sort(compareTitles);
            list.forEach((node) => sortRec(node.children));
        };
        sortRec(roots);

        return roots;
    }

    function flatten(roots) {
        const entries = [];
        const walk = (nodes, depth, trail) => {
            nodes.forEach((node) => {
                const path = trail.concat(node.title);
                entries.push({ node, depth, path });
                walk(node.children, depth + 1, path);
            });
        };
        walk(roots, 0, []);
        return entries;
    }

    // --- Search ---------------------------------------------------------------

    // Every token must hit something. A title hit always beats a path hit, so
    // "Werk" first returns the folder named Werk and only then the folders that
    // merely live inside it.
    function scoreEntry(entry, tokens) {
        const title = fold(entry.node.title);
        const path = fold(entry.path.join(' '));
        let titleScore = Infinity;
        let pathScore = Infinity;

        for (const token of tokens) {
            if (title === token) titleScore = Math.min(titleScore, 0);
            else if (title.startsWith(token)) titleScore = Math.min(titleScore, 1);
            else if (title.includes(token)) titleScore = Math.min(titleScore, 2);
            else if (path.includes(token)) pathScore = Math.min(pathScore, 1);
            else return null; // this token matched nothing
        }

        if (titleScore === Infinity) titleScore = 3;
        return titleScore * 10 + pathScore;
    }

    function search(entries, query) {
        const tokens = fold(query).split(/\s+/).filter(Boolean);
        if (!tokens.length) return entries;

        const scored = [];
        entries.forEach((entry) => {
            const score = scoreEntry(entry, tokens);
            if (score !== null) scored.push({ entry, score });
        });

        scored.sort((a, b) => a.score - b.score || compareTitles(a.entry.node, b.entry.node));
        return scored.map((item) => item.entry);
    }

    // --- Component ------------------------------------------------------------

    function create(select, options) {
        const opts = options || {};
        const allowNewFolder = opts.allowNewFolder !== false;
        const emptyLabel = opts.emptyLabel || 'Select a folder';

        const wrapper = document.createElement('div');
        wrapper.className = 'folder-picker';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        select.classList.add('folder-picker-native');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'folder-picker-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const triggerLabel = document.createElement('span');
        triggerLabel.className = 'folder-picker-trigger-label';
        const chevron = document.createElement('span');
        chevron.className = 'folder-picker-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        trigger.appendChild(triggerLabel);
        trigger.appendChild(chevron);
        wrapper.appendChild(trigger);

        const popover = document.createElement('div');
        popover.className = 'folder-picker-popover hidden';
        popover.setAttribute('role', 'dialog');

        const searchRow = document.createElement('div');
        searchRow.className = 'folder-picker-search';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'folder-picker-input';
        input.placeholder = opts.searchPlaceholder || 'Search folders…';
        input.setAttribute('aria-label', 'Search folders');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        const count = document.createElement('span');
        count.className = 'folder-picker-count';
        searchRow.appendChild(input);
        searchRow.appendChild(count);
        popover.appendChild(searchRow);

        const list = document.createElement('div');
        list.className = 'folder-picker-list';
        list.setAttribute('role', 'listbox');
        popover.appendChild(list);
        document.body.appendChild(popover);

        let entries = [];
        let roots = [];
        let rows = [];
        let activeIndex = -1;
        let currentValue = select.value || '';

        // The native select is the value holder the rest of the settings code
        // reads, but a <select> only accepts values that exist as <option>s. The
        // visible list is rebuilt anyway, so the hidden options mirror it and
        // `.value` keeps working.
        function syncNativeOptions() {
            select.innerHTML = '';

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = emptyLabel;
            select.appendChild(placeholder);

            entries.forEach((entry) => {
                const option = document.createElement('option');
                option.value = entry.node.id;
                option.textContent = entry.path.join(' › ');
                select.appendChild(option);
            });

            if (allowNewFolder) {
                const option = document.createElement('option');
                option.value = NEW_FOLDER_VALUE;
                option.textContent = '+ New folder…';
                select.appendChild(option);
            }

            select.value = currentValue;
        }

        function selectedValue() {
            return currentValue;
        }

        function labelFor(value) {
            if (!value) return emptyLabel;
            if (value === NEW_FOLDER_VALUE) return '+ New folder…';
            const entry = entries.find((item) => item.node.id === value);
            return entry ? entry.node.title : emptyLabel;
        }

        function renderTrigger() {
            const value = selectedValue();
            triggerLabel.textContent = labelFor(value);
            trigger.classList.toggle('has-value', Boolean(value));
        }

        function makeRow({ value, title, path, depth, kind }) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'folder-picker-row';
            row.setAttribute('role', 'option');
            row.dataset.value = value;
            if (kind) row.dataset.kind = kind;

            if (kind === 'new') {
                row.classList.add('folder-picker-row-new');
            } else if (kind === 'clear') {
                row.classList.add('folder-picker-row-clear');
            } else {
                row.style.paddingLeft = (10 + depth * 15) + 'px';
            }

            const titleEl = document.createElement('span');
            titleEl.className = 'folder-picker-row-title';
            titleEl.textContent = title;
            row.appendChild(titleEl);

            // The path is the whole point of the redesign: two folders called
            // "Projecten" in different branches are only distinguishable with it.
            if (path) {
                const pathEl = document.createElement('span');
                pathEl.className = 'folder-picker-row-path';
                pathEl.textContent = path;
                row.appendChild(pathEl);
            }

            row.addEventListener('click', () => choose(value));
            return row;
        }

        function render() {
            const query = input.value;
            const tokens = fold(query).split(/\s+/).filter(Boolean);
            const visible = tokens.length ? search(entries, query) : entries;
            const selected = selectedValue();

            list.innerHTML = '';
            rows = [];

            if (!tokens.length && selected) {
                const clearRow = makeRow({ value: '', title: 'Clear selection', kind: 'clear' });
                list.appendChild(clearRow);
                rows.push(clearRow);
            }

            visible.forEach((entry) => {
                const row = makeRow({
                    value: entry.node.id,
                    title: entry.node.title,
                    // Only the parents: repeating the folder's own name in the
                    // path would be noise ("Archief — Bookmark bar › Werk › Archief").
                    path: tokens.length ? entry.path.slice(0, -1).join('  ›  ') : '',
                    depth: tokens.length ? 0 : entry.depth
                });
                if (entry.node.id === selected) {
                    row.classList.add('is-selected');
                    row.setAttribute('aria-current', 'true');
                }
                list.appendChild(row);
                rows.push(row);
            });

            if (!visible.length) {
                const empty = document.createElement('p');
                empty.className = 'folder-picker-empty';
                empty.textContent = tokens.length ? 'No folder matches that.' : 'No folders yet.';
                list.appendChild(empty);
            }

            if (allowNewFolder && !tokens.length) {
                const newRow = makeRow({ value: NEW_FOLDER_VALUE, title: '+ New folder…', kind: 'new' });
                list.appendChild(newRow);
                rows.push(newRow);
            }

            count.textContent = tokens.length
                ? visible.length + (visible.length === 1 ? ' result' : ' results')
                : '';

            activeIndex = rows.findIndex((row) => row.dataset.value === selected && row.dataset.kind !== 'clear');
            highlight();
        }

        function highlight() {
            rows.forEach((row, index) => row.classList.toggle('is-active', index === activeIndex));
            const active = rows[activeIndex];
            if (active && active.scrollIntoView) {
                active.scrollIntoView({ block: 'nearest' });
            }
        }

        function moveActive(step) {
            if (!rows.length) return;
            if (activeIndex < 0) activeIndex = step > 0 ? 0 : rows.length - 1;
            else activeIndex = (activeIndex + step + rows.length) % rows.length;
            highlight();
        }

        function choose(value) {
            close();
            if (String(value) === selectedValue()) {
                renderTrigger();
                return;
            }
            currentValue = String(value);
            select.value = currentValue;
            renderTrigger();
            // Existing listeners (save, new-folder prompt) stay in charge of what
            // a change means; this only reports it.
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function open() {
            if (!popover.classList.contains('hidden')) return;
            input.value = '';
            render();
            popover.classList.remove('hidden');
            trigger.setAttribute('aria-expanded', 'true');
            position();
            input.focus();
        }

        function close() {
            if (popover.classList.contains('hidden')) return;
            popover.classList.add('hidden');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
        }

        function toggle() {
            if (popover.classList.contains('hidden')) open();
            else close();
        }

        function position() {
            const rect = trigger.getBoundingClientRect();
            const width = Math.max(rect.width, 280);
            popover.style.width = width + 'px';
            // Measure while hidden so the flip decision uses the real height.
            popover.style.visibility = 'hidden';
            const height = popover.offsetHeight;

            let top = rect.bottom + 6;
            if (top + height > window.innerHeight - 8 && rect.top - height - 6 >= 8) {
                top = rect.top - height - 6;
            }
            top = Math.max(8, Math.min(top, window.innerHeight - height - 8));

            const maxLeft = Math.max(8, window.innerWidth - width - 8);
            const left = Math.min(Math.max(8, rect.left), maxLeft);

            popover.style.top = top + 'px';
            popover.style.left = left + 'px';
            popover.style.visibility = '';
        }

        function setValue(value) {
            currentValue = value == null ? '' : String(value);

            // A <select> rejects a value that has no matching <option>, and the
            // folder list is refetched asynchronously. Without a placeholder the
            // freshly created folder would read back as '' to whoever saves.
            if (currentValue && ![...select.options].some((o) => o.value === currentValue)) {
                const option = document.createElement('option');
                option.value = currentValue;
                option.textContent = currentValue;
                select.appendChild(option);
            }

            select.value = currentValue;
            renderTrigger();
        }

        function setFolders(folders, value) {
            roots = buildTree(folders);
            entries = flatten(roots);
            syncNativeOptions();
            if (value !== undefined) setValue(value);
            else select.value = currentValue;
            renderTrigger();
            if (!popover.classList.contains('hidden')) render();
        }

        // --- Events ---
        trigger.addEventListener('click', toggle);

        input.addEventListener('input', () => {
            activeIndex = -1;
            render();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                const row = rows[activeIndex >= 0 ? activeIndex : 0];
                if (row) choose(row.dataset.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // The settings panel closes itself on Escape at document level;
                // closing the picker must not close the panel underneath it.
                e.stopPropagation();
                close();
            } else if (e.key === 'Tab') {
                close();
            }
        });

        // Clicking a trigger of another picker must not leave this one open.
        document.addEventListener('pointerdown', (e) => {
            if (popover.classList.contains('hidden')) return;
            if (wrapper.contains(e.target) || popover.contains(e.target)) return;
            close();
        });

        window.addEventListener('resize', () => {
            if (!popover.classList.contains('hidden')) position();
        });
        // The settings panel scrolls; a fixed popover would drift away from the
        // trigger, so follow it instead of closing under the user's fingers.
        window.addEventListener('scroll', () => {
            if (!popover.classList.contains('hidden')) position();
        }, true);

        select.__folderPicker = {
            setFolders,
            setValue,
            refresh: render,
            open,
            close
        };

        renderTrigger();
        return select.__folderPicker;
    }

    window.FolderPicker = { create };
})();