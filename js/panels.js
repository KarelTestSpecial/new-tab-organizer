// This file will handle the logic for creating and managing panels and cards.
let dragSrcContext = null;

// Helper to get storage key (duplicated here to ensure availability)
function getStorageKeyForMove(view) {
    if (view === 'B') return 'panelsState_B';
    if (view === 'C') return 'panelsState_C';
    return 'panelsState'; // Default for A
}

// Global function to move panel
window.movePanelToOrganizer = function (panelId, sourceView, destinationView, position = 'bottom') {
    if (!panelId) {
        alert('Invalid panel ID.');
        return;
    }
    if (sourceView === destinationView) {
        alert('Source and destination organizers cannot be the same.');
        return;
    }

    const sourceKey = getStorageKeyForMove(sourceView);
    const destinationKey = getStorageKeyForMove(destinationView);
    let panelToMove;

    chrome.storage.local.get([sourceKey, destinationKey], (data) => {
        let sourcePanels = data[sourceKey] || [];
        let destinationPanels = data[destinationKey] || [];

        const panelIndex = sourcePanels.findIndex(p => p.id === panelId);
        if (panelIndex > -1) {
            panelToMove = sourcePanels.splice(panelIndex, 1)[0];

            if (position === 'top') {
                destinationPanels.unshift(panelToMove);
            } else {
                destinationPanels.push(panelToMove);
            }

            chrome.storage.local.set({
                [sourceKey]: sourcePanels,
                [destinationKey]: destinationPanels
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    alert('An error occurred while moving the panel.');
                } else {
                    // --- Refresh affected tabs ---
                    const viewsToReload = [sourceView, destinationView];
                    viewsToReload.forEach(view => {
                        // CURRENT_VIEW is available globally from app.js by the time this runs
                        if (typeof CURRENT_VIEW !== 'undefined' && view === CURRENT_VIEW) return;

                        const urlToReload = chrome.runtime.getURL(`panel${view}.html`);
                        chrome.tabs.query({ url: urlToReload }, (tabs) => {
                            if (tabs.length > 0) chrome.tabs.reload(tabs[0].id);
                        });
                    });

                    if (typeof CURRENT_VIEW !== 'undefined' && viewsToReload.includes(CURRENT_VIEW)) {
                        setTimeout(() => location.reload(), 150);
                    }
                }
            });
        } else {
            alert('Could not find the panel to move. It might have been deleted.');
        }
    });
};

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
    panelHeader.className = 'panel-header drag-handle';

    // --- Context Menu for Moving Panels ---
    panelHeader.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Remove any existing context menu
        const existingMenu = document.getElementById('panel-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'panel-context-menu';
        menu.className = 'context-menu';

        // Determine available views
        // Relying on CURRENT_VIEW global from app.js
        if (typeof CURRENT_VIEW === 'undefined') return;

        const views = ['A', 'B', 'C'];
        const otherViews = views.filter(v => v !== CURRENT_VIEW);

        otherViews.forEach(targetView => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = `Move to Organizer ${targetView}`;
            item.addEventListener('click', () => {
                // Open modal instead of moving immediately
                if (window.showMovePanelModal) {
                    window.showMovePanelModal(id, targetView);
                }
                menu.remove();
            });
            menu.appendChild(item);
        });

        if (panel.dataset.type === 'bookmarks') {
            const deleteItem = document.createElement('div');
            deleteItem.className = 'context-menu-item';
            deleteItem.textContent = 'Delete Folder...';
            deleteItem.addEventListener('click', () => {
                // This function will be created in the next step
                if (window.showDeleteFolderModal) {
                    window.showDeleteFolderModal(id, title);
                }
                menu.remove();
            });
            menu.appendChild(deleteItem);
        }

        // Position the menu
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        document.body.appendChild(menu);

        // Close logic
        const closeMenu = () => {
            if (menu.parentNode) {
                menu.remove();
            }
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu);
        };

        // Add listener on next tick to avoid immediate closing
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            // Also close if another context menu updates, but simpler to just listen for clicks
            document.addEventListener('contextmenu', (e) => {
                if (!menu.contains(e.target)) {
                    closeMenu();
                }
            });
        }, 0);
    });

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.contentEditable = true;

    let originalTitle = title;
    titleElement.dataset.originalText = originalTitle;

    titleElement.addEventListener('focus', () => {
        originalTitle = titleElement.textContent;
        titleElement.dataset.originalText = originalTitle;
    });

    titleElement.addEventListener('blur', () => {
        const newTitle = titleElement.textContent;
        // Use dataset.originalText as source of truth to avoid stale closures
        const currentOriginalTitle = titleElement.dataset.originalText;

        if (panel.dataset.type === 'bookmarks' && panel.dataset.folderId && newTitle !== currentOriginalTitle) {
            if (confirm(`Do you want to rename the bookmark folder from "${currentOriginalTitle}" to "${newTitle}"?`)) {
                chrome.bookmarks.update(panel.dataset.folderId, { title: newTitle }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(`Error updating bookmark folder: ${chrome.runtime.lastError.message}`);
                        titleElement.textContent = currentOriginalTitle; // Revert on error
                    } else {
                        // Update source of truth
                        titleElement.dataset.originalText = newTitle;
                        onStateChange();
                    }
                });
            } else {
                titleElement.textContent = currentOriginalTitle; // Revert on cancel
            }
        } else if (newTitle !== currentOriginalTitle) {
            undoStack.push({
                itemType: 'panel-title-edit',
                panelId: panel.dataset.id,
                oldTitle: currentOriginalTitle,
                newTitle: newTitle
            });

            // Update source of truth so subsequent actions are correct
            titleElement.dataset.originalText = newTitle;

            if (typeof redoStack !== 'undefined') redoStack.length = 0;
            onStateChange();
        }
    });

    titleElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleElement.blur();
        }
    });
    panelHeader.appendChild(titleElement);

    const panelActions = document.createElement('div');
    panelActions.className = 'panel-actions';

    const deletePanelButton = document.createElement('button');
    deletePanelButton.innerHTML = '&times;'; // A simple 'x'
    deletePanelButton.className = 'delete-btn panel-delete-btn';
    deletePanelButton.addEventListener('click', () => {
        // Scrape current state for accurate undo
        const currentCards = [];
        if (panel.dataset.type === 'notes') {
            panel.querySelectorAll('.card').forEach(c => {
                currentCards.push({
                    id: c.id,
                    text: c.querySelector('p').textContent,
                    imageUrl: c.querySelector('img') ? c.querySelector('img').src : null
                });
            });
        }

        const currentPanelState = {
            id: panel.dataset.id,
            title: panel.querySelector('h3').textContent,
            type: panel.dataset.type,
            folderId: panel.dataset.folderId,
            cards: currentCards
        };

        const nextSibling = panel.nextElementSibling;
        const undoItem = {
            itemType: 'panel',
            state: currentPanelState,
            nextSiblingId: nextSibling ? nextSibling.dataset.id : null
        };
        undoStack.push(undoItem);
        if (typeof redoStack !== 'undefined') redoStack.length = 0;

        panel.remove();
        onStateChange();
    });

    const contentContainer = document.createElement('div');

    if (type === 'notes') {
        contentContainer.className = 'cards-container';

        const addCardButton = document.createElement('button');
        addCardButton.textContent = '+';
        addCardButton.className = 'add-card-btn';
        addCardButton.addEventListener('click', () => {
            const newCard = createCard(contentContainer, { id: `card-${Date.now()}`, text: 'New Card' }, onStateChange);
            undoStack.push({
                itemType: 'create-card',
                cardId: newCard.id,
                parentPanelId: panel.dataset.id
            });
            if (typeof redoStack !== 'undefined') redoStack.length = 0;
            onStateChange();
        });
        panelActions.appendChild(addCardButton);

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

                // Undo Logic for Move
                if (dragSrcContext && dragSrcContext.cardId === cardId) {
                    const newParent = draggable.closest('.panel');
                    const newSiblings = [...newParent.querySelectorAll('.card')];
                    const newIndex = newSiblings.indexOf(draggable);

                    if (dragSrcContext.sourceParentId !== newParent.dataset.id || dragSrcContext.sourceIndex !== newIndex) {
                        undoStack.push({
                            itemType: 'move-card',
                            cardId: cardId,
                            sourceParentId: dragSrcContext.sourceParentId,
                            sourceIndex: dragSrcContext.sourceIndex,
                            destParentId: newParent.dataset.id,
                            destIndex: newIndex
                        });
                        if (typeof redoStack !== 'undefined') redoStack.length = 0;
                    }
                    dragSrcContext = null;
                }

                onStateChange();
            }
        });

        // Paste listener for images
        contentContainer.addEventListener('paste', e => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const cardState = {
                            id: `card-${Date.now()}`,
                            imageUrl: event.target.result,
                            text: ''
                        };
                        createCard(contentContainer, cardState, onStateChange);
                        undoStack.push({
                            itemType: 'create-card',
                            cardId: cardState.id,
                            parentPanelId: panel.dataset.id
                        });
                        if (typeof redoStack !== 'undefined') redoStack.length = 0;
                        onStateChange();
                    };
                    reader.readAsDataURL(file);
                    return; // Handle only the first image
                }
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

    panelActions.appendChild(deletePanelButton);
    panelHeader.appendChild(panelActions);
    panel.appendChild(panelHeader);
    panel.appendChild(contentContainer);

    return panel;
}

