import { render } from "solid-js/web";
import App from "./App";
import { initSystemThemeSync } from "./lib/theme";
import { getSafeCurrentWebviewWindow } from "./lib/tauri-window";
import "./styles/globals.css";

initSystemThemeSync();

render(() => <App />, document.getElementById("root")!);

// Show window after frontend is rendered (prevents white flash)
getSafeCurrentWebviewWindow()?.show().catch(() => {});
