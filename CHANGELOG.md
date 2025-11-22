# Changelog

All notable changes to this project will be documented in this file.

## [1.6.7] - 2025-11-22

### Added
- "Move to Panel" feature now includes an "at top" / "at bottom" selector to specify the panel's destination position.
- The "from" organizer in "Move to Panel" now defaults to the current view.

### Changed
- The layout of the "Move to Panel" settings has been improved to a 2x2 grid for better usability.

### Fixed
- Removed a harmless but unprofessional console warning related to the viewport meta tag in the HTML files.

## [1.6.6] - 2025-11-15

### Changed
- The height of note panels now dynamically adjusts to fit their content. Newly created note panels will start with the height of a single card.

## [1.5.1] - 2025-09-17

### Added
- **Enter to Save Note:** When editing a note card, pressing `Enter` (without `Shift`) will now save the changes and remove focus, similar to the `Escape` key. `Shift+Enter` still creates a new line.

## [1.5.0] - 2025-09-17

### Added
- **Undo Functionality:** Press `Ctrl+Z` to undo the last panel or card deletion, restoring the item to its previous position.
- **Paste Images:** Paste images directly from the clipboard into a notes panel to instantly create a new image card.
- **Swap Organizers:** A new tool in the Settings panel allows you to swap the entire content of two organizers (e.g., swap View A and View B).
- **Move Panels:** A new tool in the Settings panel allows you to move a single panel from one organizer to another.

### Changed
- **Project Name:** Updated the project name in `manifest.json` to "New Tab Organizer" for clarity.
- **README:** Overhauled the `README.md` to be more comprehensive, accurate, and reflect all current features.

### Fixed
- Ensured that when a bookmark panel's title is edited, the underlying bookmark folder is also renamed.

## [1.4.0] - 2025-09-10

### Added
- **Multi-View System:** Added support for up to three independent views (View 1, 2, and 3) to mitigate memory overload from a large number of panels. Each view runs in a separate process with its own data storage.
- **Smart View Navigation:** Implemented navigation links in the sidebar of each view. Clicking a link will focus the tab for that view if it is already open, or open a new tab if it is not. This requires the `tabs` permission.
- **Active View Highlighting:** The navigation link for the currently active view is now visually highlighted in the sidebar.

### Changed
- **Sidebar Layout:** The main action buttons in the sidebar have been redesigned to accommodate the new view navigation links. The "Settings" link is now on its own line.

### Fixed
- The default title for new notes panels created via the modal is now consistently "New Notes".
- The order of action buttons on notes panels has been corrected to place the delete button ('x') on the far right.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2025-08-31

### Fixed
- **History Link:** The history link now correctly opens the history page (`chrome://history`) by using the `chrome.tabs` API, preventing it from being blocked by browser security policies.

## [1.3.0] - 2025-08-31

### Added
- **History Link:** Added a link to the sidebar to open `chrome://history/`.

### Changed
- The "History" link in the sidebar is now an icon instead of text.

## [1.2.0] - 2025-08-27

### Added
- **Import All Bookmarks:** In the Settings panel, a new "Import All Bookmarks" button will automatically create new panels for any of your bookmark folders that are not already displayed on the page.
- **Clock and Date Display:** Added a customizable clock and date display to the startpage. Users can toggle their visibility in the Settings panel.

## [1.1.1] - 2025-08-25

### Added
- Pressing the `Escape` key while editing a note card will now save the text and exit the editing mode.

### Fixed
- Improved the reliability of the Escape key functionality to ensure it consistently removes focus from the text area in the extension environment.

## [1.1.0] - 2025-08-25

### Added
- **Bookmark Management:** Users can now manage bookmarks directly on the startpage.
    - Edit a bookmark's title and URL via an inline form.
    - Delete bookmarks from a folder with a confirmation dialog.
    - Subtle "edit" (e) and "delete" (x) controls appear on hover for a clean UI.
- **Bookmark Drag-and-Drop:**
    - Reorder bookmarks within the same folder/panel by dragging them.
    - Move bookmarks to a different folder by dragging them to another bookmark panel.
- **Changelog:** Added this `CHANGELOG.md` file to track project changes.

### Changed
- **Notes Drag-and-Drop:** The logic for reordering cards in a notes panel has been fixed. Cards can now be moved up and down in the list intuitively.
- **README:** The `README.md` file has been updated to reflect all new features.
