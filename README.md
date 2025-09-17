# New Tab Organizer

A powerful and highly customizable startpage to replace your browser's default new tab page. Organize your digital life with a dynamic system of interactive panels for notes, bookmarks, and more, all within a flexible, multi-view layout.

## Key Features

### Dynamic Panel System & Customizable Layout
- **Create & Delete:** Easily add or remove panels for notes and bookmarks.
- **Drag & Drop Layout:** Intuitively arrange panels by dragging and dropping them into any order. The layout supports multiple rows and wraps automatically to fit your screen.
- **Editable Titles:** All panel titles can be edited directly on the page. Just click the title, make your changes, and it saves automatically.

### Multiple Independent Views (Organizers)
- **Three Workspaces:** To prevent clutter and keep workflows separate, the extension supports up to three independent views (A, B, and C).
- **Separate Data:** Each view maintains its own unique set of panels and data, allowing you to organize different projects or contexts.
- **Smart Navigation:** Use the A/B/C links in the sidebar to switch between views. The extension intelligently focuses an existing view's tab if it's already open, preventing duplicates.
- **Swap & Move:**
    - **Swap Organizers:** Swap the entire contents of two organizers from the Settings menu.
    - **Move Panels:** Move individual panels from one organizer to another.

### Notes Panels
- **Rich-Text Notes:** Jot down quick notes, to-do lists, or ideas in text-based cards.
- **Image Support:** Paste images directly from your clipboard into a notes panel to create an image card.
- **Drag & Drop Cards:** Reorder cards within a panel or move them between different notes panels by dragging them.
- **Add & Delete:** Add new cards with a single click or remove them when no longer needed.

### Bookmark Panels
- **Live Bookmark Folders:** Display and manage links from any of your browser's bookmark folders.
- **Full Bookmark Management:**
    - **Edit:** Hover over any bookmark to reveal an "edit" (e) button to modify its title and URL.
    - **Delete:** Remove bookmarks with a confirmation step to prevent accidents.
    - **Reorder:** Drag and drop bookmarks to reorder them within a panel.
    - **Move:** Move a bookmark to a different folder by dragging it to another bookmark panel or to the sidebar folder.
- **Automatic Naming:** Bookmark panels automatically use the folder name as a default title if you leave it blank.

### Efficient Workflow & Settings
- **Quick Actions:** Instantly create new notes (`+ P`) or bookmark (`+ L`) panels from the sidebar.
- **Undo Deletions:** Accidentally deleted a panel or a card? Press `Ctrl+Z` to restore it instantly.
- **Customizable Sidebar:** Choose a specific bookmark folder to display in the persistent sidebar via the Settings menu for quick access.
- **Data Portability:** Use the **Import** and **Export** buttons in Settings to save your entire layout and settings to a JSON file, or restore your setup from a backup.
- **Bulk Bookmark Import:** Quickly populate a view by using the "Import All Bookmarks" button, which creates panels for all your bookmark folders that aren't already displayed.
- **Customizable UI:**
    - Switch between **light and dark themes**.
    - Choose whether new panels are added to the **top or bottom** of the page.
    - Show or hide the **clock and date** display.

## How to Install and Use

1.  Download or clone this repository to your local machine.
2.  Open your Chrome-based browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** using the toggle switch in the top right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the directory where you saved this repository.
6.  The extension is now active. Open a new tab to see your custom startpage!

## Data Storage

This extension uses a hybrid storage model to provide a balance of synchronization and flexibility:

-   **Synced Data (`chrome.storage.sync`):** The structure of your panels, the text in your notes, your settings, and your bookmark data are all synchronized across your devices using your browser's built-in sync feature.
-   **Local Data (`chrome.storage.local`):** To accommodate larger data like images without exceeding sync storage limits, all pasted images are saved only on the local machine where they were added.

**This means your layout and text-based notes will always be in sync, but pasted images will not appear on your other devices.**
