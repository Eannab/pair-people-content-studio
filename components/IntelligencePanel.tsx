"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";
import type { NewsletterSender } from "@/app/api/newsletters/senders/route";

interface Props {
  onUseForPost: (article: ScoredArticle) => void;
  onNavigateToBD?: () => void;
}

type ScanState = "idle" | "scanning" | "done" | "error";
type Tab = "insight" | "sources" | "manual";

// ── Sector metadata ──────────────────────────────────────────────────────────

const SECTOR_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  defence:   { label: "Defence & Deep Tech", bg: "#323B6A", color: "#FFFFFF" },
  ai:        { label: "AI / ML",             bg: "#BDCF7C", color: "#323B6A" },
  healthtech:{ label: "Healthtech",          bg: "#DBEAA0", color: "#323B6A" },
  sydney:    { label: "Sydney Market",       bg: "#A7B8D1", color: "#323B6A" },
  general:   { label: "General",             bg: "#E7EDF3", color: "#6F92BF" },
};

function SectorBadge({ sector }: { sector: string }) {
  const s = SECTOR_LABELS[sector] ?? SECTOR_LABELS.general;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
    >
      {s.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full flex-1" style={{ backgroundColor: "#E7EDF3" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score * 10}%`, backgroundColor: score >= 7 ? "#BDCF7C" : score >= 5 ? "#FEEA99" : "#A7B8D1" }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif", minWidth: 24 }}>
        {score}/10
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// ── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  onUse,
}: {
  article: ScoredArticle;
  onUse: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-150"
      style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
    >
      <div className="px-5 py-4">
        {/* Source + date */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            {article.source}
          </span>
          <span className="text-xs" style={{ color: "#A7B8D1" }}>
            {formatDate(article.receivedDate)}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-sm font-semibold mb-1.5 leading-snug"
          style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
        >
          {article.title}
        </h3>

        {/* Summary */}
        <p className="text-xs leading-relaxed mb-3" style={{ color: "#6F92BF" }}>
          {article.summary}
        </p>

        {/* Score + sector */}
        <div className="flex items-center gap-2 mb-3">
          <SectorBadge sector={article.sector} />
          <div className="flex-1">
            <ScoreBar score={article.topScore} />
          </div>
        </div>

        {/* Relevance note */}
        {article.relevanceSummary && (
          <p className="text-xs mb-3 italic" style={{ color: "#A7B8D1" }}>
            {article.relevanceSummary}
          </p>
        )}

        {/* CTA row */}
        <div className="flex items-center justify-between">
          {article.webLink ? (
            <a
              href={article.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1"
              style={{ color: "#6F92BF" }}
            >
              Open email
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span />
          )}
          <button
            onClick={onUse}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              backgroundColor: "#BDCF7C",
              color: "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              boxShadow: "0 2px 8px rgba(189,207,124,0.35)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#a8ba6a"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#BDCF7C"; }}
          >
            Use for post
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sender row ───────────────────────────────────────────────────────────────

function SenderRow({
  sender,
  onDelete,
}: {
  sender: NewsletterSender;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
          {sender.name}
        </p>
        {sender.email && (
          <p className="text-xs mt-0.5" style={{ color: "#A7B8D1" }}>{sender.email}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {sender.isDefault && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E7EDF3", color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            Default
          </span>
        )}
        <button
          onClick={() => onDelete(sender.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "#A7B8D1" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF0F0"; (e.currentTarget as HTMLButtonElement).style.color = "#CC4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#A7B8D1"; }}
          title="Remove sender"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Newsletter Sources tab ───────────────────────────────────────────────────

function NewsletterSourcesTab() {
  const [senders, setSenders] = useState<NewsletterSender[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/newsletters/senders")
      .then((r) => r.json())
      .then((d) => setSenders(d.senders ?? []))
      .catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { setError("Name is required"); return; }
    setIsAdding(true);
    setError("");
    try {
      const res = await fetch("/api/newsletters/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSenders(data.senders);
      setNewName("");
      setNewEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add sender");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/newsletters/senders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSenders(data.senders);
    } catch {}
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs mb-3" style={{ color: "#6F92BF" }}>
          Newsletters from these senders will be scanned. Match is against the sender&apos;s display name (partial) or email address (exact).
        </p>
        <div className="space-y-2">
          {senders.map((s) => (
            <SenderRow key={s.id} sender={s} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {/* Add sender form */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "#F9FAFB", border: "1.5px dashed #A7B8D1" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
          Add sender
        </p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Sender display name (e.g. Morning Brew)"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; }}
        />
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Email address — optional, for exact match"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; }}
        />
        {error && <p className="text-xs" style={{ color: "#CC4444" }}>{error}</p>}
        <button
          onClick={handleAdd}
          disabled={isAdding}
          className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: isAdding ? "#E7EDF3" : "#323B6A",
            color: isAdding ? "#A7B8D1" : "#FFFFFF",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 600,
          }}
        >
          {isAdding ? "Adding…" : "Add Sender"}
        </button>
      </div>
    </div>
  );
}

// ── Connect Outlook screen ───────────────────────────────────────────────────

function ConnectOutlookScreen() {
  const [isConnecting, setIsConnecting] = useState(false);

  return (
    <div className="flex flex-col items-center text-center py-8">
      {/* Microsoft envelope icon */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: "#E7EDF3" }}
      >
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#323B6A" strokeWidth="1.5" />
          <path d="M2 8l10 6 10-6" stroke="#323B6A" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="14" y="14" width="8" height="6" rx="1" fill="#BDCF7C" />
          <path d="M14 14l4 3 4-3" stroke="#323B6A" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

      <h2
        className="text-xl mb-2"
        style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 700, color: "#323B6A" }}
      >
        Connect Outlook
      </h2>
      <p className="text-sm mb-6 max-w-sm" style={{ color: "#6F92BF" }}>
        Grant read-only access to scan newsletters from approved senders and surface
        relevant articles for your LinkedIn posts.
      </p>

      <ul className="text-left space-y-2 mb-8 w-full max-w-sm">
        {[
          "Scans inbox for newsletters you select",
          "Extracts article titles & summaries",
          "Scores relevance to your sectors",
          "One-click to draft a Market Insight post",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "#323B6A" }}>
            <span className="mt-0.5 flex-shrink-0" style={{ color: "#BDCF7C" }}>✓</span>
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          setIsConnecting(true);
          signIn("azure-ad");
        }}
        disabled={isConnecting}
        className="flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200"
        style={{
          backgroundColor: isConnecting ? "#E7EDF3" : "#323B6A",
          color: isConnecting ? "#A7B8D1" : "#FFFFFF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 700,
          boxShadow: isConnecting ? "none" : "0 4px 14px rgba(50,59,106,0.3)",
        }}
      >
        {isConnecting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 23 23" fill="none">
              <rect x="1" y="1" width="10" height="10" fill="#F25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
              <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </>
        )}
      </button>

      <p className="text-xs mt-4" style={{ color: "#A7B8D1" }}>
        Read-only access · no emails stored externally
      </p>
    </div>
  );
}

// ── Market Insight tab ───────────────────────────────────────────────────────

function MarketInsightTab({
  session,
  onUseForPost,
}: {
  session: { user?: { name?: string | null; email?: string | null } };
  onUseForPost: (article: ScoredArticle) => void;
}) {
  const [articles, setArticles] = useState<ScoredArticle[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanMeta, setScanMeta] = useState<{ checked: number; matched: number } | null>(null);
  const [scanError, setScanError] = useState("");

  // Load cached articles on mount
  useEffect(() => {
    fetch("/api/newsletters/scan")
      .then((r) => r.json())
      .then((d) => {
        if (d.articles?.length > 0) {
          setArticles(d.articles);
          setScannedAt(d.scannedAt);
          setScanState("done");
        }
      })
      .catch(() => {});
  }, []);

  const handleScan = async () => {
    setScanState("scanning");
    setScanError("");
    try {
      const res = await fetch("/api/newsletters/scan", { method: "POST" });
      const data = await res.json();

      if (res.status === 401 && data.tokenExpired) {
        signIn("azure-ad");
        return;
      }
      // Treat as success if articles came back — BD detection failure shouldn't block the UI
      if (data.articles?.length >= 0 && data.scannedAt) {
        setArticles(data.articles ?? []);
        setScannedAt(data.scannedAt);
        setScanMeta({ checked: data.emailsChecked, matched: data.emailsMatched });
        setScanState("done");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setScanState("error");
    }
  };

  const top5 = articles.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#BDCF7C" }} />
          <span className="text-xs font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            {session.user?.email ?? session.user?.name ?? "Connected"}
          </span>
          {scannedAt && (
            <span className="text-xs" style={{ color: "#A7B8D1" }}>
              · Last scan {formatDate(scannedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanState === "scanning"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: scanState === "scanning" ? "#E7EDF3" : "#BDCF7C",
              color: scanState === "scanning" ? "#A7B8D1" : "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
            }}
          >
            {scanState === "scanning" ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan Now
              </>
            )}
          </button>
          <button
            onClick={() => signOut()}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
            style={{ color: "#A7B8D1", backgroundColor: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E7EDF3"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Scanning progress */}
      {scanState === "scanning" && (
        <div
          className="flex items-center gap-3 px-4 py-4 rounded-xl"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#BDCF7C" strokeWidth="4" />
            <path className="opacity-75" fill="#BDCF7C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Scanning inbox…
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6F92BF" }}>
              Fetching newsletters, extracting articles, scoring relevance. ~30 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Scan error */}
      {scanState === "error" && (
        <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC" }}>
          <p className="text-sm font-semibold" style={{ color: "#CC4444" }}>Scan failed</p>
          <p className="text-sm mt-0.5" style={{ color: "#CC4444" }}>{scanError}</p>
        </div>
      )}

      {/* Scan meta */}
      {scanState === "done" && scanMeta && (
        <p className="text-xs px-1" style={{ color: "#A7B8D1" }}>
          Checked {scanMeta.checked} emails · {scanMeta.matched} newsletter{scanMeta.matched !== 1 ? "s" : ""} matched
          {articles.length > 0 ? ` · ${articles.length} article${articles.length !== 1 ? "s" : ""} scored` : ""}
        </p>
      )}

      {/* Empty state */}
      {scanState === "done" && articles.length === 0 && (
        <div
          className="rounded-xl px-5 py-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            No matching newsletters found
          </p>
          <p className="text-sm" style={{ color: "#6F92BF" }}>
            Make sure approved senders are in your inbox from the last 7 days, or add more senders in the Sources tab.
          </p>
        </div>
      )}

      {/* Article cards */}
      {top5.length > 0 && (
        <div className="space-y-4">
          {top5.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onUse={() => onUseForPost(article)}
            />
          ))}
          {articles.length > 5 && (
            <p className="text-xs text-center" style={{ color: "#A7B8D1" }}>
              Showing top 5 of {articles.length} articles by relevance score.
            </p>
          )}
        </div>
      )}

      {/* First-run prompt */}
      {scanState === "idle" && (
        <div
          className="rounded-xl px-5 py-8 text-center"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            Ready to scan
          </p>
          <p className="text-sm mb-5" style={{ color: "#6F92BF" }}>
            Hit Scan Now to fetch the last 7 days of newsletters and score articles for relevance.
          </p>
          <button
            onClick={handleScan}
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{
              backgroundColor: "#BDCF7C",
              color: "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(189,207,124,0.4)",
            }}
          >
            Scan Newsletters
          </button>
        </div>
      )}
    </div>
  );
}

// ── Email file parsing helpers ────────────────────────────────────────────────

// Tracking URL patterns — these appear as naked URLs after DOM extraction
const TRACKING_URL_RE =
  /https?:\/\/(?:link|click|track|email|e|go)\.[^\s"'<>]*/gi;
const TRACKING_PATH_RE =
  /https?:\/\/[^\s"'<>]*\/(?:ss\/c|click|track|open|wf\/click)\/[^\s"'<>]*/gi;

function htmlToText(html: string): string {
  // DOM-based extraction — handles nested tags, entities, whitespace
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Remove non-content nodes
  temp.querySelectorAll("style, script, noscript, head").forEach((el) => el.remove());

  // Insert newlines around block-level elements so paragraphs stay separated
  temp
    .querySelectorAll("p, div, br, h1, h2, h3, h4, h5, h6, li, tr, blockquote")
    .forEach((el) => el.prepend(document.createTextNode("\n")));

  const raw = temp.textContent || temp.innerText || "";

  // Strip tracking URLs (beehiiv, mailchimp redirects, etc.)
  const noTracking = raw
    .replace(TRACKING_URL_RE, "")
    .replace(TRACKING_PATH_RE, "");

  // Clean up: trim each line, drop lines that are only punctuation/symbols
  const lines = noTracking.split("\n").map((l) => l.trim());
  const meaningful = lines.filter((l) => l.length > 0 && !/^[|•·—–\-=_*]+$/.test(l));

  // Collapse 3+ blank lines into one blank line
  const collapsed = meaningful.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (collapsed.length < 100) {
    console.warn("htmlToText: result suspiciously short after cleaning", { length: collapsed.length, preview: collapsed.slice(0, 80) });
  }

  return collapsed;
}

// Kept for .eml plain-text paths (no DOM needed there, but reuse htmlToText for HTML parts)
function stripHtml(html: string): string {
  return htmlToText(html);
}

function decodeRfc2047(value: string): string {
  return value.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, enc, encoded) => {
    try {
      if (enc.toUpperCase() === "B") {
        const bytes = atob(encoded);
        return new TextDecoder(charset).decode(new Uint8Array([...bytes].map((c) => c.charCodeAt(0))));
      } else {
        return encoded
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
      }
    } catch {
      return value;
    }
  });
}

async function parseMsgFile(file: File): Promise<{ text: string; subject: string; sender: string }> {
  // Dynamic import avoids SSR issues — msgreader uses Buffer internals
  const { default: MsgReader } = await import("msgreader");
  const buffer = await file.arrayBuffer();
  const reader = new MsgReader(buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = reader.getFileData() as any;
  const htmlBody: string | undefined = data.bodyHTML;
  const plainBody: string | undefined = data.body;

  let text: string;
  if (htmlBody) {
    // Always prefer HTML body — richer content, htmlToText handles it correctly
    text = htmlToText(htmlBody);
  } else if (plainBody) {
    // Plain text: just clean up whitespace, no HTML to strip
    text = plainBody.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } else {
    text = "";
  }

  return {
    text,
    subject: data.subject || file.name,
    sender: data.senderName || data.senderSmtpAddress || data.senderEmail || "Unknown sender",
  };
}

async function parseEmlFile(file: File): Promise<{ text: string; subject: string; sender: string }> {
  const raw = await file.text();
  const lines = raw.split(/\r?\n/);

  // Parse RFC 2822 headers (handles folded header lines)
  const headers: Record<string, string> = {};
  let i = 0;
  let lastKey = "";
  while (i < lines.length) {
    const line = lines[i];
    if (line === "") break;
    if (/^\s/.test(line) && lastKey) {
      headers[lastKey] = (headers[lastKey] ?? "") + " " + line.trim();
    } else {
      const sep = line.indexOf(":");
      if (sep > 0) {
        lastKey = line.slice(0, sep).toLowerCase();
        headers[lastKey] = line.slice(sep + 1).trim();
      }
    }
    i++;
  }

  const subject = decodeRfc2047(headers["subject"] || file.name);
  const sender = decodeRfc2047(headers["from"] || "Unknown sender");
  const contentType = headers["content-type"] || "text/plain";
  const encoding = (headers["content-transfer-encoding"] || "").toLowerCase();
  const bodyRaw = lines.slice(i + 1).join("\n");

  function decodeTransfer(text: string, enc: string): string {
    if (enc === "base64") {
      try { return atob(text.replace(/\s/g, "")); } catch { return text; }
    }
    if (enc === "quoted-printable") {
      return text
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return text;
  }

  // Handle multipart MIME
  const boundaryMatch = contentType.match(/boundary="?([^";,\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = bodyRaw.split(new RegExp("--" + escaped + "(?:--|\\r?\\n)"));
    let htmlBody = "";
    let plainBody = "";

    for (const part of parts) {
      if (!part.trim() || part.trim() === "--") continue;
      const partLines = part.split(/\r?\n/);
      const partHeaders: Record<string, string> = {};
      let pi = 0;
      while (pi < partLines.length && partLines[pi].trim() !== "") {
        const sep = partLines[pi].indexOf(":");
        if (sep > 0) {
          partHeaders[partLines[pi].slice(0, sep).toLowerCase().trim()] = partLines[pi].slice(sep + 1).trim();
        }
        pi++;
      }
      const partBody = partLines.slice(pi + 1).join("\n").trimEnd();
      const partType = partHeaders["content-type"] || "text/plain";
      const partEnc = (partHeaders["content-transfer-encoding"] || "").toLowerCase();
      const decoded = decodeTransfer(partBody, partEnc);
      if (partType.includes("text/html")) htmlBody = decoded;
      else if (partType.includes("text/plain")) plainBody = decoded;
    }

    const text = plainBody || (htmlBody ? stripHtml(htmlBody) : bodyRaw);
    return { text: text.trim(), subject, sender };
  }

  // Single-part body
  const decoded = decodeTransfer(bodyRaw, encoding);
  const text = contentType.includes("text/html") ? stripHtml(decoded) : decoded;
  return { text: text.trim(), subject, sender };
}

// ── Add Articles tab ─────────────────────────────────────────────────────────

interface ManualResult {
  articlesAdded: number;
  leadsAdded: number;
  insightsAdded: number;
  articles: ScoredArticle[];
}

function AddArticlesTab({
  onUseForPost,
  onNavigateToBD,
}: {
  onUseForPost: (article: ScoredArticle) => void;
  onNavigateToBD?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualResult | null>(null);
  const [emailMeta, setEmailMeta] = useState<{ subject: string; sender: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailFile = async (file: File) => {
    setError(null);
    try {
      const parsed = file.name.toLowerCase().endsWith(".msg")
        ? await parseMsgFile(file)
        : await parseEmlFile(file);
      setContent(parsed.text);
      setEmailMeta({ subject: parsed.subject, sender: parsed.sender });
    } catch (err) {
      setError(`Failed to read email file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const name = file.name.toLowerCase();
      if (name.endsWith(".msg") || name.endsWith(".eml")) {
        handleEmailFile(file);
        return;
      }
      if (file.type.startsWith("text/")) {
        const reader = new FileReader();
        reader.onload = (ev) => { setContent((ev.target?.result as string) ?? ""); setEmailMeta(null); };
        reader.readAsText(file);
        return;
      }
    }
    // Accept dragged plain text
    const text = e.dataTransfer.getData("text/plain");
    if (text) { setContent((prev) => (prev ? prev + "\n\n" + text : text)); setEmailMeta(null); }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleEmailFile(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/newsletters/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), url: url.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Processing failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "#6F92BF" }}>
        Paste any article, blog post, or press release. Claude will extract the content, score it for relevance, detect any BD signals, and add everything to your Market Intel and BD digest.
      </p>

      {/* Source URL */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
        >
          Source URL <span style={{ color: "#A7B8D1", fontWeight: 400, textTransform: "none" }}>(optional)</span>
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://techcrunch.com/..."
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; }}
        />
      </div>

      {/* Content drop zone */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Article Content
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs transition-colors"
            style={{ color: "#6F92BF" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#323B6A"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6F92BF"; }}
          >
            Browse .msg / .eml
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".msg,.eml"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Email metadata banner */}
        {emailMeta && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg mb-2 text-xs"
            style={{ backgroundColor: "#F0F5EC", border: "1px solid #BDCF7C" }}
          >
            <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#323B6A" }}>
              <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="1.8" />
              <path d="M2 8l10 6 10-6" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div style={{ color: "#323B6A" }}>
              <span className="font-semibold">{emailMeta.subject}</span>
              <span style={{ color: "#6F92BF" }}> · {emailMeta.sender}</span>
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className="relative rounded-xl transition-all"
          style={{
            border: isDragOver ? "2px dashed #BDCF7C" : "1.5px solid #E7EDF3",
            backgroundColor: isDragOver ? "#F0F5EC" : "#FFFFFF",
          }}
        >
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); if (!e.target.value) setEmailMeta(null); }}
            placeholder="Paste newsletter text, drop a URL, or drag an Outlook email (.msg)"
            rows={9}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none bg-transparent"
            style={{ color: "#323B6A" }}
          />
          {isDragOver && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
              style={{ backgroundColor: "rgba(240,245,236,0.8)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "#323B6A" }}>
                Drop .msg, .eml, or text file
              </p>
            </div>
          )}
        </div>
        <p className="text-xs mt-1.5 text-right" style={{ color: "#A7B8D1" }}>
          {content.length} chars
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || isProcessing}
        className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
        style={{
          backgroundColor: !content.trim() || isProcessing ? "#E7EDF3" : "#323B6A",
          color: !content.trim() || isProcessing ? "#A7B8D1" : "#FFFFFF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 700,
          cursor: !content.trim() || isProcessing ? "not-allowed" : "pointer",
          boxShadow: !content.trim() || isProcessing ? "none" : "0 4px 12px rgba(50,59,106,0.3)",
        }}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analysing…
          </span>
        ) : (
          "Extract & Analyse"
        )}
      </button>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary card */}
          <div
            className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
            style={{ backgroundColor: "#F0F5EC", border: "1px solid #BDCF7C" }}
          >
            <span className="text-sm font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Done
            </span>
            <span className="text-sm" style={{ color: "#323B6A" }}>
              {result.articlesAdded} article{result.articlesAdded !== 1 ? "s" : ""} added
              {result.leadsAdded > 0 && ` · ${result.leadsAdded} BD lead${result.leadsAdded !== 1 ? "s" : ""}`}
              {result.insightsAdded > 0 && ` · ${result.insightsAdded} market insight${result.insightsAdded !== 1 ? "s" : ""}`}
            </span>
            {(result.leadsAdded > 0 || result.insightsAdded > 0) && onNavigateToBD && (
              <button
                onClick={onNavigateToBD}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: "#323B6A",
                  color: "#FFFFFF",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                }}
              >
                View in BD Intel →
              </button>
            )}
          </div>

          {/* New articles */}
          {result.articles.length > 0 && (
            <div className="space-y-3">
              {result.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onUse={() => onUseForPost(article)}
                />
              ))}
            </div>
          )}

          {result.articlesAdded === 0 && result.leadsAdded === 0 && result.insightsAdded === 0 && (
            <p className="text-sm text-center" style={{ color: "#A7B8D1" }}>
              No new content found — this article may already be in your pool.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function IntelligencePanel({ onUseForPost, onNavigateToBD }: Props) {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("insight");

  const isLoading = status === "loading";
  const isConnected = status === "authenticated";

  const TAB_LABELS: Record<Tab, string> = {
    insight: "Market Insight",
    sources: "Newsletter Sources",
    manual: "Add Articles",
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Heading */}
      <div className="mb-6">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 700, color: "#323B6A" }}
        >
          Market Insight
        </h1>
        <p className="text-sm" style={{ color: "#6F92BF" }}>
          Newsletter scanner — surface relevant articles and draft posts in one click.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#BDCF7C" strokeWidth="4" />
            <path className="opacity-75" fill="#BDCF7C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm" style={{ color: "#6F92BF" }}>Checking connection…</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Token-expired banner — shown when silent refresh has failed */}
          {session?.error === "RefreshAccessTokenError" && (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl mb-4 text-sm"
              style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC" }}
            >
              <span style={{ color: "#CC4444" }}>
                Microsoft session expired — please reconnect to restore Outlook access.
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

          {/* Tabs — always visible */}
          <div className="flex border-b mb-6" style={{ borderColor: "#E7EDF3" }}>
            {(["insight", "sources", "manual"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-1 py-2.5 mr-6 text-sm font-medium transition-all duration-150"
                style={{
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: 600,
                  color: tab === t ? "#323B6A" : "#A7B8D1",
                  borderBottom: tab === t ? "2px solid #BDCF7C" : "2px solid transparent",
                  backgroundColor: "transparent",
                }}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Market Insight + Newsletter Sources require Outlook auth */}
          {(tab === "insight" || tab === "sources") && !isConnected && (
            <ConnectOutlookScreen />
          )}
          {tab === "insight" && isConnected && session && (
            <MarketInsightTab session={session} onUseForPost={onUseForPost} />
          )}
          {tab === "sources" && isConnected && (
            <NewsletterSourcesTab />
          )}

          {/* Add Articles is always accessible */}
          {tab === "manual" && (
            <AddArticlesTab onUseForPost={onUseForPost} onNavigateToBD={onNavigateToBD} />
          )}
        </>
      )}
    </div>
  );
}
