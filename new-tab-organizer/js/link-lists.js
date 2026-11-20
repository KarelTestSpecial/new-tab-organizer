// Simultaneous link opening: named lists of links, built by dragging bookmarks
// from the organizer panels or the sidebar into the modal dropzone.

(function () {
    'use strict';

    const LISTS_STORAGE_KEY = 'linkLists';
    const MODAL_ID = 'open-links-modal';

    let lists = [];
    let draft = { items: [] };
    let editingListId = null;
    let internalDragIndex = null;
    let toastTimer = null;
    let toastHideTimer = null;

    // --- Helpers ---

    function uid() {
        return 'll_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    function looksLikeUrl(value) {
        return /^[a-z][a-z0-9+.-]*:/i.test(value) || /^www\./i.test(value);
    }

    function normalizeUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return '';
        return /^www\./i.test(trimmed) ? 'https://' + trimmed : trimmed;
    }

    function titleFromUrl(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
            return url;
        }
    }

    // --- Storage ---

    function loadLists(callback) {
        chrome.storage.local.get(LISTS_STORAGE_KEY, (data) => {
            const stored = data[LISTS_STORAGE_KEY];
            lists = Array.isArray(stored) ? stored : [];
            if (callback) callback();
        });
    }

    function persistLists(callback) {
        chrome.storage.local.set({ [LISTS_STORAGE_KEY]: lists }, () => {
            if (callback) callback();
        });
    }

    // --- Toast ---

    function showToast(message) {
        const toast = document.getElementById('open-links-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        // Force reflow so the transition replays on consecutive toasts
        void toast.offsetWidth;
        toast.classList.add('visible');
        if (toastTimer) clearTimeout(toastTimer);
        if (toastHideTimer) clearTimeout(toastHideTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('visible');
            toastHideTimer = setTimeout(() => toast.classList.add('hidden'), 200);
        }, 1800);
    }

    // --- Views ---

    function showView(view) {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        modal.querySelectorAll('.open-links-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === view);
        });
        modal.querySelectorAll('.open-links-view').forEach((section) => {
            section.classList.toggle('hidden', section.dataset.view !== view);
        });
    }

    // --- Lists view ---

    function renderLists() {
        const container = document.getElementById('open-links-list-container');
        const empty = document.getElementById('open-links-empty');
        if (!container) return;

        container.innerHTML = '';
        if (empty) empty.classList.toggle('hidden', lists.length > 0);

        lists.forEach((list) => {
            const itemCount = (list.items || []).length;

            const row = document.createElement('div');
            row.className = 'open-links-list-row';

            const openButton = document.createElement('button');
            openButton.type = 'button';
            openButton.className = 'open-links-list-open';
            openButton.title = "Open all links in this list";

            const name = document.createElement('span');
            name.className = 'open-links-list-name';
            name.textContent = list.name;

            const count = document.createElement('span');
            count.className = 'open-links-list-count';
            count.textContent = itemCount + ' ' + "links";

            openButton.appendChild(name);
            openButton.appendChild(count);
            openButton.addEventListener('click', () => openList(list));

            const actions = document.createElement('div');
            actions.className = 'open-links-list-actions';

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'open-links-icon-btn';
            editButton.textContent = '\u270E';
            editButton.title = "Edit";
            editButton.addEventListener('click', () => startBuild(list));

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'open-links-icon-btn';
            deleteButton.textContent = '\u2715';
            deleteButton.title = "Delete";
            deleteButton.addEventListener('click', () => deleteList(list));

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);

            row.appendChild(openButton);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    function openList(list) {
        const urls = (list.items || []).map((item) => item.url).filter(Boolean);
        if (urls.length === 0) {
            showToast("This list has no links.");
            return;
        }
        urls.forEach((url) => {
            chrome.tabs.create({ url: url, active: false });
        });
        showToast(urls.length + ' ' + "tabs opened");
    }

    function deleteList(list) {
        const question = "Delete this list?";
        if (!confirm(question + '\n\n' + list.name)) return;
        lists = lists.filter((entry) => entry.id !== list.id);
        persistLists(() => {
            renderLists();
            showToast("List deleted.");
        });
    }

    // --- Build view ---

    function startBuild(list) {
        const nameInput = document.getElementById('open-links-name-input');
        editingListId = list ? list.id : null;
        draft = {
            items: list ? (list.items || []).map((item) => ({ title: item.title, url: item.url })) : []
        };
        if (nameInput) nameInput.value = list ? list.name : '';
        renderDraft();
        showView('build');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 0);
        }
    }

    function renderDraft() {
        const itemList = document.getElementById('open-links-items');
        const countLabel = document.getElementById('open-links-count');
        if (!itemList) return;

        itemList.innerHTML = '';

        draft.items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'open-links-item';
            li.draggable = true;
            li.dataset.index = String(index);

            const textWrap = document.createElement('div');
            textWrap.className = 'open-links-item-text';

            const title = document.createElement('span');
            title.className = 'open-links-item-title';
            title.textContent = item.title || titleFromUrl(item.url);

            const url = document.createElement('span');
            url.className = 'open-links-item-url';
            url.textContent = item.url;

            textWrap.appendChild(title);
            textWrap.appendChild(url);

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'open-links-icon-btn open-links-item-remove';
            removeButton.textContent = '\u2715';
            removeButton.title = "Remove";
            removeButton.addEventListener('click', () => {
                draft.items.splice(index, 1);
                renderDraft();
            });

            li.addEventListener('dragstart', (e) => {
                internalDragIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                // Custom type only: dragging an item out of the modal must not look
                // like a bookmark move to the panels underneath.
                e.dataTransfer.setData('application/x-open-links-item', String(index));
                setTimeout(() => li.classList.add('dragging'), 0);
            });
            li.addEventListener('dragend', () => {
                internalDragIndex = null;
                li.classList.remove('dragging');
            });

            li.appendChild(textWrap);
            li.appendChild(removeButton);
            itemList.appendChild(li);
        });

        if (countLabel) {
            countLabel.textContent = draft.items.length
                ? draft.items.length + ' ' + "links"
                : '';
        }
    }

    function insertionIndex(clientY) {
        const items = [...document.querySelectorAll('#open-links-items .open-links-item:not(.dragging)')];
        for (let i = 0; i < items.length; i++) {
            const box = items[i].getBoundingClientRect();
            if (clientY < box.top + box.height / 2) return i;
        }
        return items.length;
    }

    function addItem(url, title) {
        const normalized = normalizeUrl(url);
        if (!normalized) return;

        const exists = draft.items.some((item) => item.url === normalized);
        if (exists) {
            showToast("That link is already in the list.");
            return;
        }

        draft.items.push({
            title: (title || '').trim() || titleFromUrl(normalized),
            url: normalized
        });
        renderDraft();
    }

    // Dragged bookmarks arrive as a bookmark id (panels/sidebar) or as a URL
    // (dragging the <a> itself, or a link from another page).
    function addFromDataTransfer(dataTransfer) {
        if (!dataTransfer) return;

        const plain = (dataTransfer.getData('text/plain') || '').trim();
        const uriList = (dataTransfer.getData('text/uri-list') || '').trim();
        const uri = uriList.split(/\r?\n/).find((line) => line && !line.startsWith('#')) || '';

        if (plain && looksLikeUrl(plain)) {
            addItem(plain, '');
            return;
        }

        if (plain && /^\d+$/.test(plain)) {
            chrome.bookmarks.get(plain, (results) => {
                if (!chrome.runtime.lastError && results && results[0] && results[0].url) {
                    addItem(results[0].url, results[0].title);
                } else if (uri) {
                    addItem(uri, '');
                }
            });
            return;
        }

        if (uri) {
            addItem(uri, '');
            return;
        }

        if (plain) addItem(plain, '');
    }

    function saveDraft() {
        const nameInput = document.getElementById('open-links-name-input');
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            showToast("Give the list a name first.");
            if (nameInput) nameInput.focus();
            return;
        }
        if (draft.items.length === 0) {
            showToast("Add at least one link.");
            return;
        }

        if (editingListId) {
            const index = lists.findIndex((list) => list.id === editingListId);
            if (index > -1) {
                lists[index] = { ...lists[index], name: name, items: draft.items };
            }
        } else {
            lists.push({ id: uid(), name: name, items: draft.items, createdAt: Date.now() });
        }

        persistLists(() => {
            editingListId = null;
            draft = { items: [] };
            renderLists();
            showView('lists');
            showToast("List saved.");
        });
    }

    // --- Wiring ---

    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        const openButton = document.getElementById('open-links-btn');
        const newButton = document.getElementById('open-links-new-btn');
        const saveButton = document.getElementById('open-links-save-btn');
        const cancelButton = document.getElementById('open-links-cancel-btn');
        const dropzone = document.getElementById('open-links-dropzone');
        const nameInput = document.getElementById('open-links-name-input');

        function openModal() {
            loadLists(() => {
                renderLists();
                draft = { items: [] };
                editingListId = null;
                if (nameInput) nameInput.value = '';
                renderDraft();
                showView('lists');
                modal.classList.remove('hidden');
            });
        }

        if (openButton) openButton.addEventListener('click', openModal);
        if (newButton) newButton.addEventListener('click', () => startBuild(null));
        if (saveButton) saveButton.addEventListener('click', saveDraft);
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                editingListId = null;
                draft = { items: [] };
                showView('lists');
            });
        }

        modal.querySelectorAll('.open-links-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === 'build') {
                    if (editingListId === null && draft.items.length === 0 && !(nameInput && nameInput.value.trim())) {
                        startBuild(null);
                    } else {
                        showView('build');
                    }
                } else {
                    showView('lists');
                }
            });
        });

        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveDraft();
                }
            });
        }

        if (dropzone) {
            ['dragenter', 'dragover'].forEach((eventName) => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = internalDragIndex !== null ? 'move' : 'copy';
                    }
                    dropzone.classList.add('drag-over');
                });
            });

            dropzone.addEventListener('dragleave', (e) => {
                if (!dropzone.contains(e.relatedTarget)) {
                    dropzone.classList.remove('drag-over');
                }
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');

                if (internalDragIndex !== null) {
                    const from = internalDragIndex;
                    internalDragIndex = null;
                    const to = insertionIndex(e.clientY);
                    if (to !== from) {
                        const [moved] = draft.items.splice(from, 1);
                        draft.items.splice(to, 0, moved);
                        renderDraft();
                    }
                    return;
                }

                addFromDataTransfer(e.dataTransfer);
            });
        }

        // Guard: while the modal is open, a link dropped anywhere else on the
        // page must not navigate the new-tab page away.
        document.addEventListener('dragover', (e) => {
            if (!modal.classList.contains('hidden')) e.preventDefault();
        });
        document.addEventListener('drop', (e) => {
            if (!modal.classList.contains('hidden')) e.preventDefault();
        });
    });
})();
