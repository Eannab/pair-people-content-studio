# Pair People — Content Studio

An AI-powered LinkedIn content creation tool for Pair People, Sydney's Fixed Fee tech recruitment agency. Built with Next.js 14, Tailwind CSS, and Anthropic Claude.

## Features

- **Create Panel** — Generate LinkedIn posts by selecting a post type, angle, and providing context
- **Quick Refine** — Single-instruction refinement of generated posts
- **Deep Thread** — Multi-turn conversation with Claude to iterate on posts (history persisted via Vercel KV)
- **Intelligence Panel** — Coming soon: market trends, competitor analysis
- **Research Panel** — Coming soon: candidate stories, company insights

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/YOUR_USERNAME/pair-people-content-studio.git
cd pair-people-content-studio
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

Required:
- `ANTHROPIC_API_KEY` — Get from [console.anthropic.com](https://console.anthropic.com)

Optional (for Deep Thread history persistence):
- `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` — From Vercel KV / Upstash Redis integration

> **Note:** The app works without KV credentials — conversation history will be held in client memory only (lost on page refresh).

### 3. Font setup

The app uses **Alte Haas Grotesk** as the body font. This is a self-hosted font.

1. Download `AlteHaasGroteskRegular.woff2`
2. Place it at: `public/fonts/AlteHaasGroteskRegular.woff2`

Without this file the app will fall back to system sans-serif — all functionality still works.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Storage | Vercel KV (Upstash Redis) |
| Deployment | Vercel |

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── page.tsx                # Main page (panel routing)
│   ├── globals.css             # Global styles + font-face declarations
│   └── api/
│       ├── generate/route.ts   # POST /api/generate — Claude post generation
│       └── thread/route.ts     # POST /api/thread — Deep thread with KV storage
├── components/
│   ├── Sidebar.tsx             # Navigation sidebar
│   ├── CreatePanel.tsx         # Main content creation UI
│   ├── GeneratedPost.tsx       # Post display with copy button
│   ├── RefinementPanel.tsx     # Quick refine + Deep thread
│   ├── IntelligencePanel.tsx   # Coming soon placeholder
│   └── ResearchPanel.tsx       # Coming soon placeholder
├── public/
│   └── fonts/                  # Place AlteHaasGroteskRegular.woff2 here
├── tailwind.config.ts          # Brand colours + font families
├── vercel.json                 # Vercel deployment config
└── .env.local.example          # Environment variable template
```

## Deploying to Vercel

```bash
vercel deploy
```

Or connect your GitHub repo to Vercel and it will auto-deploy on push.

Add your environment variables in the Vercel dashboard under **Settings > Environment Variables**.

## Brand Colours

| Name | Hex |
|------|-----|
| Primary Navy | `#323B6A` |
| Primary Green | `#BDCF7C` |
| Mid Blue | `#6F92BF` |
| Light Blue | `#A7B8D1` |
| Light Green | `#DBEAA0` |
| Yellow | `#FEEA99` |
| Pale Background | `#E7EDF3` |
