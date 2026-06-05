"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const { logoUrl, showLogo, titleText } = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800/80 p-2 border border-slate-700/60 shadow-inner">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl text-white tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-2 leading-relaxed">
            We&apos;ve sent a password reset link to{" "}
            <span className="text-white font-medium">{email}</span>. Please check your
            inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
      <CardHeader className="items-center text-center pb-2">
        {showLogo && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800/80 p-2 border border-slate-700/60 shadow-inner">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={titleText} className="h-10 w-10 object-contain" />
            ) : (
              <MessageSquare className="h-7 w-7 text-primary" />
            )}
          </div>
        )}
        <CardTitle className="text-xl text-white tracking-tight">Reset password</CardTitle>
        <CardDescription className="text-slate-400 text-xs mt-1">
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 transition-all duration-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-slate-300 text-xs font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-slate-700/80 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20 h-10 transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.99] transition-all font-medium shadow-md shadow-primary/10"
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
