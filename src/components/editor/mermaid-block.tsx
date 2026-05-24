// SolidJS preview component used by the mermaid NodeView.
//
// Phase 1: debounced render, runId guard, disposed flag, error UI, Retry on
// loader failure.
// Phase 2: toolbar (Copy SVG / Copy PNG / Fullscreen), toast, Portal-based
// fullscreen modal with svg-pan-zoom (inline preview is static — no
// pan-zoom on inline, validation 2026-04-16 Q3).

import {
  type Component,
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  renderMermaidSafe,
  __resetMermaidCache,
  copyAsSvg,
  copyAsPng,
  getIntrinsicSize,
} from "../../lib/mermaid";
import { watchSystemTheme } from "../../lib/theme";

export interface Disposed {
  v: boolean;
}

export interface MermaidBlockProps {
  code: Accessor<string>;
  disposed: Disposed;
}

type RenderState = "idle" | "loading" | "ok" | "err" | "loader-err";
type ToastKind = "ok" | "err";
type SvgPanZoomFactory = typeof import("svg-pan-zoom");
type SvgPanZoomInstance = ReturnType<SvgPanZoomFactory>;

let svgPanZoomPromise: Promise<SvgPanZoomFactory> | undefined;

const loadSvgPanZoom = (): Promise<SvgPanZoomFactory> => {
  svgPanZoomPromise ??= import("svg-pan-zoom").then((mod) => {
    const loaded = mod as unknown as { default?: SvgPanZoomFactory } & SvgPanZoomFactory;
    return loaded.default ?? loaded;
  });
  return svgPanZoomPromise;
};

const DEBOUNCE_MS = 300;
const TOAST_MS = 3000;

function firstLine(msg: string): string {
  return (msg ?? "").split("\n", 1)[0]!.slice(0, 200);
}

function isLoaderError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    m.includes("mermaid library") ||
    m.includes("failed to fetch") ||
    m.includes("import") ||
    m.includes("timeout")
  );
}

