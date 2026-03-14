"use client";

import React from "react";

export default function IntelligencePanel() {
  return (
    <div className="max-w-2xl mx-auto mt-16 text-center px-6">
      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
        style={{ backgroundColor: "#FEEA99" }}
      >
        <svg
          className="w-10 h-10"
          fill="none"
          stroke="#323B6A"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </div>

      {/* Heading */}
      <h2
        className="text-2xl mb-3"
        style={{
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 700,
          color: "#323B6A",
        }}
      >
        Intelligence
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: "#6F92BF" }}>
        Coming soon — Market intelligence, competitor analysis, and trend
        spotting for the Sydney tech recruitment scene.
      </p>

      {/* Feature previews */}
      <div className="grid grid-cols-1 gap-3 text-left">
        {[
          {
            title: "Trend Radar",
            desc: "Spot emerging hiring trends before they go mainstream",
            color: "#DBEAA0",
          },
          {
            title: "Competitor Watch",
            desc: "Track what other recruiters are posting and talking about",
            color: "#A7B8D1",
          },
          {
            title: "Salary Insights",
            desc: "Real-time salary benchmarks across Sydney tech roles",
            color: "#FEEA99",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E7EDF3" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
              style={{ backgroundColor: feature.color }}
            />
            <div>
              <h3
                className="text-sm font-semibold mb-0.5"
                style={{
                  fontFamily: "var(--font-poppins), Poppins, sans-serif",
                  color: "#323B6A",
                }}
              >
                {feature.title}
              </h3>
              <p className="text-xs" style={{ color: "#6F92BF" }}>
                {feature.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: "#E7EDF3",
          color: "#6F92BF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        Coming in Q2 2025
      </div>
    </div>
  );
}
