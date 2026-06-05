"use client";

import { useTheme } from "@/hooks/use-theme";
import { MessageSquare, Sparkles, CheckCheck, ShieldCheck, Zap, Users } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

export function AuthWrapper({ children }: { children: ReactNode }) {
  const { showLogo, logoUrl, showTitle, titleText } = useTheme();

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12 bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Left side: Branding & Visual Showcase */}
      <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-[#0a0f1d] to-slate-950 border-r border-slate-900 relative overflow-hidden">
        {/* Subtle grid background overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />
        
        {/* Ambient Glowing Blobs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/10 blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />

        {/* Top Section: Logo & Brand Name */}
        <div className="flex items-center gap-3 relative z-10">
          {showLogo && (
            <div className="flex h-10 items-center justify-center rounded-lg bg-primary-soft p-1">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={titleText} className="h-8 object-contain" />
              ) : (
                <MessageSquare className="h-6 w-6 text-primary" />
              )}
            </div>
          )}
          {showTitle && (
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {titleText}
            </span>
          )}
        </div>

        {/* Middle Section: Premium Interactive Feature Preview */}
        <div className="flex flex-col items-center justify-center py-12 relative z-10">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-xl shadow-2xl relative">
            <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary tracking-wider uppercase flex items-center gap-1.5 shadow-sm">
              <Sparkles className="h-3 w-3 animate-spin duration-[4s]" />
              Live Workspace preview
            </div>

            {/* Simulated Live Chat Interface */}
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-white">
                    JD
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200">John Doe</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Active Chat
                    </div>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary border border-primary/15">
                  Sales Lead
                </div>
              </div>

              {/* Message bubbles */}
              <div className="space-y-3">
                <div className="flex justify-start max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-none bg-slate-800/90 px-3.5 py-2.5 text-xs text-slate-300 border border-slate-700/50 leading-relaxed shadow-sm">
                    Hey! I am looking for the pricing packages of your WhatsApp API CRM system. Could you guide me?
                  </div>
                </div>
                
                <div className="flex justify-end max-w-[85%] ml-auto">
                  <div className="rounded-2xl rounded-tr-none bg-primary px-3.5 py-2.5 text-xs text-primary-foreground leading-relaxed shadow-md relative">
                    <div>
                      Hi John! We offer custom tiers based on conversation volume. Let me trigger our interactive pricing guide.
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-primary-foreground/70">
                      <span>16:10</span>
                      <CheckCheck className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                {/* Animated Typing Indicator */}
                <div className="flex justify-start max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-none bg-slate-800/90 px-4 py-2.5 text-xs text-slate-300 border border-slate-700/50 leading-relaxed shadow-sm flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce delay-100" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce delay-200" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce delay-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center max-w-sm">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Scale Your Conversations Instantly
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Connect your team, build visual workflow automations, and manage broadcast metrics—all inside a highly secure and premium workspace.
            </p>
          </div>

          {/* Core Perks Highlights */}
          <div className="grid grid-cols-3 gap-6 mt-8 w-full max-w-md">
            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <Zap className="h-5 w-5 text-primary mb-1" />
              <span className="text-[10px] font-medium text-slate-300">Automations</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <Users className="h-5 w-5 text-primary mb-1" />
              <span className="text-[10px] font-medium text-slate-300">Shared Inbox</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <ShieldCheck className="h-5 w-5 text-primary mb-1" />
              <span className="text-[10px] font-medium text-slate-300">Secure API</span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Branding Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 relative z-10 border-t border-slate-900 pt-6">
          <span>&copy; {new Date().getFullYear()} {titleText}</span>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>

      {/* Right side: Login / Signup / Reset Form Panel */}
      <div className="col-span-12 lg:col-span-5 flex flex-col justify-center min-h-screen py-12 px-6 relative bg-slate-950">
        {/* Behind form background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary-soft-2)_0%,transparent_70%)] pointer-events-none opacity-60" />
        
        {/* Top Logo row for Mobile View */}
        <div className="flex lg:hidden items-center justify-center gap-3 mb-8 relative z-10">
          {showLogo && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft p-1">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={titleText} className="h-8 object-contain" />
              ) : (
                <MessageSquare className="h-6 w-6 text-primary" />
              )}
            </div>
          )}
          {showTitle && (
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {titleText}
            </span>
          )}
        </div>

        <div className="w-full max-w-md mx-auto relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
