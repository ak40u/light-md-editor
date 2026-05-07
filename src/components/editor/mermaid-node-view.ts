// ProseMirror NodeView for commonmark code_block. Branches on
// node.attrs.language: mermaid → split-view Solid component with live
// preview; everything else → default <pre><code> passthrough so existing
// non-mermaid code blocks remain pixel-identical to baseline.

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Node as PMNode } from "@milkdown/kit/prose/model";
import type {
  EditorView,
  NodeView,
  ViewMutationRecord,
} from "@milkdown/kit/prose/view";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import MermaidBlock, { type Disposed } from "./mermaid-block";
import { sweepMermaidOrphans } from "../../lib/mermaid";

const MERMAID_PLUGIN_KEY = new PluginKey("lightmd-mermaid-code-block");

function getLanguage(node: PMNode): string {
  // commonmark code_block uses `language`. gfm/fenced may use `params`.
  return (
    (node.attrs?.language as string | undefined) ??
    (node.attrs?.params as string | undefined) ??
    ""
  ).trim();
}

function isMermaid(node: PMNode): boolean {
  return getLanguage(node).toLowerCase() === "mermaid";
}

class MermaidCodeBlockView implements NodeView {
  dom: HTMLDivElement;
  contentDOM: HTMLPreElement;
  private previewMount: HTMLDivElement;
  private solidDispose: (() => void) | null = null;
  private setCode: (v: string) => void;
  private disposed: Disposed = { v: false };
  private currentLanguage: string;
  private lastPushedText: string;

  constructor(
    node: PMNode,
    _view: EditorView,
    _getPos: () => number | undefined,
  ) {
    this.currentLanguage = getLanguage(node);
    this.dom = document.createElement("div");
    this.dom.className = "mermaid-block";

    this.contentDOM = document.createElement("pre");
    this.contentDOM.className = "mermaid-block__code";
    // PM owns textContent of this <pre>; do NOT seed it here.

    this.previewMount = document.createElement("div");
    this.previewMount.className = "mermaid-block__preview-mount";
    // Stop PM from treating preview DOM as document content.
    this.previewMount.setAttribute("contenteditable", "false");

    this.dom.appendChild(this.contentDOM);
    this.dom.appendChild(this.previewMount);

    this.lastPushedText = node.textContent;
    const [code, setCode] = createSignal(this.lastPushedText);
    this.setCode = setCode;

    this.solidDispose = render(
      () => MermaidBlock({ code, disposed: this.disposed }),
      this.previewMount,
    );
  }

  update(node: PMNode): boolean {
    // Language change → return false; PM destroys + recreates the NodeView.
    const lang = getLanguage(node);
    if (lang !== this.currentLanguage) return false;

    // contentDOM is owned by PM (text already updated in place by the time
    // update() runs). Only push when text actually changed — PM calls
    // update() for any neighboring transaction; skipping no-op pushes
    // matters if the signal ever becomes equals:false.
    const newText = node.textContent;
    if (newText !== this.lastPushedText) {
      this.lastPushedText = newText;
      this.setCode(newText);
    }
    return true;
  }

  // contentDOM is where PM-managed text lives — do NOT ignore its mutations.
  ignoreMutation(m: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(m.target as Node);
  }

  stopEvent(event: Event): boolean {
    // Only stop mouse events from the preview side (so PM doesn't try to
    // place selection inside rendered SVG). Keyboard, composition, focus
    // etc. all flow to PM natively.
    const target = event.target as Node | null;
    if (!target) return false;
    if (!this.previewMount.contains(target)) return false;
    return event.type.startsWith("mouse") || event.type === "click";
  }

  destroy(): void {
    // Order matters: flag first (every await in MermaidBlock checks it),
    // then dispose Solid (stops effects/timers via onCleanup), then sweep
    // any orphan mermaid measurement nodes.
    this.disposed.v = true;
    try {
      this.solidDispose?.();
    } finally {
      this.solidDispose = null;
      sweepMermaidOrphans();
    }
  }
}

class DefaultCodeBlockView implements NodeView {
  dom: HTMLPreElement;
  contentDOM: HTMLElement;
  private currentLanguage: string;

  constructor(node: PMNode) {
    this.currentLanguage = getLanguage(node);
    this.dom = document.createElement("pre");
    this.contentDOM = document.createElement("code");
    if (this.currentLanguage) {
      this.contentDOM.className = `language-${this.currentLanguage}`;
    }
    this.dom.appendChild(this.contentDOM);
  }

  update(node: PMNode): boolean {
    const lang = getLanguage(node);
    if (lang !== this.currentLanguage) return false;
    return true;
  }
}

export const mermaidCodeBlockPlugin = $prose(
  () =>
    new Plugin({
      key: MERMAID_PLUGIN_KEY,
      props: {
        nodeViews: {
          code_block: (node, view, getPos) =>
            isMermaid(node)
              ? new MermaidCodeBlockView(node, view, getPos)
              : new DefaultCodeBlockView(node),
        },
      },
    }),
);

export type { Disposed };
