import { onMount, onCleanup, Component } from "solid-js";
import { Editor } from "@milkdown/kit/core";
import { rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { defaultMarkdown } from "../../lib/editor-config";
import "../../styles/editor-theme.css";

interface MilkdownEditorProps {
  onContentChange?: (markdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
  initialContent?: string;
}

const MilkdownEditor: Component<MilkdownEditorProps> = (props) => {
  let containerRef!: HTMLDivElement;
  let editorInstance: Editor | undefined;

  onMount(async () => {
    try {
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef);
          ctx.set(defaultValueCtx, props.initialContent ?? defaultMarkdown);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            props.onContentChange?.(markdown);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(clipboard)
        .use(listener)
        .create();

      editorInstance = editor;
      props.onEditorReady?.(editor);
    } catch (err) {
      console.error("Failed to initialize Milkdown editor:", err);
    }
  });

  onCleanup(() => {
    editorInstance?.destroy();
  });

  return (
    <div
      ref={containerRef}
      class="milkdown-wrapper"
    />
  );
};

export default MilkdownEditor;
