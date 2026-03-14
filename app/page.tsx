"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import CreatePanel from "@/components/CreatePanel";
import IntelligencePanel from "@/components/IntelligencePanel";
import ResearchPanel from "@/components/ResearchPanel";

type Panel = "create" | "intelligence" | "research";

export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("create");

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#E7EDF3" }}>
      {/* Sidebar */}
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Main content */}
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: "260px" }}
      >
        {activePanel === "create" && <CreatePanel />}
        {activePanel === "intelligence" && <IntelligencePanel />}
        {activePanel === "research" && <ResearchPanel />}
      </main>
    </div>
  );
}
