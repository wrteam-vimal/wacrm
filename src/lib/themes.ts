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

export function getPublicStorageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const baseUrl = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
  return `${baseUrl}/storage/v1/object/public/avatars/${path}`;
}

export function getRelativeStoragePath(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null;
  const cleanUrl = urlOrPath.split("?")[0];
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return cleanUrl;
  }
  try {
    const url = new URL(cleanUrl);
    const parts = url.pathname.split("/public/avatars/");
    if (parts.length > 1) {
      return parts[1];
    }
  } catch {}
  return cleanUrl;
}
