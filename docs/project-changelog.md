# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/ak40u/light-md-editor/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ak40u/light-md-editor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ak40u/light-md-editor/releases/tag/v0.1.0
