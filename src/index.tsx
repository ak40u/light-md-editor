import { render } from "solid-js/web";
import App from "./App";
import { getSafeCurrentWebviewWindow } from "./lib/tauri-window";
import "./styles/globals.css";

render(() => <App />, document.getElementById("root")!);

// Show window after frontend is rendered (prevents white flash)
getSafeCurrentWebviewWindow()?.show().catch(() => {});
