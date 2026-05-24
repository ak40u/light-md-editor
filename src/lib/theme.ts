export type SystemTheme = "light" | "dark";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

let stopSystemThemeSync: (() => void) | undefined;

export function getSystemTheme(): SystemTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export function applySystemTheme(theme = getSystemTheme()): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function watchSystemTheme(
  onChange: (theme: SystemTheme) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const media = window.matchMedia(DARK_MEDIA_QUERY);
  const handleChange = () => onChange(media.matches ? "dark" : "light");

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }

  media.addListener(handleChange);
  return () => media.removeListener(handleChange);
}

export function initSystemThemeSync(): void {
  stopSystemThemeSync?.();
  applySystemTheme();
  stopSystemThemeSync = watchSystemTheme((theme) => {
    applySystemTheme(theme);
  });
}
