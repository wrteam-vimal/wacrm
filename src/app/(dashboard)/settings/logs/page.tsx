'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
  Activity,
  Layers,
  Play,
  Key,
  Link as LinkIcon,
  Send as SendIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WebhookLog {
  id: string;
  account_id: string;
  phone_number_id: string | null;
  event_type: string;
  payload: any;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

interface SystemErrorLog {
  id: string;
  account_id: string | null;
  user_id: string | null;
  error_message: string;
  stack_trace: string | null;
  url: string | null;
  component: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata: any;
  created_at: string;
}

export default function LogsPage() {
  const { accountId } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'system' | 'webhook' | 'simulator'>('system');

  // Simulator states
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [senderPhone, setSenderPhone] = useState('+916359302924');
  const [messageText, setMessageText] = useState('Hello! This is a test message to verify the webhook connection.');
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: number;
    response: any;
  } | null>(null);
  const [origin, setOrigin] = useState('');

  // Webhook logs states
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [webhookMissingTable, setWebhookMissingTable] = useState(false);
  const [webhookStatusFilter, setWebhookStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [webhookTypeFilter, setWebhookTypeFilter] = useState<string>('all');
  const [webhookSearchQuery, setWebhookSearchQuery] = useState('');
  const [expandedWebhookLogId, setExpandedWebhookLogId] = useState<string | null>(null);

  // System error logs states
  const [systemLogs, setSystemLogs] = useState<SystemErrorLog[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemMissingTable, setSystemMissingTable] = useState(false);
  const [systemSeverityFilter, setSystemSeverityFilter] = useState<string>('all');
  const [systemSearchQuery, setSystemSearchQuery] = useState('');
  const [expandedSystemLogId, setExpandedSystemLogId] = useState<string | null>(null);

  // Global operations states
  const [clearing, setClearing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Webhook logs
  const fetchWebhookLogs = async () => {
    if (!accountId) return;
    setWebhookLoading(true);
    try {
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (webhookStatusFilter !== 'all') {
        query = query.eq('status', webhookStatusFilter);
      }

      if (webhookTypeFilter !== 'all') {
        query = query.eq('event_type', webhookTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setWebhookMissingTable(true);
        } else {
          toast.error(`Error loading webhook logs: ${error.message}`);
        }
        setWebhookLogs([]);
      } else {
        setWebhookLogs(data || []);
        setWebhookMissingTable(false);
      }
    } catch (err) {
      console.error('Failed to fetch webhook logs:', err);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Fetch System logs
  const fetchSystemLogs = async () => {
    if (!accountId) return;
    setSystemLoading(true);
    try {
      let query = supabase
        .from('system_errors')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (systemSeverityFilter !== 'all') {
        query = query.eq('severity', systemSeverityFilter);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setSystemMissingTable(true);
        } else {
          toast.error(`Error loading system logs: ${error.message}`);
        }
        setSystemLogs([]);
      } else {
        setSystemLogs(data || []);
        setSystemMissingTable(false);
      }
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setSystemLoading(false);
    }
  };

  // Fetch WhatsApp configuration for simulator
  const fetchConfig = async () => {
    if (!accountId) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) {
        toast.error(`Error loading WhatsApp configuration: ${error.message}`);
      } else if (data) {
        setPhoneNumberId(data.phone_number_id || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'webhook') {
      fetchWebhookLogs();
    } else if (activeTab === 'system') {
      fetchSystemLogs();
    } else if (activeTab === 'simulator') {
      fetchConfig();
    }
  }, [accountId, activeTab, webhookStatusFilter, webhookTypeFilter, systemSeverityFilter]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleTestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId || !senderPhone || !messageText) {
      toast.error('Please fill in all the test parameters.');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/webhook/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderPhone,
          messageText,
          phoneNumberId,
        }),
      });

      const data = await res.json();
      setTestResult({
        success: res.ok && data.success,
        status: res.status,
        response: data,
      });

      if (res.ok && data.success) {
        toast.success('Mock webhook request processed successfully.');
      } else {
        toast.error('Webhook simulation failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger webhook test.');
    } finally {
      setTesting(false);
    }
  };

  const callbackUrl = `${origin}/api/whatsapp/webhook`;
  const verifyToken = 'wrteam-whatsapp';

  const getTroubleshootingTips = (result: typeof testResult) => {
    if (!result) return null;
    
    const responseText = JSON.stringify(result.response).toLowerCase();
    
    if (responseText.includes('allowed list') || responseText.includes('131030')) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-amber-400">Meta Sandbox Restriction Identified:</p>
          <p className="text-slate-300">
            You are using a Meta Developer Test Account. Outbound/Inbound sandbox accounts require verifying target numbers.
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-400 text-[12px]">
            <li>Log into the **Meta Developer Console**.</li>
            <li>Navigate to **WhatsApp** ➔ **API Setup** (Getting Started).</li>
            <li>In the **"To"** dropdown list, select **Add Phone Number** and verify the sender number `{senderPhone}` via OTP.</li>
          </ul>
        </div>
      );
    }

    if (responseText.includes('decryption') || responseText.includes('encryption_key')) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-amber-400">Decryption/Encryption Key Mismatch:</p>
          <p className="text-slate-300">
            The server failed to decrypt your access token.
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-400 text-[12px]">
            <li>Check if you have configured <code className="bg-slate-900 px-1 py-0.5 rounded text-white font-mono text-[11px]">ENCRYPTION_KEY</code> in your environment.</li>
            <li>If testing on Vercel, verify that the <code className="bg-slate-900 px-1 py-0.5 rounded text-white font-mono text-[11px]">ENCRYPTION_KEY</code> matches your local <code className="bg-slate-900 px-1 py-0.5 rounded text-white font-mono text-[11px]">.env.local</code> exactly.</li>
          </ul>
        </div>
      );
    }

    if (responseText.includes('signature') || result.status === 401) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-amber-400">Signature Verification Failure:</p>
          <p className="text-slate-300">
            The webhook rejected the payload because the HMAC signature didn't match.
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-400 text-[12px]">
            <li>Verify that the <code className="bg-slate-900 px-1 py-0.5 rounded text-white font-mono text-[11px]">META_APP_SECRET</code> environment variable is set correctly.</li>
            <li>It must match your App Secret under **Meta Developers ➔ App Settings ➔ Basic**.</li>
          </ul>
        </div>
      );
    }

    if (result.status === 404) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-amber-400">Webhook Route Not Found (404):</p>
          <p className="text-slate-300">
            The webhook endpoint is not reachable at the URL `{callbackUrl}`.
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-400 text-[12px]">
            <li>Check if your development server is running.</li>
            <li>If testing locally with ngrok, verify the ngrok tunnel is online.</li>
          </ul>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <p className="font-semibold text-slate-300">General Diagnostic:</p>
        <p className="text-slate-400">
          The webhook endpoint responded with status `{result.status}`. Please check the **System Logs** page for the detailed trace.
        </p>
      </div>
    );
  };

  const handleClearLogs = async () => {
    if (!accountId || clearing) return;

    const logTypeName = activeTab === 'system' ? 'website system errors' : 'webhook logs';
    const tableName = activeTab === 'system' ? 'system_errors' : 'webhook_logs';

    const confirm = window.confirm(`Are you sure you want to delete all ${logTypeName} for this account? This cannot be undone.`);
    if (!confirm) return;

    setClearing(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('account_id', accountId);

      if (error) {
        toast.error(`Error clearing logs: ${error.message}`);
      } else {
        toast.success(`Successfully cleared all ${logTypeName}.`);
        if (activeTab === 'system') {
          setSystemLogs([]);
          setExpandedSystemLogId(null);
        } else {
          setWebhookLogs([]);
          setExpandedWebhookLogId(null);
        }
      }
    } catch (err) {
      toast.error('Failed to clear logs.');
    } finally {
      setClearing(false);
    }
  };

  const copyTraceToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Stack trace copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter Webhook logs locally
  const filteredWebhookLogs = webhookLogs.filter((log) => {
    if (!webhookSearchQuery) return true;
    const query = webhookSearchQuery.toLowerCase();
    const phoneIdMatch = log.phone_number_id?.toLowerCase().includes(query);
    const errorMatch = log.error_message?.toLowerCase().includes(query);
    let payloadString = '';
    try {
      payloadString = JSON.stringify(log.payload).toLowerCase();
    } catch {}
    return phoneIdMatch || errorMatch || payloadString.includes(query);
  });

  // Filter System logs locally
  const filteredSystemLogs = systemLogs.filter((log) => {
    if (!systemSearchQuery) return true;
    const query = systemSearchQuery.toLowerCase();
    const messageMatch = log.error_message?.toLowerCase().includes(query);
    const traceMatch = log.stack_trace?.toLowerCase().includes(query);
    const componentMatch = log.component?.toLowerCase().includes(query);
    const urlMatch = log.url?.toLowerCase().includes(query);
    return messageMatch || traceMatch || componentMatch || urlMatch;
  });

  const getSeverityBadge = (severity: SystemErrorLog['severity']) => {
    const badges: Record<SystemErrorLog['severity'], React.ReactNode> = {
      info: (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
          <Info className="size-3" />
          Info
        </span>
      ),
      warning: (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
          <AlertTriangle className="size-3" />
          Warning
        </span>
      ),
      error: (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
          <AlertCircle className="size-3" />
          Error
        </span>
      ),
      critical: (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 animate-pulse">
          <AlertCircle className="size-3" />
          Critical
        </span>
      ),
    };
    return badges[severity] || badges.error;
  };

  const getWebhookStatusBadge = (status: 'success' | 'failed') => {
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          <CheckCircle2 className="size-3" />
          Success
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
        <AlertCircle className="size-3" />
        Failed
      </span>
    );
  };

  const getWebhookTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      message: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      status: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
      verification: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      error: 'border-red-500/30 bg-red-500/10 text-red-400',
    };
    const c = colors[type] || 'border-slate-700 bg-slate-800 text-slate-300';
    return (
      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${c}`}>
        {type}
      </span>
    );
  };

  const renderMissingTableMessage = (tableName: string, migrationFile: string, retryFn: () => void) => (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-slate-300">
      <div className="flex gap-3">
        <AlertTriangle className="size-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Database Migration Required</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            The database table <code className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-amber-400 text-xs">{tableName}</code> has not been created in your Supabase project yet.
          </p>
          <p className="text-sm text-slate-400">
            Please copy the contents of the migration file located at <code className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs">{migrationFile}</code> and run them in your **Supabase Dashboard ➔ SQL Editor** to initialize the database schema.
          </p>
          <div className="pt-2">
            <Button size="sm" onClick={retryFn} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              <RefreshCw className="size-4" />
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Modern Glassmorphic Tabs Menu */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === 'system'
                ? 'border-primary text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Terminal className="size-4" />
            System Errors
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === 'webhook'
                ? 'border-primary text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Activity className="size-4" />
            Webhook Logs
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === 'simulator'
                ? 'border-primary text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Play className="size-4" />
            Webhook Simulator
          </button>
        </div>

        {activeTab !== 'simulator' && (
          <div className="flex gap-2 mb-1">
            <Button
              size="sm"
              variant="outline"
              onClick={activeTab === 'system' ? fetchSystemLogs : fetchWebhookLogs}
              disabled={activeTab === 'system' ? systemLoading : webhookLoading}
              className="border-slate-800 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${
                  (activeTab === 'system' ? systemLoading : webhookLoading) ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearLogs}
              disabled={
                clearing ||
                (activeTab === 'system' ? systemLogs.length === 0 : webhookLogs.length === 0)
              }
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Clear Logs
            </Button>
          </div>
        )}
      </div>

      {/* activeTab === 'system' (System Errors View) */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          {/* Filters Panel */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Severity Quick Filter */}
              <div className="flex rounded-lg border border-slate-800 p-0.5 bg-slate-950">
                {['all', 'info', 'warning', 'error', 'critical'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSystemSeverityFilter(sev)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                      systemSeverityFilter === sev
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Text Search */}
              <div className="relative min-w-[240px] md:min-w-[320px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search error logs, components, stack traces..."
                  value={systemSearchQuery}
                  onChange={(e) => setSystemSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white"
                />
                {systemSearchQuery && (
                  <button
                    onClick={() => setSystemSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logs Table Container */}
          {systemMissingTable ? (
            renderMissingTableMessage('system_errors', 'supabase/migrations/027_system_errors.sql', fetchSystemLogs)
          ) : systemLoading && systemLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3 rounded-xl border border-slate-800 bg-slate-900/40">
              <RefreshCw className="size-8 animate-spin text-primary" />
              <p className="text-sm">Fetching system error history...</p>
            </div>
          ) : filteredSystemLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3 text-center rounded-xl border border-slate-800 bg-slate-900/40">
              <Terminal className="size-8 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-white">No system errors logged</p>
                <p className="text-xs text-slate-500 mt-1">
                  {systemLogs.length > 0
                    ? 'Try adjusting your filters or search query.'
                    : 'System exceptions and frontend warnings will appear here when captured.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
              {filteredSystemLogs.map((log) => {
                const isExpanded = expandedSystemLogId === log.id;
                const formattedDate = new Date(log.created_at).toLocaleString();

                return (
                  <div key={log.id} className="transition-colors hover:bg-slate-800/10">
                    {/* Header Summary */}
                    <div
                      onClick={() => setExpandedSystemLogId(isExpanded ? null : log.id)}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getSeverityBadge(log.severity)}
                        <span className="text-xs text-slate-400 font-mono shrink-0">
                          {formattedDate}
                        </span>
                        {log.component && (
                          <span className="inline-flex items-center rounded bg-slate-950 px-1.5 py-0.5 text-[11px] font-mono text-slate-400 border border-slate-800 shrink-0">
                            {log.component}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-sm sm:max-w-md md:max-w-lg">
                          {log.error_message}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto text-slate-500 hover:text-slate-300">
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>
                    </div>

                    {/* Detailed Dropdown */}
                    {isExpanded && (
                      <div className="bg-slate-950 p-5 border-t border-slate-800 space-y-4">
                        {/* URL Details */}
                        {log.url && (
                          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                            <span className="text-slate-500 font-semibold uppercase">Trigger URL:</span>
                            <a href={log.url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                              {log.url}
                            </a>
                          </div>
                        )}

                        {/* Error stack trace code block */}
                        {log.stack_trace ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-400">Stack Trace:</span>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => copyTraceToClipboard(log.stack_trace || '', log.id)}
                                className="h-7 px-2 border-slate-800 hover:bg-slate-800 text-slate-400 text-[11px] gap-1"
                              >
                                {copiedId === log.id ? (
                                  <>
                                    <Check className="size-3 text-green-400" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    Copy Trace
                                  </>
                                )}
                              </Button>
                            </div>
                            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 overflow-x-auto max-h-[300px]">
                              <pre className="text-xs font-mono text-red-300 leading-relaxed whitespace-pre">
                                {log.stack_trace}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">No stack trace captured for this error.</div>
                        )}

                        {/* Metadata Details */}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-slate-400">Context Metadata:</span>
                            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 overflow-x-auto">
                              <pre className="text-xs font-mono text-emerald-400">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Log Identity */}
                        <div className="text-[10px] text-slate-600 font-mono flex gap-4">
                          <span>Log ID: {log.id}</span>
                          {log.user_id && <span>User ID: {log.user_id}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* activeTab === 'webhook' (Webhook Logs View) */}
      {activeTab === 'webhook' && (
        <div className="space-y-4">
          {/* Filters Panel */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <div className="flex rounded-lg border border-slate-800 p-0.5 bg-slate-950">
                {(['all', 'success', 'failed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setWebhookStatusFilter(s)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                      webhookStatusFilter === s
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Event Type Filter */}
              <select
                value={webhookTypeFilter}
                onChange={(e) => setWebhookTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[120px]"
              >
                <option value="all">All Types</option>
                <option value="message">Messages</option>
                <option value="status">Status Updates</option>
                <option value="verification">Verifications</option>
                <option value="error">Errors</option>
              </select>

              {/* Search Bar */}
              <div className="relative min-w-[200px] md:min-w-[260px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search payloads or errors..."
                  value={webhookSearchQuery}
                  onChange={(e) => setWebhookSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white"
                />
                {webhookSearchQuery && (
                  <button
                    onClick={() => setWebhookSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logs Table Container */}
          {webhookMissingTable ? (
            renderMissingTableMessage('webhook_logs', 'supabase/migrations/026_webhook_logs.sql', fetchWebhookLogs)
          ) : webhookLoading && webhookLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3 rounded-xl border border-slate-800 bg-slate-900/40">
              <RefreshCw className="size-8 animate-spin text-primary" />
              <p className="text-sm">Fetching webhook event history...</p>
            </div>
          ) : filteredWebhookLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3 text-center rounded-xl border border-slate-800 bg-slate-900/40">
              <Terminal className="size-8 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-white">No webhook logs found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {webhookLogs.length > 0
                    ? 'Try adjusting your filters or search query.'
                    : 'Meta Cloud API requests will show up here once configured and verified.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
              {filteredWebhookLogs.map((log) => {
                const isExpanded = expandedWebhookLogId === log.id;
                const formattedDate = new Date(log.created_at).toLocaleString();

                let summary = '';
                if (log.error_message) {
                  summary = log.error_message;
                } else if (log.event_type === 'message') {
                  const text =
                    log.payload?.text?.body ||
                    log.payload?.interactive?.button_reply?.title ||
                    `[${log.payload?.type || 'Media'}]`;
                  summary = `From: ${log.payload?.from || 'Unknown'} - "${text}"`;
                } else if (log.event_type === 'verification') {
                  summary = `Verification token: "${log.payload?.verifyToken || 'N/A'}"`;
                } else if (log.event_type === 'status') {
                  summary = `Message status update: "${log.payload?.status || 'N/A'}"`;
                }

                return (
                  <div key={log.id} className="transition-colors hover:bg-slate-800/10">
                    {/* Header Summary */}
                    <div
                      onClick={() => setExpandedWebhookLogId(isExpanded ? null : log.id)}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getWebhookStatusBadge(log.status)}
                        {getWebhookTypeBadge(log.event_type)}
                        <span className="text-xs text-slate-400 font-mono shrink-0">
                          {formattedDate}
                        </span>
                        <span className="text-xs font-medium text-slate-300 truncate max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
                          {summary}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto text-slate-500 hover:text-slate-300">
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>
                    </div>

                    {/* Detailed Dropdown */}
                    {isExpanded && (
                      <div className="bg-slate-950 p-4 border-t border-slate-800 space-y-3">
                        {log.error_message && (
                          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                            <strong className="block font-semibold mb-1">Execution Error Details:</strong>
                            {log.error_message}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>Event ID: {log.id}</span>
                          {log.phone_number_id && <span>Phone Number ID: {log.phone_number_id}</span>}
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 overflow-x-auto max-h-[350px]">
                          <pre className="text-xs font-mono text-emerald-400">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* activeTab === 'simulator' (Webhook Simulator Tool View) */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webhook details card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h3 className="text-md font-semibold text-white flex items-center gap-2">
                <LinkIcon className="size-4 text-primary" />
                Meta Webhook Setup
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Copy these configuration parameters and enter them in your Meta Developer Console under **WhatsApp ➔ Configuration** to receive incoming WhatsApp messages.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Callback URL
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <input
                      type="text"
                      readOnly
                      value={callbackUrl}
                      className="flex-1 bg-transparent text-xs text-slate-300 outline-none select-all font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(callbackUrl, 'Callback URL')}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Verify Token
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <input
                      type="text"
                      readOnly
                      value={verifyToken}
                      className="flex-1 bg-transparent text-xs text-slate-300 outline-none select-all font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(verifyToken, 'Verify Token')}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 text-xs leading-relaxed text-blue-400">
              <Info className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block font-semibold text-slate-200">How verification works:</strong>
                <p className="text-slate-400">
                  When you click "Verify and save" in Meta, Meta sends a `GET` request to your callback URL with the verify token. Our server decrypts the token, confirms it matches, and returns the challenge.
                </p>
              </div>
            </div>
          </div>

          {/* Simulator form & results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Testing form */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-md font-semibold text-white flex items-center gap-2 mb-4">
                <Terminal className="size-4 text-primary" />
                Webhook Simulator
              </h3>
              
              <form onSubmit={handleTestWebhook} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Target WhatsApp Phone Number ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={loadingConfig ? 'Loading configuration...' : 'e.g., 704715479397601'}
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      disabled={loadingConfig}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-primary text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Customer Sender Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., +916359302924"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-primary text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Message Body
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Type your test message content here..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-primary text-white resize-none"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={testing || loadingConfig}
                    className="bg-primary hover:bg-primary/95 text-white gap-2 font-medium"
                  >
                    {testing ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4 shrink-0 fill-current" />
                    )}
                    Run Webhook Diagnostic
                  </Button>
                </div>
              </form>
            </div>

            {/* Results section */}
            {testResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="size-4 text-green-500" />
                  ) : (
                    <AlertCircle className="size-4 text-red-500" />
                  )}
                  Diagnostic Results
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Test Outcome</span>
                    <span className={testResult.success ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {testResult.success ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Status Code</span>
                    <span>{testResult.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">HTTP OK</span>
                    <span>{testResult.response?.success ? 'TRUE' : 'FALSE'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Target URL</span>
                    <span>/webhook</span>
                  </div>
                </div>

                {/* Troubleshooting/Action Panel */}
                <div className={`rounded-lg border p-4 text-xs leading-relaxed ${
                  testResult.success 
                    ? 'border-green-500/20 bg-green-500/5 text-green-400' 
                    : 'border-red-500/20 bg-red-500/5 text-red-400'
                }`}>
                  {testResult.success ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-200">Local Webhook Verification Successful!</p>
                      <p className="text-slate-400">
                        The endpoint processed the payload successfully. The contact has been updated, and the message has been written to the database. Go to your **Inbox** page to view the conversation.
                      </p>
                    </div>
                  ) : (
                    getTroubleshootingTips(testResult)
                  )}
                </div>

                {/* Raw JSON response */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">Raw API Response Payload:</span>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 overflow-x-auto max-h-[200px]">
                    <pre className="text-xs font-mono text-blue-400">
                      {JSON.stringify(testResult.response, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
