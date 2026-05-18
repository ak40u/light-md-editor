import { createSignal, createMemo } from "solid-js";

export interface RecentFile {
  name: string;
  path: string;
  lastOpened: string;
}

const ZOOM_STORAGE_KEY = "lightmd:editor-font-size";
const ZOOM_DEFAULT = 15;
const ZOOM_MIN = 10;
const ZOOM_MAX = 32;
const ZOOM_STEP = 1;

const loadInitialZoom = (): number => {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (!raw) return ZOOM_DEFAULT;
    const v = parseInt(raw, 10);
    if (!Number.isFinite(v) || v < ZOOM_MIN || v > ZOOM_MAX) return ZOOM_DEFAULT;
    return v;
  } catch {
    return ZOOM_DEFAULT;
  }
};

const persistZoom = (v: number) => {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(v));
  } catch {
    // localStorage unavailable (private mode, quota) — keep in-memory only
  }
};

const [currentContent, setCurrentContent] = createSignal("");
const [isDirty, setIsDirty] = createSignal(false);
const [sidebarVisible, setSidebarVisible] = createSignal(true);
const [sourceMode, setSourceMode] = createSignal(false);
const [currentFilePath, setCurrentFilePath] = createSignal<string | null>(null);
const [recentFiles, setRecentFiles] = createSignal<RecentFile[]>([]);
const [editorFontSize, setEditorFontSize] = createSignal(loadInitialZoom());

const setZoom = (v: number) => {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
  setEditorFontSize(clamped);
  persistZoom(clamped);
};

const zoomIn = () => setZoom(editorFontSize() + ZOOM_STEP);
const zoomOut = () => setZoom(editorFontSize() - ZOOM_STEP);
const zoomReset = () => setZoom(ZOOM_DEFAULT);

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
  editorFontSize,
  zoomIn,
  zoomOut,
  zoomReset,
};
