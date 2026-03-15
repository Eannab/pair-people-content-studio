"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import CreatePanel from "@/components/CreatePanel";
import VoicePanel from "@/components/VoicePanel";
import PerformancePanel from "@/components/PerformancePanel";
import IntelligencePanel from "@/components/IntelligencePanel";
import ResearchPanel from "@/components/ResearchPanel";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";

type Panel = "create" | "voice" | "performance" | "intelligence" | "research";

export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("create");
  const [contextSuggestion, setContextSuggestion] = useState<string>("");

  const handleUseForPost = (article: ScoredArticle) => {
    setContextSuggestion(
      `${article.title}\n\n${article.summary}\n\nSource: ${article.source}`
    );
    setActivePanel("create");
  };

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
          <IntelligencePanel onUseForPost={handleUseForPost} />
        )}
        {activePanel === "research" && <ResearchPanel />}
      </main>
    </div>
  );
}
