# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.4.1] -- 2026-05-24

### Changed

- **Comfort dark theme**. Replaced the near-black dark palette with a
  softer dark gray scheme for lower perceived glare during long writing
  sessions.
- Reduced contrast harshness for the app shell, editor surface,
  sidebar, toolbar, borders, and Mermaid diagram colors while keeping
  text contrast comfortably above WCAG AA thresholds.

## [0.4.0] -- 2026-05-24

### Added

- **Automatic system theme**. LightMD now follows the operating system
  light / dark appearance and updates the app while it is running.
- **Light theme**. Added a full light palette for the app shell,
  editor surface, source mode, toolbar, sidebar, status bar, and
  Mermaid block UI.
- **Theme-aware Mermaid rendering**. Mermaid diagrams now use matching
  light / dark palettes and re-render when the system appearance
  changes.

### Changed

- Replaced hard-coded editor and Mermaid colors with shared CSS theme
  tokens.
- Added an initial light / dark page background before the app mounts,
  preventing a wrong-theme flash on startup.
- Polished the public README and package metadata for the project page.

## [0.3.3] -- 2026-05-24

### Changed

- **Faster cold start**. The first UI shell now renders before the
  Milkdown / ProseMirror editor stack is loaded. Toolbar commands,
  editor replacement helpers, and Mermaid fullscreen pan/zoom are
  loaded lazily.
- **Blank new documents**. New documents are truly empty; the previous
  welcome / untitled starter markdown has been replaced by a visual
  placeholder.

### Fixed

- Clicking **New** now focuses the editor after clearing the document,
  so the caret stays in the empty editor instead of appearing above the
  placeholder area or leaving focus on the button.
- Programmatic editor resets no longer mark a fresh empty document as
  dirty.
- Browser-only development mode no longer throws Tauri bridge errors
  while rendering the app shell.

## [0.3.2] -- 2026-05-18

### Added

- **Auto-save drafts**. Untitled documents are debounced-persisted to
  `app_data_dir/drafts/{session_id}.md` as you type (1s of idle).
  On next launch the most recent draft is restored automatically.
  A real Save (As) deletes the draft from disk. Crash, power loss,
  accidental quit — no more lost work.
- **Save As** (`Cmd/Ctrl+Shift+S`): always opens the save dialog
  regardless of whether the document already has a path. Useful for
  forking an opened file into a new one without overwriting the
  original.

### Fixed

- **macOS Cmd shortcuts now work**. All keyboard shortcuts
  (`Cmd+S`, `Cmd+O`, `Cmd+N`, `Cmd+R`, `Cmd+/`, `Cmd+\`) were
  silently broken on macOS because the keydown handler only checked
  `e.ctrlKey`. Switched to a single `cmdOrCtrl = e.ctrlKey || e.metaKey`
  gate for every binding. Zoom shortcuts already used this pattern;
  now everything else does too.

### Build

- macOS bundles are now ad-hoc code-signed with Hardened Runtime, so
  `codesign --verify --strict` passes and the build is one step closer
  to notarization-ready (creds via APPLE_ID / APPLE_TEAM_ID env vars
  are all that's missing).

## [0.3.1] -- 2026-05-18

### Added

- **Open button in the sidebar footer**: dedicated button (folder
  glyph) that triggers the native file dialog, paired with a
  similarly-styled New button (plus glyph). Closes a discoverability
  gap on first launch when the recent-files list is empty -- previously
  the only ways to open a file were `Ctrl/Cmd+O`, drag-and-drop, or
  clicking a Recent entry.

## [0.3.0] -- 2026-05-18

### Added

- **Editor zoom**: `Ctrl/Cmd + +` (or `=`) and `Ctrl/Cmd + -` adjust the
  editor font size in 1px steps; `Ctrl/Cmd + 0` resets to default. Size
  clamps to 10-32 px and persists across sessions via localStorage.
  Both WYSIWYG and source modes share the same zoom level.
- **New macOS-style app icon**: 824x824 squircle on a 1024 canvas with
  a two-stop blue gradient and a Markdown-inspired wordmark (M with a
  download arrow). Vector source kept as `app-icon.svg`.

### Fixed

- `openFileDialog` aligned with `@tauri-apps/plugin-dialog` v2.6.0 types
  (the previous unreachable `selected.path` fallback broke
  `tsc --noEmit`).

## [0.2.0] -- 2026-05-18

### Added

- **macOS support**: file association for `.md` and `.markdown` via
  Finder double-click, the `open` command, and Apple Events
  (`RunEvent::Opened`). Cold-start paths stash into `INITIAL_FILE`;
  hot-start paths emit `open-file` to the running frontend.
- **Mermaid diagrams**: live WYSIWYG preview for ` ```mermaid ` blocks
  via a custom Milkdown / ProseMirror NodeView. Includes fullscreen
  modal with svg-pan-zoom and clipboard export (SVG / PNG) through
  `tauri-plugin-clipboard-manager`.
- **Ctrl+R reload**: re-read the current file from disk and refresh the
  editor (useful when files change externally).
- **Project documentation**: `docs/system-architecture.md` and this
  changelog.
- **CI**: GitHub Actions workflow runs typecheck + Vite build on Linux
  and `cargo check` / `clippy` / `fmt` on Windows + macOS.

### Changed

- Sidebar recent-files list now suppresses the native browser context
  menu for more native-feel right-click behaviour.
- README repositioned as Windows-first with macOS supported.

### Security

- Mermaid pipeline hardened against XSS: every rendered SVG passes
  through a DOMPurify chokepoint (`sanitizeMermaidSvg`); Mermaid config
  locked with `securityLevel: 'strict'`, `htmlLabels: false`, and a
  `secure` list against in-document `%%{init}%%` overrides.
- CSP tightened: dropped `https:` from `img-src`, removed Google Fonts,
  added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`,
  `connect-src 'self'`, and `blob:` only on `img-src` for raster export.

## [0.1.0] -- 2026-03-30

Initial release.

### Added

- Tauri 2 (Rust) backend with file I/O commands, recent-files
  persistence, single-instance plugin, CLI argv handling, and Windows
  `.md` / `.markdown` file association.
- SolidJS + TypeScript frontend with Milkdown 7 (ProseMirror) editor,
  CommonMark + GFM, and source-mode toggle (Ctrl+/).
- Formatting toolbar with SVG icons (headings, bold, italic,
  strikethrough, code, lists, tables, links, images).
- Recent-files sidebar with search filter and remove action.
- Status bar with word count and dirty indicator.
- Fluent Obsidian dark theme on Tailwind CSS 4.
- Drag & drop support for `.md` files onto the window.
- Dynamic window title with dirty-state indicator.
- CSP configured, path validation on file operations.

[Unreleased]: https://github.com/ak40u/light-md-editor/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/ak40u/light-md-editor/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ak40u/light-md-editor/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/ak40u/light-md-editor/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/ak40u/light-md-editor/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/ak40u/light-md-editor/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/ak40u/light-md-editor/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ak40u/light-md-editor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ak40u/light-md-editor/releases/tag/v0.1.0
