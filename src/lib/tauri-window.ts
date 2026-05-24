import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

type CurrentWebviewWindow = ReturnType<typeof getCurrentWebviewWindow>;

export const getSafeCurrentWebviewWindow = (): CurrentWebviewWindow | null => {
  try {
    return getCurrentWebviewWindow();
  } catch {
    return null;
  }
};
