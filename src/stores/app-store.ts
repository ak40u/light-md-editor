import { createSignal, createMemo } from "solid-js";

export interface RecentFile {
  name: string;
  path: string;
  lastOpened: string;
}

const [currentContent, setCurrentContent] = createSignal("");
const [isDirty, setIsDirty] = createSignal(false);
const [sidebarVisible, setSidebarVisible] = createSignal(true);
const [sourceMode, setSourceMode] = createSignal(false);
const [currentFilePath, setCurrentFilePath] = createSignal<string | null>(null);
const [recentFiles, setRecentFiles] = createSignal<RecentFile[]>([]);

const wordCount = createMemo(() => {
  const text = currentContent().trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
});

const lineCount = createMemo(() => {
  const text = currentContent();
  if (!text) return 0;
  return text.split("\n").length;
});

export {
  currentContent,
  setCurrentContent,
  isDirty,
  setIsDirty,
  sidebarVisible,
  setSidebarVisible,
  currentFilePath,
  setCurrentFilePath,
  recentFiles,
  setRecentFiles,
  sourceMode,
  setSourceMode,
  wordCount,
  lineCount,
};
