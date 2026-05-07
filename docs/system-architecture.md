# System Architecture

## Editor

LightMD's editor is built on Milkdown 7 (ProseMirror) with a dark Obsidian-
inspired theme.

**Mermaid integration.** Commonmark `code_block` nodes with `language:
"mermaid"` are rendered via a custom ProseMirror NodeView
(`src/components/editor/mermaid-node-view.ts`) that branches on language:
mermaid blocks show a split-view (native PM-managed `<pre>` as `contentDOM`
+ Solid-mounted preview pane via `src/components/editor/mermaid-block.tsx`);
all other code blocks use a default `<pre><code>` passthrough to avoid
regressing existing content. Mermaid itself loads lazily via dynamic import
and is initialized once with a locked config (`securityLevel: "strict"`,
`htmlLabels: false`, `secure` list freezing against in-document `%%{init}%%`
overrides). Every rendered SVG passes through a DOMPurify chokepoint
(`sanitizeMermaidSvg`) before reaching the DOM or the clipboard. A
module-level async mutex serializes all `mermaid.render()` calls to avoid
shared-DOM corruption. Inline preview is static (no pan-zoom); full
zoom/pan is available exclusively in a fullscreen Portal modal. Export
goes through Tauri's `clipboard-manager` plugin (text + image MIME), with
`navigator.clipboard` as fallback. See
`plans/260416-1403-mermaid-diagrams-integration/` for full design.
