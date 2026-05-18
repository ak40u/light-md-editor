import { invoke } from "@tauri-apps/api/core";

export interface RecentFile {
  path: string;
  title: string;
  lastOpened: string;
}

interface RecentFileRaw {
  path: string;
  title: string;
  last_opened: string;
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  const entries = await invoke<RecentFileRaw[]>("get_recent_files");
  return entries.map((e) => ({
    path: e.path,
    title: e.title,
    lastOpened: e.last_opened,
  }));
}

export async function addRecentFile(
  path: string,
  title: string,
): Promise<void> {
  await invoke("add_recent_file", { path, title });
}

export async function removeRecentFile(path: string): Promise<void> {
  await invoke("remove_recent_file", { path });
}
