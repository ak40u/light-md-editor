import { render } from "solid-js/web";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import "./styles/globals.css";

render(() => <App />, document.getElementById("root")!);

// Show window after frontend is rendered (prevents white flash)
getCurrentWebviewWindow().show().catch(() => {});
