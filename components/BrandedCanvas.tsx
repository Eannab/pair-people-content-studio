"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

export type CardType = "pull-quote" | "role-badge" | "stat-card";

export interface PullQuoteData {
  quote: string;
  attributionName: string;
  attributionTitle: string;
}
export interface RoleBadgeData {
  candidateName: string;
  roleType: string;
  techStack: string; // comma-separated
}
export interface StatCardData {
  stat: string;
  headline: string;
  copy: string;
}
export type CardData = PullQuoteData | RoleBadgeData | StatCardData;

interface Props {
  type: CardType;
}

const W = 1200;
const H = 627;

const NAVY = "#323B6A";
const GREEN = "#BDCF7C";
const LIGHT_BLUE = "#A7B8D1";
const WHITE = "#FFFFFF";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Watermark ─────────────────────────────────────────────────────────────────

function drawWatermark(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  if (!logo || logo.width === 0) return;
  const size = 380;
  const x = W - size - 20;
  const y = (H - size) / 2;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.drawImage(logo, x, y, size, size);
  ctx.restore();
}

// ── Text logo ─────────────────────────────────────────────────────────────────

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

// ── Pull Quote ────────────────────────────────────────────────────────────────

function drawPullQuote(
  ctx: CanvasRenderingContext2D,
  data: PullQuoteData,
  logo: HTMLImageElement | null
) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  drawWatermark(ctx, logo);

  // Left accent bar
  ctx.fillStyle = GREEN;
  ctx.fillRect(40, 55, 8, H - 110);

  // Decorative open-quote mark
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

  const maxWidth = W - 130 - 48;
  const lines = wrapText(ctx, quoteText, maxWidth);
  const lineHeight = 66;
  const hasAttrib = !!(data.attributionName);
  const attrHeight = hasAttrib ? 60 : 0;
  const totalH = lines.length * lineHeight + attrHeight;
  let y = Math.max(80, (H - totalH) / 2);

  for (const line of lines) {
    ctx.fillText(line, 76, y);
    y += lineHeight;
  }
  ctx.restore();

  // Attribution
  if (data.attributionName) {
    const attrLine = data.attributionTitle
      ? `\u2014 ${data.attributionName}, ${data.attributionTitle}`
      : `\u2014 ${data.attributionName}`;
    ctx.save();
    ctx.font = `normal 28px AlteHaasGrotesk, serif`;
    ctx.fillStyle = GREEN;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(attrLine, 76, y + 10);
    ctx.restore();
  }

  drawLogo(ctx);
}

// ── Role Badge ────────────────────────────────────────────────────────────────

