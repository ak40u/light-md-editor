import { Component, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import type { Editor } from "@milkdown/kit/core";
import { replaceAll } from "@milkdown/kit/utils";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MilkdownEditor from "./components/editor/milkdown-editor";
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
  sidebarVisible,
  setSidebarVisible,
  sourceMode,
  setSourceMode,
  setRecentFiles,
} from "./stores/app-store";
import { getRecentFiles } from "./lib/recent-files";
import "./styles/layout.css";

const App: Component = () => {
  const [editor, setEditor] = createSignal<Editor | undefined>();

  // Update window title when file path or dirty state changes
  createEffect(() => {
    const path = currentFilePath();
    const dirty = isDirty();
    const fileName = path ? path.split(/[/\\]/).pop() : "Untitled";
    const title = `${dirty ? "* " : ""}${fileName} — LightMD`;
    getCurrentWebviewWindow().setTitle(title).catch(() => {
      document.title = title;
    });
  });

  const handleContentChange = (markdown: string) => {
    setCurrentContent(markdown);
    setIsDirty(true);
  };

  const handleEditorReady = (instance: Editor) => handleEditorReadyAndLoad(instance);

  const handleNewFile = () => {
    const newContent = "# Untitled\n\nStart writing...\n";
    const ed = editor();
    if (ed) {
      ed.action(replaceAll(newContent));
    }
    setCurrentFilePath(null);
    setCurrentContent(newContent);
    setIsDirty(false);
  };

  /** Open file via native dialog */
  const handleOpenFile = async () => {
    try {
      const result = await openFileDialog();
      if (!result) return;
      const ed = editor();
      if (ed) {
        ed.action(replaceAll(result.content));
      }
      setCurrentFilePath(result.path);
      setCurrentContent(result.content);
      setIsDirty(false);
      const fileName = result.path.split(/[/\\]/).pop() || "untitled.md";
      await addRecentFile(result.path, fileName);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  /** Save current document */
  const handleSave = async () => {
    try {
      const path = currentFilePath();
      const content = currentContent();
      if (path) {
        await saveFile(path, content);
        setIsDirty(false);
      } else {
        const newPath = await saveFileAs(content);
        if (newPath) {
          setCurrentFilePath(newPath);
          setIsDirty(false);
          const fileName = newPath.split(/[/\\]/).pop() || "untitled.md";
          await addRecentFile(newPath, fileName);
          await refreshRecentFiles();
        }
        // If user cancelled Save As, isDirty stays true
      }
    } catch (err) {
      console.error("Failed to save file:", err);
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
      if (!sourceMode()) {
        const ed = editor();
        if (ed) {
          ed.action(replaceAll(content));
        }
      }
      setCurrentContent(content);
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
    if (e.ctrlKey && e.key === "\\") {
      e.preventDefault();
      setSidebarVisible(!sidebarVisible());
    }
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.ctrlKey && e.key === "o") {
      e.preventDefault();
      handleOpenFile();
    }
    if (e.ctrlKey && e.key === "n") {
      e.preventDefault();
      handleNewFile();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      handleReloadCurrentFile();
    }
    if (e.ctrlKey && e.key === "/") {
      e.preventDefault();
      toggleSourceMode();
    }
  };

  /** Toggle between WYSIWYG and raw markdown source */
  const toggleSourceMode = () => {
    const entering = !sourceMode();
    if (!entering) {
      // Returning to WYSIWYG — push textarea content into Milkdown
      const ed = editor();
      if (ed) {
        ed.action(replaceAll(currentContent()));
      }
    }
    setSourceMode(entering);
  };

  /** Load file by path (from CLI arg, drag-drop, or file association) */
  const loadFileByPath = async (path: string) => {
    try {
      const content = await readFile(path);
      const ed = editor();
      if (ed) {
        ed.action(replaceAll(content));
      }
      setCurrentFilePath(path);
      setCurrentContent(content);
      setIsDirty(false);
      const fileName = path.split(/[/\\]/).pop() || "untitled.md";
      await addRecentFile(path, fileName);
      await refreshRecentFiles();
    } catch (err) {
      console.error("Failed to load file:", path, err);
    }
  };

  let unlistenOpenFile: (() => void) | undefined;

  onMount(async () => {
    document.addEventListener("keydown", handleKeydown);
    refreshRecentFiles();

    // Listen for "open-file" events from Tauri backend
    // (drag & drop, second instance with file arg)
    unlistenOpenFile = await listen<string>("open-file", (event) => {
      loadFileByPath(event.payload);
    });
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeydown);
    unlistenOpenFile?.();
  });

  /** Called when Milkdown editor is fully initialized */
  const handleEditorReadyAndLoad = async (instance: Editor) => {
    setEditor(instance);

    // Load file passed via CLI argument (double-click .md, command line)
    try {
      const initialFile = await invoke<string | null>("get_initial_file");
      if (initialFile) {
        loadFileByPath(initialFile);
      }
    } catch {
      // Not running in Tauri (dev mode without backend)
    }
  };

  return (
    <div class="app-layout">
      <Sidebar
        onNewFile={handleNewFile}
        onOpenFile={handleOpenRecentFile}
        onRemoveRecent={handleRemoveRecent}
      />
      <main class="main-area">
        <Toolbar editor={editor()} />
        <div class="editor-area">
          <Show when={!sourceMode()} fallback={
            <textarea
              class="source-editor"
              value={currentContent()}
              onInput={(e) => {
                setCurrentContent(e.currentTarget.value);
                setIsDirty(true);
              }}
              spellcheck={false}
            />
          }>
            <MilkdownEditor
              onContentChange={handleContentChange}
              onEditorReady={handleEditorReady}
            />
          </Show>
        </div>
        <StatusBar />
      </main>
    </div>
  );
};

export default App;
