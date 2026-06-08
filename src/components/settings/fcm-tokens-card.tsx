'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Bell, Calendar, Key } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

interface FcmTokenRow {
  id: string;
  token: string;
  created_at: string;
}

export function FcmTokensCard() {
  const supabase = createClient();
  const { user } = useAuth();
  
  const [tokens, setTokens] = useState<FcmTokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize or fetch the device token from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let token = localStorage.getItem('wacrm_device_token');
      if (!token) {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        const hex = Array.from(array)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        token = `web_${hex}`;
        localStorage.setItem('wacrm_device_token', token);
      }
      setDeviceToken(token);
    }
  }, []);

  const fetchTokens = async () => {
    if (!user) return;
    setLoadingTokens(true);
    try {
      const { data, error } = await supabase
        .from('fcm_tokens')
        .select('id, token, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(`Failed to load tokens: ${error.message}`);
      } else {
        setTokens((data as FcmTokenRow[]) || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching tokens';
      toast.error(msg);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [user]);

  const handleRegisterToken = async () => {
    if (!deviceToken) return;

    // Request browser notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission denied. Please allow notifications in your browser settings.');
        return;
      }
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/account/fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: deviceToken }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to register token');
      }
      
      toast.success('FCM Token registered successfully');
      await fetchTokens();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error registering token';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteToken = async (tokenVal: string, id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch('/api/account/fcm-token', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenVal }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete token');
      }
      
      toast.success('FCM Token removed');
      await fetchTokens();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting token';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const truncateToken = (token: string) => {
    if (token.length <= 30) return token;
    return `${token.slice(0, 15)}...${token.slice(-15)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isRegistered = tokens.some((row) => row.token === deviceToken);

  return (
    <Card className="bg-slate-900/40 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="size-4 text-primary" />
          FCM Push Notification Tokens
        </CardTitle>
        <CardDescription className="text-slate-400">
          Manage Firebase Cloud Messaging (FCM) tokens for this user. When a new WhatsApp message is received, a push notification will be broadcast to all registered devices.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Register current device banner */}
        {!loadingTokens && deviceToken && !isRegistered && (
          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-center space-y-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Bell className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-slate-200">Register This Device</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Receive push notifications on this browser whenever a new WhatsApp message is received.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleRegisterToken}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 transition-all duration-200"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Registering...
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-2" />
                  Register my token
                </>
              )}
            </Button>
          </div>
        )}

        {/* List of tokens */}
        <div className="space-y-3">
          <Label className="text-slate-200">Registered Devices ({tokens.length})</Label>
          
          {loadingTokens ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading registered tokens...
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 border border-dashed border-slate-800 rounded-lg text-center bg-slate-950/20">
              No registered devices found. Register this device to start receiving push notifications.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/20 overflow-hidden">
              {tokens.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 text-sm font-mono text-slate-200 break-all">
                      <Key className="size-3 text-slate-400 shrink-0" />
                      <span>{truncateToken(row.token)}</span>
                      {row.token === deviceToken && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-sans shrink-0 font-medium">
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="size-3" />
                      <span>Registered on {formatDate(row.created_at)}</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteToken(row.token, row.id)}
                    disabled={deletingId !== null}
                    className="text-slate-400 hover:text-red-400 hover:bg-red-950/20 shrink-0"
                  >
                    {deletingId === row.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
