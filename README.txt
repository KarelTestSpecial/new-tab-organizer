NEW TAB ORGANIZER
=================

A powerful and highly customizable startpage to replace your browser's default new tab page. Organize your digital life with a dynamic system of interactive panels for notes, bookmarks, and more, all within a flexible, multi-view layout.


1. KEY FEATURES
---------------

DYNAMIC PANEL SYSTEM & CUSTOMIZABLE LAYOUT
  - Create & Delete: Easily add or remove panels for notes and bookmarks.
  - Drag & Drop Layout: Intuitively arrange panels by dragging and dropping them into any order. The layout supports multiple rows and wraps automatically to fit your screen.
  - Editable Titles: All panel titles can be edited directly on the page. Just click the title, make your changes, and it saves automatically.

MULTIPLE INDEPENDENT VIEWS (ORGANIZERS)
  - Four Workspaces: To prevent clutter and keep workflows separate, the extension supports up to four independent views (A, B, C, and D).
  - Separate Data: Each view maintains its own unique set of panels and data, allowing you to organize different projects or contexts.
  - Smart Navigation: Use the A/B/C/D links in the sidebar to switch between views. The extension intelligently focuses an existing view's tab if it's already open, preventing duplicates.
  - Swap & Move:
      * Swap Organizers: Swap the entire contents of two organizers from the Settings menu.
      * Move Panels: Move individual panels from one organizer to another.

NOTES PANELS
  - Rich-Text Notes: Jot down quick notes, to-do lists, or ideas in text-based cards.
  - Image Support: Paste images directly from your clipboard into a notes panel to create an image card.
  - Drag & Drop Cards: Reorder cards within a panel or move them between different notes panels by dragging them.
  - Add & Delete: Add new cards with a single click or remove them when no longer needed.

BOOKMARK PANELS
  - Live Bookmark Folders: Display and manage links from any of your browser's bookmark folders.
  - Create Folders: Create brand new Chrome bookmark folders directly from the extension when adding a new Bookmark Panel. You can choose whether to create them in the root or inside a specific Organizer folder.
  - Full Bookmark Management:
      * Edit: Hover over any bookmark to reveal an "edit" (e) button to modify its title and URL.
      * Delete: Remove bookmarks with a confirmation step to prevent accidents.
      * Reorder: Drag and drop bookmarks to reorder them within a panel.
      * Move: Move a bookmark to a different folder by dragging it to another bookmark panel or to the sidebar folder.
  - Automatic Naming: Bookmark panels automatically use the folder name as a default title if you leave it blank.

EFFICIENT WORKFLOW & SETTINGS
  - Quick Actions: Instantly create new notes (+ P) or bookmark (+ L) panels from the sidebar.
  - Undo Deletions: Accidentally deleted a panel or a card? Press Ctrl+Z to restore it instantly.
  - Customizable Sidebar: Choose a specific bookmark folder to display in the persistent sidebar via the Settings menu for quick access.
  - Open on startup: Choose which workspace (A, B, C, or D) opens automatically when you launch your browser.
  - Data Portability: Use the Import and Export buttons in Settings to save your entire layout and settings to a JSON file, or restore your setup from a backup.
  - Bulk Bookmark Import: Quickly populate a view by using the "Import All Bookmarks" button, which creates panels for all your bookmark folders that aren't already displayed.
  - Dedicated Organizer Folders: Enable the "Use Organizer Folders" setting to automatically create dedicated overarching folders (Organizer A, B, C, D) in your Chrome bookmarks. This keeps your extension bookmarks neatly separated from your regular browser bookmarks. If enabled, moving panels between views will also physically move the corresponding bookmark folder in Chrome.
  - Customizable UI:
      * Switch between light and dark themes or pick custom colors.
      * Choose whether new panels are added to the top or bottom of the page.
  - Multilingual Support: Fully localized in 6 languages: English, Dutch, French, German, Spanish, and Portuguese. Switch languages instantly from the Settings menu.
  - Localized Date & Clock:
      * Show or hide the clock and date display.
      * Granular Date Control: Toggle the display of the Year and Day of Week independently.
      * Smart Localization: The date and clock automatically respect your manually selected language (e.g., Spanish date formatting when the Spanish language is selected).
      * Date Font Size: Adjust the size of the date text using a slider in Settings.


2. HOW TO INSTALL AND USE
-------------------------

  1. Download or clone this repository to your local machine.
  2. Open your Chrome-based browser and navigate to chrome://extensions
  3. Enable "Developer mode" using the toggle switch in the top right corner.
  4. Click the "Load unpacked" button.
  5. Select the directory where you saved this repository.
  6. The extension is now active. Open a new tab to see your custom startpage!


3. DATA STORAGE
---------------

This extension uses a hybrid storage model to provide a balance of synchronization and flexibility:

  - Synced Data (chrome.storage.sync): The structure of your panels, the text in your notes, your settings, and your bookmark data are all synchronized across your devices using your browser's built-in sync feature.
  - Local Data (chrome.storage.local): To accommodate larger data like images without exceeding sync storage limits, all pasted images are saved only on the local machine where they were added.

NOTE: This means your layout and text-based notes will always be in sync, but pasted images will not appear on your other devices.
