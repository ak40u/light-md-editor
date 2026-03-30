import { Component } from "solid-js";

const App: Component = () => {
  return (
    <div class="flex h-screen w-screen bg-[var(--surface)] text-[var(--on-surface)]">
      {/* Sidebar placeholder */}
      <aside class="w-[220px] bg-[var(--surface-container-low)] flex flex-col shrink-0">
        <div class="p-4">
          <h1 class="text-lg font-semibold tracking-wide">LightMD</h1>
          <p class="text-xs text-[var(--on-surface-variant)]">MARKDOWN EDITOR</p>
        </div>
      </aside>

      {/* Main area */}
      <main class="flex flex-col flex-1 min-w-0">
        {/* Toolbar placeholder */}
        <div class="h-12 bg-[var(--surface-container)] flex items-center px-4 text-sm text-[var(--on-surface-variant)]">
          Toolbar
        </div>

        {/* Editor area placeholder */}
        <div class="flex-1 overflow-auto p-8">
          <p class="text-[var(--on-surface-variant)]">Editor will be here...</p>
        </div>

        {/* Status bar placeholder */}
        <div class="h-7 bg-[var(--surface-container)] flex items-center px-4 text-xs text-[var(--on-surface-variant)]">
          0 words · 0 lines
        </div>
      </main>
    </div>
  );
};

export default App;
