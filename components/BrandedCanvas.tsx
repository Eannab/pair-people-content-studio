"use client";

import React, { useRef, useEffect, useCallback } from "react";

export type CardType = "pull-quote" | "role-badge" | "stat-card";

export interface PullQuoteData {
  quote: string;
  attribution: string;
}
export interface RoleBadgeData {
  candidateName: string;
  roleType: string;
  techStack: string; // comma-separated
}
export interface StatCardData {
  stat: string;
  copy: string;
}
export type CardData = PullQuoteData | RoleBadgeData | StatCardData;

interface Props {
  type: CardType;
  data: CardData;
}

const W = 1200;
const H = 627;

const NAVY = "#323B6A";
const GREEN = "#BDCF7C";
const LIGHT_BLUE = "#A7B8D1";
const WHITE = "#FFFFFF";

// Returns wrapped lines for the given maxWidth
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawLogo(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = `600 26px Poppins, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.55;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Pair People", W - 48, H - 36);
  ctx.restore();
}

function drawPullQuote(ctx: CanvasRenderingContext2D, data: PullQuoteData) {
  // Background
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  ctx.fillStyle = GREEN;
  ctx.fillRect(40, 55, 8, H - 110);

  // Faint decorative open-quote mark
  ctx.save();
  ctx.font = `normal 220px AlteHaasGrotesk, serif`;
  ctx.fillStyle = GREEN;
  ctx.globalAlpha = 0.1;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("\u201C", 62, -30);
  ctx.restore();

  // Quote text
  const quoteText = data.quote
    ? `\u201C${data.quote}\u201D`
    : "\u201CYour quote will appear here\u201D";

  ctx.save();
  ctx.font = `normal 46px AlteHaasGrotesk, serif`;
  ctx.fillStyle = data.quote ? WHITE : `${WHITE}55`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const maxWidth = W - 130 - 48; // left bar + right margin
  const lines = wrapText(ctx, quoteText, maxWidth);
  const lineHeight = 66;
  const attrHeight = data.attribution ? 60 : 0;
  const totalH = lines.length * lineHeight + attrHeight;
  let y = Math.max(80, (H - totalH) / 2);

  for (const line of lines) {
    ctx.fillText(line, 76, y);
    y += lineHeight;
  }
  ctx.restore();

  // Attribution
  if (data.attribution) {
    ctx.save();
    ctx.font = `normal 28px AlteHaasGrotesk, serif`;
    ctx.fillStyle = GREEN;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`\u2014 ${data.attribution}`, 76, y + 10);
    ctx.restore();
  }

  drawLogo(ctx);
}

function drawRoleBadge(ctx: CanvasRenderingContext2D, data: RoleBadgeData) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;

  // Top accent line
  ctx.fillStyle = GREEN;
  ctx.fillRect(cx - 40, 60, 80, 5);

  // Candidate name
  ctx.save();
  ctx.font = `600 72px Poppins, sans-serif`;
  ctx.fillStyle = data.candidateName ? WHITE : `${WHITE}44`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    data.candidateName || "Candidate Name",
    cx,
    230
  );
  ctx.restore();

  // Role type
  ctx.save();
  ctx.font = `600 36px Poppins, sans-serif`;
  ctx.fillStyle = GREEN;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.roleType || "Role Type", cx, 290);
  ctx.restore();

  // Divider
  ctx.save();
  ctx.strokeStyle = `${LIGHT_BLUE}44`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 120, 315);
  ctx.lineTo(cx + 120, 315);
  ctx.stroke();
  ctx.restore();

  // Tech pills
  const techs = data.techStack
    ? data.techStack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (techs.length > 0) {
    ctx.save();
    ctx.font = `normal 22px AlteHaasGrotesk, sans-serif`;
    const pillPadX = 22;
    const pillPadY = 11;
    const pillH = 22 + pillPadY * 2;
    const gap = 14;

    const widths = techs.map((t) => ctx.measureText(t).width + pillPadX * 2);
    const totalW =
      widths.reduce((a, b) => a + b, 0) + gap * (techs.length - 1);
    let px = cx - totalW / 2;
    const py = 345;

    for (let i = 0; i < techs.length; i++) {
      const pw = widths[i];

      // Background
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = LIGHT_BLUE;
      roundRect(ctx, px, py, pw, pillH, pillH / 2);
      ctx.fill();

      // Border
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = LIGHT_BLUE;
      ctx.lineWidth = 1;
      roundRect(ctx, px, py, pw, pillH, pillH / 2);
      ctx.stroke();

      // Text
      ctx.globalAlpha = 1;
      ctx.fillStyle = WHITE;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(techs[i], px + pw / 2, py + pillH / 2);

      px += pw + gap;
    }
    ctx.restore();
  }

  drawLogo(ctx);
}

function drawStatCard(ctx: CanvasRenderingContext2D, data: StatCardData) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;

  // Large stat
  ctx.save();
  ctx.font = `600 140px Poppins, sans-serif`;
  ctx.fillStyle = data.stat ? GREEN : `${GREEN}44`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.stat || "00%", cx, 310);
  ctx.restore();

  // Green underline accent
  const statWidth = ctx.measureText(data.stat || "00%").width;
  ctx.save();
  ctx.font = `600 140px Poppins, sans-serif`;
  const lineW = Math.min(statWidth + 20, 400);
  ctx.fillStyle = GREEN;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(cx - lineW / 2, 320, lineW, 4);
  ctx.restore();

  // Supporting copy
  if (data.copy) {
    ctx.save();
    ctx.font = `normal 36px AlteHaasGrotesk, serif`;
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const maxWidth = W - 200;
    const lines = wrapText(ctx, data.copy, maxWidth);
    let y = 348;
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += 52;
    }
    ctx.restore();
  }

  drawLogo(ctx);
}

export default function BrandedCanvas({ type, data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Attempt to ensure fonts are loaded before drawing
    try {
      await Promise.all([
        document.fonts.load(`normal 46px AlteHaasGrotesk`),
        document.fonts.load(`600 72px Poppins`),
      ]);
    } catch {
      // Continue with system fallbacks if fonts fail to load
    }

    ctx.clearRect(0, 0, W, H);

    if (type === "pull-quote") drawPullQuote(ctx, data as PullQuoteData);
    else if (type === "role-badge") drawRoleBadge(ctx, data as RoleBadgeData);
    else if (type === "stat-card") drawStatCard(ctx, data as StatCardData);
  }, [type, data]);

  useEffect(() => {
    render();
  }, [render]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `pair-people-${type}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1.5px solid #E7EDF3" }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
      <button
        onClick={handleDownload}
        className="mt-3 w-full py-2.5 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2"
        style={{
          backgroundColor: "#323B6A",
          color: "#FFFFFF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 600,
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
