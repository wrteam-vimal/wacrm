"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_THEME,
  isThemeId,
  type ThemeId,
  getPublicStorageUrl,
  getRelativeStoragePath,
} from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  showLogo: boolean;
  setShowLogo: (show: boolean) => void;
  showTitle: boolean;
  setShowTitle: (show: boolean) => void;
  titleText: string;
  setTitleText: (title: string) => void;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  faviconUrl: string | null;
  setFaviconUrl: (url: string | null) => void;
  loaderType: "shimmer" | "custom";
  setLoaderType: (type: "shimmer" | "custom") => void;
  loaderImageUrl: string | null;
  setLoaderImageUrl: (url: string | null) => void;
  persistSettings: (settings: {
    theme: ThemeId;
    customColor: string;
    showLogo: boolean;
    showTitle: boolean;
    titleText: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    loaderType: "shimmer" | "custom";
    loaderImageUrl: string | null;
  }) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyCustomColor(color: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", color);
  root.style.setProperty("--primary-hover", `color-mix(in srgb, ${color} 85%, white)`);
  root.style.setProperty("--primary-soft", `color-mix(in srgb, ${color} 12%, transparent)`);
  root.style.setProperty("--primary-soft-2", `color-mix(in srgb, ${color} 20%, transparent)`);
  root.style.setProperty("--sidebar-primary", color);
  root.style.setProperty("--sidebar-ring", color);
  root.style.setProperty("--ring", color);
  root.style.setProperty("--chart-1", color);
}

function removeCustomColorStyles() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--primary-hover");
  root.style.removeProperty("--primary-soft");
  root.style.removeProperty("--primary-soft-2");
  root.style.removeProperty("--sidebar-primary");
  root.style.removeProperty("--sidebar-ring");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--chart-1");
}

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeId(fromAttr)) return fromAttr;
  return DEFAULT_THEME;
}

interface InitialThemeSettings {
  theme?: string;
  custom_color?: string;
  show_logo?: boolean;
  show_title?: boolean;
  title_text?: string;
  logo_url?: string;
  favicon_url?: string;
  loader_type?: string;
  loader_image_url?: string;
}

