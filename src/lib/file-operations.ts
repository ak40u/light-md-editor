import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown"] },
  { name: "Text", extensions: ["txt"] },
  { name: "All Files", extensions: ["*"] },
];

export async function openFileDialog(): Promise<{
  path: string;
  content: string;
} | null> {
  const selected = await open({
    multiple: false,
    filters: MD_FILTERS,
  });

  if (!selected) return null;

  const path = typeof selected === "string" ? selected : selected.path;
  const content = await invoke<string>("read_file", { path });
  return { path, content };
}

export async function saveFile(
  path: string,
  content: string,
): Promise<void> {
  await invoke("write_file", { path, content });
}

export async function saveFileAs(
  content: string,
): Promise<string | null> {
  const path = await save({
    filters: MD_FILTERS,
    defaultPath: "untitled.md",
  });

  if (!path) return null;

  await invoke("write_file", { path, content });
  return path;
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}
