"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { BDLead, CompanySignal, MarketInsightSignal } from "@/app/api/bd/signals/route";
import type { PipelineLead } from "@/app/api/bd/pipeline/route";

// ── Sub-components ────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: CompanySignal }) {
  const styles: Record<CompanySignal["type"], { bg: string; color: string }> = {
    funded: { bg: "#BDCF7C", color: "#323B6A" },
    hiring: { bg: "#6F92BF", color: "#FFFFFF" },
    launch: { bg: "#E8A838", color: "#323B6A" },
  };
  const s = styles[signal.type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: s.bg,
        color: s.color,
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      {signal.type === "funded" ? "⚡" : signal.type === "hiring" ? "👥" : "🚀"}{" "}
      {signal.label}
    </span>
  );
}

function SectorTag({ sector }: { sector: BDLead["sector"] }) {
  const labels: Record<BDLead["sector"], string> = {
    defence: "Defence/DeepTech",
    ai: "AI/ML",
    healthtech: "Healthtech",
    sydney: "Sydney",
    general: "General",
  };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-md"
      style={{
        backgroundColor: "#E7EDF3",
        color: "#6F92BF",
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
        fontWeight: 600,
      }}
    >
      {labels[sector]}
    </span>
  );
}

function ConfidenceDot({ confidence }: { confidence: BDLead["confidence"] }) {
  const colors = { high: "#BDCF7C", medium: "#E8A838", low: "#A7B8D1" };
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "#6F92BF" }}>
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: colors[confidence] }}
      />
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
    </span>
  );
}

function RelevanceBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#E7EDF3" }}>
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${score * 10}%`,
            backgroundColor: score >= 7 ? "#BDCF7C" : score >= 4 ? "#E8A838" : "#A7B8D1",
          }}
        />
      </div>
      <span
        className="text-xs font-semibold"
        style={{ color: "#323B6A", minWidth: "2ch" }}
      >
        {score}
      </span>
    </div>
  );
}

function TechPill({ label }: { label: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-md text-xs"
      style={{
        backgroundColor: "#E7EDF3",
        color: "#323B6A",
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      {label}
    </span>
  );
}

/** Flag shown on lead cards to indicate AU presence */
function AUPresenceTag({
  basedInAustralia,
  hiringInAustralia,
  detail,
}: {
  basedInAustralia: boolean;
  hiringInAustralia: boolean;
  detail: string;
}) {
  if (!basedInAustralia && !hiringInAustralia) return null;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: basedInAustralia ? "#EEF4FF" : "#F0F5EC",
        color: basedInAustralia ? "#323B6A" : "#4A6B3A",
        border: basedInAustralia ? "1px solid #A7B8D1" : "1px solid #BDCF7C",
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
      title={detail}
    >
      🇦🇺 {basedInAustralia ? detail || "AU-based" : "Hiring in AU"}
    </span>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: BDLead;
  isResearching: boolean;
  hasFailed: boolean;
  onView: () => void;
  onRetry: () => void;
}

function LeadCard({ lead, isResearching, hasFailed, onView, onRetry }: LeadCardProps) {
  const isResearched = !!lead.researchedAt;
  const ap = lead.australiaPresence;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1.5px solid #E7EDF3",
        opacity: isResearching ? 0.7 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <h3
            className="text-base leading-tight"
            style={{
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 700,
              color: "#323B6A",
            }}
          >
            {lead.companyName}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <SectorTag sector={lead.sector} />
            {ap && (ap.basedInAustralia || ap.hiringInAustralia) && (
              <AUPresenceTag
                basedInAustralia={ap.basedInAustralia}
                hiringInAustralia={ap.hiringInAustralia}
                detail={ap.detail}
              />
            )}
          </div>
        </div>
        {isResearching && (
          <svg
            className="w-4 h-4 animate-spin flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            style={{ color: "#6F92BF" }}
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-1.5">
        {lead.signals.map((s, i) => (
          <SignalBadge key={i} signal={s} />
        ))}
      </div>

      {/* Relevance */}
      <div>
        <p className="text-xs mb-1" style={{ color: "#A7B8D1" }}>
          Relevance
        </p>
        <RelevanceBar score={lead.relevanceScore} />
      </div>

      {/* Researched data */}
      {isResearched && (
        <>
          {lead.relevanceReason && (
            <p className="text-sm" style={{ color: "#6F92BF" }}>
              {lead.relevanceReason}
            </p>
          )}
          {lead.hiringContact.name && (
            <div
              className="flex items-center gap-1.5 text-sm"
              style={{ color: "#323B6A" }}
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#A7B8D1" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span style={{ fontWeight: 500 }}>{lead.hiringContact.name}</span>
              <span style={{ color: "#A7B8D1" }}>{lead.hiringContact.title}</span>
            </div>
          )}
          <ConfidenceDot confidence={lead.confidence} />
        </>
      )}

      {!isResearched && isResearching && (
        <p className="text-xs" style={{ color: "#A7B8D1" }}>
          Researching company…
        </p>
      )}

      {!isResearched && hasFailed && !isResearching && (
        <p className="text-xs" style={{ color: "#CC4444" }}>
          Research failed — click to retry
        </p>
      )}

      {!isResearched && !isResearching && !hasFailed && (
        <p className="text-xs" style={{ color: "#A7B8D1" }}>
          Queued for research…
        </p>
      )}

      <button
        onClick={hasFailed && !isResearched ? onRetry : onView}
        disabled={isResearching || (!isResearched && !hasFailed)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
        style={{
          backgroundColor: isResearched ? "#BDCF7C" : hasFailed ? "#FFF0F0" : "#E7EDF3",
          color: isResearched ? "#323B6A" : hasFailed ? "#CC4444" : "#A7B8D1",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          cursor: isResearched || hasFailed ? "pointer" : "not-allowed",
          border: hasFailed && !isResearched ? "1px solid #FFCCCC" : "none",
        }}
      >
        {isResearching
          ? "Researching…"
          : isResearched
          ? "View Brief →"
          : hasFailed
          ? "Retry Research"
          : "Researching…"}
      </button>
    </div>
  );
}

// ── Market Insight Card ───────────────────────────────────────────────────────

interface MarketInsightCardProps {
  insight: MarketInsightSignal;
  onCreatePost: (context: string) => void;
}

function MarketInsightCard({ insight, onCreatePost }: MarketInsightCardProps) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: "#FAFBFC",
        border: "1.5px solid #E7EDF3",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <h4
            className="text-sm leading-tight"
            style={{
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
              color: "#323B6A",
            }}
          >
            {insight.companyName}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <SectorTag sector={insight.sector} />
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: "#E7EDF3",
                color: "#6F92BF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
              }}
            >
              Market Insight
            </span>
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-1.5">
        {insight.signals.map((s, i) => (
          <SignalBadge key={i} signal={s} />
        ))}
      </div>

      {/* Why excluded */}
      <p className="text-xs" style={{ color: "#A7B8D1" }}>
        {insight.whyExcluded}
      </p>

      <button
        onClick={() => onCreatePost(insight.postContext)}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
        style={{
          backgroundColor: "#E7EDF3",
          color: "#6F92BF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          border: "1px solid #A7B8D1",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#6F92BF";
          (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E7EDF3";
          (e.currentTarget as HTMLButtonElement).style.color = "#6F92BF";
        }}
      >
        Create Post from this →
      </button>
    </div>
  );
}

// ── Outreach Chat ─────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OutreachChatProps {
  companyId: string;
  currentDraft: string;
  onDraftUpdate: (draft: string) => void;
}

function OutreachChat({ companyId, currentDraft, onDraftUpdate }: OutreachChatProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/bd/thread/${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.history?.length > 0) setHistory(d.history);
      })
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/bd/thread/${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, currentDraft }),
      });
      if (!res.ok) throw new Error("Thread request failed");
      const data = await res.json();

      setHistory(
        data.updatedHistory.map((m: ChatMessage) => ({
          role: m.role,
          content: m.role === "assistant" ? (data.reply || m.content) : m.content,
        }))
      );
      if (data.updatedDraft) onDraftUpdate(data.updatedDraft);
    } catch {
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
      >
        Refine with AI
      </p>

      {history.length > 0 && (
        <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm"
                style={{
                  backgroundColor: msg.role === "user" ? "#323B6A" : "#FFFFFF",
                  color: msg.role === "user" ? "#FFFFFF" : "#323B6A",
                  border: msg.role === "assistant" ? "1.5px solid #E7EDF3" : "none",
                  borderRadius:
                    msg.role === "user"
                      ? "1rem 1rem 0.25rem 1rem"
                      : "1rem 1rem 1rem 0.25rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1.5px solid #E7EDF3",
                  color: "#A7B8D1",
                  borderRadius: "1rem 1rem 1rem 0.25rem",
                }}
              >
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Make it shorter, change the hook, be more direct..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            border: "1.5px solid #E7EDF3",
            color: "#323B6A",
            backgroundColor: "#FFFFFF",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#6F92BF";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E7EDF3";
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            backgroundColor: !input.trim() || isLoading ? "#E7EDF3" : "#6F92BF",
            color: !input.trim() || isLoading ? "#A7B8D1" : "#FFFFFF",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ── Lead Detail View ──────────────────────────────────────────────────────────

interface LeadDetailProps {
  lead: BDLead;
  onBack: () => void;
  onLeadUpdate?: (updated: BDLead) => void;
}

function LeadDetail({ lead, onBack, onLeadUpdate }: LeadDetailProps) {
  const [candidateDraft, setCandidateDraft] = useState("");
  const [introDraft, setIntroDraft] = useState("");
  const [activeDraftType, setActiveDraftType] = useState<"candidate" | "intro">("candidate");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isResearching, setIsResearching] = useState(false);

  const activeDraft = activeDraftType === "candidate" ? candidateDraft : introDraft;
  const setActiveDraft = (val: string) => {
    if (activeDraftType === "candidate") setCandidateDraft(val);
    else setIntroDraft(val);
  };
  const ap = lead.australiaPresence;

  // Load both saved drafts on mount
  React.useEffect(() => {
    Promise.all([
      fetch(`/api/bd/draft/${lead.id}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/bd/draft/${lead.id}?type=intro`).then((r) => r.json()).catch(() => ({})),
    ]).then(([cData, iData]) => {
      if (cData.draft) setCandidateDraft(cData.draft);
      if (iData.draft) setIntroDraft(iData.draft);
    });
  }, [lead.id]);

  // Auto-trigger research if brief is empty
  React.useEffect(() => {
    if (lead.overview || lead.researchedAt) return;
    setIsResearching(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    fetch(`/api/bd/research/${lead.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: lead.companyName }),
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.lead && onLeadUpdate) onLeadUpdate(data.lead);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setIsResearching(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const generateDraft = async (type: "candidate" | "intro") => {
    setActiveDraftType(type);
    setIsDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch(`/api/bd/draft/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Draft generation failed");
      const data = await res.json();
      if (type === "candidate") setCandidateDraft(data.draft);
      else setIntroDraft(data.draft);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setIsDrafting(false);
    }
  };

  const copyDraft = () => {
    navigator.clipboard.writeText(activeDraft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "#6F92BF" }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to digest
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1
            className="text-2xl"
            style={{
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 700,
              color: "#323B6A",
            }}
          >
            {lead.companyName}
          </h1>
          <SectorTag sector={lead.sector} />
          {ap && (ap.basedInAustralia || ap.hiringInAustralia) && (
            <AUPresenceTag
              basedInAustralia={ap.basedInAustralia}
              hiringInAustralia={ap.hiringInAustralia}
              detail={ap.detail}
            />
          )}
          <ConfidenceDot confidence={lead.confidence} />
          {isResearching && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#6F92BF" }}>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Researching…
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.signals.map((s, i) => (
            <SignalBadge key={i} signal={s} />
          ))}
        </div>
      </div>

      {/* Company brief */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
        >
          Company Brief
        </h2>

        {lead.overview && (
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#A7B8D1" }}>
              Overview
            </p>
            <p className="text-sm" style={{ color: "#323B6A" }}>
              {lead.overview}
            </p>
          </div>
        )}

        {lead.techStack.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#A7B8D1" }}>
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.techStack.map((t) => (
                <TechPill key={t} label={t} />
              ))}
            </div>
          </div>
        )}

        {lead.recentActivity && (
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#A7B8D1" }}>
              Recent Activity
            </p>
            <p className="text-sm" style={{ color: "#323B6A" }}>
              {lead.recentActivity}
            </p>
          </div>
        )}

        {lead.relevanceReason && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: "#F0F5EC", border: "1px solid #BDCF7C" }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: "#323B6A" }}>
              Why reach out now
            </p>
            <p className="text-sm" style={{ color: "#323B6A" }}>
              {lead.relevanceReason}
            </p>
          </div>
        )}
      </div>

      {/* Signals */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
        >
          Signals
        </h2>
        <div className="flex flex-col gap-3">
          {lead.signals.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 pt-0.5">
                <SignalBadge signal={s} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "#323B6A" }}>
                  {s.context}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#A7B8D1" }}>
                  {s.articleTitle} · {s.articleSource}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hiring contact */}
      {lead.hiringContact.name && (
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-3"
            style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Hiring Contact
          </h2>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: "#E7EDF3", color: "#323B6A" }}
            >
              {lead.hiringContact.name.charAt(0)}
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{
                  color: "#323B6A",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                }}
              >
                {lead.hiringContact.name}
              </p>
              <p className="text-xs" style={{ color: "#6F92BF" }}>
                {lead.hiringContact.title}
              </p>
            </div>
            {lead.hiringContact.linkedInUrl && (
              <a
                href={lead.hiringContact.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: "#E7EDF3",
                  color: "#6F92BF",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: 600,
                }}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                LinkedIn
              </a>
            )}
          </div>
        </div>
      )}

      {/* Outreach email */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Outreach Email
          </h2>
          {activeDraft && (
            <button
              onClick={copyDraft}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: copied ? "#BDCF7C" : "#E7EDF3",
                color: copied ? "#323B6A" : "#6F92BF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>

        {/* Type selector + generate buttons */}
        <div className="flex gap-2 mb-4">
          {(["candidate", "intro"] as const).map((type) => {
            const isActive = activeDraftType === type;
            const isThisDrafting = isDrafting && isActive;
            const label = type === "candidate" ? "With Candidate" : "Without Candidate";
            const hasDraft = type === "candidate" ? !!candidateDraft : !!introDraft;
            return (
              <button
                key={type}
                onClick={() => {
                  if (activeDraftType !== type) {
                    setActiveDraftType(type);
                    return;
                  }
                  generateDraft(type);
                }}
                onDoubleClick={() => generateDraft(type)}
                disabled={isThisDrafting}
                title={isActive ? (hasDraft ? "Double-click to regenerate" : `Generate ${label} email`) : `Switch to ${label}`}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  backgroundColor: isThisDrafting
                    ? "#E7EDF3"
                    : isActive
                    ? "#323B6A"
                    : "#E7EDF3",
                  color: isThisDrafting
                    ? "#A7B8D1"
                    : isActive
                    ? "#FFFFFF"
                    : "#6F92BF",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: 600,
                  cursor: isThisDrafting ? "not-allowed" : "pointer",
                  border: isActive && !isThisDrafting ? "none" : "1.5px solid #E7EDF3",
                }}
              >
                {isThisDrafting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Drafting...
                  </>
                ) : (
                  label
                )}
              </button>
            );
          })}
          {/* Generate / Regenerate button for active type */}
          <button
            onClick={() => generateDraft(activeDraftType)}
            disabled={isDrafting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ml-auto"
            style={{
              backgroundColor: isDrafting ? "#E7EDF3" : "#BDCF7C",
              color: isDrafting ? "#A7B8D1" : "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
              cursor: isDrafting ? "not-allowed" : "pointer",
            }}
          >
            {isDrafting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Drafting...
              </>
            ) : activeDraft ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </button>
        </div>

        {draftError && (
          <div
            className="mb-3 px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
          >
            {draftError}
          </div>
        )}

        {activeDraft ? (
          <textarea
            value={activeDraft}
            onChange={(e) => setActiveDraft(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              border: "1.5px solid #E7EDF3",
              color: "#323B6A",
              backgroundColor: "#FAFBFC",
              lineHeight: "1.6",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; }}
          />
        ) : (
          <div
            className="h-28 rounded-xl flex items-center justify-center text-sm"
            style={{
              backgroundColor: "#FAFBFC",
              border: "1.5px dashed #E7EDF3",
              color: "#A7B8D1",
            }}
          >
            {activeDraftType === "candidate"
              ? "Pitch a matched candidate from your CV index"
              : "Introduce Pair People — no specific candidate"}
          </div>
        )}
      </div>

      {/* Refine chat */}
      {activeDraft && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <OutreachChat
            companyId={lead.id}
            currentDraft={activeDraft}
            onDraftUpdate={setActiveDraft}
          />
        </div>
      )}
    </div>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────────

const ADD_LEAD_STEPS = [
  "Searching the web…",
  "Building company brief…",
  "Generating outreach draft…",
];

function AddLeadModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (entry: PipelineLead) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    lead: BDLead;
    pipelineEntry: PipelineLead;
    draft: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    setStepIdx(0);
    intervalRef.current = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, ADD_LEAD_STEPS.length - 1));
    }, 5000);
  };

  const stopProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleAdd = async () => {
    const name = companyName.trim();
    if (!name) return;
    setPhase("loading");
    setError("");
    startProgress();

    try {
      const res = await fetch("/api/bd/add-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add lead");

      stopProgress();
      setResult(data);
      setPhase("done");
      if (data.pipelineEntry) onAdded(data.pipelineEntry);
    } catch (err) {
      stopProgress();
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(50,59,106,0.5)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0 20px 60px rgba(50,59,106,0.25)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-bold"
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: "#323B6A" }}
          >
            Add Lead Manually
          </h3>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ backgroundColor: "#E7EDF3", color: "#6F92BF" }}
          >
            Close
          </button>
        </div>

        {phase === "idle" && (
          <>
            <p className="text-xs" style={{ color: "#6F92BF" }}>
              Enter a company name. We&apos;ll search the web, build a company brief, and generate an outreach draft automatically.
            </p>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g. Canva, Atlassian, Rokt…"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#BDCF7C")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E7EDF3")}
            />
            <button
              onClick={handleAdd}
              disabled={!companyName.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{
                backgroundColor: companyName.trim() ? "#323B6A" : "#E7EDF3",
                color: companyName.trim() ? "#FFFFFF" : "#A7B8D1",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                cursor: companyName.trim() ? "pointer" : "not-allowed",
              }}
            >
              Research &amp; Add
            </button>
          </>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "#BDCF7C" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="text-center">
              <p
                className="text-sm font-semibold mb-1"
                style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: "#323B6A" }}
              >
                {companyName}
              </p>
              <p className="text-xs" style={{ color: "#6F92BF" }}>
                {ADD_LEAD_STEPS[stepIdx]}
              </p>
            </div>
            <div className="flex gap-1.5 mt-2">
              {ADD_LEAD_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: i <= stepIdx ? 24 : 8,
                    backgroundColor: i <= stepIdx ? "#BDCF7C" : "#E7EDF3",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {phase === "error" && (
          <>
            <p className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: "#FFF0F0", color: "#CC4444" }}>
              {error}
            </p>
            <button
              onClick={() => { setPhase("idle"); setError(""); }}
              className="text-sm py-2.5 rounded-xl font-semibold"
              style={{ backgroundColor: "#E7EDF3", color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
            >
              Try again
            </button>
          </>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "#F6FAF0", border: "1.5px solid #BDCF7C" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p
                    className="font-bold text-sm mb-0.5"
                    style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: "#323B6A" }}
                  >
                    {result.lead.companyName}
                  </p>
                  <p className="text-xs" style={{ color: "#6F92BF" }}>
                    {result.lead.sector} · Score {result.lead.relevanceScore}/10 · {result.lead.confidence} confidence
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "#BDCF7C", color: "#323B6A" }}
                >
                  Added to pipeline
                </span>
              </div>
              {result.lead.overview && (
                <p className="text-xs leading-relaxed" style={{ color: "#323B6A" }}>
                  {result.lead.overview}
                </p>
              )}
              {result.lead.australiaPresence.detail && (
                <p className="text-xs mt-1.5" style={{ color: "#6F92BF" }}>
                  AU: {result.lead.australiaPresence.detail}
                </p>
              )}
            </div>

            {result.draft && (
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#FAFBFC", border: "1px solid #E7EDF3" }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", color: "#323B6A" }}
                >
                  Outreach draft ready
                </p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#6F92BF" }}>
                  {result.draft.substring(0, 300)}{result.draft.length > 300 ? "…" : ""}
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{
                backgroundColor: "#323B6A",
                color: "#FFFFFF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline view ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PipelineLead["status"],
  { label: string; bg: string; color: string }
> = {
  new:       { label: "New",       bg: "#323B6A", color: "#FFFFFF" },
  contacted: { label: "Contacted", bg: "#6F92BF", color: "#FFFFFF" },
  replied:   { label: "Replied",   bg: "#E8A838", color: "#323B6A" },
  converted: { label: "Converted", bg: "#BDCF7C", color: "#323B6A" },
  dismissed: { label: "Dismissed", bg: "#E7EDF3", color: "#A7B8D1" },
};

function PipelineRow({
  lead: initial,
  onViewBrief,
}: {
  lead: PipelineLead;
  onViewBrief: () => void;
}) {
  const [lead, setLead] = useState(initial);
  const [localNotes, setLocalNotes] = useState(initial.notes);
  const [saved, setSaved] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback(
    async (update: Partial<Pick<PipelineLead, "status" | "notes">>) => {
      try {
        const res = await fetch(`/api/bd/pipeline/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        if (res.ok) {
          const data = await res.json();
          setLead(data.lead);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } catch {}
    },
    [lead.id]
  );

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as PipelineLead["status"];
    setLead((prev) => ({ ...prev, status }));
    patch({ status });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const notes = e.target.value;
    setLocalNotes(notes);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => patch({ notes }), 800);
  };

  const handleDelete = async () => {
    try {
      await fetch(`/api/bd/pipeline/${lead.id}`, { method: "DELETE" });
      // Parent will re-fetch; optimistically hide row
      setLead((prev) => ({ ...prev, status: "dismissed" }));
    } catch {}
  };

  const sm = STATUS_META[lead.status];
  const dateStr = new Date(lead.dateAdded).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1.5px solid #E7EDF3",
        opacity: lead.status === "dismissed" ? 0.5 : 1,
      }}
    >
      {/* Top row: name, sector, signal, date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            {lead.companyName}
          </span>
          <SectorTag sector={lead.sector} />
          {lead.signals[0] && <SignalBadge signal={lead.signals[0]} />}
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: "#A7B8D1" }}>
          {dateStr}
        </span>
      </div>

      {/* View Brief button */}
      <div>
        <button
          onClick={onViewBrief}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150"
          style={{
            backgroundColor: "#E7EDF3",
            color: "#323B6A",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#323B6A";
            (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E7EDF3";
            (e.currentTarget as HTMLButtonElement).style.color = "#323B6A";
          }}
        >
          View Brief →
        </button>
      </div>

      {/* Bottom row: notes, status, saved indicator, delete */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={localNotes}
          onChange={handleNotesChange}
          placeholder="Add notes, e.g. spoke to CTO 14 March…"
          className="flex-1 px-3 py-2 rounded-lg text-xs outline-none min-w-0"
          style={{
            border: "1.5px solid #E7EDF3",
            color: "#323B6A",
            backgroundColor: "#FAFBFC",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; }}
        />
        {saved && (
          <span className="text-xs flex-shrink-0" style={{ color: "#BDCF7C" }}>
            ✓
          </span>
        )}
        <select
          value={lead.status}
          onChange={handleStatusChange}
          className="text-xs px-2 py-2 rounded-lg outline-none flex-shrink-0 font-semibold"
          style={{
            backgroundColor: sm.bg,
            color: sm.color,
            border: "none",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            cursor: "pointer",
          }}
        >
          {(Object.keys(STATUS_META) as PipelineLead["status"][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button
          onClick={handleDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
          style={{ color: "#A7B8D1" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF0F0";
            (e.currentTarget as HTMLButtonElement).style.color = "#CC4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#A7B8D1";
          }}
          title="Remove from pipeline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PipelineTab({
  onViewBrief,
}: {
  onViewBrief: (companyId: string | undefined, companyName: string) => void;
}) {
  const [pipeline, setPipeline] = useState<PipelineLead[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetch("/api/bd/pipeline")
      .then((r) => r.json())
      .then((d) => setPipeline(d.pipeline ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLeadAdded = (entry: PipelineLead) => {
    setPipeline((prev) => {
      const exists = prev.some((p) => p.id === entry.id);
      return exists ? prev : [entry, ...prev];
    });
  };

  const active = pipeline.filter((l) => l.status !== "dismissed");
  const dismissed = pipeline.filter((l) => l.status === "dismissed");
  const visible = showDismissed ? pipeline : active;

  const sorted = [...visible].sort((a, b) => {
    if (a.status === "converted" && b.status !== "converted") return 1;
    if (b.status === "converted" && a.status !== "converted") return -1;
    return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  });

  const AddLeadButton = () => (
    <button
      onClick={() => setShowAddModal(true)}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
      style={{
        backgroundColor: "#323B6A",
        color: "#FFFFFF",
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
      Add Lead
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8" style={{ color: "#A7B8D1" }}>
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Loading pipeline…</span>
      </div>
    );
  }

  // Status summary counts
  const counts = active.reduce(
    (acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <>
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleLeadAdded}
        />
      )}

      {pipeline.length === 0 ? (
        <div
          className="rounded-2xl p-10 flex flex-col items-center text-center gap-4"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px dashed #E7EDF3" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: "#E7EDF3" }}
          >
            📋
          </div>
          <div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
            >
              Pipeline is empty
            </p>
            <p className="text-sm mb-4" style={{ color: "#A7B8D1" }}>
              Detect signals in the Digest tab to add leads automatically, or add one manually.
            </p>
            <AddLeadButton />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Summary bar + Add Lead button */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_META) as PipelineLead["status"][])
                .filter((s) => s !== "dismissed" && counts[s])
                .map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ backgroundColor: STATUS_META[s].bg, color: STATUS_META[s].color }}
                  >
                    {STATUS_META[s].label} {counts[s]}
                  </span>
                ))}
            </div>
            <AddLeadButton />
          </div>

          {/* Lead rows */}
          <div className="flex flex-col gap-2">
            {sorted.map((lead) => (
              <PipelineRow
                key={lead.id}
                lead={lead}
                onViewBrief={() => onViewBrief(lead.companyId, lead.companyName)}
              />
            ))}
          </div>

          {/* Dismissed toggle */}
          {dismissed.length > 0 && (
            <button
              onClick={() => setShowDismissed((v) => !v)}
              className="text-xs py-2 transition-all"
              style={{ color: "#A7B8D1" }}
            >
              {showDismissed
                ? `Hide dismissed (${dismissed.length})`
                : `Show dismissed (${dismissed.length})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Main BDPanel ──────────────────────────────────────────────────────────────

interface BDPanelProps {
  onCreatePost?: (context: string) => void;
}

export default function BDPanel({ onCreatePost }: BDPanelProps) {
  const [activeTab, setActiveTab] = useState<"digest" | "pipeline">("digest");
  const [leads, setLeads] = useState<BDLead[]>([]);
  const [marketInsights, setMarketInsights] = useState<MarketInsightSignal[]>([]);
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<BDLead | null>(null);
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  // Load existing data on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/bd/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
      fetch("/api/bd/market-insights").then((r) => r.json()).catch(() => ({ insights: [] })),
    ]).then(([leadsData, insightsData]) => {
      if (leadsData.leads?.length > 0) setLeads(leadsData.leads);
      if (insightsData.insights?.length > 0) setMarketInsights(insightsData.insights);
    });
  }, []);

  // Keep selectedLead in sync with leads array
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find((l) => l.id === selectedLead.id);
      if (updated) setSelectedLead(updated);
    }
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const researchLead = async (lead: BDLead) => {
    setResearchingIds((prev) => new Set(prev).add(lead.id));
    // Clear any prior failure so the spinner shows while retrying
    setFailedIds((prev) => { const next = new Set(prev); next.delete(lead.id); return next; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch(`/api/bd/research/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: lead.companyName }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setFailedIds((prev) => new Set(prev).add(lead.id));
        return;
      }
      const data = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
    } catch {
      setFailedIds((prev) => new Set(prev).add(lead.id));
    } finally {
      clearTimeout(timeout);
      setResearchingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  const detectSignals = async () => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      const res = await fetch("/api/bd/signals", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Signal detection failed");
      }
      const data = await res.json();
      const newLeads: BDLead[] = data.leads ?? [];
      const newInsights: MarketInsightSignal[] = data.marketInsights ?? [];

      setLeads(newLeads);
      setMarketInsights(newInsights);
      setLastDetected(new Date().toISOString());

      // Auto-research all BD leads, staggered 2s apart to avoid hammering the API
      (async () => {
        for (let i = 0; i < newLeads.length; i++) {
          if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, 2000));
          researchLead(newLeads[i]);
        }
      })();
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setIsDetecting(false);
    }
  };

  const updateLead = (updated: BDLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  if (selectedLead) {
    return (
      <LeadDetail
        lead={selectedLead}
        onBack={() => setSelectedLead(null)}
        onLeadUpdate={updateLead}
      />
    );
  }

  const sortedLeads = [...leads].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const isEmpty = leads.length === 0 && marketInsights.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl mb-1"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 700,
            color: "#323B6A",
          }}
        >
          BD Intelligence
        </h1>
        <p className="text-sm" style={{ color: "#6F92BF" }}>
          Detects funding, hiring, and launch signals. Australian startups become BD leads. Large or global companies surface as Market Insight content ideas.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b mb-6" style={{ borderColor: "#E7EDF3" }}>
        {(["digest", "pipeline"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="px-1 py-2.5 mr-6 text-sm font-medium transition-all duration-150"
            style={{
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
              color: activeTab === t ? "#323B6A" : "#A7B8D1",
              borderBottom: activeTab === t ? "2px solid #BDCF7C" : "2px solid transparent",
              backgroundColor: "transparent",
            }}
          >
            {t === "digest" ? "Digest" : "Pipeline"}
          </button>
        ))}
      </div>

      {/* Pipeline tab */}
      {activeTab === "pipeline" && (
        <PipelineTab
          onViewBrief={async (companyId, companyName) => {
            // Try local state first
            const found = leads.find(
              (l) =>
                (companyId && l.id === companyId) ||
                l.companyName.toLowerCase() === companyName.toLowerCase()
            );
            if (found) {
              setSelectedLead(found);
              return;
            }
            // Lead not in local state — fetch fresh (e.g. added manually or from a previous scan)
            try {
              const res = await fetch("/api/bd/leads");
              const data = await res.json();
              const freshLeads: BDLead[] = data.leads ?? [];
              const lead = freshLeads.find(
                (l) =>
                  (companyId && l.id === companyId) ||
                  l.companyName.toLowerCase() === companyName.toLowerCase()
              );
              if (lead) {
                setLeads(freshLeads);
                setSelectedLead(lead);
                return;
              }
            } catch {}
            // Not in bd:leads at all (expired TTL or manually added) — open brief with
            // a stub so the button is never a no-op
            setSelectedLead({
              id: companyId ?? companyName,
              companyName,
              sector: "general",
              signals: [],
              australiaPresence: { basedInAustralia: false, hiringInAustralia: false, detail: "" },
              overview: "",
              techStack: [],
              recentActivity: "",
              relevanceScore: 5,
              relevanceReason: "",
              hiringContact: { name: "", title: "", linkedInUrl: "" },
              confidence: "medium",
              createdAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {/* Digest tab */}
      {activeTab === "digest" && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              {lastDetected && (
                <p className="text-xs" style={{ color: "#A7B8D1" }}>
                  Last detected{" "}
                  {new Date(lastDetected).toLocaleString("en-AU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
              {!isEmpty && !lastDetected && (
                <p className="text-xs" style={{ color: "#A7B8D1" }}>
                  {leads.length} lead{leads.length !== 1 ? "s" : ""} · {marketInsights.length} market insight
                  {marketInsights.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!isEmpty && (
                <button
                  onClick={() => {
                    setLeads([]);
                    setMarketInsights([]);
                    fetch("/api/bd/leads", { method: "DELETE" }).catch(() => {});
                  }}
                  className="text-xs px-3 py-2 rounded-xl transition-all"
                  style={{ color: "#A7B8D1", backgroundColor: "#E7EDF3" }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={detectSignals}
                disabled={isDetecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: isDetecting ? "#E7EDF3" : "#323B6A",
                  color: isDetecting ? "#A7B8D1" : "#FFFFFF",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  cursor: isDetecting ? "not-allowed" : "pointer",
                  boxShadow: isDetecting ? "none" : "0 4px 12px rgba(50, 59, 106, 0.3)",
                }}
              >
                {isDetecting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Detecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {!isEmpty ? "Re-scan" : "Detect Signals"}
                  </>
                )}
              </button>
            </div>
          </div>

          {detectError && (
            <div
              className="mb-6 px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
            >
              <strong>Error:</strong> {detectError}
            </div>
          )}

          {isEmpty && !isDetecting && (
            <div
              className="rounded-2xl p-10 flex flex-col items-center text-center gap-4"
              style={{ backgroundColor: "#FFFFFF", border: "1.5px dashed #E7EDF3" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: "#E7EDF3" }}
              >
                ⚡
              </div>
              <div>
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                >
                  No signals detected yet
                </p>
                <p className="text-sm" style={{ color: "#A7B8D1" }}>
                  Run a newsletter scan in the Market Intel tab first, then click Detect Signals.
                </p>
              </div>
            </div>
          )}

          {sortedLeads.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                >
                  BD Leads
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "#BDCF7C", color: "#323B6A" }}
                >
                  {sortedLeads.length}
                </span>
                <span className="text-xs" style={{ color: "#A7B8D1" }}>
                  · AU-based or hiring in AU · under 200 people
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isResearching={researchingIds.has(lead.id)}
                    hasFailed={failedIds.has(lead.id)}
                    onView={() => setSelectedLead(lead)}
                    onRetry={() => researchLead(lead)}
                  />
                ))}
              </div>
            </div>
          )}

          {marketInsights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                >
                  Market Insights
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "#E7EDF3", color: "#6F92BF" }}
                >
                  {marketInsights.length}
                </span>
                <span className="text-xs" style={{ color: "#A7B8D1" }}>
                  · interesting news · not BD leads · great for content
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {marketInsights.map((insight) => (
                  <MarketInsightCard
                    key={insight.id}
                    insight={insight}
                    onCreatePost={(ctx) => onCreatePost?.(ctx)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
