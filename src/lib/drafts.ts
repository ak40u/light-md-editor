import { invoke } from "@tauri-apps/api/core";

/**
 * Draft = unsaved document auto-persisted in the app data dir so that
 * power loss / crashes / accidental quits don't lose the user's work.
 */
export interface DraftEntry {
  id: string;
  lastModified: string;
  preview: string;
}

interface DraftEntryRaw {
  id: string;
  last_modified: string;
  preview: string;
}

/** Generate a session id that's filesystem-safe and sortable by time. */
export function newDraftId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `draft-${ts}-${rand}`;
}

export async function saveDraft(id: string, content: string): Promise<void> {
  await invoke("save_draft", { id, content });
}

export async function loadDraft(id: string): Promise<string> {
  return invoke<string>("load_draft", { id });
}

export async function discardDraft(id: string): Promise<void> {
  await invoke("discard_draft", { id });
}

export async function listDrafts(): Promise<DraftEntry[]> {
  const raw = await invoke<DraftEntryRaw[]>("list_drafts");
  return raw.map((r) => ({
    id: r.id,
    lastModified: r.last_modified,
    preview: r.preview,
  }));
}
