"use client";

import React, { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import CreatePanel from "@/components/CreatePanel";
import VoicePanel from "@/components/VoicePanel";
import PerformancePanel from "@/components/PerformancePanel";
import IntelligencePanel from "@/components/IntelligencePanel";
import ResearchPanel from "@/components/ResearchPanel";
import BDPanel from "@/components/BDPanel";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";

type Panel = "create" | "voice" | "performance" | "intelligence" | "research" | "bd";

export default function Home() {
  const { data: session, status } = useSession();
  const [activePanel, setActivePanel] = useState<Panel>("create");
  const [contextSuggestion, setContextSuggestion] = useState<string>("");

  const handleUseForPost = (article: ScoredArticle) => {
    setContextSuggestion(
      `${article.title}\n\n${article.summary}\n\nSource: ${article.source}`
    );
    setActivePanel("create");
  };

  const handleCreatePostFromBD = (context: string) => {
    setContextSuggestion(context);
    setActivePanel("create");
  };

  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "#E7EDF3" }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#323B6A", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "#E7EDF3" }}
      >
        <div className="text-center max-w-sm px-6">
          <div className="mb-6">
            <p
              className="text-2xl"
              style={{
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 700,
                color: "#323B6A",
              }}
            >
              Pair People
            </p>
            <p
              className="text-base mt-1"
              style={{
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
                color: "#BDCF7C",
              }}
            >
              Content Studio
            </p>
          </div>
          <button
            onClick={() => signIn("azure-ad")}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "#323B6A",
              color: "#ffffff",
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <path d="M10 0H0v10h10V0z" fill="#F25022" />
              <path d="M21 0H11v10h10V0z" fill="#7FBA00" />
              <path d="M10 11H0v10h10V11z" fill="#00A4EF" />
              <path d="M21 11H11v10h10V11z" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#E7EDF3" }}>
      {/* Sidebar */}
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Main content */}
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: "260px" }}
      >
        {activePanel === "create" && (
          <CreatePanel
            contextSuggestion={contextSuggestion}
            onContextConsumed={() => setContextSuggestion("")}
          />
        )}
        {activePanel === "voice" && <VoicePanel />}
        {activePanel === "performance" && <PerformancePanel />}
        {activePanel === "intelligence" && (
          <IntelligencePanel
            onUseForPost={handleUseForPost}
            onNavigateToBD={() => setActivePanel("bd")}
          />
        )}
        {activePanel === "research" && <ResearchPanel />}
        {activePanel === "bd" && <BDPanel onCreatePost={handleCreatePostFromBD} />}
      </main>
    </div>
  );
}
