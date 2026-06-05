"use client";

import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export type PageLoaderType =
  | "table"
  | "cards"
  | "dashboard"
  | "pipelines"
  | "flows"
  | "broadcasts"
  | "generic";

interface PageLoaderProps {
  type?: PageLoaderType;
  className?: string;
}

export function PageLoader({ type = "generic", className }: PageLoaderProps) {
  const { loaderType, loaderImageUrl } = useTheme();

  // 1. Custom Graphic Loader
  if (loaderType === "custom" && loaderImageUrl) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[350px] w-full flex-col items-center justify-center p-12 transition-all duration-300",
          className
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={loaderImageUrl}
              alt="Loading..."
              className="h-full w-full object-contain animate-bounce"
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-primary" />
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider animate-pulse">
            Loading wacrm...
          </span>
        </div>
      </div>
    );
  }

  // 2. Shimmer Skeleton Loader
  return (
    <div className={cn("w-full space-y-6 transition-all duration-300", className)}>
      {type === "table" || type === "broadcasts" ? (
        <div className="space-y-4">
          {/* Header controls shimmer */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="h-8 w-48 shimmer-element" />
            <div className="flex gap-2">
              <div className="h-9 w-24 shimmer-element" />
              <div className="h-9 w-32 shimmer-element" />
            </div>
          </div>
          {/* Search bar shimmer */}
          <div className="h-9 w-72 shimmer-element" />
          
          {/* Table skeleton */}
          <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-900/10">
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 border-b border-slate-800 p-4">
              <div className="h-4 w-24 shimmer-element" />
              <div className="h-4 w-32 shimmer-element" />
              <div className="h-4 w-20 shimmer-element" />
              <div className="h-4 w-28 shimmer-element" />
              <div className="h-4 w-12 shimmer-element" />
            </div>
            {/* Table Body Rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="grid grid-cols-5 gap-4 border-b border-slate-800/60 p-4 last:border-0"
              >
                <div className="h-5 w-28 shimmer-element" />
                <div className="h-5 w-40 shimmer-element" />
                <div className="h-5 w-24 shimmer-element" />
                <div className="h-5 w-16 shimmer-element" />
                <div className="h-5 w-8 shimmer-element" />
              </div>
            ))}
          </div>
        </div>
      ) : type === "cards" || type === "flows" ? (
        <div className="space-y-6">
          {/* Header shimmer */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-36 shimmer-element" />
              <div className="h-4 w-64 shimmer-element" />
            </div>
            <div className="h-9 w-28 shimmer-element" />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="h-5 w-32 shimmer-element" />
                  <div className="h-5 w-16 shimmer-element" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full shimmer-element" />
                  <div className="h-4 w-3/4 shimmer-element" />
                </div>
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="h-4 w-20 shimmer-element" />
                  <div className="flex gap-2">
                    <div className="h-8 w-14 shimmer-element" />
                    <div className="h-8 w-14 shimmer-element" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : type === "pipelines" ? (
        <div className="space-y-6">
          {/* Header controls */}
          <div className="flex items-center justify-between">
            <div className="h-9 w-44 shimmer-element" />
            <div className="flex gap-2">
              <div className="h-9 w-28 shimmer-element" />
              <div className="h-9 w-24 shimmer-element" />
            </div>
          </div>

          {/* Analytics block shimmer */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 bg-slate-900/30 p-4 border border-slate-800 rounded-lg">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 shimmer-element" />
                <div className="h-6 w-16 shimmer-element" />
              </div>
            ))}
          </div>

          {/* Columns */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-slate-900/20 p-3 border border-slate-800/40"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <div className="h-5 w-24 shimmer-element" />
                  <div className="h-5 w-6 shimmer-element" />
                </div>
                {/* Cards */}
                {[1, 2].map((j) => (
                  <div
                    key={j}
                    className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="h-4 w-28 shimmer-element" />
                    <div className="h-3 w-36 shimmer-element" />
                    <div className="h-3 w-16 shimmer-element" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : type === "dashboard" ? (
        <div className="space-y-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-44 shimmer-element" />
              <div className="h-4 w-60 shimmer-element" />
            </div>
            <div className="h-9 w-32 shimmer-element" />
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 shimmer-element" />
                  <div className="h-4 w-4 shimmer-element" />
                </div>
                <div className="h-7 w-16 shimmer-element" />
                <div className="h-3.5 w-36 shimmer-element" />
              </div>
            ))}
          </div>

          {/* Charts area grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-36 shimmer-element" />
                <div className="h-7 w-20 shimmer-element" />
              </div>
              <div className="h-64 w-full shimmer-element" />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="h-5 w-32 shimmer-element" />
              <div className="h-64 w-full shimmer-element" />
            </div>
          </div>

          {/* Bottom stats cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="h-5 w-44 shimmer-element" />
              <div className="h-48 w-full shimmer-element" />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="h-5 w-36 shimmer-element" />
              {/* Activity feed list */}
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full shrink-0 shimmer-element" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 shimmer-element" />
                      <div className="h-3.5 w-1/2 shimmer-element" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* type === "generic" */
        <div className="space-y-4">
          <div className="h-8 w-40 shimmer-element" />
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="h-6 w-3/4 shimmer-element" />
            <div className="space-y-2">
              <div className="h-4 w-full shimmer-element" />
              <div className="h-4 w-full shimmer-element" />
              <div className="h-4 w-2/3 shimmer-element" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
