# Custom Startpage

A highly customizable and feature-rich startpage for your browser, designed to replace the default new tab page. Organize your digital life with interactive panels for notes, bookmarks, and more.

## Data Storage

**Important:** This extension uses a hybrid storage model to provide the best of both worlds—synchronization for most data and local storage for large items like images.

-   **Synced Data (`chrome.storage.sync`):** The structure of your panels, the text in your notes, your settings, and your bookmarks are all synchronized across your devices.
-   **Local Data (`chrome.storage.local`):** To allow for pasting images without hitting sync storage limits, all pasted images are saved only on the local machine where they were added.

This means your layout and text will always be in sync, but **pasted images will not appear on your other devices.**

## Features

-   **Undo Deletions:** Accidentally deleted a panel or a card? Just press `Ctrl+Z` to restore it instantly.
-   **Data Portability:** Use the Import and Export buttons in the Settings panel to save your entire layout and settings to a file, or to restore your setup from a backup.
-   **Bulk Bookmark Import:** Quickly populate your startpage by using the "Import All Bookmarks" button in the Settings panel. This automatically creates panels for all your bookmark folders that aren't already displayed.
-   **Dynamic Panel System:** Create, delete, and rearrange panels to fit your workflow.
-   **Notes Panels:** Jot down quick notes, to-do lists, or ideas in text-based panels.
    -   Add and delete individual cards.
    -   Intuitively reorder cards by dragging and dropping them up or down in the list.
    -   Move cards between different notes panels by dragging them.
-   **Bookmark Panels:** Display and manage links from your browser's bookmark folders.
    -   Hover over any bookmark to reveal subtle "edit" (e) and "delete" (x) controls.
    -   Modify a bookmark's title and URL directly on the page.
    -   Remove bookmarks with a confirmation step to prevent accidents.
    -   Reorder bookmarks within a panel using drag-and-drop.
    -   Move bookmarks to a different folder by dragging them to another bookmark panel.
-   **Customizable Layout:**
    -   Drag and drop panels to arrange them in any order.
    -   The layout supports multiple rows and wraps automatically.
    -   The sidebar is responsive and will resize with the window.
-   **Live Clock and Date:** Keep track of time with a clean, digital clock and date display at the top of the page.
-   **Quick & Efficient Workflow:**
    -   All primary actions are available directly in the sidebar.
    -   Instantly create new notes panels with a single click (`+ P`).
    -   Streamlined process for creating bookmark panels (`+ L`).
-   **Smart & Editable Titles:**
    -   All panel titles are editable directly on the page.
    -   Bookmark panels automatically use the folder name as a default title if the title is left blank.
-   **Customizable Bookmarks Display:**
    -   Choose a specific bookmark folder to display in the persistent sidebar via the Settings menu.
-   **Customizable Settings:**
    -   Switch between light and dark themes.
    -   Choose whether new panels are added to the top or bottom of the page.
    -   Show or hide the clock and date display.

## How to Install and Use

1.  Download or clone this repository to your local machine.
2.  Open your Chrome-based browser and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch in the top right corner.
4.  Click the "Load unpacked" button.
5.  Select the directory where you saved this repository.
6.  The extension is now active. Open a new tab to see your custom startpage!
