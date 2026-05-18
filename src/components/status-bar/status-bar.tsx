import type { Component } from "solid-js";
import { wordCount, lineCount, sourceMode, setSourceMode } from "../../stores/app-store";

const StatusBar: Component = () => {
  return (
    <div class="status-bar">
      <div class="status-bar-left">
        <span>{wordCount()} words</span>
        <span class="status-bar-separator">&middot;</span>
        <span>{lineCount()} lines</span>
      </div>
      <div class="status-bar-right">
        <button
          class="status-bar-toggle"
          type="button"
          title="Toggle source mode (Ctrl+/)"
          onClick={() => setSourceMode(!sourceMode())}
        >
          {sourceMode() ? "Source" : "Preview"}
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
