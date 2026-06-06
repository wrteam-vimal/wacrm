'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Info,
  Key,
  Link as LinkIcon,
  Play,
  RefreshCw,
  Send,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function WebhookTestPage() {
  const { accountId } = useAuth();
  const supabase = createClient();

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

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
    fetchConfig();
  }, [accountId]);

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

  return (
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
                className="bg-primary hover:bg-primary-hover text-white gap-2 font-medium"
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
  );
}
