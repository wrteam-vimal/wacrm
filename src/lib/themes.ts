/**
 * Single source of truth for the color-theme catalog.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `html[data-theme="..."]` blocks — that file is the one we paste
 * theme tokens into. This module only carries the metadata the UI
 * (settings picker, no-flash boot script) needs.
 *
 * Adding a new theme is a two-step change:
 *   1. Append the new `html[data-theme="<id>"]` block in globals.css
 *      with every token from an existing theme (use violet as the
 *      shape reference).
 *   2. Add an entry below. The order here drives the picker grid.
 */

export const THEME_IDS = [
  "default",
] as const;

export type ThemeId = (typeof THEME_IDS)[number] | "custom";

export const DEFAULT_THEME: ThemeId = "default";

export const STORAGE_KEY = "wacrm.theme";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static swatch color for the picker chip. Hard-coded so the boot
   * script / picker cards don't need a getComputedStyle round trip
   * before the page settles. Must mirror `--primary` of the same
   * theme in globals.css.
   */
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    ((THEME_IDS as ReadonlyArray<string>).includes(value) || value === "custom")
  );
}

/**
 * Returns a renderable URL for an asset path.
 * Assets are stored as local /assets/… paths in public/.
 * If a legacy full Supabase URL is still in the DB, it is returned as-is
 * so nothing breaks before the user re-saves.
 */
export function getPublicStorageUrl(path: string | null): string | null {
  if (!path) return null;
  // Already a full URL (legacy Supabase URL or data URI) — use as-is.
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  // Local asset path — ensure leading slash.
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Normalises a value before saving to the database.
 * – Local paths (/assets/…) are stored as-is (no domain).
 * – Legacy full Supabase URLs are stripped to just the relative path
 *   so the DB stays clean going forward.
 * – Query-string cache-busters are always removed.
 */
export function getRelativeStoragePath(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null;
  // Strip query string.
  const clean = urlOrPath.split("?")[0];
  // Already a local path.
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    return clean;
  }
  // Legacy Supabase URL — extract the part after /public/avatars/.
  try {
    const url = new URL(clean);
    const parts = url.pathname.split("/public/avatars/");
    if (parts.length > 1) return `/${parts[1]}`;
  } catch {}
  return clean;
}
