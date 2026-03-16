"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import type { CVCandidate } from "@/lib/cv-context";
import type { LinkedInIntelligenceReport, LinkedInInsight } from "@/lib/linkedin-insights-context";

type Tab = "cv" | "linkedin";

const NAVY = "#323B6A";
const GREEN = "#BDCF7C";
const PALE = "#E7EDF3";
const BLUE = "#6F92BF";
const LIGHT_BLUE = "#A7B8D1";

const SENIORITY_COLORS: Record<string, string> = {
  junior: "#A7B8D1",
  mid: "#6F92BF",
  senior: GREEN,
  lead: "#FEEA99",
  principal: "#F4A261",
};

const GROUP_LABELS: Record<string, string> = {
  boutique_recruitment: "Boutique Recruiters",
  non_recruitment_tech: "Tech Founders",
  au_startup: "AU Startups",
};

// ── CV Intelligence Tab ───────────────────────────────────────────────────────

function CVIntelligenceTab() {
  const { data: session } = useSession();
  const [folderPath, setFolderPath] = useState("/Active CVs");
  const [savedPath, setSavedPath] = useState("/Active CVs");
  const [candidates, setCandidates] = useState<CVCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ enriched: number; total: number } | null>(null);
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIndexed, setLastIndexed] = useState<string | null>(null);

  const loadIndex = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/cv/index");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates ?? []);
        if (data.candidates?.length > 0) {
          setLastIndexed(data.candidates[0].indexedAt);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/cv/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.folderPath) {
          setFolderPath(data.folderPath);
          setSavedPath(data.folderPath);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadIndex();
    loadSettings();
  }, [loadIndex, loadSettings]);

  const savePath = async () => {
    setIsSavingPath(true);
    try {
      await fetch("/api/cv/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
      setSavedPath(folderPath);
    } catch {
      // ignore
    } finally {
      setIsSavingPath(false);
    }
  };

  const scanCVs = async () => {
    if (!session?.accessToken || session?.error === "RefreshAccessTokenError") return;
    setIsScanning(true);
    setError(null);
    setScanProgress(null);

    try {
      let done = false;
      while (!done) {
        const res = await fetch("/api/cv/index", { method: "POST" });

        const bodyText = await res.text().catch(() => "");
        let data: Record<string, unknown> = {};
        try {
          data = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          const preview = bodyText.substring(0, 200).replace(/\s+/g, " ").trim();
          throw new Error(
            res.status === 504
              ? "Scan timed out — click Scan CVs again to continue from where it left off."
              : `Server error (${res.status})${preview ? `: ${preview}` : ""}`
          );
        }

        if (res.status === 401) { signIn("azure-ad"); return; }
        if (!res.ok) throw new Error((data.error as string) ?? "Scan failed");

        const count = (data.count as number) ?? 0;
        const remainingFiles = (data.remainingFiles as number) ?? 0;
        done = (data.done as boolean) ?? true;

        if (count > 0) setLastIndexed(new Date().toISOString());
        setScanProgress(
          count > 0 ? { scanned: count, total: count + remainingFiles } : null
        );
      }
      // Reload index after scan completes
      await loadIndex();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const enrichCVs = async () => {
    if (!session?.accessToken || session?.error === "RefreshAccessTokenError") return;
    setIsEnriching(true);
    setError(null);
    setEnrichProgress(null);

    try {
      let done = false;
      while (!done) {
        const res = await fetch("/api/cv/enrich", { method: "POST" });

        const bodyText = await res.text().catch(() => "");
        let data: Record<string, unknown> = {};
        try {
          data = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          throw new Error(`Server error (${res.status})`);
        }

        if (res.status === 401) { signIn("azure-ad"); return; }
        if (!res.ok) throw new Error((data.error as string) ?? "Enrichment failed");

        const total = (data.total as number) ?? 0;
        const remaining = (data.remaining as number) ?? 0;
        done = (data.done as boolean) ?? true;

        setEnrichProgress({ enriched: total - remaining, total });
      }
      await loadIndex();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setIsEnriching(false);
      setEnrichProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Folder settings */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "#FFFFFF", border: `1px solid ${PALE}` }}
      >
        <h3
          className="text-sm font-semibold mb-1"
          style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: NAVY }}
        >
          OneDrive CV Folder
        </h3>
        <p className="text-xs mb-3" style={{ color: LIGHT_BLUE }}>
          Specify the OneDrive folder path containing active candidate CVs (PDF or DOCX).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/Active CVs"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              border: `1.5px solid ${PALE}`,
              color: NAVY,
              backgroundColor: "#FFFFFF",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
            onBlur={(e) => (e.currentTarget.style.borderColor = PALE)}
          />
          <button
            onClick={savePath}
            disabled={isSavingPath || folderPath === savedPath}
            className="px-4 py-2 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor:
                isSavingPath || folderPath === savedPath ? PALE : GREEN,
              color:
                isSavingPath || folderPath === savedPath ? LIGHT_BLUE : NAVY,
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              cursor:
                isSavingPath || folderPath === savedPath ? "not-allowed" : "pointer",
            }}
          >
            {isSavingPath ? "Saving…" : "Save"}
          </button>
        </div>
        {savedPath && folderPath === savedPath && savedPath !== "/Active CVs" && (
          <p className="text-xs mt-1.5" style={{ color: BLUE }}>
            ✓ Folder saved: {savedPath}
          </p>
        )}
      </div>

      {/* Scan + Enrich buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: LIGHT_BLUE }}>
          {candidates.length > 0
            ? `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""} indexed`
            : "No candidates indexed yet"}
          {lastIndexed && (
            <span className="ml-2">
              · Last scanned {new Date(lastIndexed).toLocaleDateString("en-AU")}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={scanCVs}
            disabled={isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              backgroundColor: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? PALE : NAVY,
              color: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? LIGHT_BLUE : "#FFFFFF",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              cursor: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? "not-allowed" : "pointer",
            }}
          >
            {isScanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {scanProgress ? `Scanning ${scanProgress.scanned} / ${scanProgress.total}…` : "Starting scan…"}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Scan CVs
              </>
            )}
          </button>
          <button
            onClick={enrichCVs}
            disabled={isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              backgroundColor: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? PALE : GREEN,
              color: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? LIGHT_BLUE : NAVY,
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              cursor: isScanning || isEnriching || !session?.accessToken || session?.error === "RefreshAccessTokenError" ? "not-allowed" : "pointer",
            }}
          >
            {isEnriching ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {enrichProgress ? `Enriching ${enrichProgress.enriched} / ${enrichProgress.total}…` : "Starting enrichment…"}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.001 3.001 0 00-.765 1.965v.201a2 2 0 01-2 2h-1.172a2 2 0 01-2-2v-.201a3.001 3.001 0 00-.765-1.965l-.347-.347z" />
                </svg>
                Enrich CVs
              </>
            )}
          </button>
        </div>
      </div>

      {session?.error === "RefreshAccessTokenError" && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC" }}
        >
          <span style={{ color: "#CC4444" }}>
            Microsoft session expired — please reconnect to restore access.
          </span>
          <button
            onClick={() => signIn("azure-ad")}
            className="ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: "#323B6A", color: "#FFFFFF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Reconnect
          </button>
        </div>
      )}

      {!session?.accessToken && session?.error !== "RefreshAccessTokenError" && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FFF8E1", color: "#B8860B" }}>
          Connect your Microsoft account (via Market Intelligence) to scan OneDrive CVs.
        </p>
      )}

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FFF0F0", color: "#CC4444" }}>
          {error}
        </p>
      )}

      {/* Candidate list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: LIGHT_BLUE }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="rounded-xl p-4 flex items-start justify-between gap-3"
              style={{ backgroundColor: "#FFFFFF", border: `1px solid ${PALE}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="font-semibold text-sm"
                    style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: NAVY }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: SENIORITY_COLORS[c.seniority] ?? PALE,
                      color: NAVY,
                    }}
                  >
                    {c.seniority}
                  </span>
                </div>
                <p className="text-xs mb-1.5" style={{ color: BLUE }}>
                  {c.currentRole}
                  {c.yearsExperience > 0 && ` · ${c.yearsExperience}yr exp`}
                  {c.location && ` · ${c.location}`}
                </p>
                {c.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.skills.slice(0, 6).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md text-xs"
                        style={{ backgroundColor: PALE, color: BLUE }}
                      >
                        {s}
                      </span>
                    ))}
                    {c.skills.length > 6 && (
                      <span className="text-xs" style={{ color: LIGHT_BLUE }}>
                        +{c.skills.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs" style={{ color: LIGHT_BLUE }}>
                  {c.fileName.length > 20
                    ? `${c.fileName.substring(0, 18)}…`
                    : c.fileName}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: `1px solid ${PALE}` }}
        >
          <p className="text-sm" style={{ color: LIGHT_BLUE }}>
            No candidates indexed. Set your OneDrive folder path and click Scan CVs.
          </p>
        </div>
      )}
    </div>
  );
}

// ── LinkedIn Intelligence Tab ─────────────────────────────────────────────────

function InsightCard({ insight }: { insight: LinkedInInsight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: "#FFFFFF", border: `1px solid ${PALE}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: PALE, color: BLUE }}
            >
              {GROUP_LABELS[insight.group] ?? insight.group}
            </span>
            {insight.applicablePostTypes.length > 0 && (
              <span className="text-xs" style={{ color: LIGHT_BLUE }}>
                {insight.applicablePostTypes.join(", ")}
              </span>
            )}
          </div>
          <h4
            className="text-sm font-semibold mb-1"
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: NAVY }}
          >
            {insight.title}
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: BLUE }}>
            {insight.observation}
          </p>
        </div>
        {insight.examplePost && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-xs px-2 py-1 rounded-lg"
            style={{ backgroundColor: PALE, color: BLUE }}
          >
            {expanded ? "Hide" : "Example"}
          </button>
        )}
      </div>
      {expanded && insight.examplePost && (
        <div
          className="mt-3 p-3 rounded-lg text-xs leading-relaxed italic"
          style={{ backgroundColor: PALE, color: NAVY, borderLeft: `3px solid ${GREEN}` }}
        >
          &ldquo;{insight.examplePost}&rdquo;
          {insight.exampleAuthor && (
            <p className="mt-1 not-italic" style={{ color: LIGHT_BLUE }}>
              — {insight.exampleAuthor}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedInIntelligenceTab() {
  const [report, setReport] = useState<LinkedInIntelligenceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>("all");

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch("/api/research/linkedin-intelligence");
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const generateReport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/research/linkedin-intelligence", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredInsights =
    report?.insights.filter(
      (i) => filterGroup === "all" || i.group === filterGroup
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: LIGHT_BLUE }}>
            {report
              ? `${report.insights.length} insights · ${report.coversPeriod}`
              : "No report generated yet"}
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            backgroundColor: isGenerating ? PALE : NAVY,
            color: isGenerating ? LIGHT_BLUE : "#FFFFFF",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            cursor: isGenerating ? "not-allowed" : "pointer",
          }}
        >
          {isGenerating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Researching…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {report ? "Refresh Research" : "Run Research"}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FFF0F0", color: "#CC4444" }}>
          {error}
        </p>
      )}

      {!isLoading && !report && !isGenerating && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: `1px solid ${PALE}` }}
        >
          <p className="text-sm mb-2" style={{ color: NAVY, fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}>
            No research yet
          </p>
          <p className="text-xs mb-4" style={{ color: LIGHT_BLUE }}>
            Click &ldquo;Run Research&rdquo; to analyse what&apos;s working on LinkedIn right now for tech recruiters and founders.
          </p>
          <p className="text-xs" style={{ color: LIGHT_BLUE }}>
            This runs automatically on the 1st of each month.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: LIGHT_BLUE }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {report && filteredInsights !== undefined && (
        <>
          {/* Group filter */}
          <div className="flex flex-wrap gap-2">
            {["all", "boutique_recruitment", "non_recruitment_tech", "au_startup"].map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: filterGroup === g ? NAVY : PALE,
                  color: filterGroup === g ? "#FFFFFF" : BLUE,
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                }}
              >
                {g === "all" ? "All Groups" : GROUP_LABELS[g]}
              </button>
            ))}
          </div>

          {/* Insights */}
          <div className="space-y-3">
            {filteredInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
            {filteredInsights.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: LIGHT_BLUE }}>
                No insights for this group.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResearchPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("cv");

  const tabs: { id: Tab; label: string }[] = [
    { id: "cv", label: "CV Intelligence" },
    { id: "linkedin", label: "LinkedIn Intelligence" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl mb-1"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 700,
            color: NAVY,
          }}
        >
          Research
        </h1>
        <p className="text-sm" style={{ color: BLUE }}>
          CV Intelligence and LinkedIn content research for Pair People.
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ backgroundColor: PALE }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? "#FFFFFF" : "transparent",
              color: activeTab === tab.id ? NAVY : BLUE,
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              boxShadow:
                activeTab === tab.id
                  ? "0 1px 4px rgba(50,59,106,0.08)"
                  : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "cv" && <CVIntelligenceTab />}
      {activeTab === "linkedin" && <LinkedInIntelligenceTab />}
    </div>
  );
}
