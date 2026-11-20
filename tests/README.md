# Tests

End-to-end suites that drive the real page in headless Chrome over HTTP with a
`chrome.*` shim, so the extension's own code runs unmodified.

## Run

```bash
pnpm test          # every suite, one after another
node tests/test-ordering.mjs   # one suite
```

Requires Node 22+ (global `WebSocket`), `google-chrome` and `python3`.
Each suite starts its own Chrome on its own debugging port and its own HTTP
server, so they must not run in parallel — `run-all.mjs` runs them serially.

## Layout

| Suite | Covers |
|---|---|
| `test-organizers.mjs` | configurable organizer count, views, startup tabs, storage keys |
| `test-link-lists.mjs` | link-list modal, tabs, dropzone, reorder, duplicate guard |
| `test-folder-picker.mjs` | hierarchy, alphabetical order, search, selection, legacy rename |
| `test-ordering.mjs` | panels/sidebar/Chrome-folder policies, save/sync, leak regression |
| `test-leaks.mjs` | repeated applies/renders do not stack listeners or callbacks; colour writes once |
| `test-ui.mjs` | actions menu, modal semantics, live settings, quoted bookmark titles |
| `test-realdrag.mjs` | real CDP mouse drag (browser effect negotiation, not synthetic events) |