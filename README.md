# New Tab Organizer (v6.1)

A powerful, highly customizable, and aesthetically premium startpage to replace your browser's default new tab page. Organize your digital life with a dynamic system of interactive panels for notes, bookmarks, and more, all within a beautiful glassmorphic multi-view layout.

## Key Features

### Premium Unified UI & Customizable Layout
- **Unified Glassmorphic Design:** A modern, consistent visual language across all modals and settings panels, featuring backdrop blur effects and a centered layout.
- **Drag & Drop Layout:** Intuitively arrange panels by dragging and dropping them into any order. The layout supports multiple rows and wraps automatically to fit your screen.
- **Editable Titles:** All panel titles can be edited directly on the page. Just click the title, make your changes, and it saves automatically.
- **Panel Actions Menu:** Every panel has a `⋮` button with Move, Sort and Delete. Right-click still works, and the menu is keyboard reachable.
- **Real-Time Updates:** Settings (colors, themes, toggles) take effect instantly as you change them.

### Multiple Independent Views (Organizers)
- **As Many Organizers As You Need:** Organizers are independent views, configured from 1 to 26. Six is the default; change the number in Settings and the sidebar, startup options and swap lists follow automatically.
- **Separate Data:** Each organizer keeps its own panels and data, so you can separate projects or contexts. Lowering the number only hides an organizer — its data and Chrome bookmark folder stay intact and return when you raise the number again.
- **Smart Navigation:** Use the letter links in the sidebar to switch views. The extension focuses the organizer's tab if it is already open, instead of opening a duplicate.
- **Startup Options:** Pick exactly which organizers open when Chrome starts.
- **Swap & Move:**
    - **Swap Organizers:** Swap the entire contents of two organizers from the Settings menu.
    - **Move Panels:** Move individual panels from one organizer to another.

### Bookmark Panels & Advanced Folder Logic
- **Live Bookmark Folders:** Display and manage links from any of your browser's bookmark folders.
- **Intelligent Folder Creation:** Create brand new Chrome bookmark folders directly from the "Add Bookmark" modal.
    - **Quick Toggle:** Switch between creating folders in the root or inside a specific organizer folder directly within the modal.
    - **Contextual Help:** An integrated info button explaining folder placement logic.
- **Full Bookmark Management:**
    - **Edit:** Hover over any bookmark to reveal an "edit" (e) button to modify its title and URL.
    - **Delete:** Remove bookmarks with a confirmation step.
    - **Reorder:** Drag and drop bookmarks to reorder them within a panel.
    - **Move:** Drag bookmarks to other panels or the sidebar to move them between folders.
- **Automatic Naming:** Bookmark panels automatically use the folder name as a default title if you leave it blank.
- **Ordering Policies:** Per organizer, choose whether panels keep your own order or sort A–Z. The sidebar and each Chrome organizer folder can be kept alphabetical too. Lists in dialogs are always alphabetical, and a sorted view never overwrites the order you set by dragging. Changes apply immediately; **Sort now** enforces them without saving first.

### Simultaneous Link Opening
- **Named Link Lists:** Bundle links into a named list (for example "Morning routine") and open them all at once.
- **Build by Drag & Drop:** Open the link modal from the sidebar, create a list, and drag links from any bookmark panel or the sidebar into the dropzone. Reorder or remove them before saving.
- **One Click, Many Tabs:** Clicking a list name opens every link in background tabs, keeping the organizer in front.
- **Edit & Delete:** Rename, extend or delete lists at any time. Lists are included in the Export/Import backup.

### Notes Panels
- **Rich-Text Notes:** Jot down quick notes, to-do lists, or ideas in text-based cards.
- **Image Support:** Paste images directly from your clipboard into a notes panel to create an image card.
- **Drag & Drop Cards:** Reorder cards within a panel or move them between different notes panels.
- **Add & Delete:** Add new cards with a single click or remove them when no longer needed.

### Efficient Workflow & Settings
- **Quick Actions:** Instantly create new notes (`+ N`) or bookmark (`+ B`) panels from the sidebar.
- **Undo Deletions:** Accidentally deleted a panel or a card? Press `Ctrl+Z` to restore it instantly (`Ctrl+Y` redoes).
- **Customizable Sidebar:** Choose a specific bookmark folder to display in the persistent sidebar.
- **Open on Startup:** Choose which organizers open automatically when you launch your browser.
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
- **Date & Clock:**
    - Toggle display of the **clock, date, year, and day of week**.
    - Date and time follow your browser's regional formatting.
    - **Adjustable Size:** Use a slider in Settings to change the date font size in real-time.

## How to Install and Use

1.  Download or clone this repository to your local machine.
2.  Open your Chrome-based browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** in the top right corner.
4.  Click **"Load unpacked"**.
5.  Select the directory where you saved this repository.
6.  The extension is now active. Open a new tab to see your custom startpage!

## Data Storage

Everything lives in `chrome.storage.local`: panel layout, notes, settings, link lists and pasted images. Nothing is sent anywhere, and nothing is stored outside your browser profile.

Settings are applied live. If you have two organizers open side by side, a change in one tab is picked up by the other, so the two views do not drift apart. Export/Import writes the layout and settings to a JSON file you control.

## Accessibility

- Every panel action is reachable from the `⋮` button, not only from a right-click.
- Dialogs announce themselves as dialogs, keep focus inside while open, close on Escape or a backdrop click, and return focus to where you were.
- The folder picker supports arrow keys, Enter and Escape.

## Tests

```bash
pnpm test
```

The suites drive the real page in headless Chrome over HTTP with a `chrome.*` shim. They require Node 22+, `google-chrome` and `python3`; see `tests/README.md`.
