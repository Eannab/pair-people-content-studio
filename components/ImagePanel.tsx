"use client";

import React, { useState, useEffect } from "react";
import BrandedCanvas, {
  CardType,
  PullQuoteData,
  RoleBadgeData,
  StatCardData,
} from "./BrandedCanvas";

type ImageMode = "none" | "ai" | "branded";

interface Props {
  content: string;
  postType?: string;
}

// ── Mode toggle ──────────────────────────────────────────────────────────────

const MODES: { id: ImageMode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "ai", label: "AI Image" },
  { id: "branded", label: "Branded" },
];

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ImageMode;
  onChange: (m: ImageMode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-semibold uppercase tracking-wider mr-1"
        style={{
          color: "#323B6A",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
        }}
      >
        Image
      </span>
      {MODES.map(({ id, label }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="px-3 py-1.5 rounded-full text-xs transition-all duration-150"
            style={{
              backgroundColor: active ? "#323B6A" : "#FFFFFF",
              color: active ? "#FFFFFF" : "#6F92BF",
              border: active ? "1.5px solid #323B6A" : "1.5px solid #A7B8D1",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: active ? 600 : 400,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── AI Image section ─────────────────────────────────────────────────────────

interface ImageConcept {
  id: number;
  title: string;
  description: string;
  dallePrompt: string;
}

type AIStage = "idle" | "loading_concepts" | "concepts" | "generating" | "done";

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function AIImageSection({
  content,
  postType,
}: {
  content: string;
  postType?: string;
}) {
  const [direction, setDirection] = useState("");
  const [stage, setStage] = useState<AIStage>("idle");
  const [concepts, setConcepts] = useState<ImageConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<ImageConcept | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [usedPrompt, setUsedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateConcepts = async () => {
    setStage("loading_concepts");
    setError(null);
    setConcepts([]);
    setSelectedConcept(null);
    setImageUrl(null);
    setUsedPrompt(null);

    try {
      const res = await fetch("/api/generate-image/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postContent: content, direction, postType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Concept generation failed");
      setConcepts(data.concepts ?? []);
      setStage("concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
    }
  };

  const generateImage = async (concept: ImageConcept) => {
    setSelectedConcept(concept);
    setStage("generating");
    setError(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dallePrompt: concept.dallePrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");
      setImageUrl(data.imageUrl);
      setUsedPrompt(data.prompt);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("concepts");
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.download = "pair-people-post-image.png";
    link.href = imageUrl;
    link.click();
  };

  const directionLocked = stage !== "idle";

  return (
    <div className="space-y-4 pt-4">
      {/* Direction input */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{
            color: "#323B6A",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
          }}
        >
          Image direction
          <span className="ml-1.5 normal-case font-normal" style={{ color: "#A7B8D1" }}>
            optional
          </span>
        </label>
        <input
          type="text"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          disabled={directionLocked}
          placeholder="e.g. minimalist Sydney skyline, abstract tech concept, warm office…"
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            border: "1.5px solid #E7EDF3",
            color: directionLocked ? "#A7B8D1" : "#323B6A",
            backgroundColor: directionLocked ? "#F9FAFB" : "#FFFFFF",
          }}
          onFocus={(e) => {
            if (!directionLocked) {
              e.currentTarget.style.borderColor = "#BDCF7C";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)";
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E7EDF3";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {/* ── Stage: idle — show Generate Concepts button ── */}
      {stage === "idle" && (
        <button
          onClick={generateConcepts}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            backgroundColor: "#BDCF7C",
            color: "#323B6A",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(189,207,124,0.4)",
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Generate image concepts
        </button>
      )}

      {/* ── Stage: loading_concepts — spinner ── */}
      {stage === "loading_concepts" && (
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <Spinner className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Generating 4 image concepts…
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6F92BF" }}>
              Claude is creating distinct visual directions for you to choose from.
            </p>
          </div>
        </div>
      )}

      {/* ── Stage: concepts — show 4 cards ── */}
      {(stage === "concepts" || stage === "generating") && concepts.length > 0 && (
        <div className="space-y-3">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            {stage === "generating" ? "Generating image…" : "Choose a concept to generate"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {concepts.map((concept) => {
              const isSelected = selectedConcept?.id === concept.id;
              const isGeneratingThis = stage === "generating" && isSelected;
              const isDisabled = stage === "generating";

              return (
                <button
                  key={concept.id}
                  onClick={() => !isDisabled && generateImage(concept)}
                  disabled={isDisabled}
                  className="rounded-xl text-left transition-all duration-150 overflow-hidden"
                  style={{
                    backgroundColor: isSelected ? "#323B6A" : "#FFFFFF",
                    border: isSelected ? "1.5px solid #323B6A" : "1.5px solid #E7EDF3",
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled && !isSelected ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#323B6A";
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F4F5F9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#E7EDF3";
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFFFFF";
                    }
                  }}
                >
                  {/* Card header */}
                  <div
                    className="px-3 py-2 flex items-center justify-between gap-2"
                    style={{ backgroundColor: isSelected ? "#2A3260" : "#F4F5F9" }}
                  >
                    <span
                      className="text-xs font-bold leading-tight"
                      style={{
                        color: isSelected ? "#BDCF7C" : "#323B6A",
                        fontFamily: "var(--font-poppins), Poppins, sans-serif",
                      }}
                    >
                      {concept.title}
                    </span>
                    {isGeneratingThis && <Spinner className="w-3.5 h-3.5 flex-shrink-0" />}
                    {!isGeneratingThis && !isSelected && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#A7B8D1" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  {/* Card body */}
                  <div className="px-3 py-2.5">
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: isSelected ? "#A7B8D1" : "#6F92BF" }}
                    >
                      {concept.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {stage === "concepts" && (
            <button
              onClick={() => setStage("idle")}
              className="text-xs transition-all duration-150"
              style={{ color: "#A7B8D1" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#323B6A"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#A7B8D1"; }}
            >
              ← Change direction &amp; regenerate
            </button>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC4444" }}
        >
          {error}
        </div>
      )}

      {/* ── Stage: done — show image ── */}
      {stage === "done" && imageUrl && (
        <div className="space-y-3">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1.5px solid #E7EDF3" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="AI-generated post image"
              className="w-full h-auto block"
            />
          </div>

          {selectedConcept && (
            <p className="text-xs px-1" style={{ color: "#A7B8D1" }}>
              <span style={{ color: "#6F92BF", fontWeight: 600 }}>Concept: </span>
              {selectedConcept.title}
            </p>
          )}

          {usedPrompt && (
            <p className="text-xs px-1" style={{ color: "#A7B8D1" }}>
              <span style={{ color: "#6F92BF", fontWeight: 600 }}>Prompt: </span>
              {usedPrompt}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2"
              style={{
                backgroundColor: "#323B6A",
                color: "#FFFFFF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PNG
            </button>
            <button
              onClick={() => {
                setStage("concepts");
                setImageUrl(null);
                setUsedPrompt(null);
                setError(null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm transition-all duration-150"
              style={{
                backgroundColor: "#E7EDF3",
                color: "#323B6A",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D0DCE8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E7EDF3"; }}
            >
              ← Try another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branded section ──────────────────────────────────────────────────────────

const CARD_TYPES: { id: CardType; label: string; desc: string }[] = [
  { id: "pull-quote", label: "Pull Quote", desc: "Quote on navy with green accent" },
  { id: "role-badge", label: "Role Badge", desc: "Candidate name, role & tech pills" },
  { id: "stat-card", label: "Stat Card", desc: "Big number with supporting copy" },
];

function BrandedSection({ content }: { content: string }) {
  const [cardType, setCardType] = useState<CardType>("pull-quote");

  // Pull Quote state
  const firstParagraph = content.split("\n\n")[0]?.trim() ?? "";
  const [quote, setQuote] = useState(
    firstParagraph.length <= 160 ? firstParagraph : firstParagraph.substring(0, 157) + "…"
  );
  const [attribution, setAttribution] = useState("Eanna Barry, Pair People");

  // Role Badge state
  const [candidateName, setCandidateName] = useState("");
  const [roleType, setRoleType] = useState("");
  const [techStack, setTechStack] = useState("");

  // Stat Card state
  const [stat, setStat] = useState("");
  const [copy, setCopy] = useState("");

  // Reset quote when content changes
  useEffect(() => {
    const para = content.split("\n\n")[0]?.trim() ?? "";
    setQuote(para.length <= 160 ? para : para.substring(0, 157) + "…");
  }, [content]);

  const cardData =
    cardType === "pull-quote"
      ? ({ quote, attribution } as PullQuoteData)
      : cardType === "role-badge"
      ? ({ candidateName, roleType, techStack } as RoleBadgeData)
      : ({ stat, copy } as StatCardData);

  return (
    <div className="space-y-5 pt-4">
      {/* Card type selector */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{
            color: "#323B6A",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
          }}
        >
          Card Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CARD_TYPES.map(({ id, label, desc }) => {
            const active = cardType === id;
            return (
              <button
                key={id}
                onClick={() => setCardType(id)}
                className="px-3 py-3 rounded-xl text-left transition-all duration-150"
                style={{
                  backgroundColor: active ? "#323B6A" : "#FFFFFF",
                  border: active ? "1.5px solid #323B6A" : "1.5px solid #E7EDF3",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                }}
              >
                <div
                  className="text-xs font-semibold"
                  style={{ color: active ? "#BDCF7C" : "#323B6A" }}
                >
                  {label}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: active ? "#A7B8D1" : "#6F92BF" }}
                >
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form fields — Pull Quote */}
      {cardType === "pull-quote" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Quote
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Attribution
              <span className="ml-1.5 normal-case font-normal" style={{ color: "#A7B8D1" }}>optional</span>
            </label>
            <input
              type="text"
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder="e.g. Eanna Barry, Pair People"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        </div>
      )}

      {/* Form fields — Role Badge */}
      {cardType === "role-badge" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Candidate name
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Role type
            </label>
            <input
              type="text"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              placeholder="e.g. Senior Full-Stack Engineer"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Tech stack
              <span className="ml-1.5 normal-case font-normal" style={{ color: "#A7B8D1" }}>comma-separated</span>
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g. React, Node.js, AWS, TypeScript"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        </div>
      )}

      {/* Form fields — Stat Card */}
      {cardType === "stat-card" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Stat
            </label>
            <input
              type="text"
              value={stat}
              onChange={(e) => setStat(e.target.value)}
              placeholder="e.g. 3× or 247% or $180K"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              Supporting copy
            </label>
            <textarea
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              rows={2}
              placeholder="e.g. faster time-to-hire with Fixed Fee recruitment"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: "1.5px solid #E7EDF3", color: "#323B6A", backgroundColor: "#FFFFFF" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#BDCF7C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E7EDF3"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        </div>
      )}

      {/* Canvas preview + download */}
      <BrandedCanvas type={cardType} data={cardData} />
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function ImagePanel({ content, postType }: Props) {
  const [mode, setMode] = useState<ImageMode>("none");

  return (
    <div
      className="rounded-xl"
      style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
    >
      {/* Header row */}
      <div
        className="px-5 py-3 flex items-center"
        style={{ borderBottom: mode !== "none" ? "1px solid #E7EDF3" : undefined }}
      >
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Content */}
      {mode !== "none" && (
        <div className="px-5 pb-5">
          {mode === "ai" && (
            <AIImageSection content={content} postType={postType} />
          )}
          {mode === "branded" && <BrandedSection content={content} />}
        </div>
      )}
    </div>
  );
}