function createCard(cardsContainer, cardState, onStateChange) {
    const { id, text, imageUrl } = cardState;

    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.id = id;

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = text || 'Pasted image';
        card.appendChild(img);
        card.classList.add('image-card');
    }

    const cardText = document.createElement('p');
    cardText.textContent = text || '';
    cardText.contentEditable = true;

    // Undo Logic for Text
    let originalText = text || '';
    cardText.dataset.originalText = originalText;

    cardText.addEventListener('focus', () => {
        originalText = cardText.textContent;
        cardText.dataset.originalText = originalText;
    });

    card.appendChild(cardText);

    if (!text && imageUrl) {
        cardText.classList.add('hidden'); // Hide empty text if there's an image
    }

    const deleteCardButton = document.createElement('button');
    deleteCardButton.innerHTML = '&times;';
    deleteCardButton.className = 'delete-btn card-delete-btn';
    deleteCardButton.addEventListener('click', () => {
        // For undo functionality
        const parentPanelId = card.closest('.panel').dataset.id;
        const nextSibling = card.nextElementSibling;
        const undoItem = {
            itemType: 'card',
            // Fix: Capture current state from DOM, not stale closure 'cardState'
            state: {
                id: card.id,
                text: card.querySelector('p').textContent,
                imageUrl: card.querySelector('img') ? card.querySelector('img').src : null
            },
            parentPanelId: parentPanelId,
            nextSiblingId: nextSibling ? nextSibling.id : null
        };
        undoStack.push(undoItem);
        if (typeof redoStack !== 'undefined') redoStack.length = 0;

        card.remove();
        onStateChange();
    });
    card.appendChild(deleteCardButton);

    cardText.addEventListener('blur', () => {
        const newText = cardText.textContent;
        // Check against dataset, not closure
        const currentOriginalText = cardText.dataset.originalText;

        if (newText !== currentOriginalText) {
            // Update dataset immediately so next interaction is fresh
            cardText.dataset.originalText = newText;

            undoStack.push({
                itemType: 'text-edit',
                cardId: card.id,
                oldText: currentOriginalText,
                newText: newText
            });
            if (typeof redoStack !== 'undefined') redoStack.length = 0;
        }
        onStateChange();
    });

    cardText.addEventListener('keydown', (e) => {
        // For Enter (but not Shift+Enter), and Escape
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
            e.preventDefault();
            e.target.blur();
        }
    });

    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', e.target.id);

        const parentPanel = card.closest('.panel');
        if (parentPanel) {
            const siblings = [...parentPanel.querySelectorAll('.card')];
            dragSrcContext = {
                cardId: card.id,
                sourceParentId: parentPanel.dataset.id,
                sourceIndex: siblings.indexOf(card)
            };
        }

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
