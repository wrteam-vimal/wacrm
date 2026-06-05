import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { DEFAULT_THEME, getPublicStorageUrl } from "@/lib/themes";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const defaultMeta: Metadata = {
    title: {
      default: "wacrm",
      template: "%s — wacrm",
    },
    description: "Self-hostable WRTeam Whatsapp CRM.",
    robots: {
      index: false,
      follow: false,
    },
    icons: {
      icon: [{ url: "/icon" }],
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };

  try {
    logger.info("LAYOUT_METADATA", "Starting metadata generation...");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let seoData = null;
    let appearanceData = null;
    
    if (user) {
      logger.info("LAYOUT_METADATA", `Authenticated user found: ${user.email}`);
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.account_id) {
        const [seoRes, appRes] = await Promise.all([
          supabase
            .from("seo_settings")
            .select("*")
            .eq("account_id", profile.account_id)
            .maybeSingle(),
          supabase
            .from("appearance_settings")
            .select("*")
            .eq("account_id", profile.account_id)
            .maybeSingle()
        ]);
        seoData = seoRes.data;
        appearanceData = appRes.data;
      }
    } else {
      logger.info("LAYOUT_METADATA", "No authenticated user session found.");
    }

    if (!seoData) {
      logger.info("LAYOUT_METADATA", "Fetching default SEO settings row...");
      const { data } = await supabase
        .from("seo_settings")
        .select("*")
        .limit(1);
      if (data && data.length > 0) {
        seoData = data[0];
      }
    }

    if (!appearanceData) {
      logger.info("LAYOUT_METADATA", "Fetching default appearance settings row...");
      const { data } = await supabase
        .from("appearance_settings")
        .select("*")
        .limit(1);
      if (data && data.length > 0) {
        appearanceData = data[0];
      }
    }

    const title = seoData?.meta_title || "wacrm";
    const description = seoData?.meta_description || "Self-hostable WRTeam Whatsapp CRM.";
    const keywords = seoData?.meta_keywords || "";
    
    let faviconUrl = "/icon";
    if (appearanceData?.favicon_url) {
      faviconUrl = getPublicStorageUrl(appearanceData.favicon_url) || "/icon";
    }

    logger.info("LAYOUT_METADATA", `Metadata compiled successfully. Title: ${title}, Favicon: ${faviconUrl}`);

    return {
      title: {
        default: title,
        template: `%s — ${title}`,
      },
      description,
      keywords,
      robots: {
        index: false,
        follow: false,
      },
      icons: {
        icon: [{ url: faviconUrl }],
      },
      openGraph: {
        title: seoData?.og_title || title,
        description: seoData?.og_description || description,
        images: seoData?.og_image_url ? [{ url: seoData.og_image_url }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: seoData?.twitter_title || seoData?.og_title || title,
        description: seoData?.twitter_description || seoData?.og_description || description,
        images: seoData?.og_image_url ? [seoData.og_image_url] : [],
      },
    };
  } catch (err) {
    logger.warn("LAYOUT_METADATA", "Failed to generate SEO metadata from database, using defaults", err);
    return defaultMeta;
  }
}

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
};

// Generates dynamic script body for server-side theme initialization
function getThemeBootScript(theme: string, customColor: string, faviconUrl: string) {
  return `
(function(){
  try {
    var theme = ${JSON.stringify(theme)};
    document.documentElement.dataset.theme = theme;

    if (theme === "custom") {
      var customColor = ${JSON.stringify(customColor)};
      if (customColor) {
        var root = document.documentElement;
        root.style.setProperty("--primary", customColor);
        root.style.setProperty("--primary-hover", "color-mix(in srgb, " + customColor + " 85%, white)");
        root.style.setProperty("--primary-soft", "color-mix(in srgb, " + customColor + " 12%, transparent)");
        root.style.setProperty("--primary-soft-2", "color-mix(in srgb, " + customColor + " 20%, transparent)");
        root.style.setProperty("--sidebar-primary", customColor);
        root.style.setProperty("--sidebar-ring", customColor);
        root.style.setProperty("--ring", customColor);
        root.style.setProperty("--chart-1", customColor);
      }
    }

    var favicon = ${JSON.stringify(faviconUrl)};
    if (favicon) {
      var link = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = favicon + "?t=" + Date.now();
      } else {
        var newLink = document.createElement("link");
        newLink.rel = "icon";
        newLink.href = favicon + "?t=" + Date.now();
        document.head.appendChild(newLink);
      }
    }
  } catch (_e) {}
})();
  `;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let customHeaderHtml = "";
  let dbTheme = DEFAULT_THEME;
  let dbCustomColor = "";
  let dbFaviconUrl = "";
  let appearanceData: any = null;

  try {
    logger.info("ROOT_LAYOUT", "Starting RootLayout render...");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let profile = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = data;
    }

    let seoData = null;

    if (profile?.account_id) {
      const [seoRes, appRes] = await Promise.all([
        supabase
          .from("seo_settings")
          .select("*")
          .eq("account_id", profile.account_id)
          .maybeSingle(),
        supabase
          .from("appearance_settings")
          .select("*")
          .eq("account_id", profile.account_id)
          .maybeSingle()
      ]);
      seoData = seoRes.data;
      appearanceData = appRes.data;
    }

    if (!seoData) {
      const { data } = await supabase
        .from("seo_settings")
        .select("*")
        .limit(1);
      if (data && data.length > 0) {
        seoData = data[0];
      }
    }

    if (!appearanceData) {
      const { data } = await supabase
        .from("appearance_settings")
        .select("*")
        .limit(1);
      if (data && data.length > 0) {
        appearanceData = data[0];
      }
    }

    if (seoData?.custom_header_html) {
      customHeaderHtml = seoData.custom_header_html;
    }

    if (appearanceData) {
      dbTheme = appearanceData.theme || DEFAULT_THEME;
      dbCustomColor = appearanceData.custom_color || "";
      dbFaviconUrl = getPublicStorageUrl(appearanceData.favicon_url) || "";
    }
    logger.info("ROOT_LAYOUT", `Loaded settings for layout. Theme: ${dbTheme}, Has custom header scripts: ${!!customHeaderHtml}`);
  } catch (err) {
    logger.error("ROOT_LAYOUT", "Failed to load layout settings from database:", err);
  }

  return (
    <html
      lang="en"
      data-theme={dbTheme}
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeBootScript(dbTheme, dbCustomColor, dbFaviconUrl) }}
        />
        {/* Inject custom header script from settings */}
        {customHeaderHtml && (
          <meta dangerouslySetInnerHTML={{ __html: customHeaderHtml }} />
        )}
      </head>
      <body className="min-h-full bg-background text-foreground font-sans" suppressHydrationWarning>
        <ThemeProvider initialSettings={appearanceData || undefined}>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "rgb(30 41 59)",
                border: "1px solid rgb(51 65 85)",
                color: "white",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
