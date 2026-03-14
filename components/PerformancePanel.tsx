"use client";

import React, { useState, useEffect } from "react";
import type { PostAssessment } from "@/app/api/voice/assess/route";

type LoadState = "loading" | "no-posts" | "ready-to-analyse" | "analysing" | "done" | "error";

const TIER_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  A: { bg: "#BDCF7C", color: "#323B6A", label: "A — Excellent" },
  B: { bg: "#FEEA99", color: "#323B6A", label: "B — Solid" },
  C: { bg: "#E7EDF3", color: "#6F92BF", label: "C — Average" },
};

function TierBadge({ tier }: { tier: "A" | "B" | "C" }) {
  const s = TIER_STYLES[tier];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
    >
      {tier}
    </span>
  );
}

function formatDate(raw: string) {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return raw.split(" ")[0] ?? raw;
  }
}

function getBestType(assessments: PostAssessment[]): string {
  const aOnly = assessments.filter((a) => a.tier === "A");
  if (aOnly.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const a of aOnly) {
    counts[a.inferredType] = (counts[a.inferredType] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getTopHooks(assessments: PostAssessment[]): PostAssessment[] {
  return assessments
    .filter((a) => a.tier === "A" && a.hook)
    .slice(0, 3);
}

export default function PerformancePanel() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [assessments, setAssessments] = useState<PostAssessment[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "A" | "B" | "C">("all");

  useEffect(() => {
    (async () => {
      try {
        // Check for cached assessments
        const res = await fetch("/api/voice/assess");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (data.assessments?.length > 0) {
          setAssessments(data.assessments);
          setLoadState("done");
          return;
        }

        // Check if posts exist at all
        const profileRes = await fetch("/api/voice/profile");
        const profileData = await profileRes.json();
        setLoadState(profileData.postCount > 0 ? "ready-to-analyse" : "no-posts");
      } catch {
        setLoadState("no-posts");
      }
    })();
  }, []);

  const runAnalysis = async () => {
    setLoadState("analysing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/voice/assess", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAssessments(data.assessments);
      setLoadState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Analysis failed");
      setLoadState("error");
    }
  };

  const visible =
    filterTier === "all" ? assessments : assessments.filter((a) => a.tier === filterTier);

  const tierCounts = {
    A: assessments.filter((a) => a.tier === "A").length,
    B: assessments.filter((a) => a.tier === "B").length,
    C: assessments.filter((a) => a.tier === "C").length,
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Heading */}
      <div className="mb-8">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 700, color: "#323B6A" }}
        >
          Post Performance
        </h1>
        <p className="text-sm" style={{ color: "#6F92BF" }}>
          Claude assesses your LinkedIn post history for hook strength and engagement potential.
        </p>
      </div>

      {/* Loading */}
      {loadState === "loading" && (
        <div className="flex items-center gap-3 py-8">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#BDCF7C" strokeWidth="4" />
            <path className="opacity-75" fill="#BDCF7C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm" style={{ color: "#6F92BF" }}>Loading…</span>
        </div>
      )}

      {/* No posts */}
      {loadState === "no-posts" && (
        <div
          className="rounded-xl px-6 py-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "#E7EDF3" }}>
            <svg className="w-6 h-6" fill="none" stroke="#A7B8D1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            No post history yet
          </p>
          <p className="text-sm" style={{ color: "#6F92BF" }}>
            Upload your LinkedIn Posts.csv in the <strong>My Voice</strong> section to enable performance analysis.
          </p>
        </div>
      )}

      {/* Ready to analyse */}
      {loadState === "ready-to-analyse" && (
        <div
          className="rounded-xl px-6 py-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            Posts loaded — ready to analyse
          </p>
          <p className="text-sm mb-5" style={{ color: "#6F92BF" }}>
            Claude will assess up to 30 posts for hook strength, engagement potential, and post type.
          </p>
          <button
            onClick={runAnalysis}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              backgroundColor: "#BDCF7C",
              color: "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(189,207,124,0.4)",
            }}
          >
            Analyse Posts
          </button>
        </div>
      )}

      {/* Analysing */}
      {loadState === "analysing" && (
        <div
          className="rounded-xl px-5 py-5 flex items-center gap-3"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#BDCF7C" strokeWidth="4" />
            <path className="opacity-75" fill="#BDCF7C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Analysing posts with Claude…
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6F92BF" }}>This takes about 20–40 seconds.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {loadState === "error" && (
        <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC" }}>
          <p className="text-sm font-semibold" style={{ color: "#CC4444" }}>Analysis failed</p>
          <p className="text-sm mt-0.5" style={{ color: "#CC4444" }}>{errorMsg}</p>
          <button onClick={runAnalysis} className="text-sm mt-3 underline" style={{ color: "#CC4444" }}>
            Try again
          </button>
        </div>
      )}

      {/* Done — results */}
      {loadState === "done" && assessments.length > 0 && (
        <div className="space-y-6">

          {/* ── Tier distribution ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {(["A", "B", "C"] as const).map((tier) => (
              <div
                key={tier}
                className="rounded-xl px-4 py-4 text-center"
                style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
              >
                <p
                  className="text-3xl font-bold"
                  style={{
                    color: tier === "A" ? "#BDCF7C" : tier === "B" ? "#6F92BF" : "#A7B8D1",
                    fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  }}
                >
                  {tierCounts[tier]}
                </p>
                <p className="text-xs mt-1" style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                  Tier {TIER_STYLES[tier].label.split("—")[1].trim()}
                </p>
              </div>
            ))}
          </div>

          {/* ── Top hooks ───────────────────────────────────────────────── */}
          {getTopHooks(assessments).length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
            >
              <div
                className="px-5 py-3 border-b flex items-center gap-2"
                style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#BDCF7C" }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
                >
                  Top 3 Hooks
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "#E7EDF3" }}>
                {getTopHooks(assessments).map((a, i) => (
                  <div key={i} className="px-5 py-3 flex gap-3 items-start">
                    <span
                      className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "#BDCF7C", color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm italic" style={{ color: "#323B6A" }}>
                      &ldquo;{a.hook}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Best post type ──────────────────────────────────────────── */}
          {getBestType(assessments) !== "—" && (
            <div
              className="rounded-xl px-5 py-4 flex items-center gap-4"
              style={{ backgroundColor: "#323B6A" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(189,207,124,0.2)" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="#BDCF7C" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#A7B8D1", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                  Best-performing post type
                </p>
                <p
                  className="text-lg font-bold mt-0.5"
                  style={{ color: "#BDCF7C", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                >
                  {getBestType(assessments)}
                </p>
              </div>
            </div>
          )}

          {/* ── Posts table ─────────────────────────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
          >
            {/* Table header row */}
            <div
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
              >
                All Posts ({assessments.length})
              </span>
              {/* Tier filter */}
              <div className="flex gap-1.5">
                {(["all", "A", "B", "C"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTier(t)}
                    className="px-2.5 py-1 rounded-full text-xs transition-all"
                    style={{
                      backgroundColor: filterTier === t ? "#323B6A" : "#E7EDF3",
                      color: filterTier === t ? "#FFFFFF" : "#6F92BF",
                      fontFamily: "var(--font-poppins), Poppins, sans-serif",
                      fontWeight: filterTier === t ? 600 : 400,
                    }}
                  >
                    {t === "all" ? "All" : `Tier ${t}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div
              className="grid px-5 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: "100px 1fr 130px 60px",
                color: "#A7B8D1",
                borderBottom: "1px solid #E7EDF3",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
              }}
            >
              <span>Date</span>
              <span>Post</span>
              <span>Type</span>
              <span className="text-center">Tier</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: "#E7EDF3" }}>
              {visible.length === 0 && (
                <p className="px-5 py-6 text-sm text-center" style={{ color: "#A7B8D1" }}>
                  No posts at this tier.
                </p>
              )}
              {visible.map((a, i) => (
                <div
                  key={i}
                  className="grid px-5 py-3 items-start gap-2 hover:bg-gray-50 transition-colors"
                  style={{ gridTemplateColumns: "100px 1fr 130px 60px" }}
                >
                  <span className="text-xs pt-0.5" style={{ color: "#A7B8D1" }}>
                    {formatDate(a.date)}
                  </span>
                  <div>
                    <p className="text-sm" style={{ color: "#323B6A" }}>
                      {a.text.substring(0, 120)}{a.text.length > 120 ? "…" : ""}
                    </p>
                    {a.tierReason && (
                      <p className="text-xs mt-1" style={{ color: "#6F92BF" }}>
                        {a.tierReason}
                      </p>
                    )}
                  </div>
                  <span className="text-xs pt-0.5" style={{ color: "#6F92BF" }}>
                    {a.inferredType}
                  </span>
                  <div className="flex justify-center pt-0.5">
                    <TierBadge tier={a.tier} />
                  </div>
                </div>
              ))}
            </div>

            {/* Re-run footer */}
            <div
              className="px-5 py-3 border-t flex justify-end"
              style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
            >
              <button
                onClick={runAnalysis}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  backgroundColor: "#E7EDF3",
                  color: "#6F92BF",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#A7B8D1"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E7EDF3"; (e.currentTarget as HTMLButtonElement).style.color = "#6F92BF"; }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-run Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
