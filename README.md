# LightMD

[![CI](https://github.com/ak40u/light-md-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/ak40u/light-md-editor/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ak40u/light-md-editor?sort=semver)](https://github.com/ak40u/light-md-editor/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

LightMD is a lightweight WYSIWYG Markdown editor for quick writing,
editing, and reviewing `.md` files without opening a full IDE.

It is built with Tauri, Rust, SolidJS, and Milkdown, with native file
dialogs, Markdown file associations, draft recovery, and Mermaid diagram
preview.

![LightMD screenshot](docs/screenshot.png)

## Why

Markdown editors often sit at one of two extremes: a full development
environment that feels too heavy for a small edit, or a plain text editor
that loses the structure of the document while you write.

LightMD is the middle path: fast to open, native-feeling on the desktop,
and focused on the core Markdown workflow.

## Highlights

- **Inline WYSIWYG editing**: edit rendered Markdown directly with a
  Milkdown / ProseMirror editor.
- **Source mode**: switch to raw Markdown whenever precision matters.
- **Fast startup path**: the app shell renders first; the heavier editor
  stack, toolbar commands, and Mermaid fullscreen tools are loaded lazily.
- **Blank new documents**: new files start empty, with a visual
  placeholder instead of starter text inserted into the document.
- **Native desktop workflow**: open, save, Save As, drag-and-drop, recent
  files, single-instance handoff, and `.md` / `.markdown` file association.
- **Draft recovery**: untitled documents are auto-saved after idle time
  and restored on next launch.
- **Mermaid diagrams**: live preview for fenced `mermaid` blocks, plus
  fullscreen zoom/pan and SVG / PNG clipboard export.
- **CommonMark + GFM**: headings, lists, tables, task lists,
  strikethrough, code blocks, links, and images.
- **Security-conscious rendering**: Mermaid SVG output is sanitized, and
  the app uses a strict Content Security Policy.

## Install

### macOS

Download the latest macOS build from
[Releases](https://github.com/ak40u/light-md-editor/releases/latest).

For Apple Silicon Macs, download the `LightMD_*_aarch64.dmg` asset.

After installing, macOS can use LightMD as the default editor for
`.md` and `.markdown` files.

### Build From Source

Prerequisites:

- Node.js 18+
- Rust stable
- Xcode Command Line Tools on macOS
- WebView2 on Windows

```bash
git clone https://github.com/ak40u/light-md-editor.git
cd light-md-editor
npm install
npm run tauri build
```

Build artifacts are written to:

```text
src-tauri/target/release/bundle/
```

## Development

```bash
npm install
npm run typecheck
npm run tauri dev
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Type-check the Solid / TypeScript frontend |
| `npm run build` | Build the frontend with Vite |
| `npm run tauri dev` | Run the desktop app in development mode |
| `npm run tauri build` | Create release bundles |

## Keyboard Shortcuts

Use `Cmd` on macOS and `Ctrl` on Windows / Linux.

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + N` | New document |
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Shift + S` | Save As |
| `Cmd/Ctrl + R` | Reload current file from disk |
| `Cmd/Ctrl + /` | Toggle source mode |
| `Cmd/Ctrl + \` | Toggle sidebar |
| `Cmd/Ctrl + +` / `=` | Increase editor zoom |
| `Cmd/Ctrl + -` | Decrease editor zoom |
| `Cmd/Ctrl + 0` | Reset editor zoom |

## Architecture

LightMD is a small desktop application with a native Rust shell and a
webview frontend.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Desktop runtime | Tauri 2 | App lifecycle, windows, bundling |
| Backend | Rust | File I/O, recent files, drafts, OS events |
| Frontend | SolidJS, TypeScript, Vite | App state and UI |
| Editor | Milkdown, ProseMirror | WYSIWYG Markdown editing |
| Markdown | CommonMark, GFM | Markdown features and serialization |
| Diagrams | Mermaid, DOMPurify | Diagram rendering and SVG sanitization |
| Styling | Tailwind CSS 4, custom CSS | Dark desktop UI |

The frontend talks to Rust through Tauri IPC commands. File association,
drag-and-drop, and single-instance handoff are normalized into the same
open-file event path.

## Project Status

LightMD is an active personal desktop-app project. The current release is
focused on macOS, while the codebase keeps Windows support in scope through
Tauri and CI checks.

See [docs/project-changelog.md](docs/project-changelog.md) for release
history.

## License

[MIT](LICENSE)
