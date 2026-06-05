"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, AlertTriangle, Copy, Check, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useTheme } from "@/hooks/use-theme";
import { type ThemeId, DEFAULT_THEME } from "@/lib/themes";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// SQL command string to copy-paste if table is missing
const MIGRATION_SQL = `-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS appearance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'violet',
  custom_color TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_title BOOLEAN NOT NULL DEFAULT true,
  title_text TEXT NOT NULL DEFAULT 'WRTeam Whatsapp CRM',
  logo_url TEXT,
  favicon_url TEXT,
  loader_type TEXT NOT NULL DEFAULT 'shimmer',
  loader_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT appearance_settings_account_id_key UNIQUE (account_id)
);

ALTER TABLE appearance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appearance_settings_select ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_insert ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_update ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_delete ON appearance_settings;

CREATE POLICY appearance_settings_select ON appearance_settings FOR SELECT
  USING (true);

CREATE POLICY appearance_settings_insert ON appearance_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY appearance_settings_update ON appearance_settings FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY appearance_settings_delete ON appearance_settings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON appearance_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appearance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

/**
 * Appearance panel — dynamic color theme and brand assets configuration.
 *
 * Persists layout options, custom color themes, logo URL, and favicon URL
 * inside Supabase Database (appearance_settings). All media assets are saved
 * to the local server filesystem under public/assets/ via /api/appearance/upload.
 */
export function AppearancePanel() {
  const { accountId, canEditSettings } = useAuth();
  const supabase = createClient();

  const {
    theme,
    customColor,
    showLogo,
    showTitle,
    titleText,
    logoUrl,
    faviconUrl,
    loaderType,
    loaderImageUrl,
    persistSettings,
  } = useTheme();

  // Temporary local state variables for editing
  const [tempTheme, setTempTheme] = useState<ThemeId>(theme);
  const [tempCustomColor, setTempCustomColor] = useState<string>(customColor);
  const [tempShowLogo, setTempShowLogo] = useState<boolean>(showLogo);
  const [tempShowTitle, setTempShowTitle] = useState<boolean>(showTitle);
  const [tempTitleText, setTempTitleText] = useState<string>(titleText);
  const [tempLogoUrl, setTempLogoUrl] = useState<string | null>(logoUrl);
  const [tempFaviconUrl, setTempFaviconUrl] = useState<string | null>(faviconUrl);
  const [tempLoaderType, setTempLoaderType] = useState<"shimmer" | "custom">(loaderType);
  const [tempLoaderImageUrl, setTempLoaderImageUrl] = useState<string | null>(loaderImageUrl);
  const [saving, setSaving] = useState(false);

  // Synchronize local states with global context when settings load
  useEffect(() => {
    setTempTheme(theme);
    setTempCustomColor(customColor);
    setTempShowLogo(showLogo);
    setTempShowTitle(showTitle);
    setTempTitleText(titleText);
    setTempLogoUrl(logoUrl);
    setTempFaviconUrl(faviconUrl);
    setTempLoaderType(loaderType);
    setTempLoaderImageUrl(loaderImageUrl);
  }, [theme, customColor, showLogo, showTitle, titleText, logoUrl, faviconUrl, loaderType, loaderImageUrl]);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const loaderInputRef = useRef<HTMLInputElement>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLoader, setUploadingLoader] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleClearCache = async () => {
    if (!canEditSettings) {
      toast.error("You do not have permission to clear caches");
      return;
    }

    setClearingCache(true);
    const toastId = toast.loading("Clearing system cache...");

    try {
      // 1. Clear server-side Next.js cache via API
      const res = await fetch("/api/cache/clear", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Server cache clear failed");
      }

      // 2. Clear client-side sessionStorage
      sessionStorage.clear();

      // 3. Selectively clear client-side localStorage
      // We retain keys starting with "sb-" to prevent logging the user out.
      const keysToKeep = ["sb-"];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const shouldKeep = keysToKeep.some((prefix) => key.startsWith(prefix));
          if (!shouldKeep) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      toast.success("Cache cleared successfully", { id: toastId });

      // 4. Force window reload to re-fetch/re-apply state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error("Failed to clear cache", {
        id: toastId,
        description: err.message || "An unexpected error occurred",
      });
    } finally {
      setClearingCache(false);
    }
  };

  // Check if table exists on mount
  useEffect(() => {
    if (!accountId) return;
    async function checkTable() {
      try {
        const { error } = await supabase
          .from("appearance_settings")
          .select("id")
          .limit(1);
        if (error && (error.code === "42P01" || error.code === "PGRST205")) {
          setTableMissing(true);
        }
      } catch {}
    }
    checkTable();
  }, [accountId, supabase]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    toast.success("SQL schema copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "favicon" | "loader",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canEditSettings) {
      toast.error("You do not have permission to upload brand assets");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file type", {
        description: "Please upload an image file.",
      });
      return;
    }

    if (type === "logo") setUploadingLogo(true);
    else if (type === "favicon") setUploadingFavicon(true);
    else setUploadingLoader(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/appearance/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Bust the browser's image cache by appending a timestamp to the src.
      const urlWithBust = `${data.url}?t=${Date.now()}`;

      if (type === "logo") {
        setTempLogoUrl(urlWithBust);
        toast.success("Logo uploaded successfully");
      } else if (type === "favicon") {
        setTempFaviconUrl(urlWithBust);
        toast.success("Favicon uploaded successfully");
      } else {
        setTempLoaderImageUrl(urlWithBust);
        toast.success("Loader graphic uploaded successfully");
      }
    } catch (err: any) {
      toast.error("Upload failed", {
        description: err.message || "Something went wrong",
      });
    } finally {
      if (type === "logo") {
        setUploadingLogo(false);
        if (logoInputRef.current) logoInputRef.current.value = "";
      } else if (type === "favicon") {
        setUploadingFavicon(false);
        if (faviconInputRef.current) faviconInputRef.current.value = "";
      } else {
        setUploadingLoader(false);
        if (loaderInputRef.current) loaderInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (type: "logo" | "favicon" | "loader") => {
    if (!canEditSettings) {
      toast.error("You do not have permission to modify brand assets");
      return;
    }

    if (type === "logo") {
      setTempLogoUrl(null);
      toast.success("Logo reset to default");
    } else if (type === "favicon") {
      setTempFaviconUrl(null);
      toast.success("Favicon reset to default");
    } else {
      setTempLoaderImageUrl(null);
      toast.success("Custom loader graphic reset to default");
    }
  };

  const handleSaveSettings = async () => {
    if (!canEditSettings) {
      toast.error("You do not have permission to edit settings");
      return;
    }
    setSaving(true);
    try {
      await persistSettings({
        theme: tempTheme,
        customColor: tempCustomColor,
        showLogo: tempShowLogo,
        showTitle: tempShowTitle,
        titleText: tempTitleText,
        logoUrl: tempLogoUrl,
        faviconUrl: tempFaviconUrl,
        loaderType: tempLoaderType,
        loaderImageUrl: tempLoaderImageUrl,
      });
      toast.success("Appearance settings saved successfully");
    } catch (err) {
      console.error("Failed to save appearance settings:", err);
      toast.error("Failed to save appearance settings");
    } finally {
      setSaving(false);
    }
  };

  if (tableMissing) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="size-6 shrink-0" />
            <CardTitle>Database Migration Required</CardTitle>
          </div>
          <CardDescription className="text-slate-300 mt-2">
            The appearance configurations feature requires a new database table. Since your
            Supabase database is remotely hosted, please run the following SQL script
            in your Supabase Dashboard SQL Editor to initialize the table and configure permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative rounded-lg bg-slate-950 p-4 border border-slate-800">
            <Button
              size="sm"
              variant="outline"
              className="absolute right-4 top-4 border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
              onClick={handleCopySQL}
            >
              {copied ? <Check className="size-4 mr-2 text-green-400" /> : <Copy className="size-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy SQL'}
            </Button>
            <pre className="overflow-x-auto text-xs text-slate-400 font-mono pr-24 max-h-[350px] leading-relaxed">
              {MIGRATION_SQL}
            </pre>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => window.location.reload()}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              I have run the SQL, Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Theme Color selection */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div>
          <h3 className="text-md font-semibold text-white">Custom Accent Color</h3>
          <p className="mt-1 text-sm text-slate-400">
            Define your own brand color directly via the color picker dialog (RGB/Hex).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center cursor-pointer hover:border-slate-600 transition-colors">
            <input
              type="color"
              value={tempTheme === "custom" ? tempCustomColor : "#7c3aed"}
              onChange={(e) => {
                if (!canEditSettings) {
                  toast.error("You do not have permission to modify settings");
                  return;
                }
                setTempTheme("custom");
                setTempCustomColor(e.target.value);
              }}
              disabled={!canEditSettings}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            />
            <span
              className="h-8 w-8 rounded-full border border-slate-700 shadow-sm"
              style={{ backgroundColor: tempTheme === "custom" ? tempCustomColor : "#7c3aed" }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">
              {tempTheme === "custom" ? "Custom Color Active" : "Click to select color"}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {tempTheme === "custom" ? tempCustomColor.toUpperCase() : "Hex Dialog Color"}
            </span>
          </div>
          {tempTheme === "custom" && canEditSettings && (
            <button
              type="button"
              onClick={() => {
                setTempTheme(DEFAULT_THEME);
              }}
              className="ml-auto text-xs text-slate-400 hover:text-white underline"
            >
              Reset to default
            </button>
          )}
        </div>
      </section>

      {/* Header and Logo configurations */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-6">
        <div>
          <h3 className="text-md font-semibold text-white">Sidebar Header Logo & Title</h3>
          <p className="mt-1 text-sm text-slate-400">
            Customize the visibility and assets for the sidebar's top logo header row.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Logo visibility */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white block">Show Logo</span>
                <span className="text-xs text-slate-400">Display the branding logo in the sidebar</span>
              </div>
              <Switch
                checked={tempShowLogo}
                onCheckedChange={setTempShowLogo}
                disabled={!canEditSettings}
              />
            </div>

            {tempShowLogo && (
              <div className="space-y-3 pt-4 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Custom Logo Image</span>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                    {tempLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tempLogoUrl || undefined}
                        alt="Custom Logo"
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <MessageSquare className="h-6 w-6 text-slate-500" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUpload(e, "logo")}
                      disabled={!canEditSettings}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo || !canEditSettings}
                      >
                        {uploadingLogo ? "Uploading..." : tempLogoUrl ? "Change logo" : "Upload logo"}
                      </Button>
                      {tempLogoUrl && canEditSettings && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove("logo")}
                          className="text-slate-400 hover:text-white"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 truncate">PNG, JPG, SVG or WEBP. Saved in Supabase Storage.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Title visibility */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white block">Show Title</span>
                <span className="text-xs text-slate-400">Display the app title text in the sidebar</span>
              </div>
              <Switch
                checked={tempShowTitle}
                onCheckedChange={setTempShowTitle}
                disabled={!canEditSettings}
              />
            </div>

            {tempShowTitle && (
              <div className="space-y-3 pt-4 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Custom Title Text</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempTitleText}
                    onChange={(e) => {
                      if (!canEditSettings) return;
                      setTempTitleText(e.target.value);
                    }}
                    placeholder="WRTeam Whatsapp CRM"
                    disabled={!canEditSettings}
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-white"
                  />
                  {tempTitleText !== "WRTeam Whatsapp CRM" && canEditSettings && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTempTitleText("WRTeam Whatsapp CRM")}
                      className="text-slate-400 hover:text-white"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Favicon Configuration */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div>
          <h3 className="text-md font-semibold text-white">Favicon Icon</h3>
          <p className="mt-1 text-sm text-slate-400">
            Customize the browser tab icon.
          </p>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
          <div className="h-10 w-10 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
            {tempFaviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tempFaviconUrl || undefined}
                alt="Custom Favicon"
                className="h-6 w-6 object-contain"
              />
            ) : (
              <div className="h-5 w-5 bg-primary rounded" />
            )}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e, "favicon")}
              disabled={!canEditSettings}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => faviconInputRef.current?.click()}
                disabled={uploadingFavicon || !canEditSettings}
              >
                {uploadingFavicon ? "Uploading..." : tempFaviconUrl ? "Change favicon" : "Upload favicon"}
              </Button>
              {tempFaviconUrl && canEditSettings && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove("favicon")}
                  className="text-slate-400 hover:text-white"
                >
                  Reset
                </Button>
              )}
            </div>
            <span className="text-[10px] text-slate-500 truncate">ICO, PNG or SVG. Saved in Supabase Storage.</span>
          </div>
        </div>
      </section>

      {/* Loading Screen Configuration */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div>
          <h3 className="text-md font-semibold text-white">Loading Screen Configuration</h3>
          <p className="mt-1 text-sm text-slate-400">
            Customize the loading indicator and skeleton style across the application.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Loader Type</label>
            <RadioGroup
              value={tempLoaderType}
              onValueChange={(val) => {
                if (!canEditSettings) return;
                setTempLoaderType(val as "shimmer" | "custom");
              }}
              disabled={!canEditSettings}
              className="flex gap-6 mt-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shimmer" id="loader-shimmer" />
                <label htmlFor="loader-shimmer" className="text-sm text-slate-300 cursor-pointer">
                  Shimmer Skeleton (Recommended)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="custom" id="loader-custom" />
                <label htmlFor="loader-custom" className="text-sm text-slate-300 cursor-pointer">
                  Custom Graphic Loader
                </label>
              </div>
            </RadioGroup>
          </div>

          {tempLoaderType === "custom" && (
            <div className="space-y-3 pt-4 border-t border-slate-800/85">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Custom Loader Graphic (SVG, PNG, GIF)
              </span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                  {tempLoaderImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tempLoaderImageUrl || undefined}
                      alt="Custom Loader"
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <input
                    ref={loaderInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "loader")}
                    disabled={!canEditSettings}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loaderInputRef.current?.click()}
                      disabled={uploadingLoader || !canEditSettings}
                    >
                      {uploadingLoader ? "Uploading..." : tempLoaderImageUrl ? "Change graphic" : "Upload graphic"}
                    </Button>
                    {tempLoaderImageUrl && canEditSettings && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove("loader")}
                        className="text-slate-400 hover:text-white"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate">
                    SVG, PNG, GIF or JPG. Saved in Supabase Storage.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Save Settings Action Button */}
      <div className="flex justify-end pt-4 border-t border-slate-800/80">
        <Button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving || !canEditSettings}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>

      {/* System Cache section */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-md font-semibold text-white">System Cache</h3>
            <p className="mt-1 text-sm text-slate-400">
              Clear the site's local and server-side caches. This will purge Next.js server caches, clear your browser session state, and reload the application.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={handleClearCache}
            disabled={clearingCache || !canEditSettings}
            className="shrink-0 bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-200 hover:text-white"
          >
            {clearingCache ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Clearing Cache...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cache
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
