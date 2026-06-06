"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { MessageSquare, CheckCircle, UsersRound } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const { logoUrl, showLogo, titleText, allowSignup = true } = useTheme();
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (!allowSignup && !inviteToken) {
    return (
      <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800/80 p-2 border border-slate-700/60 shadow-inner">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={titleText} className="h-10 w-10 object-contain" />
            ) : (
              <MessageSquare className="h-7 w-7 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl text-white tracking-tight">
            Registration Closed
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-2 leading-relaxed">
            Public registration is currently disabled for this instance. If you have been invited to a workspace, please use the invitation link sent to you by the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Go to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

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
            We&apos;ve sent a confirmation link to{" "}
            <span className="text-white font-medium">{email}</span>. Please check your
            inbox and click the link to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Link
            href={
              inviteToken
                ? `/login?invite=${encodeURIComponent(inviteToken)}`
                : "/login"
            }
          >
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
            ) : inviteToken ? (
              <UsersRound className="h-7 w-7 text-primary" />
            ) : (
              <MessageSquare className="h-7 w-7 text-primary" />
            )}
          </div>
        )}
        <CardTitle className="text-xl text-white tracking-tight">
          {inviteToken ? "Create account & join" : "Create account"}
        </CardTitle>
        <CardDescription className="text-slate-400 text-xs mt-1">
          {inviteToken
            ? "Verify your email, then accept the invitation to join your team."
            : "Get started with WRTeam Whatsapp CRM"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 transition-all duration-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName" className="text-slate-300 text-xs font-medium">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="border-slate-700/80 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20 h-10 transition-colors"
            />
          </div>

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
            <Label htmlFor="password" className="text-slate-300 text-xs font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-slate-700/80 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20 h-10 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword" className="text-slate-300 text-xs font-medium">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="border-slate-700/80 bg-slate-955/60 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20 h-10 transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.99] transition-all font-medium shadow-md shadow-primary/10"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href={
              inviteToken
                ? `/login?invite=${encodeURIComponent(inviteToken)}`
                : "/login"
            }
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
