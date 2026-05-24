import type { Component, JSX } from "solid-js";
import type { Editor } from "@milkdown/kit/core";

interface ToolbarProps {
  editor: Editor | undefined;
}

type ToolbarCommand =
  | "heading1"
  | "heading2"
  | "bold"
  | "italic"
  | "strike"
  | "inlineCode"
  | "link"
  | "bulletList"
  | "orderedList"
  | "image"
  | "table";

interface ToolbarButton {
  label: string | JSX.Element;
  title: string;
  className?: string;
  command: ToolbarCommand;
}

type ToolbarCommandModules = {
  callCommand: typeof import("@milkdown/kit/utils").callCommand;
  commonmark: typeof import("@milkdown/kit/preset/commonmark");
  gfm: typeof import("@milkdown/kit/preset/gfm");
};

let commandModulesPromise: Promise<ToolbarCommandModules> | undefined;

const loadCommandModules = (): Promise<ToolbarCommandModules> => {
  commandModulesPromise ??= Promise.all([
    import("@milkdown/kit/utils"),
    import("@milkdown/kit/preset/commonmark"),
    import("@milkdown/kit/preset/gfm"),
  ]).then(([utils, commonmark, gfm]) => ({
    callCommand: utils.callCommand,
    commonmark,
    gfm,
  }));
  return commandModulesPromise;
};

const runToolbarCommand = async (
  editor: Editor,
  command: ToolbarCommand,
): Promise<void> => {
  const { callCommand, commonmark, gfm } = await loadCommandModules();

  switch (command) {
    case "heading1":
      editor.action(callCommand(commonmark.wrapInHeadingCommand.key, 1));
      break;
    case "heading2":
      editor.action(callCommand(commonmark.wrapInHeadingCommand.key, 2));
      break;
    case "bold":
      editor.action(callCommand(commonmark.toggleStrongCommand.key));
      break;
    case "italic":
      editor.action(callCommand(commonmark.toggleEmphasisCommand.key));
      break;
    case "strike":
      editor.action(callCommand(gfm.toggleStrikethroughCommand.key));
      break;
    case "inlineCode":
      editor.action(callCommand(commonmark.toggleInlineCodeCommand.key));
      break;
    case "link":
      editor.action(callCommand(commonmark.toggleLinkCommand.key, { href: "" }));
      break;
    case "bulletList":
      editor.action(callCommand(commonmark.wrapInBulletListCommand.key));
      break;
    case "orderedList":
      editor.action(callCommand(commonmark.wrapInOrderedListCommand.key));
      break;
    case "image":
      editor.action(callCommand(commonmark.insertImageCommand.key, { src: "", alt: "image" }));
      break;
    case "table":
      editor.action(callCommand(gfm.insertTableCommand.key, { row: 3, col: 3 }));
      break;
  }
};

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const OrderedListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="10" y1="6" x2="21" y2="6" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="18" x2="21" y2="18" />
    <path d="M4 6h1v4" />
    <path d="M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </svg>
);

const TableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

const CodeBlockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const toolbarButtons: ToolbarButton[] = [
  {
    label: "H1",
    title: "Heading 1",
    command: "heading1",
  },
  {
    label: "H2",
    title: "Heading 2",
    command: "heading2",
  },
  {
    label: "B",
    title: "Bold (Ctrl+B)",
    className: "toolbar-btn--bold",
    command: "bold",
  },
  {
    label: "I",
    title: "Italic (Ctrl+I)",
    className: "toolbar-btn--italic",
    command: "italic",
  },
  {
    label: "S",
    title: "Strikethrough",
    className: "toolbar-btn--strike",
    command: "strike",
  },
  {
    label: <CodeBlockIcon />,
    title: "Code (Ctrl+E)",
    command: "inlineCode",
  },
  {
    label: <LinkIcon />,
    title: "Link (Ctrl+K)",
    command: "link",
  },
  {
    label: <ListIcon />,
    title: "Bullet List",
    command: "bulletList",
  },
  {
    label: <OrderedListIcon />,
    title: "Numbered List",
    command: "orderedList",
  },
  {
    label: <ImageIcon />,
    title: "Image",
    command: "image",
  },
  {
    label: <TableIcon />,
    title: "Table",
    command: "table",
  },
];

const Toolbar: Component<ToolbarProps> = (props) => {
  const handleClick = async (btn: ToolbarButton) => {
    if (!props.editor) return;
    try {
      await runToolbarCommand(props.editor, btn.command);
    } catch {
      // Command may not apply to current selection
    }
  };

  return (
    <div class="toolbar">
      {toolbarButtons.map((btn) => (
        <button
          class={`toolbar-btn ${btn.className || ""}`}
          title={btn.title}
          type="button"
          disabled={!props.editor}
          onMouseDown={(e) => {
            e.preventDefault();
            void handleClick(btn);
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
};

export default Toolbar;