export function ThemeProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: InitialThemeSettings;
}) {
  const supabase = createClient();

  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (initialSettings?.theme && isThemeId(initialSettings.theme)) {
      return initialSettings.theme as ThemeId;
    }
    return readInitialTheme();
  });
  const [customColor, setCustomColorState] = useState<string>(
    initialSettings?.custom_color || "#7c3aed"
  );
  const [showLogo, setShowLogoState] = useState<boolean>(
    initialSettings?.show_logo !== undefined ? initialSettings.show_logo : true
  );
  const [showTitle, setShowTitleState] = useState<boolean>(
    initialSettings?.show_title !== undefined ? initialSettings.show_title : true
  );
  const [titleText, setTitleTextState] = useState<string>(
    initialSettings?.title_text || "WRTeam Whatsapp CRM"
  );
  const [logoUrl, setLogoUrlState] = useState<string | null>(() =>
    getPublicStorageUrl(initialSettings?.logo_url || null)
  );
  const [faviconUrl, setFaviconUrlState] = useState<string | null>(() =>
    getPublicStorageUrl(initialSettings?.favicon_url || null)
  );
  const [loaderType, setLoaderTypeState] = useState<"shimmer" | "custom">(
    (initialSettings?.loader_type as "shimmer" | "custom") || "shimmer"
  );
  const [loaderImageUrl, setLoaderImageUrlState] = useState<string | null>(() =>
    getPublicStorageUrl(initialSettings?.loader_image_url || null)
  );

  // Helper to save setting to the database (upsert by account_id)
  const saveSetting = useCallback(async (updates: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.account_id) return;

      const { data: existing } = await supabase
        .from("appearance_settings")
        .select("id")
        .eq("account_id", profile.account_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("appearance_settings")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("appearance_settings")
          .insert({
            account_id: profile.account_id,
            ...updates,
          });
      }
    } catch (err) {
      console.warn("Failed to save appearance settings to database:", err);
    }
  }, [supabase]);

  // Load settings from database on mount (if authenticated)
  useEffect(() => {
    let active = true;

    async function loadDbSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("account_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.account_id || !active) return;

        const { data: appSettings } = await supabase
          .from("appearance_settings")
          .select("*")
          .eq("account_id", profile.account_id)
          .maybeSingle();

        if (appSettings && active) {
          setThemeState(appSettings.theme || DEFAULT_THEME);
          setCustomColorState(appSettings.custom_color || "#7c3aed");
          setShowLogoState(appSettings.show_logo);
          setShowTitleState(appSettings.show_title);
          setTitleTextState(appSettings.title_text || "WRTeam Whatsapp CRM");
          setLogoUrlState(getPublicStorageUrl(appSettings.logo_url));
          setFaviconUrlState(getPublicStorageUrl(appSettings.favicon_url));
          setLoaderTypeState((appSettings.loader_type as "shimmer" | "custom") || "shimmer");
          setLoaderImageUrlState(getPublicStorageUrl(appSettings.loader_image_url));

          if (typeof document !== "undefined") {
            document.documentElement.dataset.theme = appSettings.theme || DEFAULT_THEME;
            if (appSettings.theme === "custom" && appSettings.custom_color) {
              applyCustomColor(appSettings.custom_color);
            } else {
              removeCustomColorStyles();
            }

            const favicon = getPublicStorageUrl(appSettings.favicon_url);
            if (favicon) {
              const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
              if (link) {
                link.href = `${favicon}?t=${Date.now()}`;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load appearance settings from database:", err);
      }
    }

    loadDbSettings();

    return () => {
      active = false;
    };
  }, [supabase]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = next;
        if (next === "custom") {
          applyCustomColor(customColor);
        } else {
          removeCustomColorStyles();
        }
      }
    },
    [customColor]
  );

  const setCustomColor = useCallback(
    (color: string) => {
      setCustomColorState(color);
      if (typeof document !== "undefined" && document.documentElement.dataset.theme === "custom") {
        applyCustomColor(color);
      }
    },
    []
  );

  const setShowLogo = useCallback(
    (show: boolean) => {
      setShowLogoState(show);
    },
    []
  );

  const setShowTitle = useCallback(
    (show: boolean) => {
      setShowTitleState(show);
    },
    []
  );

  const setTitleText = useCallback(
    (title: string) => {
      setTitleTextState(title);
    },
    []
  );

  const setLogoUrl = useCallback(
    (url: string | null) => {
      setLogoUrlState(url);
    },
    []
  );

  const setFaviconUrl = useCallback(
    (url: string | null) => {
      setFaviconUrlState(url);
      if (typeof document !== "undefined") {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (link) {
          link.href = url ? `${url}?t=${Date.now()}` : "/icon";
        }
      }
    },
    []
  );

  const setLoaderType = useCallback(
    (type: "shimmer" | "custom") => {
      setLoaderTypeState(type);
    },
    []
  );

  const setLoaderImageUrl = useCallback(
    (url: string | null) => {
      setLoaderImageUrlState(url);
    },
    []
  );

  const persistSettings = useCallback(async (settings: {
    theme: ThemeId;
    customColor: string;
    showLogo: boolean;
    showTitle: boolean;
    titleText: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    loaderType: "shimmer" | "custom";
    loaderImageUrl: string | null;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.account_id) throw new Error("No organization account linked");

      const { data: existing } = await supabase
        .from("appearance_settings")
        .select("id")
        .eq("account_id", profile.account_id)
        .maybeSingle();

      const dbPayload = {
        theme: settings.theme,
        custom_color: settings.customColor,
        show_logo: settings.showLogo,
        show_title: settings.showTitle,
        title_text: settings.titleText,
        logo_url: getRelativeStoragePath(settings.logoUrl),
        favicon_url: getRelativeStoragePath(settings.faviconUrl),
        loader_type: settings.loaderType,
        loader_image_url: getRelativeStoragePath(settings.loaderImageUrl),
        updated_at: new Date().toISOString(),
      };

      let saveError;
      if (existing) {
        const { error } = await supabase
          .from("appearance_settings")
          .update(dbPayload)
          .eq("id", existing.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("appearance_settings")
          .insert({
            account_id: profile.account_id,
            ...dbPayload,
          });
        saveError = error;
      }

      if (saveError) throw saveError;

      // Update client states
      setThemeState(settings.theme);
      setCustomColorState(settings.customColor);
      setShowLogoState(settings.showLogo);
      setShowTitleState(settings.showTitle);
      setTitleTextState(settings.titleText);
      setLogoUrlState(settings.logoUrl);
      setFaviconUrlState(settings.faviconUrl);
      setLoaderTypeState(settings.loaderType);
      setLoaderImageUrlState(settings.loaderImageUrl);

      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = settings.theme;
        if (settings.theme === "custom") {
          applyCustomColor(settings.customColor);
        } else {
          removeCustomColorStyles();
        }

        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (link) {
          // For local assets the file is replaced in-place; append a timestamp
          // only when a URL is available to bust any CDN/proxy caches.
          link.href = settings.faviconUrl
            ? `${settings.faviconUrl.split("?")[0]}?t=${Date.now()}`
            : "/icon";
        }
      }

      // LocalStorage removed, database is the sole source of truth.
    } catch (err) {
      console.warn("Failed to save settings:", err);
      throw err;
    }
  }, [supabase]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        customColor,
        setCustomColor,
        showLogo,
        setShowLogo,
        showTitle,
        setShowTitle,
        titleText,
        setTitleText,
        logoUrl,
        setLogoUrl,
        faviconUrl,
        setFaviconUrl,
        loaderType,
        setLoaderType,
        loaderImageUrl,
        setLoaderImageUrl,
        persistSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => { },
      customColor: "#7c3aed",
      setCustomColor: () => { },
      showLogo: true,
      setShowLogo: () => { },
      showTitle: true,
      setShowTitle: () => { },
      titleText: "WRTeam Whatsapp CRM",
      setTitleText: () => { },
      logoUrl: null,
      setLogoUrl: () => { },
      faviconUrl: null,
      setFaviconUrl: () => { },
      loaderType: "shimmer",
      setLoaderType: () => { },
      loaderImageUrl: null,
      setLoaderImageUrl: () => { },
      persistSettings: async () => { },
    };
  }
  return ctx;
}
