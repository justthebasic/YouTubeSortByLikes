"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  decodeHtmlEntities,
  parseDuration,
  formatDuration,
  formatNumber,
  formatDate,
  exportToCSV,
  exportToJSON,
  VideoData,
} from "@/lib/utils";

type DurationFilter = "all" | "short" | "long";
type SortKey = "likes" | "views" | "ratio" | "duration" | "publishedAt" | "comments" | "engagement" | "velocity";
type SortConfig = { key: SortKey; direction: "asc" | "desc" } | null;

export default function HomePage() {
  const [channelUrl, setChannelUrl] = useState("");
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxVideos, setMaxVideos] = useState(50);
  const [darkMode, setDarkMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [minViews, setMinViews] = useState(0);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Dark mode init
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [darkMode]);

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ch = params.get("channel");
    const max = params.get("max");
    if (ch) setChannelUrl(ch);
    if (max) setMaxVideos(Math.min(1000, Math.max(50, Number(max))));
  }, []);

  const getSliderBackground = (value: number) => {
    const pct = ((value - 50) / 950) * 100;
    return `linear-gradient(to right, var(--accent-color) ${pct}%, var(--slider-track) ${pct}%)`;
  };

  async function fetchVideos() {
    if (!channelUrl.trim()) return;
    setLoading(true);
    setError(null);
    setVideos([]);

    // Update shareable URL
    const url = new URL(window.location.href);
    url.searchParams.set("channel", channelUrl.trim());
    url.searchParams.set("max", maxVideos.toString());
    window.history.replaceState({}, "", url.toString());

    try {
      const qp = new URLSearchParams({
        channelUrl: channelUrl.trim(),
        maxVideos: maxVideos.toString(),
      });
      const res = await fetch(`/api/videos?${qp}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setVideos(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Client-side filtering and sorting
  const filteredVideos = useMemo(() => {
    let result = videos.filter((v) => {
      if (searchQuery && !v.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (v.views < minViews) return false;
      if (durationFilter !== "all") {
        const secs = parseDuration(v.duration);
        if (durationFilter === "short" && secs > 60) return false;
        if (durationFilter === "long" && secs <= 60) return false;
      }
      return true;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortConfig.key === 'ratio') {
          aValue = a.views > 0 ? a.likes / a.views : 0;
          bValue = b.views > 0 ? b.likes / b.views : 0;
        } else if (sortConfig.key === 'engagement') {
          aValue = a.views > 0 ? (a.likes + a.comments) / a.views : 0;
          bValue = b.views > 0 ? (b.likes + b.comments) / b.views : 0;
        } else if (sortConfig.key === 'velocity') {
          const aDays = Math.max(1, (Date.now() - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
          const bDays = Math.max(1, (Date.now() - new Date(b.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
          aValue = a.views / aDays;
          bValue = b.views / bDays;
        } else if (sortConfig.key === 'duration') {
          aValue = parseDuration(a.duration);
          bValue = parseDuration(b.duration);
        } else if (sortConfig.key === 'publishedAt') {
          aValue = new Date(a.publishedAt).getTime();
          bValue = new Date(b.publishedAt).getTime();
        } else {
          aValue = a[sortConfig.key] as number;
          bValue = b[sortConfig.key] as number;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [videos, searchQuery, minViews, durationFilter, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: "asc" | "desc" = "desc"; // Default to desc for metrics
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const hasResults = filteredVideos.length > 0;

  return (
    <div
      className="relative min-h-screen flex flex-col font-mono"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <header
        className="w-full border-b-[3px]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">YouTube Sort By Likes</h1>
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border-[2px] transition-transform hover:-translate-y-px"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            {/* GitHub */}
            <a
              href="https://github.com/justthebasic/YouTubeSortByLikes"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:-translate-y-px transition-transform"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="font-medium hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">
        {/* Search Card */}
        <div className="w-full max-w-3xl relative mb-10">
          <div
            className="w-full h-full absolute inset-0 rounded-xl translate-y-2 translate-x-2"
            style={{ background: "var(--shadow-color)" }}
          />
          <div
            className="rounded-xl border-[3px] p-6 sm:p-8 relative z-20"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <p className="text-center mb-6" style={{ color: "var(--text-secondary)" }}>
              Find the best quality videos from any channel or playlist! Paste a YouTube channel or playlist URL below.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); fetchVideos(); }} className="space-y-5">
              {/* URL Input */}
              <div className="relative">
                <div
                  className="w-full h-full rounded absolute inset-0 translate-y-1 translate-x-1"
                  style={{ background: "var(--shadow-color)" }}
                />
                <input
                  type="text"
                  placeholder="e.g. https://www.youtube.com/@veritasium or a playlist URL"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  className="block w-full rounded border-[3px] px-5 py-3.5 relative z-10 focus:outline-none transition-transform placeholder:opacity-50 text-sm md:text-base"
                  style={{
                    borderColor: "var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Slider */}
              <div>
                <label htmlFor="max_videos" className="block mb-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Videos to fetch: <span className="font-bold" style={{ color: "var(--text-primary)" }}>{maxVideos}</span>
                </label>
                <input
                  type="range"
                  id="max_videos"
                  min="50"
                  max="1000"
                  step="50"
                  value={maxVideos}
                  onChange={(e) => setMaxVideos(Number(e.target.value))}
                  style={{ background: getSliderBackground(maxVideos) }}
                />
              </div>

              {/* Buttons */}
              <div className="mt-2">
                <BrutalButton onClick={() => fetchVideos()} type="submit" variant="primary">
                  Fetch Videos
                </BrutalButton>
              </div>
            </form>

            {/* Loading */}
            {loading && (
              <div className="mt-6 text-center animate-fade-in">
                <div className="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-color)", borderTopColor: "transparent" }} />
                <span className="ml-2 text-sm" style={{ color: "var(--accent-color)" }}>
                  Fetching up to {maxVideos} videos... This may take a moment.
                </span>
              </div>
            )}
            {error && (
              <div className="mt-6 p-4 rounded border-[3px] text-sm" style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", background: "var(--bg-secondary)" }}>
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {videos.length > 0 && (
          <div className="w-full max-w-7xl relative animate-fade-in">
            <div
              className="w-full h-full absolute inset-0 rounded-xl translate-y-2 translate-x-2"
              style={{ background: "var(--shadow-color)" }}
            />
            <div
              className="rounded-xl border-[3px] p-4 relative z-20"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              {/* Toolbar: filters + export */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    {filteredVideos.length} of {videos.length} videos
                  </span>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-xs px-3 py-1.5 rounded border-[2px] font-medium transition-transform hover:-translate-y-px"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
                  >
                    {showFilters ? "Hide Filters" : "Filters"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportToCSV(filteredVideos)}
                    className="text-xs px-3 py-1.5 rounded border-[2px] font-medium transition-transform hover:-translate-y-px"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
                  >
                    📥 CSV
                  </button>
                  <button
                    onClick={() => exportToJSON(filteredVideos)}
                    className="text-xs px-3 py-1.5 rounded border-[2px] font-medium transition-transform hover:-translate-y-px"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
                  >
                    📥 JSON
                  </button>
                </div>
              </div>

              {/* Filters panel */}
              {showFilters && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-4 rounded-lg border-[2px] animate-fade-in"
                  style={{ borderColor: "var(--border-light)", background: "var(--bg-secondary)" }}
                >
                  <div>
                    <label className="block text-xs font-bold mb-1">Search title</label>
                    <input
                      type="text"
                      placeholder="Filter by title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded border-[2px] text-xs focus:outline-none"
                      style={{ borderColor: "var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Min views: {formatNumber(minViews)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1000000"
                      step="10000"
                      value={minViews}
                      onChange={(e) => setMinViews(Number(e.target.value))}
                      style={{ background: getSliderBackground(50) }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Duration</label>
                    <div className="flex gap-1">
                      {(["all", "short", "long"] as DurationFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setDurationFilter(f)}
                          className="flex-1 text-xs px-2 py-2 rounded border-[2px] font-medium transition-colors"
                          style={{
                            borderColor: "var(--border-color)",
                            background: durationFilter === f ? "var(--accent-color)" : "var(--bg-card)",
                            color: durationFilter === f ? "#fff" : "var(--text-primary)",
                          }}
                        >
                          {f === "all" ? "All" : f === "short" ? "Shorts" : "Long"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm sm:text-base">
                  <thead>
                    <tr className="border-b-[3px]" style={{ borderColor: "var(--accent-color)" }}>
                      <th className="px-2 py-3 text-left font-bold w-8">#</th>
                      <th className="px-2 py-3 text-left font-bold hidden sm:table-cell w-24">Thumb</th>
                      <th className="px-2 py-3 text-left font-bold">Title</th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('likes')}>
                        Likes {getSortIcon('likes')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('comments')}>
                        Comments {getSortIcon('comments')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('views')}>
                        Views {getSortIcon('views')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('ratio')}>
                        Like % {getSortIcon('ratio')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('engagement')}>
                        Engage % {getSortIcon('engagement')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold cursor-pointer hover:underline" onClick={() => requestSort('velocity')}>
                        Velocity {getSortIcon('velocity')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold hidden md:table-cell cursor-pointer hover:underline" onClick={() => requestSort('duration')}>
                        Duration {getSortIcon('duration')}
                      </th>
                      <th className="px-2 py-3 text-right font-bold hidden lg:table-cell cursor-pointer hover:underline" onClick={() => requestSort('publishedAt')}>
                        Date {getSortIcon('publishedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map((v, idx) => {
                      const ratio = v.views > 0 ? ((v.likes / v.views) * 100).toFixed(2) : "0.00";
                      const engagement = v.views > 0 ? (((v.likes + v.comments) / v.views) * 100).toFixed(2) : "0.00";
                      const daysSincePublished = Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
                      const velocity = Math.round(v.views / daysSincePublished);
                      const durationSecs = parseDuration(v.duration);
                      return (
                        <tr
                          key={v.videoId}
                          className="border-b transition-colors"
                          style={{ borderColor: "var(--border-light)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-2 py-2.5 font-bold" style={{ color: "var(--text-muted)" }}>
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2.5 hidden sm:table-cell">
                            {v.thumbnail && (
                              <img
                                src={v.thumbnail}
                                alt=""
                                width={80}
                                height={45}
                                className="rounded border-[2px]"
                                style={{ borderColor: "var(--border-light)" }}
                                loading="lazy"
                              />
                            )}
                          </td>
                          <td className="px-2 py-2.5 max-w-[200px] sm:max-w-[350px]">
                            <a
                              href={`https://www.youtube.com/watch?v=${v.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline underline-offset-2 line-clamp-2"
                              style={{ color: "var(--text-primary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-color)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                            >
                              {decodeHtmlEntities(v.title)}
                            </a>
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                            {formatNumber(v.likes)}
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                            {formatNumber(v.comments)}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                            {formatNumber(v.views)}
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                            {ratio}%
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums" style={{ color: "var(--accent-color)" }}>
                            {engagement}%
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums" title={`${formatNumber(velocity)} views/day`}>
                            {formatNumber(velocity)}/d
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                            {formatDuration(durationSecs)}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                            {formatDate(v.publishedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredVideos.length === 0 && videos.length > 0 && (
                <p className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
                  No videos match your filters. Try adjusting them.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t-[3px] mt-12" style={{ borderColor: "var(--border-color)" }}>
        <div className="container mx-auto px-6 py-4 flex flex-col items-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Originally by{" "}
            <a className="underline underline-offset-2" style={{ color: "var(--accent-color)" }} href="https://github.com/timf34" target="_blank" rel="noreferrer">
              Tim
            </a>
            {" · "}Fork by{" "}
            <a className="underline underline-offset-2" style={{ color: "var(--accent-color)" }} href="https://github.com/justthebasic" target="_blank" rel="noreferrer">
              justthebasic
            </a>
            {" · "}© {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable neo-brutalist button ── */
function BrutalButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <div className="relative group h-full">
      <div
        className="w-full h-full rounded absolute inset-0 translate-y-1 translate-x-1"
        style={{ background: "var(--shadow-color)" }}
      />
      <button
        type={type}
        onClick={onClick}
        className="w-full h-full font-medium px-4 py-3.5 rounded border-[3px] relative z-10 group-hover:-translate-y-px group-hover:-translate-x-px transition-transform text-sm md:text-base flex items-center justify-center"
        style={{
          borderColor: "var(--border-color)",
          background: isPrimary ? "var(--accent-color)" : "var(--bg-secondary)",
          color: isPrimary ? "#ffffff" : "var(--text-primary)",
        }}
      >
        {children}
      </button>
    </div>
  );
}