# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
