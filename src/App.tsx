import {
  Component,
  Show,
  Suspense,
  createSignal,
  createEffect,
  lazy,
  onMount,
  onCleanup,
} from "solid-js";
import type { Editor } from "@milkdown/kit/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/sidebar/sidebar";
import Toolbar from "./components/toolbar/toolbar";
import StatusBar from "./components/status-bar/status-bar";
import { saveFileAs, saveFile, openFileDialog, readFile } from "./lib/file-operations";
import { addRecentFile, removeRecentFile } from "./lib/recent-files";
import {
  currentContent,
  setCurrentContent,
  isDirty,
  setIsDirty,
  currentFilePath,
  setCurrentFilePath,
  currentDraftId,
  setCurrentDraftId,
  sidebarVisible,
  setSidebarVisible,
  sourceMode,
  setSourceMode,
  setRecentFiles,
  editorFontSize,
  zoomIn,
  zoomOut,
  zoomReset,
} from "./stores/app-store";
import { getRecentFiles } from "./lib/recent-files";
import { newDraftId, saveDraft, loadDraft, discardDraft, listDrafts } from "./lib/drafts";
import { getSafeCurrentWebviewWindow } from "./lib/tauri-window";
import "./styles/layout.css";

const MilkdownEditor = lazy(() => import("./components/editor/milkdown-editor"));

type ReplaceAll = typeof import("@milkdown/kit/utils").replaceAll;
type EditorViewCtx = typeof import("@milkdown/kit/core").editorViewCtx;
let replaceAllPromise: Promise<ReplaceAll> | undefined;
let editorViewCtxPromise: Promise<EditorViewCtx> | undefined;

const loadReplaceAll = (): Promise<ReplaceAll> => {
  replaceAllPromise ??= import("@milkdown/kit/utils").then((mod) => mod.replaceAll);
  return replaceAllPromise;
};

const loadEditorViewCtx = (): Promise<EditorViewCtx> => {
  editorViewCtxPromise ??= import("@milkdown/kit/core").then((mod) => mod.editorViewCtx);
  return editorViewCtxPromise;
};

