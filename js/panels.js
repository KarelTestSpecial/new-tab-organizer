// This file will handle the logic for creating and managing panels and cards.

function createPanel(panelState, onStateChange) {
    const { id, title, type, folderId, cards } = panelState;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.draggable = true;
    panel.dataset.id = id;
    panel.dataset.type = type;
    if (folderId) {
        panel.dataset.folderId = folderId;
    }

    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header drag-handle';
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.contentEditable = true;
    titleElement.addEventListener('blur', onStateChange);
    panelHeader.appendChild(titleElement);

    const panelActions = document.createElement('div');
    panelActions.className = 'panel-actions';
    panelHeader.appendChild(panelActions);

    const deletePanelButton = document.createElement('button');
    deletePanelButton.innerHTML = '&times;'; // A simple 'x'
    deletePanelButton.className = 'delete-btn panel-delete-btn';
    deletePanelButton.addEventListener('click', () => {
        // For undo functionality
        const nextSibling = panel.nextElementSibling;
        const undoItem = {
            itemType: 'panel',
            state: panelState,
            nextSiblingId: nextSibling ? nextSibling.dataset.id : null
        };
        undoStack.push(undoItem);

        panel.remove();
        onStateChange();
    });
    panelActions.appendChild(deletePanelButton);

    const contentContainer = document.createElement('div');

    if (type === 'notes') {
        contentContainer.className = 'cards-container';

        const addCardButton = document.createElement('button');
        addCardButton.textContent = '+';
        addCardButton.className = 'add-card-btn';
        panelActions.appendChild(addCardButton);

        addCardButton.addEventListener('click', () => {
            createCard(contentContainer, { id: `card-${Date.now()}`, text: 'New Card' }, onStateChange);
            onStateChange();
        });

        // Drag and drop listeners for the notes panel
        contentContainer.addEventListener('dragover', e => {
            e.preventDefault();
            contentContainer.classList.add('drag-over');
        });
        contentContainer.addEventListener('dragleave', () => contentContainer.classList.remove('drag-over'));
        contentContainer.addEventListener('drop', e => {
            e.preventDefault();
            contentContainer.classList.remove('drag-over');
            const cardId = e.dataTransfer.getData('text/plain');
            const draggable = document.getElementById(cardId);

            if (draggable) {
                const afterElement = getCardDragAfterElement(contentContainer, e.clientY);
                if (afterElement == null) {
                    contentContainer.appendChild(draggable);
                } else {
                    contentContainer.insertBefore(draggable, afterElement);
                }
                onStateChange();
            }
        });

        // Render existing cards
        if (cards) {
            cards.forEach(cardState => createCard(contentContainer, cardState, onStateChange));
        }
    } else if (type === 'bookmarks') {
        contentContainer.className = 'bookmark-panel-container';

        contentContainer.addEventListener('dragover', e => {
            e.preventDefault();
            contentContainer.classList.add('drag-over');
        });
        contentContainer.addEventListener('dragleave', () => {
            contentContainer.classList.remove('drag-over');
        });
        contentContainer.addEventListener('drop', e => {
            e.preventDefault();
            contentContainer.classList.remove('drag-over');
            const bookmarkId = e.dataTransfer.getData('text/plain');
            const destinationFolderId = panel.dataset.folderId;

            if (!bookmarkId || !destinationFolderId) return;

            // Find the drop index
            const afterElement = getBookmarkDragAfterElement(contentContainer, e.clientY);
            const children = [...contentContainer.querySelectorAll('.bookmark-item')];
            const dropIndex = afterElement ? children.indexOf(afterElement) : children.length;

            moveBookmark(bookmarkId, { parentId: destinationFolderId, index: dropIndex }, () => {
                // Refresh all bookmark panels/sidebar
                window.bookmarkRefreshCallbacks.forEach(cb => cb());
            });
        });

        if (folderId) {
            const refreshPanel = () => {
                getBookmarksInFolder(folderId, (bookmarks) => {
                    renderBookmarks(contentContainer, bookmarks, folderId, refreshPanel);
                });
            };
            // Register this refresh function globally
            window.bookmarkRefreshCallbacks.push(refreshPanel);
            refreshPanel();
        }
    }

    panel.appendChild(panelHeader);
    panel.appendChild(contentContainer);

    return panel;
}

function createCard(cardsContainer, cardState, onStateChange) {
    const { id, text } = cardState;

    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.id = id;

    const cardText = document.createElement('p');
    cardText.textContent = text;
    cardText.contentEditable = true;
    card.appendChild(cardText);

    const deleteCardButton = document.createElement('button');
    deleteCardButton.innerHTML = '&times;';
    deleteCardButton.className = 'delete-btn card-delete-btn';
    deleteCardButton.addEventListener('click', () => {
        // For undo functionality
        const parentPanelId = card.closest('.panel').dataset.id;
        const nextSibling = card.nextElementSibling;
        const undoItem = {
            itemType: 'card',
            state: cardState,
            parentPanelId: parentPanelId,
            nextSiblingId: nextSibling ? nextSibling.id : null
        };
        undoStack.push(undoItem);

        card.remove();
        onStateChange();
    });
    card.appendChild(deleteCardButton);

    cardText.addEventListener('blur', onStateChange);

    cardText.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.blur();
        }
    });

    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', e.target.id);
        setTimeout(() => card.classList.add('dragging'), 0);
    });

    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    cardsContainer.appendChild(card);
    return card;
}

function getCardDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getBookmarkDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.bookmark-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
