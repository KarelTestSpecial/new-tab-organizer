// This file will handle the logic for creating and managing panels and cards.

function createPanel(panelState, onStateChange) {
    const { id, title, type, folderId, cards } = panelState;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.dataset.id = id;
    panel.dataset.type = type;
    if (folderId) {
        panel.dataset.folderId = folderId;
    }

    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    panelHeader.appendChild(titleElement);

    const contentContainer = document.createElement('div');

    if (type === 'notes') {
        contentContainer.className = 'cards-container';
        titleElement.contentEditable = true;
        titleElement.addEventListener('blur', onStateChange);

        const addCardButton = document.createElement('button');
        addCardButton.textContent = '+';
        addCardButton.className = 'add-card-btn';
        panelHeader.appendChild(addCardButton);

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
                contentContainer.appendChild(draggable);
                onStateChange();
            }
        });

        // Render existing cards
        if (cards) {
            cards.forEach(cardState => createCard(contentContainer, cardState, onStateChange));
        }
    } else if (type === 'bookmarks') {
        contentContainer.className = 'bookmark-panel-container';
        if (folderId) {
            getBookmarksInFolder(folderId, (bookmarks) => {
                renderBookmarks(contentContainer, bookmarks);
            });
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

    cardText.addEventListener('blur', onStateChange);

    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', e.target.id);
        setTimeout(() => card.classList.add('dragging'), 0);
    });

    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    cardsContainer.appendChild(card);
    return card;
}
