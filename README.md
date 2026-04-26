# New Tab Organizer (v4.4)

A powerful, highly customizable, and aesthetically premium startpage to replace your browser's default new tab page. Organize your digital life with a dynamic system of interactive panels for notes, bookmarks, and more, all within a beautiful glassmorphic multi-view layout.

## Key Features

### Premium Unified UI & Customizable Layout
- **Unified Glassmorphic Design:** A modern, consistent visual language across all modals and settings panels, featuring backdrop blur effects and a centered layout.
- **Drag & Drop Layout:** Intuitively arrange panels by dragging and dropping them into any order. The layout supports multiple rows and wraps automatically to fit your screen.
- **Editable Titles:** All panel titles can be edited directly on the page. Just click the title, make your changes, and it saves automatically.
- **Real-Time Updates:** Settings (colors, themes, toggles) take effect instantly as you change them.

### Multiple Independent Views (Organizers)
- **Four Workspaces:** To prevent clutter and keep workflows separate, the extension supports up to four independent views (A, B, C, and D).
- **Separate Data:** Each view maintains its own unique set of panels and data, allowing you to organize different projects or contexts.
- **Smart Navigation:** Use the A/B/C/D links in the sidebar to switch between views. The extension intelligently focuses an existing view's tab if it's already open, preventing duplicates.
- **Swap & Move:**
    - **Swap Organizers:** Swap the entire contents of two organizers from the Settings menu.
    - **Move Panels:** Move individual panels from one organizer to another.

### Bookmark Panels & Advanced Folder Logic
- **Live Bookmark Folders:** Display and manage links from any of your browser's bookmark folders.
- **Intelligent Folder Creation:** Create brand new Chrome bookmark folders directly from the "Add Bookmark" modal.
    - **Quick Toggle:** Switch between creating folders in the root or inside a specific Organizer folder (A, B, C, or D) directly within the modal.
    - **Contextual Help:** An integrated info button explaining folder placement logic.
- **Full Bookmark Management:**
    - **Edit:** Hover over any bookmark to reveal an "edit" (e) button to modify its title and URL.
    - **Delete:** Remove bookmarks with a confirmation step.
    - **Reorder:** Drag and drop bookmarks to reorder them within a panel.
    - **Move:** Drag bookmarks to other panels or the sidebar to move them between folders.
- **Automatic Naming:** Bookmark panels automatically use the folder name as a default title if you leave it blank.

### Notes Panels
- **Rich-Text Notes:** Jot down quick notes, to-do lists, or ideas in text-based cards.
- **Image Support:** Paste images directly from your clipboard into a notes panel to create an image card.
- **Drag & Drop Cards:** Reorder cards within a panel or move them between different notes panels.
- **Add & Delete:** Add new cards with a single click or remove them when no longer needed.

### Efficient Workflow & Settings
- **Quick Actions:** Instantly create new notes (`+ P`) or bookmark (`+ L`) panels from the sidebar.
- **Undo Deletions:** Accidentally deleted a panel or a card? Press `Ctrl+Z` to restore it instantly.
- **Customizable Sidebar:** Choose a specific bookmark folder to display in the persistent sidebar.
- **Open on Startup:** Choose which workspace (A, B, C, or D) opens automatically when you launch your browser.
- **Data Portability:** Use **Import** and **Export** in Settings to back up or restore your entire setup via JSON.
- **Bulk Bookmark Import:** Quickly populate a view by creating panels for all your bookmark folders at once.

### Advanced Theme Engine
- **Light & Dark Themes:** Seamlessly switch between a clean light mode and a sleek dark mode.
- **Five-Way Color Customization:**
    - **Background Color:** The main page background.
    - **Text Color:** Global text color.
    - **Button Color:** Primary action buttons and toggles.
    - **Border/Line Color:** Panel borders and separators.
    - **Input/Dropdown Background:** Specific control for text boxes and selection menus for maximum legibility.
- **Multilingual Support:** Fully localized in **English, Dutch, French, German, Spanish, and Portuguese**.
- **Localized Date & Clock:**
    - Toggle display of the **clock, date, year, and day of week**.
    - **Smart Localization:** Formatting automatically respects your selected language.
    - **Adjustable Size:** Use a slider in Settings to change the date font size in real-time.

## How to Install and Use

1.  Download or clone this repository to your local machine.
2.  Open your Chrome-based browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** in the top right corner.
4.  Click **"Load unpacked"**.
5.  Select the directory where you saved this repository.
6.  The extension is now active. Open a new tab to see your custom startpage!

## Data Storage

This extension uses a hybrid storage model to provide a balance of synchronization and flexibility:

-   **Synced Data (`chrome.storage.sync`):** The structure of your panels, the text in your notes, your settings, and your bookmark data are all synchronized across your devices using your browser's built-in sync feature.
-   **Local Data (`chrome.storage.local`):** To accommodate larger data like images without exceeding sync storage limits, all pasted images are saved only on the local machine where they were added.

**This means your layout and text-based notes will always be in sync, but pasted images will not appear on your other devices.**
