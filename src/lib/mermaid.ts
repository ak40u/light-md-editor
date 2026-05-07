// Mermaid integration foundation: singleton loader (with reject-retry +
// timeout + epoch guard), config-lock, DOMPurify chokepoint, async render
// mutex, hardcoded dark palette, clipboard export helpers.

import DOMPurify from "dompurify";
import type { Mermaid, MermaidConfig } from "mermaid";

const obsidianDark: Record<string, string> = {
  background: "#1e1e2e",
  primaryColor: "#313244",
  primaryTextColor: "#cdd6f4",
  primaryBorderColor: "#45475a",
  lineColor: "#89b4fa",
  textColor: "#cdd6f4",
  mainBkg: "#313244",
  secondaryColor: "#45475a",
  tertiaryColor: "#585b70",
  noteBkgColor: "#f9e2af",
  noteTextColor: "#1e1e2e",
  fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
  fontSize: "14px",
};

function buildMermaidConfig(): MermaidConfig {
  return {
    startOnLoad: false,
    deterministicIds: true,
    securityLevel: "strict",
    secure: ["secure", "securityLevel", "startOnLoad", "deterministicIds"],
    theme: "base",
    themeVariables: obsidianDark,
    flowchart: {
      htmlLabels: false,
      curve: "basis",
    },
    sequence: {
      useMaxWidth: false,
    },
    fontFamily: obsidianDark.fontFamily,
  };
}

let cached: Promise<Mermaid> | null = null;
let loadEpoch = 0;

const IMPORT_TIMEOUT_MS = 10_000;

export function __resetMermaidCache(): void {
  cached = null;
  loadEpoch++;
}

export async function loadMermaid(): Promise<Mermaid> {
  if (cached) return cached;

  const epoch = ++loadEpoch;
  const promise = Promise.race<Mermaid>([
    import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize(buildMermaidConfig());
      return mermaid as Mermaid;
    }),
    new Promise<Mermaid>((_, reject) =>
      setTimeout(
        () => reject(new Error("Mermaid library import timed out (10s)")),
        IMPORT_TIMEOUT_MS,
      ),
    ),
  ]).catch((err) => {
    // Only clear cache if a newer load hasn't superseded us.
    if (epoch === loadEpoch) cached = null;
    throw err;
  });

  cached = promise;
  return promise;
}

class AsyncMutex {
  private chain: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(() => fn());
    // Detached settle-only chain — subsequent run() awaits prior completion
    // regardless of outcome. The returned promise carries the original
    // rejection to the caller (who must catch).
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export const mermaidRenderMutex = new AsyncMutex();

// crypto.randomUUID is unavailable in non-secure contexts (e.g. dev server
// bound to a LAN IP via TAURI_DEV_HOST). Fall back to a sufficiently-unique
// id — collisions inside one render are practically impossible.
function makeRenderId(): string {
  const fn = (
    globalThis.crypto as Crypto | undefined
  )?.randomUUID?.bind(globalThis.crypto);
  const uuid = fn ? fn() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `mermaid-svg-${uuid}`;
}

// Every SVG consumed by the app MUST pass through this function. Defense-in-
// depth against future mermaid CVEs leaking <script> / <foreignObject> /
// external <image href> via %%{init}%% or htmlLabels regression.
export function sanitizeMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
  });
}

export async function renderMermaidSafe(code: string): Promise<string> {
  const mermaid = await loadMermaid();
  return mermaidRenderMutex.run(async () => {
    const id = makeRenderId();
    // render() throws on syntax errors; caller catches. Standalone parse() is
    // redundant + slow.
    const { svg } = await mermaid.render(id, code);
    return sanitizeMermaidSvg(svg);
  });
}

// Mermaid appends measurement nodes directly to document.body. Scoping the
// scan to body's direct children keeps this O(siblings) instead of
// O(all SVG descendants in the doc).
export function sweepMermaidOrphans(): void {
  for (const el of Array.from(document.body.children)) {
    if (
      el.id?.startsWith("mermaid-svg-") &&
      !el.closest(".mermaid-block")
    ) {
      el.remove();
    }
  }
}

// ============================================================
// Phase 2: export helpers (clipboard only — save-to-file deferred)
// ============================================================

async function tauriWriteText(text: string): Promise<void> {
  const mod = await import("@tauri-apps/plugin-clipboard-manager");
  await mod.writeText(text);
}

