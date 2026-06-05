"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { MessageSquare, UsersRound } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { logoUrl, showLogo, titleText } = useTheme();
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
      <CardHeader className="items-center text-center pb-2">
        {showLogo && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800/80 p-2 border border-slate-700/60 shadow-inner">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={titleText} className="h-10 w-10 object-contain" />
            ) : inviteToken ? (
              <UsersRound className="h-7 w-7 text-primary" />
            ) : (
              <MessageSquare className="h-7 w-7 text-primary" />
            )}
          </div>
        )}
        <CardTitle className="text-xl text-white tracking-tight">
          {inviteToken ? "Sign in to accept" : "Welcome back"}
        </CardTitle>
        <CardDescription className="text-slate-400 text-xs mt-1">
          {inviteToken
            ? "Sign in and we'll take you to the invitation."
            : "Sign in to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300 text-xs font-medium">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-slate-700/80 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20 h-10 transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.99] transition-all font-medium shadow-md shadow-primary/10"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href={
              inviteToken
                ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                : "/signup"
            }
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Create account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
