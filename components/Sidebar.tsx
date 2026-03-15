"use client";

import React from "react";

type Panel = "create" | "voice" | "performance" | "intelligence" | "research" | "bd";

interface SidebarProps {
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
}

type NavGroup = {
  heading: string;
  items: { id: Panel; label: string; icon: React.ReactNode }[];
};

const navGroups: NavGroup[] = [
  {
    heading: "Create",
    items: [
      {
        id: "create",
        label: "New Post",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: "Voice & Performance",
    items: [
      {
        id: "voice",
        label: "My Voice",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
      {
        id: "performance",
        label: "Performance",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      {
        id: "intelligence",
        label: "Market Intel",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
      {
        id: "bd",
        label: "BD Intel",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
      {
        id: "research",
        label: "Research",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col"
      style={{
        width: "260px",
        backgroundColor: "#323B6A",
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div className="px-6 py-8 border-b border-white/10">
        <div className="flex flex-col">
          <span
            className="text-white text-xl leading-tight"
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 700 }}
          >
            Pair People
          </span>
          <span
            className="text-sm mt-0.5"
            style={{ color: "#BDCF7C", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
          >
            Content Studio
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <p
              className="text-xs uppercase tracking-widest mb-2 px-2"
              style={{ color: "#A7B8D1", fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600 }}
            >
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activePanel === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onPanelChange(item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium"
                      style={{
                        backgroundColor: isActive ? "#BDCF7C" : "transparent",
                        color: isActive ? "#323B6A" : "#FFFFFF",
                        fontFamily: "var(--font-poppins), Poppins, sans-serif",
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                      }}
                    >
                      <span style={{ color: isActive ? "#323B6A" : "#A7B8D1" }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-white/10">
        <p className="text-xs" style={{ color: "#A7B8D1" }}>
          Powered by Claude AI
        </p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
          v1.0.0
        </p>
      </div>
    </aside>
  );
}