async function tauriWriteImage(bytes: Uint8Array): Promise<void> {
  const mod = await import("@tauri-apps/plugin-clipboard-manager");
  await mod.writeImage(bytes);
}

// Read intrinsic dimensions from a serialized SVG via DOMParser (never
// regex). Falls back to 800×600 if the SVG lacks viewBox + width/height.
export function getIntrinsicSize(svgText: string): { w: number; h: number } {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (svg) {
      const vb = svg.viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        return { w: vb.width, h: vb.height };
      }
      const w = parseFloat(svg.getAttribute("width") ?? "");
      const h = parseFloat(svg.getAttribute("height") ?? "");
      if (w > 0 && h > 0) return { w, h };
    }
  } catch {
    /* fall through */
  }
  return { w: 800, h: 600 };
}

// Inline a font fallback so PNG rasterization doesn't substitute random
// system fonts. Belt-and-suspenders: prepend a <style> element AND set
// font-family on every <text> directly — inline <style> applies
// inconsistently in <img>-loaded SVGs across engines, but per-element
// attributes always do.
const FONT_STACK = "'Segoe UI', -apple-system, Arial, sans-serif";

function inlineFontFallback(svgText: string): string {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  } catch {
    return svgText;
  }
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return svgText;

  const styleEl = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "style",
  );
  styleEl.textContent = `svg text{font-family:${FONT_STACK} !important;}`;
  svg.insertBefore(styleEl, svg.firstChild);

  for (const text of Array.from(svg.querySelectorAll("text"))) {
    text.setAttribute("font-family", FONT_STACK);
  }

  return new XMLSerializer().serializeToString(svg);
}

// SVG string → PNG bytes via DPR-scaled canvas. Security: caller must
// sanitize before; we set crossOrigin=anonymous; explicit SecurityError
// catch on toBlob. Caps canvas dimension to avoid `RangeError: canvas too
// large` on huge diagrams (Chromium ~16384px hard limit).
const MAX_CANVAS_DIM = 8000;

async function rasterize(
  svgText: string,
  w: number,
  h: number,
): Promise<Uint8Array> {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const fitScale = Math.min(1, MAX_CANVAS_DIM / Math.max(w * dpr, h * dpr, 1));
  const totalScale = dpr * fitScale;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * totalScale));
  canvas.height = Math.max(1, Math.round(h * totalScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.scale(totalScale, totalScale);

  await (document.fonts?.ready ?? Promise.resolve());

  // Use Blob + object URL: avoids btoa+unescape (deprecated, throws on lone
  // surrogates), no base64 round-trip cost on large diagrams.
  const blobIn = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blobIn);

  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("SVG→PNG: image decode failed"));
      i.src = url;
    });
  } finally {
    // Revoke after onload/onerror so the decoder is done with the URL.
    URL.revokeObjectURL(url);
  }

  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        "image/png",
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "SecurityError") {
        reject(new Error("Canvas tainted — export blocked by browser"));
      } else {
        reject(e as Error);
      }
    }
  });

  return new Uint8Array(await blob.arrayBuffer());
}

export async function copyAsSvg(rawSvg: string): Promise<void> {
  const safe = sanitizeMermaidSvg(rawSvg);
  try {
    await tauriWriteText(safe);
    return;
  } catch (primaryErr) {
    try {
      await navigator.clipboard.writeText(safe);
      return;
    } catch (fallbackErr) {
      throw new Error(
        `Copy SVG failed (plugin: ${
          primaryErr instanceof Error ? primaryErr.message : primaryErr
        }; fallback: ${
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
        })`,
      );
    }
  }
}

export async function copyAsPng(rawSvg: string): Promise<void> {
  const safe = sanitizeMermaidSvg(rawSvg);
  const inlined = inlineFontFallback(safe);
  const { w, h } = getIntrinsicSize(inlined);
  const png = await rasterize(inlined, w, h);

  try {
    await tauriWriteImage(png);
    return;
  } catch (primaryErr) {
    try {
      // BlobPart cast: Uint8Array IS a valid BlobPart at runtime; this
      // works around a lib.dom ArrayBuffer/SharedArrayBuffer variance.
      const blob = new Blob([png as BlobPart], { type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return;
    } catch (fallbackErr) {
      throw new Error(
        `Copy PNG failed (plugin: ${
          primaryErr instanceof Error ? primaryErr.message : primaryErr
        }; fallback: ${
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
        })`,
      );
    }
  }
}
