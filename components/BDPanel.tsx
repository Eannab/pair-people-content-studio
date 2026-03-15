"use client";

import React, { useState, useEffect, useRef } from "react";
import type { BDLead, CompanySignal, MarketInsightSignal } from "@/app/api/bd/signals/route";

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
  onView: () => void;
}

function LeadCard({ lead, isResearching, onView }: LeadCardProps) {
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

      {!isResearched && !isResearching && (
        <p className="text-xs" style={{ color: "#A7B8D1" }}>
          Researching company...
        </p>
      )}

      <button
        onClick={onView}
        disabled={!isResearched}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
        style={{
          backgroundColor: isResearched ? "#BDCF7C" : "#E7EDF3",
          color: isResearched ? "#323B6A" : "#A7B8D1",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          cursor: isResearched ? "pointer" : "not-allowed",
        }}
      >
        {isResearched ? "View Brief →" : "Researching..."}
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
  onLeadUpdate: (updated: BDLead) => void;
}

function LeadDetail({ lead, onBack, onLeadUpdate }: LeadDetailProps) {
  const [draft, setDraft] = useState(lead.outreachDraft ?? "");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ap = lead.australiaPresence;

  const generateDraft = async () => {
    setIsDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch(`/api/bd/draft/${lead.id}`, { method: "POST" });
      if (!res.ok) throw new Error("Draft generation failed");
      const data = await res.json();
      setDraft(data.draft);
      onLeadUpdate(data.lead);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setIsDrafting(false);
    }
  };

  const copyDraft = () => {
    navigator.clipboard.writeText(draft).then(() => {
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
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Outreach Email
          </h2>
          <div className="flex gap-2">
            {draft && (
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
            <button
              onClick={generateDraft}
              disabled={isDrafting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: isDrafting ? "#E7EDF3" : "#323B6A",
                color: isDrafting ? "#A7B8D1" : "#FFFFFF",
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
              ) : draft ? (
                "Regenerate"
              ) : (
                "Generate Draft"
              )}
            </button>
          </div>
        </div>

        {draftError && (
          <div
            className="mb-3 px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
          >
            {draftError}
          </div>
        )}

        {draft ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              border: "1.5px solid #E7EDF3",
              color: "#323B6A",
              backgroundColor: "#FAFBFC",
              lineHeight: "1.6",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#BDCF7C";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E7EDF3";
            }}
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
            Click &ldquo;Generate Draft&rdquo; to create your outreach email
          </div>
        )}
      </div>

      {/* Refine chat */}
      {draft && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <OutreachChat
            companyId={lead.id}
            currentDraft={draft}
            onDraftUpdate={setDraft}
          />
        </div>
      )}
    </div>
  );
}

// ── Main BDPanel ──────────────────────────────────────────────────────────────

interface BDPanelProps {
  onCreatePost?: (context: string) => void;
}

export default function BDPanel({ onCreatePost }: BDPanelProps) {
  const [leads, setLeads] = useState<BDLead[]>([]);
  const [marketInsights, setMarketInsights] = useState<MarketInsightSignal[]>([]);
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());
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
    try {
      const res = await fetch(`/api/bd/research/${lead.id}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
    } catch {
      // Research failed — keep partial lead
    } finally {
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

      // Auto-research all BD leads in parallel
      newLeads.forEach((lead) => researchLead(lead));
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setIsDetecting(false);
    }
  };

  const updateLead = (updated: BDLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleCreatePost = (context: string) => {
    onCreatePost?.(context);
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
      <div className="mb-8">
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
          Detects funding, hiring, and launch signals from your newsletter scan. Australian startups and scale-ups become BD leads. Large or global companies surface as Market Insight content ideas.
        </p>
      </div>

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

      {/* Error */}
      {detectError && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
        >
          <strong>Error:</strong> {detectError}
        </div>
      )}

      {/* Empty state */}
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

      {/* BD Leads section */}
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
                onView={() => setSelectedLead(lead)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Market Insights section */}
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
                onCreatePost={handleCreatePost}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
