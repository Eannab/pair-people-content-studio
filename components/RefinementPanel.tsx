"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RefinementPanelProps {
  postId: string;
  currentPost: string;
  postType: string;
  angle: string;
  onPostUpdated: (newContent: string) => void;
}

export default function RefinementPanel({
  postId,
  currentPost,
  postType,
  angle,
  onPostUpdated,
}: RefinementPanelProps) {
  // Quick regenerate
  const [quickInstruction, setQuickInstruction] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Deep thread
  const [threadMessage, setThreadMessage] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"quick" | "thread">("quick");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const handleQuickRegenerate = async () => {
    if (!quickInstruction.trim()) return;
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType,
          angle,
          context: `Here is the current post:\n\n${currentPost}\n\nRefinement instruction: ${quickInstruction}`,
          isRefinement: true,
        }),
      });
      if (!res.ok) throw new Error("Regeneration failed");
      const data = await res.json();
      onPostUpdated(data.content);
      setQuickInstruction("");
    } catch (err) {
      console.error("Quick regenerate error:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleThreadMessage = async () => {
    if (!threadMessage.trim()) return;
    setIsThreadLoading(true);

    const userMessage: Message = { role: "user", content: threadMessage };
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);
    setThreadMessage("");

    try {
      const res = await fetch("/api/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          message: userMessage.content,
          conversationHistory: updatedHistory,
          currentPost,
          postType,
          angle,
        }),
      });
      if (!res.ok) throw new Error("Thread request failed");
      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      setConversationHistory(data.updatedHistory || [...updatedHistory, assistantMessage]);

      // If the reply looks like a revised post, update the main post
      if (
        data.reply.length > 200 &&
        !data.reply.startsWith("Sure") &&
        !data.reply.startsWith("Of course")
      ) {
        onPostUpdated(data.reply);
      }
    } catch (err) {
      console.error("Thread error:", err);
      setConversationHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsThreadLoading(false);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    action: () => void
  ) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div
      className="rounded-xl shadow-md overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E7EDF3" }}
    >
      {/* Tab Header */}
      <div
        className="flex border-b"
        style={{ borderColor: "#E7EDF3", backgroundColor: "#F9FAFB" }}
      >
        <button
          onClick={() => setActiveTab("quick")}
          className="flex-1 py-3 text-sm font-medium transition-all duration-150"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 600,
            color: activeTab === "quick" ? "#323B6A" : "#A7B8D1",
            borderBottom: activeTab === "quick" ? "2px solid #BDCF7C" : "2px solid transparent",
            backgroundColor: "transparent",
          }}
        >
          Quick Refine
        </button>
        <button
          onClick={() => setActiveTab("thread")}
          className="flex-1 py-3 text-sm font-medium transition-all duration-150"
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 600,
            color: activeTab === "thread" ? "#323B6A" : "#A7B8D1",
            borderBottom: activeTab === "thread" ? "2px solid #BDCF7C" : "2px solid transparent",
            backgroundColor: "transparent",
          }}
        >
          Deep Thread
          {conversationHistory.length > 0 && (
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#BDCF7C", color: "#323B6A" }}
            >
              {conversationHistory.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-5">
        {/* Quick Regenerate Tab */}
        {activeTab === "quick" && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: "#6F92BF" }}>
              Give a single instruction to refine the post. The AI will rewrite it based on your feedback.
            </p>
            <input
              type="text"
              value={quickInstruction}
              onChange={(e) => setQuickInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickRegenerate();
              }}
              placeholder="e.g. Make it shorter, add more urgency, change the hook..."
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                border: "1.5px solid #E7EDF3",
                color: "#323B6A",
                backgroundColor: "#F9FAFB",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#BDCF7C";
                e.currentTarget.style.backgroundColor = "#FFFFFF";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E7EDF3";
                e.currentTarget.style.backgroundColor = "#F9FAFB";
              }}
            />
            <button
              onClick={handleQuickRegenerate}
              disabled={isRegenerating || !quickInstruction.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                backgroundColor:
                  isRegenerating || !quickInstruction.trim()
                    ? "#E7EDF3"
                    : "#BDCF7C",
                color:
                  isRegenerating || !quickInstruction.trim()
                    ? "#A7B8D1"
                    : "#323B6A",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
                cursor:
                  isRegenerating || !quickInstruction.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isRegenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Regenerating...
                </span>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        )}

        {/* Deep Thread Tab */}
        {activeTab === "thread" && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: "#6F92BF" }}>
              Have a multi-turn conversation to refine and iterate on your post. Conversation history is saved.
            </p>

            {/* Messages */}
            {conversationHistory.length > 0 && (
              <div
                className="rounded-lg p-3 space-y-3 max-h-72 overflow-y-auto"
                style={{ backgroundColor: "#F9FAFB", border: "1px solid #E7EDF3" }}
              >
                {conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="rounded-lg px-3 py-2 text-xs max-w-[85%]"
                      style={{
                        backgroundColor:
                          msg.role === "user" ? "#323B6A" : "#DBEAA0",
                        color: msg.role === "user" ? "#FFFFFF" : "#323B6A",
                      }}
                    >
                      <p className="font-semibold mb-0.5 text-xs opacity-70"
                        style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                      >
                        {msg.role === "user" ? "You" : "Claude"}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isThreadLoading && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ backgroundColor: "#DBEAA0", color: "#323B6A" }}
                    >
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <textarea
              value={threadMessage}
              onChange={(e) => setThreadMessage(e.target.value)}
              onKeyDown={(e) =>
                handleKeyDown(e, handleThreadMessage)
              }
              placeholder="Ask Claude to refine, change the tone, add specific details... (Cmd+Enter to send)"
              rows={3}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none transition-all"
              style={{
                border: "1.5px solid #E7EDF3",
                color: "#323B6A",
                backgroundColor: "#F9FAFB",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#BDCF7C";
                e.currentTarget.style.backgroundColor = "#FFFFFF";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E7EDF3";
                e.currentTarget.style.backgroundColor = "#F9FAFB";
              }}
            />
            <button
              onClick={handleThreadMessage}
              disabled={isThreadLoading || !threadMessage.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                backgroundColor:
                  isThreadLoading || !threadMessage.trim()
                    ? "#E7EDF3"
                    : "#6F92BF",
                color:
                  isThreadLoading || !threadMessage.trim()
                    ? "#A7B8D1"
                    : "#FFFFFF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                fontWeight: 600,
                cursor:
                  isThreadLoading || !threadMessage.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isThreadLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Thinking...
                </span>
              ) : (
                "Send Message"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