function drawRoleBadge(
  ctx: CanvasRenderingContext2D,
  data: RoleBadgeData,
  logo: HTMLImageElement | null
) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  drawWatermark(ctx, logo);

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
  ctx.fillText(data.candidateName || "Candidate Name", cx, 230);
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
    ? data.techStack.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (techs.length > 0) {
    ctx.save();
    ctx.font = `normal 22px AlteHaasGrotesk, sans-serif`;
    const pillPadX = 22;
    const pillPadY = 11;
    const pillH = 22 + pillPadY * 2;
    const gap = 14;

    const widths = techs.map((t) => ctx.measureText(t).width + pillPadX * 2);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (techs.length - 1);
    let px = cx - totalW / 2;
    const py = 345;

    for (let i = 0; i < techs.length; i++) {
      const pw = widths[i];

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = LIGHT_BLUE;
      roundRect(ctx, px, py, pw, pillH, pillH / 2);
      ctx.fill();

      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = LIGHT_BLUE;
      ctx.lineWidth = 1;
      roundRect(ctx, px, py, pw, pillH, pillH / 2);
      ctx.stroke();

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

// ── Stat Card ─────────────────────────────────────────────────────────────────

function drawStatCard(
  ctx: CanvasRenderingContext2D,
  data: StatCardData,
  logo: HTMLImageElement | null
) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  drawWatermark(ctx, logo);

  const cx = W / 2;

  // Large stat
  ctx.save();
  ctx.font = `600 140px Poppins, sans-serif`;
  ctx.fillStyle = data.stat ? GREEN : `${GREEN}44`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.stat || "00%", cx, 290);
  ctx.restore();

  // Underline accent
  ctx.save();
  ctx.font = `600 140px Poppins, sans-serif`;
  const statWidth = ctx.measureText(data.stat || "00%").width;
  const lineW = Math.min(statWidth + 20, 400);
  ctx.fillStyle = GREEN;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(cx - lineW / 2, 300, lineW, 4);
  ctx.restore();

  // Compute line counts for layout
  ctx.font = `600 38px Poppins, sans-serif`;
  const headlineLines = data.headline ? wrapText(ctx, data.headline, W - 200) : [];
  ctx.font = `normal 30px AlteHaasGrotesk, serif`;
  const copyLines = data.copy ? wrapText(ctx, data.copy, W - 240) : [];

  let y = 322;

  // Supporting headline
  if (headlineLines.length > 0) {
    ctx.save();
    ctx.font = `600 38px Poppins, sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const line of headlineLines) {
      ctx.fillText(line, cx, y);
      y += 52;
    }
    ctx.restore();
    y += 8;
  }

  // Supporting copy
  if (copyLines.length > 0) {
    ctx.save();
    ctx.font = `normal 30px AlteHaasGrotesk, serif`;
    ctx.fillStyle = LIGHT_BLUE;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const line of copyLines) {
      ctx.fillText(line, cx, y);
      y += 44;
    }
    ctx.restore();
  }

  drawLogo(ctx);
}

// ── Input helpers ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "10px 16px",
  borderRadius: "0.75rem",
  border: "1.5px solid #E7EDF3",
  color: "#323B6A",
  backgroundColor: "#FFFFFF",
  fontSize: "0.875rem",
  outline: "none",
  fontFamily: "var(--font-poppins), Poppins, sans-serif",
  boxSizing: "border-box",
};

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: "#323B6A", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
    >
      {children}
      {hint && (
        <span className="ml-1.5 normal-case font-normal" style={{ color: "#A7B8D1" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputBase}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#BDCF7C";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "#E7EDF3";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputBase, resize: "none" }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#BDCF7C";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(189,207,124,0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "#E7EDF3";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrandedCanvas({ type }: Props) {
  // Per-template field state
  const [pullQuote, setPullQuote] = useState<PullQuoteData>({
    quote: "",
    attributionName: "",
    attributionTitle: "",
  });
  const [roleBadge, setRoleBadge] = useState<RoleBadgeData>({
    candidateName: "",
    roleType: "",
    techStack: "",
  });
  const [statCard, setStatCard] = useState<StatCardData>({
    stat: "",
    headline: "",
    copy: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoReady, setLogoReady] = useState(false);

  // Load logo once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoReady(true);
    };
    img.onerror = () => setLogoReady(true); // render without watermark if missing
    img.src = "/Pair%20People%20logo%20Final.gif";
  }, []);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      await Promise.all([
        document.fonts.load(`normal 46px AlteHaasGrotesk`),
        document.fonts.load(`600 72px Poppins`),
      ]);
    } catch {
      // continue with fallbacks
    }

    ctx.clearRect(0, 0, W, H);
    const logo = logoRef.current;

    if (type === "pull-quote") drawPullQuote(ctx, pullQuote, logo);
    else if (type === "role-badge") drawRoleBadge(ctx, roleBadge, logo);
    else if (type === "stat-card") drawStatCard(ctx, statCard, logo);
  }, [type, pullQuote, roleBadge, statCard, logoReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="space-y-5">
      {/* ── Form fields ── */}
      {type === "pull-quote" && (
        <div className="space-y-3">
          <div>
            <FieldLabel>Quote</FieldLabel>
            <TextArea
              value={pullQuote.quote}
              onChange={(v) => setPullQuote((p) => ({ ...p, quote: v }))}
              placeholder="Type the quote text here…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Attribution name</FieldLabel>
              <TextInput
                value={pullQuote.attributionName}
                onChange={(v) => setPullQuote((p) => ({ ...p, attributionName: v }))}
                placeholder="e.g. Éanna Barry"
              />
            </div>
            <div>
              <FieldLabel hint="optional">Attribution title</FieldLabel>
              <TextInput
                value={pullQuote.attributionTitle}
                onChange={(v) => setPullQuote((p) => ({ ...p, attributionTitle: v }))}
                placeholder="e.g. Pair People"
              />
            </div>
          </div>
        </div>
      )}

      {type === "role-badge" && (
        <div className="space-y-3">
          <div>
            <FieldLabel>Candidate name</FieldLabel>
            <TextInput
              value={roleBadge.candidateName}
              onChange={(v) => setRoleBadge((p) => ({ ...p, candidateName: v }))}
              placeholder="e.g. Alex Chen"
            />
          </div>
          <div>
            <FieldLabel>Role type</FieldLabel>
            <TextInput
              value={roleBadge.roleType}
              onChange={(v) => setRoleBadge((p) => ({ ...p, roleType: v }))}
              placeholder="e.g. Senior Full-Stack Engineer"
            />
          </div>
          <div>
            <FieldLabel hint="comma-separated">Tech stack</FieldLabel>
            <TextInput
              value={roleBadge.techStack}
              onChange={(v) => setRoleBadge((p) => ({ ...p, techStack: v }))}
              placeholder="e.g. React, Node.js, AWS, TypeScript"
            />
          </div>
        </div>
      )}

      {type === "stat-card" && (
        <div className="space-y-3">
          <div>
            <FieldLabel>Stat / number</FieldLabel>
            <TextInput
              value={statCard.stat}
              onChange={(v) => setStatCard((p) => ({ ...p, stat: v }))}
              placeholder="e.g. 3× or 247% or $180K"
            />
          </div>
          <div>
            <FieldLabel hint="optional">Supporting headline</FieldLabel>
            <TextInput
              value={statCard.headline}
              onChange={(v) => setStatCard((p) => ({ ...p, headline: v }))}
              placeholder="e.g. faster time-to-hire"
            />
          </div>
          <div>
            <FieldLabel hint="optional">Supporting copy</FieldLabel>
            <TextArea
              value={statCard.copy}
              onChange={(v) => setStatCard((p) => ({ ...p, copy: v }))}
              placeholder="e.g. with Fixed Fee recruitment — no surprises, no percentages"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* ── Canvas preview ── */}
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

      {/* ── Download ── */}
      <button
        onClick={handleDownload}
        className="w-full py-2.5 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2"
        style={{
          backgroundColor: "#323B6A",
          color: "#FFFFFF",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontWeight: 600,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2A3260";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#323B6A";
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
