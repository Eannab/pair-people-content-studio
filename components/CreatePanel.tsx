"use client";

import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import GeneratedPost from "./GeneratedPost";
import RefinementPanel from "./RefinementPanel";

type PostType =
  | "Hot Candidate"
  | "Market Insight"
  | "Business Journey"
  | "Personal"
  | "Fixed Fee"
  | "Live Job";

type Angle =
  | "Contrarian"
  | "Data-led"
  | "Story-first"
  | "Hot take"
  | "Practical advice"
  | "Behind the scenes";

const postTypes: PostType[] = [
  "Hot Candidate",
  "Market Insight",
  "Business Journey",
  "Personal",
  "Fixed Fee",
  "Live Job",
];

const angles: Angle[] = [
  "Contrarian",
  "Data-led",
  "Story-first",
  "Hot take",
  "Practical advice",
  "Behind the scenes",
];

const postTypeEmojis: Record<PostType, string> = {
  "Hot Candidate": "⚡",
  "Market Insight": "📊",
  "Business Journey": "🚀",
  "Personal": "👤",
  "Fixed Fee": "💡",
  "Live Job": "🎯",
};

export default function CreatePanel() {
  const [selectedPostType, setSelectedPostType] = useState<PostType | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [context, setContext] = useState("");
  const [generatedPost, setGeneratedPost] = useState("");
  const [postId, setPostId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedPostType || !selectedAngle || !context.trim()) return;
    setIsLoading(true);
    setError(null);
    const newPostId = uuidv4();
    setPostId(newPostId);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: selectedPostType,
          angle: selectedAngle,
          context: context.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Generation failed");
      }

      const data = await res.json();
      setGeneratedPost(data.content);
    } catch (err) {
      console.error("Generate error:", err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    selectedPostType !== null && selectedAngle !== null && context.trim().length > 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page heading */}
      <div className="mb-8">
        <h1
          className="text-2xl mb-1"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 700,
            color: "#323B6A",
          }}
        >
          Create Post
        </h1>
        <p className="text-sm" style={{ color: "#6F92BF" }}>
          Craft a LinkedIn post tailored for Pair People&apos;s audience.
        </p>
      </div>

      {/* Post Type Selector */}
      <section className="mb-6">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            color: "#323B6A",
          }}
        >
          Post Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {postTypes.map((type) => {
            const isSelected = selectedPostType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedPostType(type)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-150"
                style={{
                  backgroundColor: isSelected ? "#BDCF7C" : "#FFFFFF",
                  color: isSelected ? "#323B6A" : "#323B6A",
                  border: isSelected
                    ? "1.5px solid #BDCF7C"
                    : "1.5px solid #E7EDF3",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: isSelected ? 600 : 400,
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(189, 207, 124, 0.4)"
                    : "none",
                }}
              >
                <span className="text-base">{postTypeEmojis[type]}</span>
                {type}
              </button>
            );
          })}
        </div>
      </section>

      {/* Angle Selector */}
      <section className="mb-6">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            color: "#323B6A",
          }}
        >
          Angle
        </label>
        <div className="flex flex-wrap gap-2">
          {angles.map((angle) => {
            const isSelected = selectedAngle === angle;
            return (
              <button
                key={angle}
                onClick={() => setSelectedAngle(angle)}
                className="px-4 py-2 rounded-full text-sm transition-all duration-150"
                style={{
                  backgroundColor: isSelected ? "#6F92BF" : "#FFFFFF",
                  color: isSelected ? "#FFFFFF" : "#6F92BF",
                  border: isSelected
                    ? "1.5px solid #6F92BF"
                    : "1.5px solid #A7B8D1",
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  fontWeight: isSelected ? 600 : 400,
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(111, 146, 191, 0.3)"
                    : "none",
                }}
              >
                {angle}
              </button>
            );
          })}
        </div>
      </section>

      {/* Context Textarea */}
      <section className="mb-6">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            color: "#323B6A",
          }}
        >
          Context
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What's the context for this post? Share any details, stories, data, or specific points you want to include..."
          rows={5}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
          style={{
            border: "1.5px solid #E7EDF3",
            color: "#323B6A",
            backgroundColor: "#FFFFFF",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#BDCF7C";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(189, 207, 124, 0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E7EDF3";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <p className="text-xs mt-1.5 text-right" style={{ color: "#A7B8D1" }}>
          {context.length} chars
        </p>
      </section>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !isFormValid}
        className="w-full py-4 rounded-xl text-base font-bold transition-all duration-200 mb-6"
        style={{
          backgroundColor:
            isLoading || !isFormValid ? "#E7EDF3" : "#BDCF7C",
          color: isLoading || !isFormValid ? "#A7B8D1" : "#323B6A",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 700,
          cursor: isLoading || !isFormValid ? "not-allowed" : "pointer",
          boxShadow:
            isLoading || !isFormValid
              ? "none"
              : "0 4px 14px rgba(189, 207, 124, 0.5)",
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating post...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Post
          </span>
        )}
      </button>

      {/* Error */}
      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: "#FFF0F0",
            border: "1px solid #FFCCCC",
            color: "#CC4444",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Generated Post */}
      {generatedPost && (
        <div className="space-y-5">
          <GeneratedPost content={generatedPost} />
          <RefinementPanel
            postId={postId}
            currentPost={generatedPost}
            postType={selectedPostType || ""}
            angle={selectedAngle || ""}
            onPostUpdated={setGeneratedPost}
          />
        </div>
      )}
    </div>
  );
}
