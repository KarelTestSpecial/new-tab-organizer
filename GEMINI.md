# Project Context: New Tab Organizer

## Project Overview
This project is a **Chrome Extension** (Manifest V3) that replaces the default "New Tab" page with a highly customizable dashboard. It features a system of interactive panels for notes and bookmarks, supporting multiple independent views (Workspaces A, B, and C).

### Core Technologies
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
*   **Storage:** `chrome.storage.sync` (settings, text data) and `chrome.storage.local` (images, larger data).
*   **Permissions:** `bookmarks`, `storage`, `tabs`.
*   **Libraries:** `Sortable.min.js` (for drag-and-drop functionality).

## Architecture & File Structure
*   **Manifest:** `manifest.json` defines the extension configuration, permissions, and `chrome_url_overrides` for the new tab page.
*   **Views:**
    *   `panelA.html`: The default entry point (New Tab Page).
    *   `panelB.html`, `panelC.html`: Additional independent workspaces.
*   **Logic (`js/`):**
    *   `app.js`: Main entry point. Handles DOM initialization, state management (save/load), and view identification.
    *   `panels.js`: Logic for panel creation, manipulation, and moving panels between views.
    *   `bookmarks.js`: Handles interactions with the Chrome Bookmarks API.
    *   `settings_logic.js`: Manages user preferences and import/export functionality.
*   **Styles:** `css/style.css` contains all styles, including light/dark mode themes.

## Building and Running
Since this is a vanilla JavaScript project, there is no compile step.

1.  **Load Extension:**
    *   Open Chrome and go to `chrome://extensions`.
    *   Enable "Developer mode".
    *   Click "Load unpacked".
    *   Select the root directory of this project.
2.  **Test:**
    *   Open a new tab to see `panelA.html`.
    *   Navigate to `panelB.html` or `panelC.html` via the sidebar interface to test other workspaces.

## Development Conventions
*   **State Management:** The application state is serialized to JSON and stored in `chrome.storage`. `app.js` contains the primary `saveState` function that scrapes the DOM to persist changes.
*   **View context:** Functions often check `getCurrentView()` (returns 'A', 'B', or 'C') to determine which storage key to use (`panelsState`, `panelsState_B`, `panelsState_C`).
*   **DOM Manipulation:** UI is largely generated dynamically via JavaScript. Ensure event listeners are delegated or attached when elements are created.
*   **CSS:** Uses standard CSS variables for theming.
*   **Linting/Formatting:** No explicit linter config found; follow existing style (standard indentation, semicolons, single quotes preferred).
