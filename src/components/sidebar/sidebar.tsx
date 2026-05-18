import { Component, createSignal, createMemo, For, Show } from "solid-js";
import {
  recentFiles,
  currentFilePath,
  sidebarVisible,
} from "../../stores/app-store";

interface SidebarProps {
  onNewFile?: () => void;
  onOpenFile?: (path: string) => void;
  onRemoveRecent?: (path: string) => void;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredFiles = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return recentFiles();
    return recentFiles().filter((f) =>
      f.name.toLowerCase().includes(query)
    );
  });

  return (
    <Show when={sidebarVisible()}>
      <aside class="sidebar">
        {/* Logo */}
        <div class="sidebar-header">
          <h1 class="sidebar-logo">LightMD</h1>
          <p class="sidebar-subtitle">MARKDOWN EDITOR</p>
        </div>

        {/* Search */}
        <div class="sidebar-search">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="sidebar-search-input"
          />
        </div>

        {/* Recent files */}
        <div class="sidebar-files" onContextMenu={(e) => e.preventDefault()}>
          <p class="sidebar-section-label">RECENT</p>
          <ul class="sidebar-file-list">
            <For each={filteredFiles()}>
              {(file) => (
                <li
                  class="sidebar-file-item"
                  classList={{
                    "sidebar-file-item--active":
                      currentFilePath() === file.path,
                  }}
                  onClick={() => props.onOpenFile?.(file.path)}
                >
                  <div class="sidebar-file-info">
                    <span class="sidebar-file-name">{file.name}</span>
                    <span class="sidebar-file-date">{file.lastOpened}</span>
                  </div>
                  <button
                    class="sidebar-file-remove"
                    title="Remove from recent"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onRemoveRecent?.(file.path);
                    }}
                  >
                    ×
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>

        {/* Bottom actions */}
        <div class="sidebar-footer">
          <button class="sidebar-btn" type="button" onClick={() => props.onNewFile?.()}>
            + New File
          </button>
        </div>
      </aside>
    </Show>
  );
};

export default Sidebar;
