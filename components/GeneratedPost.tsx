"use client";

import React, { useState } from "react";

interface GeneratedPostProps {
  content: string;
}

export default function GeneratedPost({ content }: GeneratedPostProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="rounded-xl shadow-md overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E7EDF3" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#BDCF7C" }}
          />
          <span
            className="text-xs font-medium"
            style={{
              color: "#323B6A",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
            }}
          >
            Generated Post
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all duration-150"
          style={{
            backgroundColor: copied ? "#BDCF7C" : "#323B6A",
            color: copied ? "#323B6A" : "#FFFFFF",
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 600,
          }}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <p
          className="post-content text-sm leading-relaxed"
          style={{ color: "#1a1a2e" }}
        >
          {content}
        </p>
      </div>

      {/* Character count */}
      <div
        className="px-5 py-2 border-t text-right"
        style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
      >
        <span className="text-xs" style={{ color: "#A7B8D1" }}>
          {content.length} characters
        </span>
      </div>
    </div>
  );
}