const App: Component = () => {
  const [editor, setEditor] = createSignal<Editor | undefined>();
  let startupDocumentLoad: Promise<void> | undefined;
  let pendingEditorContent: string | undefined;
  let expectedProgrammaticContent: string | undefined;
  let expectedProgrammaticContentTimer: number | undefined;

  // Update window title when file path or dirty state changes
  createEffect(() => {
    const path = currentFilePath();
    const dirty = isDirty();
    const fileName = path ? path.split(/[/\\]/).pop() : "Untitled";
    const title = `${dirty ? "* " : ""}${fileName} — LightMD`;
    const currentWindow = getSafeCurrentWebviewWindow();
    if (!currentWindow) {
      document.title = title;
      return;
    }
    currentWindow.setTitle(title).catch(() => {
      document.title = title;
    });
  });

  const handleContentChange = (markdown: string) => {
    setCurrentContent(markdown);
    if (expectedProgrammaticContent === markdown) {
      expectedProgrammaticContent = undefined;
      if (expectedProgrammaticContentTimer !== undefined) {
        clearTimeout(expectedProgrammaticContentTimer);
        expectedProgrammaticContentTimer = undefined;
      }
      return;
    }
    setIsDirty(true);
  };

  const replaceEditorContent = async (
    markdown: string,
    instance = editor(),
  ): Promise<void> => {
    if (!instance) {
      pendingEditorContent = markdown;
      return;
    }
    const replaceAll = await loadReplaceAll();
    if (instance !== editor()) return;
    expectedProgrammaticContent = markdown;
    if (expectedProgrammaticContentTimer !== undefined) {
      clearTimeout(expectedProgrammaticContentTimer);
    }
    expectedProgrammaticContentTimer = window.setTimeout(() => {
      if (expectedProgrammaticContent === markdown) {
        expectedProgrammaticContent = undefined;
      }
      expectedProgrammaticContentTimer = undefined;
    }, 1500);
    instance.action(replaceAll(markdown));
  };

  const focusEditor = async (instance = editor()): Promise<void> => {
    if (!instance) return;
    const editorViewCtx = await loadEditorViewCtx();
    if (instance !== editor()) return;
    instance.action((ctx) => {
      ctx.get(editorViewCtx).focus();
    });
  };

  const handleEditorReady = (instance: Editor) => {
    setEditor(instance);
    if (pendingEditorContent !== undefined) {
      const content = pendingEditorContent;
      const dirty = isDirty();
      pendingEditorContent = undefined;
      replaceEditorContent(content, instance)
        .then(() => setIsDirty(dirty))
        .catch((err) => console.error("Failed to hydrate editor:", err));
    }
  };

  const handleEditorDispose = (instance: Editor) => {
    if (editor() === instance) {
      setEditor(undefined);
    }
  };

  const handleNewFile = async () => {
    setCurrentFilePath(null);
    setCurrentDraftId(null);
    setCurrentContent("");
    await replaceEditorContent("");
    setIsDirty(false);
    await focusEditor();
  };

  /** Open file via native dialog */
  const handleOpenFile = async () => {
    try {
      const result = await openFileDialog();
      if (!result) return;
      setCurrentFilePath(result.path);
      setCurrentDraftId(null);
      setCurrentContent(result.content);
      await replaceEditorContent(result.content);
      setIsDirty(false);
      const fileName = result.path.split(/[/\\]/).pop() || "untitled.md";
      await addRecentFile(result.path, fileName);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  /** Persist content. If no path is known yet, prompt Save As. */
  const handleSave = async () => {
    try {
      const path = currentFilePath();
      const content = currentContent();
      if (path) {
        await saveFile(path, content);
        setIsDirty(false);
      } else {
        await handleSaveAs();
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  };

  /** Always show the Save As dialog, regardless of whether a path is known. */
  const handleSaveAs = async () => {
    try {
      const content = currentContent();
      const newPath = await saveFileAs(content);
      if (!newPath) return; // user cancelled
      setCurrentFilePath(newPath);
      setIsDirty(false);
      // Promote draft -> real file: drop the auto-saved copy from app data dir.
      const draftId = currentDraftId();
      if (draftId) {
        await discardDraft(draftId).catch(() => {});
        setCurrentDraftId(null);
      }
      const fileName = newPath.split(/[/\\]/).pop() || "untitled.md";
      await addRecentFile(newPath, fileName);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to save file as:", err);
    }
  };

  /** Open a file from the recent files list */
  const handleOpenRecentFile = (path: string) => loadFileByPath(path);

  /** Remove a file from the recent files list */
  const handleRemoveRecent = async (path: string) => {
    try {
      await removeRecentFile(path);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to remove recent file:", err);
    }
  };

  /** Reload current document from disk */
  const handleReloadCurrentFile = async () => {
    const path = currentFilePath();
    if (!path) return;

    try {
      const content = await readFile(path);
      setCurrentContent(content);
      if (!sourceMode()) {
        await replaceEditorContent(content);
      }
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to reload file:", path, err);
    }
  };

  /** Refresh recent files list from backend */
  const refreshRecentFiles = async () => {
    try {
      const files = await getRecentFiles();
      setRecentFiles(
        files.map((f) => ({
          name: f.title,
          path: f.path,
          lastOpened: f.lastOpened.slice(0, 10),
        }))
      );
    } catch {
      // Backend unavailable — keep current list
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    // Treat Cmd (macOS) and Ctrl (Windows/Linux) interchangeably for app shortcuts.
    const cmdOrCtrl = e.ctrlKey || e.metaKey;
    if (cmdOrCtrl && e.key === "\\") {
      e.preventDefault();
      setSidebarVisible(!sidebarVisible());
    }
    if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSaveAs();
      return;
    }
    if (cmdOrCtrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    }
    if (cmdOrCtrl && e.key.toLowerCase() === "o") {
      e.preventDefault();
      handleOpenFile();
    }
    if (cmdOrCtrl && e.key.toLowerCase() === "n") {
      e.preventDefault();
      handleNewFile();
    }
    if (cmdOrCtrl && e.key.toLowerCase() === "r") {
      e.preventDefault();
      handleReloadCurrentFile();
    }
    if (cmdOrCtrl && e.key === "/") {
      e.preventDefault();
      toggleSourceMode();
    }
    // `=` is the unshifted key on US keyboards; treat it as `+` for convenience
    if (cmdOrCtrl && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      zoomIn();
    }
    if (cmdOrCtrl && e.key === "-") {
      e.preventDefault();
      zoomOut();
    }
    if (cmdOrCtrl && e.key === "0") {
      e.preventDefault();
      zoomReset();
    }
  };

  /** Toggle between WYSIWYG and raw markdown source */
  const toggleSourceMode = () => {
    setSourceMode(!sourceMode());
  };

  /** Load file by path (from CLI arg, drag-drop, or file association) */
  const loadFileByPath = async (path: string) => {
    try {
      const content = await readFile(path);
      setCurrentFilePath(path);
      setCurrentDraftId(null);
      setCurrentContent(content);
      await replaceEditorContent(content);
      setIsDirty(false);
      const fileName = path.split(/[/\\]/).pop() || "untitled.md";
      await addRecentFile(path, fileName);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to load file:", path, err);
    }
  };

  // -- Draft auto-save -----------------------------------------------------
  // For untitled, in-progress documents (path === null) we persist the
  // editor content to a session-keyed file under the app data dir on every
  // change (debounced) so a crash / power loss / accidental quit won't lose
  // the user's work. A real Save (As) discards the draft.
  let draftSaveTimer: number | undefined;
  const DRAFT_DEBOUNCE_MS = 1000;

  createEffect(() => {
    const content = currentContent();
    const path = currentFilePath();

    // Browser-only dev shell has no native app data dir or IPC draft bridge.
    if (!getSafeCurrentWebviewWindow()) return;

    // Saved files don't need draft persistence
    if (path) return;
    if (!isDirty()) return;
    if (!content.trim()) return;

    // First edit of an untitled doc — allocate a draft id lazily
    let draftId = currentDraftId();
    if (!draftId) {
      draftId = newDraftId();
      setCurrentDraftId(draftId);
    }

    if (draftSaveTimer !== undefined) {
      clearTimeout(draftSaveTimer);
    }
    const id = draftId;
    draftSaveTimer = window.setTimeout(() => {
      saveDraft(id, content).catch((err) => {
        console.error("Failed to auto-save draft:", err);
      });
    }, DRAFT_DEBOUNCE_MS);
  });

  let unlistenOpenFile: (() => void) | undefined;

  onMount(async () => {
    document.addEventListener("keydown", handleKeydown);
    refreshRecentFiles();
    loadStartupDocument();

    // Listen for "open-file" events from Tauri backend
    // (drag & drop, second instance with file arg)
    if (getSafeCurrentWebviewWindow()) {
      try {
        unlistenOpenFile = await listen<string>("open-file", (event) => {
          loadFileByPath(event.payload);
        });
      } catch {
        // Native app event bridge is unavailable in the browser-only dev shell.
      }
    }
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeydown);
    if (draftSaveTimer !== undefined) clearTimeout(draftSaveTimer);
    if (expectedProgrammaticContentTimer !== undefined) {
      clearTimeout(expectedProgrammaticContentTimer);
    }
    unlistenOpenFile?.();
  });

  /** If a draft exists from a prior session, restore the most recent one. */
  const restoreLatestDraftIfAny = async () => {
    try {
      const drafts = await listDrafts();
      if (drafts.length === 0) return;
      const latest = drafts[0]; // backend returns newest first
      const content = await loadDraft(latest.id);
      if (!content.trim()) {
        // Empty draft — discard quietly
        await discardDraft(latest.id).catch(() => {});
        return;
      }
      setCurrentFilePath(null);
      setCurrentDraftId(latest.id);
      setCurrentContent(content);
      await replaceEditorContent(content);
      setIsDirty(true);
    } catch (err) {
      console.error("Failed to restore drafts:", err);
    }
  };

  const loadStartupDocument = () => {
    startupDocumentLoad ??= loadStartupDocumentOnce();
    return startupDocumentLoad;
  };

  const loadStartupDocumentOnce = async () => {
    // Load file passed via CLI argument (double-click .md, command line).
    // If no CLI file, try restoring an in-progress draft from a prior session.
    try {
      const initialFile = await invoke<string | null>("get_initial_file");
      if (initialFile) {
        await loadFileByPath(initialFile);
      } else {
        await restoreLatestDraftIfAny();
      }
    } catch {
      // Not running in Tauri (dev mode without backend)
    }
  };

  createEffect(() => {
    if (sourceMode()) {
      setEditor(undefined);
    }
  });

  return (
    <div class="app-layout">
      <Sidebar
        onNewFile={handleNewFile}
        onOpenFile={handleOpenRecentFile}
        onOpenFileDialog={handleOpenFile}
        onRemoveRecent={handleRemoveRecent}
      />
      <main class="main-area">
        <Toolbar editor={editor()} />
        <div class="editor-area" style={{ "font-size": `${editorFontSize()}px` }}>
          <Show when={!sourceMode()} fallback={
            <textarea
              class="source-editor"
              value={currentContent()}
              placeholder="Start writing..."
              onInput={(e) => {
                setCurrentContent(e.currentTarget.value);
                setIsDirty(true);
              }}
              spellcheck={false}
            />
          }>
            <Suspense fallback={<div class="editor-loading" aria-label="Loading editor" />}>
              <MilkdownEditor
                initialContent={currentContent()}
                onContentChange={handleContentChange}
                onEditorReady={handleEditorReady}
                onEditorDispose={handleEditorDispose}
              />
            </Suspense>
          </Show>
        </div>
        <StatusBar />
      </main>
    </div>
  );
};

export default App;