const MermaidBlock: Component<MermaidBlockProps> = (props) => {
  const [svg, setSvg] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");
  const [state, setState] = createSignal<RenderState>("idle");
  const [toast, setToast] = createSignal<{ kind: ToastKind; msg: string } | null>(
    null,
  );
  const [fullscreenOpen, setFullscreenOpen] = createSignal(false);
  const [themeVersion, setThemeVersion] = createSignal(0);

  let currentRunId = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let stopWatchingTheme: (() => void) | undefined;
  const [retryKey, setRetryKey] = createSignal(0);

  let inlineWrapperRef: HTMLDivElement | undefined;
  let fullscreenWrapperRef: HTMLDivElement | undefined;
  let fullscreenPanZoom: SvgPanZoomInstance | null = null;

  const showToast = (kind: ToastKind, msg: string): void => {
    setToast({ kind, msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), TOAST_MS);
  };

  // Mount a fresh SVG into a wrapper via DOMParser (no innerHTML swap which
  // would corrupt svg-pan-zoom listeners). Sets numeric width/height —
  // required by svg-pan-zoom.
  const mountSvgInto = (
    wrapper: HTMLElement | undefined,
    svgText: string,
  ): SVGSVGElement | null => {
    if (!wrapper) return null;
    const { w, h } = getIntrinsicSize(svgText);
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const newSvg = doc.querySelector("svg");
    if (!newSvg) return null;
    newSvg.setAttribute("width", String(w));
    newSvg.setAttribute("height", String(h));
    newSvg.removeAttribute("style"); // strip mermaid's max-width:1020px
    const old = wrapper.querySelector("svg");
    if (old) wrapper.replaceChild(newSvg, old);
    else wrapper.appendChild(newSvg);
    return newSvg as unknown as SVGSVGElement;
  };

  const initFullscreenPanZoom = async (svgEl: SVGSVGElement): Promise<void> => {
    if (fullscreenPanZoom) {
      try {
        fullscreenPanZoom.destroy();
      } catch {
        /* swallow */
      }
      fullscreenPanZoom = null;
    }
    try {
      const svgPanZoom = await loadSvgPanZoom();
      if (!fullscreenOpen() || props.disposed.v) return;
      fullscreenPanZoom = svgPanZoom(svgEl, {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        mouseWheelZoomEnabled: true,
        dblClickZoomEnabled: true,
        fit: true,
        center: true,
        minZoom: 0.3,
        maxZoom: 8,
      });
    } catch {
      fullscreenPanZoom = null;
    }
  };

  const runRender = async (src: string): Promise<void> => {
    if (props.disposed.v) return;
    if (!src.trim()) {
      setSvg("");
      setError("");
      setState("idle");
      return;
    }
    const id = ++currentRunId;
    setState("loading");
    try {
      const safe = await renderMermaidSafe(src);
      if (props.disposed.v) return;
      if (id !== currentRunId) return;
      setSvg(safe);
      setError("");
      setState("ok");
    } catch (err) {
      if (props.disposed.v) return;
      if (id !== currentRunId) return;
      setError(firstLine(err instanceof Error ? err.message : String(err)));
      setState(isLoaderError(err) ? "loader-err" : "err");
    }
  };

  const scheduleRender = (src: string): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void runRender(src);
    }, DEBOUNCE_MS);
  };

  createEffect(() => {
    const src = props.code();
    retryKey();
    themeVersion();
    scheduleRender(src);
  });

  onMount(() => {
    stopWatchingTheme = watchSystemTheme(() => {
      __resetMermaidCache();
      setThemeVersion((v) => v + 1);
    });
  });

  // Inline preview: static SVG. CSS sizes it. No pan-zoom on inline.
  createEffect(() => {
    if (state() !== "ok") return;
    const s = svg();
    if (!s) return;
    mountSvgInto(inlineWrapperRef, s);
  });

  // Fullscreen pan-zoom — only when fullscreen is open and SVG is ready.
  // Use rAF (not microtask): svg-pan-zoom's fit:true reads
  // getBoundingClientRect, which is 0×0 before first layout.
  createEffect(() => {
    if (!fullscreenOpen()) return;
    const s = svg();
    if (!s) return;
    requestAnimationFrame(() => {
      const el = mountSvgInto(fullscreenWrapperRef, s);
      if (el) {
        void initFullscreenPanZoom(el);
      }
    });
  });

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && fullscreenOpen()) {
      e.preventDefault();
      setFullscreenOpen(false);
    }
  };

  createEffect(() => {
    if (fullscreenOpen()) {
      window.addEventListener("keydown", onKey);
    } else {
      window.removeEventListener("keydown", onKey);
      if (fullscreenPanZoom) {
        try {
          fullscreenPanZoom.destroy();
        } catch {
          /* swallow */
        }
        fullscreenPanZoom = null;
      }
    }
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
    if (toastTimer) clearTimeout(toastTimer);
    stopWatchingTheme?.();
    window.removeEventListener("keydown", onKey);
    if (fullscreenPanZoom) {
      try {
        fullscreenPanZoom.destroy();
      } catch {
        /* swallow */
      }
      fullscreenPanZoom = null;
    }
    // NodeView.destroy() owns props.disposed — never write it from here.
  });

  const onRetry = (): void => {
    __resetMermaidCache();
    setRetryKey((k) => k + 1);
  };

  const handleCopySvg = async (): Promise<void> => {
    const s = svg();
    if (!s) return;
    try {
      await copyAsSvg(s);
      showToast("ok", "SVG copied to clipboard");
    } catch (e) {
      showToast("err", `Copy SVG failed: ${firstLine(String(e))}`);
    }
  };

  const handleCopyPng = async (): Promise<void> => {
    const s = svg();
    if (!s) return;
    try {
      await copyAsPng(s);
      showToast("ok", "PNG copied to clipboard");
    } catch (e) {
      showToast("err", `Copy PNG failed: ${firstLine(String(e))}`);
    }
  };

  return (
    <div class="mermaid-block__preview">
      <Show when={state() === "loading"}>
        <div class="mermaid-block__status">Rendering…</div>
      </Show>

      <Show when={state() === "ok" && svg()}>
        <div class="mermaid-block__ok">
          <div class="mermaid-block__toolbar">
            <button
              type="button"
              onClick={() => void handleCopySvg()}
              title="Copy SVG to clipboard"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={() => void handleCopyPng()}
              title="Copy PNG to clipboard"
            >
              PNG
            </button>
            <button
              type="button"
              onClick={() => setFullscreenOpen(true)}
              title="Open fullscreen"
            >
              ⤢
            </button>
          </div>
          <div
            class="mermaid-block__svg-wrapper"
            ref={inlineWrapperRef}
            onDblClick={() => setFullscreenOpen(true)}
          />
        </div>
      </Show>

      <Show when={state() === "err"}>
        <div class="mermaid-block__error">
          <div class="mermaid-block__error-title">Mermaid syntax error</div>
          <div class="mermaid-block__error-msg">{error()}</div>
        </div>
      </Show>

      <Show when={state() === "loader-err"}>
        <div class="mermaid-block__error">
          <div class="mermaid-block__error-title">
            Mermaid library failed to load
          </div>
          <div class="mermaid-block__error-msg">{error()}</div>
          <button
            type="button"
            class="mermaid-block__retry"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      </Show>

      <Show when={state() === "idle"}>
        <div class="mermaid-block__status mermaid-block__status--muted">
          Empty mermaid block
        </div>
      </Show>

      <Show when={toast()}>
        {(t) => (
          <div
            class={`mermaid-block__toast mermaid-block__toast--${t().kind}`}
          >
            {t().msg}
          </div>
        )}
      </Show>

      <Show when={fullscreenOpen()}>
        <Portal>
          <div class="mermaid-fullscreen" role="dialog" aria-modal="true">
            <div class="mermaid-fullscreen__toolbar">
              <button type="button" onClick={() => void handleCopySvg()}>
                Copy SVG
              </button>
              <button type="button" onClick={() => void handleCopyPng()}>
                Copy PNG
              </button>
              <button
                type="button"
                onClick={() => setFullscreenOpen(false)}
              >
                Close (Esc)
              </button>
            </div>
            <div
              class="mermaid-fullscreen__svg-wrapper"
              ref={fullscreenWrapperRef}
            />
          </div>
        </Portal>
      </Show>
    </div>
  );
};

export default MermaidBlock;
