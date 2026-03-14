"use client";

import React, { useState, useEffect, useRef } from "react";
import type { VoiceProfile } from "@/app/api/voice/profile/route";

type Stage =
  | "idle"        // no posts in KV
  | "uploading"
  | "uploaded"    // posts stored, no profile yet
  | "profiling"
  | "ready"       // profile exists
  | "error";

function PillList({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="px-2.5 py-1 rounded-full text-xs"
          style={{
            backgroundColor: color,
            color: "#323B6A",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ProfileSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderBottom: "1px solid #E7EDF3" }}>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-1"
        style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export default function VoicePanel() {
  const [stage, setStage] = useState<Stage>("idle");
  const [postCount, setPostCount] = useState(0);
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing data on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voice/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setPostCount(data.profile.postCount);
          setStage("ready");
        } else if (data.postCount > 0) {
          setPostCount(data.postCount);
          setStage("uploaded");
        }
      } catch {
        // KV not available — stay idle
      }
    })();
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setErrorMsg("Please upload a .csv file (Posts.csv from your LinkedIn data export).");
      setStage("error");
      return;
    }

    setStage("uploading");
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/voice/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPostCount(data.postCount);
      setStage("profiling");
      await generateProfile();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    }
  };

  const generateProfile = async () => {
    setStage("profiling");
    try {
      const res = await fetch("/api/voice/profile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setPostCount(data.profile.postCount);
      setStage("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Profile generation failed");
      setStage("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Heading */}
      <div className="mb-8">
        <h1
          className="text-2xl mb-1"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 700,
            color: "#323B6A",
          }}
        >
          My Voice
        </h1>
        <p className="text-sm" style={{ color: "#6F92BF" }}>
          Upload your LinkedIn post history and Claude will learn your writing voice to generate more on-brand content.
        </p>
      </div>

      {/* ── Upload card ───────────────────────────────────────────────────── */}
      <div
        className="rounded-xl mb-6"
        style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#E7EDF3" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#BDCF7C" }} />
              <span
                className="text-xs font-semibold"
                style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
              >
                LinkedIn Post History
              </span>
            </div>
            {postCount > 0 && (
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#DBEAA0", color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
              >
                {postCount} posts loaded
              </span>
            )}
          </div>
        </div>

        <div className="p-5">
          {/* Drop zone */}
          <div
            className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-150"
            style={{
              border: `2px dashed ${isDragOver ? "#BDCF7C" : "#A7B8D1"}`,
              backgroundColor: isDragOver ? "rgba(189,207,124,0.06)" : "#F9FAFB",
              padding: "2rem 1rem",
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-8 h-8" fill="none" stroke="#A7B8D1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                {postCount > 0 ? "Re-upload Posts.csv" : "Upload Posts.csv"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#A7B8D1" }}>
                Drag & drop or click — from your LinkedIn data export
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />

          <p className="text-xs mt-3" style={{ color: "#A7B8D1" }}>
            Go to <strong style={{ color: "#6F92BF" }}>linkedin.com/mypreferences/d/download-my-data</strong>, request &ldquo;Posts&rdquo;, download and upload <strong>Posts.csv</strong>.
          </p>
        </div>
      </div>

      {/* ── Status / loading ──────────────────────────────────────────────── */}
      {(stage === "uploading" || stage === "profiling") && (
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-3 mb-6"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#BDCF7C" strokeWidth="4" />
            <path className="opacity-75" fill="#BDCF7C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              {stage === "uploading" ? "Parsing CSV…" : `Analysing ${postCount} posts with Claude…`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6F92BF" }}>
              {stage === "profiling" ? "This takes 15–30 seconds. Sit tight." : "Reading your post history"}
            </p>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {stage === "error" && (
        <div
          className="rounded-xl px-5 py-4 mb-6"
          style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#CC4444" }}>Error</p>
          <p className="text-sm mt-0.5" style={{ color: "#CC4444" }}>{errorMsg}</p>
        </div>
      )}

      {/* ── Posts uploaded but no profile yet ─────────────────────────────── */}
      {stage === "uploaded" && (
        <div className="mb-6">
          <button
            onClick={generateProfile}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              backgroundColor: "#BDCF7C",
              color: "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(189,207,124,0.4)",
            }}
          >
            Generate Voice Profile
          </button>
        </div>
      )}

      {/* ── Voice Profile card ────────────────────────────────────────────── */}
      {stage === "ready" && profile && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E7EDF3" }}
        >
          {/* Card header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ backgroundColor: "#323B6A" }}
          >
            <div>
              <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                Voice Profile
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#A7B8D1" }}>
                Generated from {profile.postCount} posts · {formatDate(profile.generatedAt)}
              </p>
            </div>
            <button
              onClick={generateProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "#BDCF7C",
                border: "1px solid rgba(189,207,124,0.3)",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(189,207,124,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.1)"; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Summary */}
          <div className="px-5 pt-4 pb-2" style={{ backgroundColor: "#F9FAFB" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#323B6A" }}>
              {profile.summary}
            </p>
          </div>

          {/* Fields */}
          <div className="px-5">
            <ProfileSection label="Writing Style">
              <p className="text-sm" style={{ color: "#323B6A" }}>{profile.writingStyle}</p>
            </ProfileSection>

            <ProfileSection label="Tone">
              <p className="text-sm" style={{ color: "#323B6A" }}>{profile.tone}</p>
            </ProfileSection>

            <ProfileSection label="Typical Structure">
              <p className="text-sm" style={{ color: "#323B6A" }}>{profile.typicalStructure}</p>
            </ProfileSection>

            <div className="py-3" style={{ borderBottom: "1px solid #E7EDF3" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                Avg post length
              </p>
              <p className="text-sm mt-1" style={{ color: "#323B6A" }}>
                ~{profile.averageLength.toLocaleString()} characters
              </p>
            </div>

            <ProfileSection label="Topics Covered">
              <PillList items={profile.topicsCovered} color="#DBEAA0" />
            </ProfileSection>

            <ProfileSection label="Topics Avoided">
              <PillList items={profile.topicsAvoided} color="#F9FAFB" />
            </ProfileSection>

            <ProfileSection label="Characteristic Vocabulary">
              <PillList items={profile.vocabulary} color="#E7EDF3" />
            </ProfileSection>

            <ProfileSection label="Key Phrases">
              <PillList items={profile.keyPhrases} color="#E7EDF3" />
            </ProfileSection>

            <div className="py-3">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6F92BF", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
                Hook Patterns
              </p>
              <ul className="space-y-1 mt-1.5">
                {profile.hookPatterns.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm" style={{ color: "#323B6A" }}>
                    <span style={{ color: "#BDCF7C", flexShrink: 0, marginTop: 2 }}>›</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
