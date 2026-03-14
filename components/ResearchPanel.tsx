"use client";

import React from "react";

export default function ResearchPanel() {
  return (
    <div className="max-w-2xl mx-auto mt-16 text-center px-6">
      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
        style={{ backgroundColor: "#A7B8D1" }}
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
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
        Research
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: "#6F92BF" }}>
        Coming soon — Deep research tools to uncover candidate stories, company
        insights, and market data to power your content.
      </p>

      {/* Feature previews */}
      <div className="grid grid-cols-1 gap-3 text-left">
        {[
          {
            title: "Candidate Stories",
            desc: "Surface compelling candidate narratives from your database",
            color: "#BDCF7C",
          },
          {
            title: "Company Deep Dives",
            desc: "Research hiring companies to craft tailored content",
            color: "#FEEA99",
          },
          {
            title: "LinkedIn Analytics",
            desc: "Track which posts are performing and why",
            color: "#DBEAA0",
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
        Coming in Q3 2025
      </div>
    </div>
  );
}
