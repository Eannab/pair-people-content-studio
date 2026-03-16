"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

export type CardType = "pull-quote" | "role-badge";

export interface PullQuoteData {
  quote: string;
  attributionName: string;
  attributionTitle: string;
}
export interface RoleBadgeData {
  title: string;    // e.g. "Senior Full Stack Engineer"
  location: string; // e.g. "Sydney, Australia"
  techStack: string; // comma-separated
}
export type CardData = PullQuoteData | RoleBadgeData;

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
  const HMARGIN = 80;

  // ── Measure title ──────────────────────────────────────────────────────────
  ctx.font = `600 60px Poppins, sans-serif`;
  const titleText = data.title || "Senior Full Stack Engineer";
  const titleLines = wrapText(ctx, titleText, W - HMARGIN * 2);
  const TITLE_LH = 74;
  const titleBlockH = titleLines.length * TITLE_LH;

  // ── Measure pills ──────────────────────────────────────────────────────────
  const techs = data.techStack
    ? data.techStack.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const PILL_PAD_X = 22;
  const PILL_PAD_Y = 11;
  const PILL_H = 22 + PILL_PAD_Y * 2; // 44px
  const PILL_GAP = 14;
  const PILL_ROW_GAP = 12;

  let pillWidths: number[] = [];
  let pillRows: number[][] = [];

  if (techs.length > 0) {
    ctx.font = `normal 22px AlteHaasGrotesk, sans-serif`;
    pillWidths = techs.map((t) => ctx.measureText(t).width + PILL_PAD_X * 2);

    const maxRowW = W - HMARGIN * 2;
    let rowItems: number[] = [];
    let rowW = 0;

    for (let i = 0; i < techs.length; i++) {
      const pw = pillWidths[i];
      if (rowItems.length > 0 && rowW + PILL_GAP + pw > maxRowW) {
        pillRows.push(rowItems);
        rowItems = [i];
        rowW = pw;
      } else {
        rowItems.push(i);
        rowW = rowItems.length === 1 ? pw : rowW + PILL_GAP + pw;
      }
    }
    if (rowItems.length > 0) pillRows.push(rowItems);
  }

  const pillBlockH =
    pillRows.length > 0
      ? pillRows.length * PILL_H + (pillRows.length - 1) * PILL_ROW_GAP
      : 0;

  // ── Total content height & start Y ────────────────────────────────────────
  const hasLocation = !!data.location;
  const hasPills = pillRows.length > 0;
  const LOCATION_H = 36;
  const GAP_TITLE_LOC = 14;
  const GAP_LOC_DIV = 18;
  const GAP_TITLE_DIV = 14;
  const GAP_DIV_PILLS = 20;

  const totalH =
    titleBlockH +
    (hasLocation ? GAP_TITLE_LOC + LOCATION_H : 0) +
    (hasPills
      ? (hasLocation ? GAP_LOC_DIV : GAP_TITLE_DIV) + 1 + GAP_DIV_PILLS + pillBlockH
      : 0);

  const startY = Math.round((H - totalH) / 2);

  // ── Top accent line ────────────────────────────────────────────────────────
  ctx.fillStyle = GREEN;
  ctx.fillRect(cx - 40, Math.max(40, startY - 28), 80, 4);

  // ── Title ─────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font = `600 60px Poppins, sans-serif`;
  ctx.fillStyle = data.title ? WHITE : `${WHITE}44`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let y = startY;
  for (const line of titleLines) {
    ctx.fillText(line, cx, y);
    y += TITLE_LH;
  }
  ctx.restore();

  // ── Location ──────────────────────────────────────────────────────────────
  if (hasLocation) {
    y += GAP_TITLE_LOC;

    // Small location dot before text
    ctx.save();
    ctx.font = `normal 28px AlteHaasGrotesk, serif`;
    const locWidth = ctx.measureText(data.location).width;
    const dotCX = cx - locWidth / 2 - 14;
    const dotCY = y + 14;
    ctx.fillStyle = LIGHT_BLUE;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(dotCX, dotCY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Location text
    ctx.save();
    ctx.font = `normal 28px AlteHaasGrotesk, serif`;
    ctx.fillStyle = LIGHT_BLUE;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(data.location, cx, y);
    ctx.restore();

    y += LOCATION_H;
    y += GAP_LOC_DIV;
  } else if (hasPills) {
    y += GAP_TITLE_DIV;
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  if (hasPills) {
    ctx.save();
    ctx.strokeStyle = `${LIGHT_BLUE}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 100, y);
    ctx.lineTo(cx + 100, y);
    ctx.stroke();
    ctx.restore();
    y += 1 + GAP_DIV_PILLS;
  }

  // ── Tech pills ────────────────────────────────────────────────────────────
  if (hasPills) {
    ctx.save();
    ctx.font = `normal 22px AlteHaasGrotesk, sans-serif`;

    for (const rowIdxs of pillRows) {
      const rowW =
        rowIdxs.reduce((s, i) => s + pillWidths[i], 0) +
        PILL_GAP * (rowIdxs.length - 1);
      let px = cx - rowW / 2;

      for (const i of rowIdxs) {
        const pw = pillWidths[i];

        ctx.globalAlpha = 0.25;
        ctx.fillStyle = LIGHT_BLUE;
        roundRect(ctx, px, y, pw, PILL_H, PILL_H / 2);
        ctx.fill();

        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = LIGHT_BLUE;
        ctx.lineWidth = 1;
        roundRect(ctx, px, y, pw, PILL_H, PILL_H / 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = WHITE;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(techs[i], px + pw / 2, y + PILL_H / 2);

        px += pw + PILL_GAP;
      }
      y += PILL_H + PILL_ROW_GAP;
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
  const [pullQuote, setPullQuote] = useState<PullQuoteData>({
    quote: "",
    attributionName: "",
    attributionTitle: "",
  });
  const [roleBadge, setRoleBadge] = useState<RoleBadgeData>({
    title: "",
    location: "",
    techStack: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoReady(true);
    };
    img.onerror = () => setLogoReady(true);
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
        document.fonts.load(`600 60px Poppins`),
      ]);
    } catch {
      // continue with fallbacks
    }

    ctx.clearRect(0, 0, W, H);
    const logo = logoRef.current;

    if (type === "pull-quote") drawPullQuote(ctx, pullQuote, logo);
    else if (type === "role-badge") drawRoleBadge(ctx, roleBadge, logo);
  }, [type, pullQuote, roleBadge, logoReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <FieldLabel>Title</FieldLabel>
            <TextInput
              value={roleBadge.title}
              onChange={(v) => setRoleBadge((p) => ({ ...p, title: v }))}
              placeholder="e.g. Senior Full Stack Engineer"
            />
          </div>
          <div>
            <FieldLabel hint="optional">Role location</FieldLabel>
            <TextInput
              value={roleBadge.location}
              onChange={(v) => setRoleBadge((p) => ({ ...p, location: v }))}
              placeholder="e.g. Sydney, Australia"
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
