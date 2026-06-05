'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Globe,
  Search,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  Trash2,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HTMLEditor } from '@/components/ui/html-editor';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// SQL command string to copy-paste if table is missing
const MIGRATION_SQL = `-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  custom_header_html TEXT,
  rich_seo_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seo_settings_account_id_key UNIQUE (account_id)
);

ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_settings_select ON seo_settings;
DROP POLICY IF EXISTS seo_settings_insert ON seo_settings;
DROP POLICY IF EXISTS seo_settings_update ON seo_settings;
DROP POLICY IF EXISTS seo_settings_delete ON seo_settings;

CREATE POLICY seo_settings_select ON seo_settings FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY seo_settings_insert ON seo_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY seo_settings_update ON seo_settings FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY seo_settings_delete ON seo_settings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON seo_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON seo_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

export function SEOPanel() {
  const { accountId, canEditSettings, profileLoading, user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const [id, setId] = useState<string | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [twitterTitle, setTwitterTitle] = useState('');
  const [twitterDescription, setTwitterDescription] = useState('');
  const [customHeaderHtml, setCustomHeaderHtml] = useState('');
  const [richSeoContent, setRichSeoContent] = useState('');

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (!accountId) {
      setLoading(false);
      return;
    }

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('seo_settings')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle();

        if (error) {
          // PostgreSQL table missing error code
          if (error.code === '42P01' || error.code === 'PGRST205') {
            setTableMissing(true);
            return;
          }
          throw error;
        }

        if (data) {
          setId(data.id);
          setMetaTitle(data.meta_title || '');
          setMetaDescription(data.meta_description || '');
          setMetaKeywords(data.meta_keywords || '');
          setOgTitle(data.og_title || '');
          setOgDescription(data.og_description || '');
          setOgImageUrl(data.og_image_url || '');
          setTwitterTitle(data.twitter_title || '');
          setTwitterDescription(data.twitter_description || '');
          setCustomHeaderHtml(data.custom_header_html || '');
          setRichSeoContent(data.rich_seo_content || '');
        }
      } catch (err) {
        console.error('Error loading SEO settings:', err);
        toast.error('Failed to load SEO settings');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [accountId, profileLoading]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    toast.success('SQL schema copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accountId || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/seo-og-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      setOgImageUrl(publicUrl);
      toast.success('Open Graph image uploaded!');
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error('Account ID not found. Please check that your profile has been linked to an organization.');
      return;
    }
    if (!canEditSettings) {
      toast.error('You do not have permission to edit settings');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        account_id: accountId,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        meta_keywords: metaKeywords || null,
        og_title: ogTitle || null,
        og_description: ogDescription || null,
        og_image_url: ogImageUrl || null,
        twitter_title: twitterTitle || null,
        twitter_description: twitterDescription || null,
        custom_header_html: customHeaderHtml || null,
        rich_seo_content: richSeoContent || null,
      };

      let saveError;
      if (id) {
        const { error } = await supabase
          .from('seo_settings')
          .update(payload)
          .eq('id', id);
        saveError = error;
      } else {
        const { data, error } = await supabase
          .from('seo_settings')
          .insert(payload)
          .select('id')
          .single();
        saveError = error;
        if (data) setId(data.id);
      }

      if (saveError) throw saveError;
      toast.success('SEO settings saved successfully');
    } catch (err) {
      console.error('Failed to save SEO settings:', err);
      toast.error('Failed to save SEO settings');
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
            The SEO settings feature requires a new database table. Since your
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-3 text-slate-400">Loading settings...</span>
      </div>
    );
  }

  // Pre-fill fallback details for previews
  const displayTitle = metaTitle || 'wacrm — WhatsApp CRM';
  const displayDesc = metaDescription || 'Manage conversations, templates, and pipelines on WhatsApp Business API.';
  const displayUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm.example.com';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              <CardTitle className="text-white">Search Engine Optimization (SEO)</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Configure search engine parameters, Open Graph meta tags, header script injection, and rich content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Meta Title */}
            <div className="space-y-2">
              <Label htmlFor="meta-title" className="text-slate-200">
                Meta Title
              </Label>
              <Input
                id="meta-title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="wacrm — WhatsApp CRM"
                maxLength={60}
                disabled={saving || !canEditSettings}
              />
              <p className="text-xs text-slate-500">
                Recommended length: 50–60 characters. Current: {metaTitle.length}
              </p>
            </div>

            {/* Meta Description */}
            <div className="space-y-2">
              <Label htmlFor="meta-description" className="text-slate-200">
                Meta Description
              </Label>
              <Textarea
                id="meta-description"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Self-hostable CRM with shared inbox, contacts, sales pipelines, broadcasts..."
                rows={3}
                maxLength={160}
                disabled={saving || !canEditSettings}
              />
              <p className="text-xs text-slate-500">
                Recommended length: 120–160 characters. Current: {metaDescription.length}
              </p>
            </div>

            {/* Meta Keywords */}
            <div className="space-y-2">
              <Label htmlFor="meta-keywords" className="text-slate-200">
                Meta Keywords
              </Label>
              <Input
                id="meta-keywords"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                placeholder="crm, whatsapp, shared inbox, broadcast"
                disabled={saving || !canEditSettings}
              />
              <p className="text-xs text-slate-500">Comma-separated keywords representing your page.</p>
            </div>

            {/* Open Graph (Facebook / Slack / Teams) */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Open Graph Settings (Social Sharing)</h3>

              <div className="space-y-2">
                <Label htmlFor="og-title" className="text-slate-200">
                  OG Title
                </Label>
                <Input
                  id="og-title"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  placeholder="wacrm — WhatsApp CRM Integration"
                  disabled={saving || !canEditSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-description" className="text-slate-200">
                  OG Description
                </Label>
                <Textarea
                  id="og-description"
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  placeholder="Check out our self-hostable WhatsApp CRM!"
                  rows={2}
                  disabled={saving || !canEditSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-image-url" className="text-slate-200">
                  OG Image URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="og-image-url"
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    placeholder="https://example.com/social-share.png"
                    disabled={saving || !canEditSettings}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={saving || !canEditSettings}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploadingImage || !canEditSettings}
                    className="shrink-0"
                  >
                    {uploadingImage ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                  </Button>
                  {ogImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOgImageUrl('')}
                      disabled={saving || !canEditSettings}
                      className="text-slate-400 hover:text-white shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Image dimension of 1200x630 is recommended for Facebook/Slack.
                </p>
              </div>
            </div>

            {/* Twitter Settings */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Twitter Card Settings</h3>

              <div className="space-y-2">
                <Label htmlFor="twitter-title" className="text-slate-200">
                  Twitter Title
                </Label>
                <Input
                  id="twitter-title"
                  value={twitterTitle}
                  onChange={(e) => setTwitterTitle(e.target.value)}
                  placeholder="wacrm on Twitter"
                  disabled={saving || !canEditSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-description" className="text-slate-200">
                  Twitter Description
                </Label>
                <Textarea
                  id="twitter-description"
                  value={twitterDescription}
                  onChange={(e) => setTwitterDescription(e.target.value)}
                  placeholder="WhatsApp CRM designed for high growth teams."
                  rows={2}
                  disabled={saving || !canEditSettings}
                />
              </div>
            </div>

            {/* Custom Scripts */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-300">Custom Header Scripts & HTML</h3>
                <p className="text-xs text-slate-500">
                  Inject raw HTML/JavaScript tags in the page header (e.g., Google Analytics, Meta Pixel).
                </p>
              </div>
              <div className="space-y-2">
                <Textarea
                  id="custom-header-html"
                  value={customHeaderHtml}
                  onChange={(e) => setCustomHeaderHtml(e.target.value)}
                  placeholder="<!-- Paste your Google Analytics tracking tag here -->&#10;<script>...</script>"
                  rows={4}
                  className="font-mono text-xs text-slate-300 bg-slate-950 border-slate-800"
                  disabled={saving || !canEditSettings}
                />
              </div>
            </div>

            {/* TinyMCE Rich Content HTML */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-300">Rich SEO Content Block</h3>
                <p className="text-xs text-slate-500">
                  Write HTML-rich marketing text, SEO page footers, or about blocks that can be pulled and rendered on public-facing layouts.
                </p>
              </div>
              <HTMLEditor
                value={richSeoContent}
                onChange={setRichSeoContent}
                disabled={saving || !canEditSettings}
                placeholder="Write custom SEO footer html or about description details..."
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800/80">
              <Button type="submit" disabled={saving || !canEditSettings}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Previews Sidebar */}
      <div className="space-y-6">
        {/* Google SERP Preview */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Search className="size-4 text-sky-400" />
              <CardTitle className="text-sm font-semibold">Search Engine Preview (SERP)</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              How this website appears in Google search results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg bg-slate-950/80 border border-slate-850 p-4 space-y-1 shadow-inner">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                <Globe className="size-3 text-slate-500 shrink-0" />
                <span>{displayUrl}</span>
                <span className="text-slate-600">› settings</span>
              </div>
              <h4 className="text-lg font-normal text-[#8ab4f8] leading-tight hover:underline cursor-pointer break-words">
                {displayTitle}
              </h4>
              <p className="text-xs text-[#bdc1c6] leading-relaxed break-words line-clamp-3">
                {displayDesc}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Social Card Preview */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Share2 className="size-4 text-violet-400" />
              <CardTitle className="text-sm font-semibold">Social Media Preview (Open Graph)</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              How this link renders when shared on Slack, Facebook, or Teams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              {/* Image box */}
              <div className="relative aspect-[1.91/1] bg-slate-900 flex items-center justify-center border-b border-slate-850 overflow-hidden">
                {ogImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ogImageUrl}
                    alt="Open Graph Share Preview"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Globe className="size-10 text-slate-700 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 font-mono">1200 x 630 pixels</span>
                  </div>
                )}
              </div>
              {/* Card info */}
              <div className="p-3.5 space-y-1 bg-slate-950">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {displayUrl.replace(/^https?:\/\//, '')}
                </p>
                <h5 className="text-xs font-semibold text-slate-200 line-clamp-1 break-words">
                  {ogTitle || displayTitle}
                </h5>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-normal break-words">
                  {ogDescription || displayDesc}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
