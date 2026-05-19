"use client";

import { useMemo } from "react";

/**
 * Project card cover art — premium minimalist edition.
 *
 * Design principles, in order of importance:
 *   1. Restraint. One accent color per cover. Lots of negative space.
 *   2. Hairline geometry. Thin strokes (0.5–1 px), no filled blobs.
 *   3. Slow, deliberate motion. 10–20 s loops, ease-in-out, never
 *      orbiting or shimmering.
 *   4. Tactile depth. Every cover wears a faint SVG noise overlay so
 *      the surface reads as material rather than CSS.
 *
 * Uniqueness comes from a Mulberry32 PRNG seeded by the project id.
 * Theme + palette + positions + timings all derive from the seed, so
 * two projects rarely share a look and a refresh keeps the art stable.
 */
export function ProjectCardCover({ seed }: { seed: number }) {
  const config = useMemo(() => buildConfig(seed), [seed]);
  const Theme = THEMES[config.themeIdx];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <BaseSurface palette={config.palette} />
      <Theme config={config} />
      <NoiseOverlay seed={config.noiseSeed} />
      <EdgeFade />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

function hashSeed(seed: number): number {
  // xorshift mixer — turns adjacent integer ids into well-spread buckets.
  let h = (seed ^ 0xc0ffee) | 0;
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = (h >>> 16) ^ h;
  return Math.abs(h);
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Palettes — one accent color per cover, plus a refined surface gradient.
// ---------------------------------------------------------------------------

type Palette = {
  /** HEX of the single accent — used sparingly. */
  accent: string;
  /** Faint top-of-card gradient stop. Light mode only; in dark mode we
   *  fall through to a tinted version of zinc-950. */
  surfaceLight: string;
  /** Subtle dark-mode tint blended into zinc-950. */
  surfaceDark: string;
};

const PALETTES: Palette[] = [
  { accent: "#6366f1", surfaceLight: "rgba(99,102,241,0.06)",  surfaceDark: "rgba(99,102,241,0.10)"  }, // indigo
  { accent: "#8b5cf6", surfaceLight: "rgba(139,92,246,0.06)",  surfaceDark: "rgba(139,92,246,0.10)"  }, // violet
  { accent: "#ec4899", surfaceLight: "rgba(236,72,153,0.05)",  surfaceDark: "rgba(236,72,153,0.09)"  }, // pink
  { accent: "#f43f5e", surfaceLight: "rgba(244,63,94,0.05)",   surfaceDark: "rgba(244,63,94,0.09)"   }, // rose
  { accent: "#f59e0b", surfaceLight: "rgba(245,158,11,0.06)",  surfaceDark: "rgba(245,158,11,0.10)"  }, // amber
  { accent: "#10b981", surfaceLight: "rgba(16,185,129,0.05)",  surfaceDark: "rgba(16,185,129,0.09)"  }, // emerald
  { accent: "#06b6d4", surfaceLight: "rgba(6,182,212,0.06)",   surfaceDark: "rgba(6,182,212,0.10)"   }, // cyan
  { accent: "#0ea5e9", surfaceLight: "rgba(14,165,233,0.06)",  surfaceDark: "rgba(14,165,233,0.10)"  }, // sky
  { accent: "#64748b", surfaceLight: "rgba(100,116,139,0.05)", surfaceDark: "rgba(148,163,184,0.07)" }, // slate (monochrome)
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Config = {
  themeIdx: number;
  palette: Palette;
  pool: number[];
  noiseSeed: number;
};

const POOL_SIZE = 32;

function buildConfig(seed: number): Config {
  const hash = hashSeed(seed);
  const rng = mulberry32(hash);
  const themeIdx = Math.floor(rng() * THEMES.length);
  const palette = PALETTES[Math.floor(rng() * PALETTES.length)];
  const pool: number[] = [];
  for (let i = 0; i < POOL_SIZE; i++) pool.push(rng());
  return { themeIdx, palette, pool, noiseSeed: hash };
}

function take(c: Config, i: number): number {
  return c.pool[i % POOL_SIZE];
}

function rand(c: Config, i: number, min: number, max: number): number {
  return min + take(c, i) * (max - min);
}

// ---------------------------------------------------------------------------
// Shared layers
// ---------------------------------------------------------------------------

function BaseSurface({ palette }: { palette: Palette }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-950"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 dark:hidden"
        style={{
          background: `linear-gradient(180deg, ${palette.surfaceLight} 0%, rgba(255,255,255,0) 70%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `linear-gradient(180deg, ${palette.surfaceDark} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
    </>
  );
}

function NoiseOverlay({ seed }: { seed: number }) {
  // SVG fractal noise — gives the surface a subtle film-grain texture
  // that matte gradients alone can't fake. Tiny opacity so it reads as
  // material, not noise. ``seed`` keeps the noise pattern stable per
  // card so resampling doesn't churn pixels on re-render.
  const filterId = `cover-noise-${seed % 100000}`;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08] mix-blend-overlay dark:opacity-[0.18]"
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed={seed % 9999}
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}

function EdgeFade() {
  // Hairline gradient along the bottom edge — sells the "material"
  // feel by giving the strip a soft fall-off into the card body.
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-white/60 dark:to-zinc-950/70"
    />
  );
}

// ---------------------------------------------------------------------------
// Theme 1 — Monolith
//
// A single very large soft sphere anchored at one edge, lit from one
// side by the accent color. Slow vertical bob; that's the entire
// animation. Vercel / Linear hero vibe.
// ---------------------------------------------------------------------------

function MonolithTheme({ config }: { config: Config }) {
  const { palette } = config;
  const side = take(config, 0) > 0.5 ? "left" : "right";
  const cx = side === "left" ? -10 : 290;
  const cy = rand(config, 1, 55, 80);
  const r = 80;
  const gid = `monolith-${config.noiseSeed % 100000}`;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 280 110"
    >
      <defs>
        <radialGradient
          id={gid}
          cx={side === "left" ? "30%" : "70%"}
          cy="35%"
          r="65%"
        >
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.55" />
          <stop offset="55%" stopColor={palette.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g style={{ animation: "cover-bob 14s ease-in-out infinite" }}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={palette.accent}
          strokeOpacity="0.22"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 2 — Hairline
//
// A single thin curve traversing the card, drawing itself in and out
// via stroke-dashoffset. One small accent dot rides at its apex.
// ---------------------------------------------------------------------------

function HairlineTheme({ config }: { config: Config }) {
  const { palette } = config;
  const y0 = rand(config, 0, 40, 80);
  const y1 = rand(config, 1, 30, 80);
  const cy1 = rand(config, 2, 0, 40);
  const cy2 = rand(config, 3, 70, 110);
  const apexX = rand(config, 4, 110, 170);
  const apexY = rand(config, 5, 25, 45);
  const d = `M -10 ${y0} C 60 ${cy1}, 170 ${cy2}, 290 ${y1}`;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 280 110"
      fill="none"
    >
      {/* Ghost echo — same curve, lower opacity, slight vertical offset. */}
      <path
        d={d}
        transform="translate(0, 6)"
        stroke={palette.accent}
        strokeOpacity="0.15"
        strokeWidth="0.6"
      />
      <path
        d={d}
        stroke={palette.accent}
        strokeOpacity="0.7"
        strokeWidth="0.85"
        strokeDasharray="360"
        style={{ animation: "cover-draw-loop 14s ease-in-out infinite" }}
      />
      <circle
        cx={apexX}
        cy={apexY}
        r="2.2"
        fill={palette.accent}
        style={{ animation: "cover-soft-pulse 4s ease-in-out infinite" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 3 — Grid
//
// Hairline grid (1px lines). One cell is highlighted with a small
// rounded square in the accent color that pulses very slowly.
// ---------------------------------------------------------------------------

function GridTheme({ config }: { config: Config }) {
  const { palette } = config;
  const cols = 14;
  const rows = 5;
  const accentRow = Math.floor(rand(config, 0, 0, rows));
  const accentCol = Math.floor(rand(config, 1, 1, cols - 1));
  const cellW = 280 / cols;
  const cellH = 110 / rows;
  const cx = accentCol * cellW + cellW / 2;
  const cy = accentRow * cellH + cellH / 2;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 280 110"
    >
      <g
        stroke="currentColor"
        strokeWidth="0.4"
        className="text-slate-300/70 dark:text-zinc-700/70"
      >
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * cellW} y1="0" x2={i * cellW} y2="110" />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * cellH} x2="280" y2={i * cellH} />
        ))}
      </g>
      <rect
        x={cx - 4}
        y={cy - 4}
        width="8"
        height="8"
        rx="1.4"
        fill={palette.accent}
        fillOpacity="0.85"
        style={{ animation: "cover-soft-pulse 5s ease-in-out infinite" }}
      />
      <rect
        x={cx - 7}
        y={cy - 7}
        width="14"
        height="14"
        rx="2.5"
        fill="none"
        stroke={palette.accent}
        strokeOpacity="0.4"
        strokeWidth="0.5"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 4 — Stack
//
// A small stack of hairline horizontal lines (think a bar chart turned
// quiet). One line is the accent; the stack drifts horizontally over a
// long period.
// ---------------------------------------------------------------------------

function StackTheme({ config }: { config: Config }) {
  const { palette } = config;
  const lineCount = 6;
  const startY = rand(config, 0, 30, 45);
  const gap = 8;
  const accentIdx = Math.floor(rand(config, 1, 1, lineCount - 1));
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    y: startY + i * gap,
    w: rand(config, 2 + i, 90, 220),
    x: rand(config, 12 + i, 30, 60),
    accent: i === accentIdx,
  }));
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 280 110"
    >
      <g style={{ animation: "cover-pan 18s ease-in-out infinite" }}>
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x}
            y1={l.y}
            x2={l.x + l.w}
            y2={l.y}
            stroke={l.accent ? palette.accent : "currentColor"}
            strokeOpacity={l.accent ? 0.85 : 0.35}
            strokeWidth={l.accent ? "1.5" : "0.7"}
            strokeLinecap="round"
            className={l.accent ? "" : "text-slate-400 dark:text-zinc-600"}
          />
        ))}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 5 — Field
//
// A single broad radial gradient drifting slowly across the card. No
// shapes — just light. Very calm. Apple-marketing feel.
// ---------------------------------------------------------------------------

function FieldTheme({ config }: { config: Config }) {
  const { palette } = config;
  const cx = rand(config, 0, 30, 70);
  const cy = rand(config, 1, 30, 70);
  const gid = `field-${config.noiseSeed % 100000}`;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 280 110"
    >
      <defs>
        <radialGradient id={gid} cx={`${cx}%`} cy={`${cy}%`} r="60%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.45" />
          <stop offset="55%" stopColor={palette.accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        width="280"
        height="110"
        fill={`url(#${gid})`}
        style={{ animation: "cover-field-drift 16s ease-in-out infinite" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 6 — Arc
//
// Three concentric thin arcs from a seeded corner — the cover's only
// motif. Outermost arc rotates very slowly; the inner two are static.
// ---------------------------------------------------------------------------

function ArcTheme({ config }: { config: Config }) {
  const { palette } = config;
  // Anchor in one of the four corners — seeded.
  const cornerIdx = Math.floor(rand(config, 0, 0, 4));
  const corner = [
    { x: 0, y: 0 },
    { x: 280, y: 0 },
    { x: 0, y: 110 },
    { x: 280, y: 110 },
  ][cornerIdx];
  const radii = [55, 80, 110];
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 280 110"
      fill="none"
    >
      {radii.map((r, i) => (
        <circle
          key={i}
          cx={corner.x}
          cy={corner.y}
          r={r}
          stroke={palette.accent}
          strokeOpacity={0.28 - i * 0.07}
          strokeWidth="0.6"
        />
      ))}
      <circle
        cx={corner.x}
        cy={corner.y}
        r={140}
        stroke={palette.accent}
        strokeOpacity="0.18"
        strokeWidth="0.5"
        strokeDasharray="2 6"
        style={{
          transformOrigin: `${corner.x}px ${corner.y}px`,
          animation: "cover-arc-spin 60s linear infinite",
        }}
      />
      <circle
        cx={corner.x}
        cy={corner.y}
        r="2.4"
        fill={palette.accent}
        opacity="0.85"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 7 — Horizon
//
// Layered low-contrast horizon lines. Each line is a wider, fainter
// echo of the next. Slow, near-imperceptible drift.
// ---------------------------------------------------------------------------

function HorizonTheme({ config }: { config: Config }) {
  const { palette } = config;
  const baseY = rand(config, 0, 60, 78);
  const skew = rand(config, 1, -8, 8);
  const lines = [0, 6, 14, 24].map((dy, i) => ({
    y1: baseY - dy,
    y2: baseY - dy + skew,
    opacity: 0.55 - i * 0.12,
    width: i === 0 ? 1.2 : 0.6,
  }));
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 280 110"
      fill="none"
    >
      <g style={{ animation: "cover-soft-shift 22s ease-in-out infinite" }}>
        {lines.map((l, i) => (
          <line
            key={i}
            x1="-10"
            y1={l.y1}
            x2="290"
            y2={l.y2}
            stroke={i === 0 ? palette.accent : "currentColor"}
            strokeOpacity={l.opacity}
            strokeWidth={l.width}
            className={i === 0 ? "" : "text-slate-400 dark:text-zinc-600"}
          />
        ))}
      </g>
      {/* A single accent dot riding the top line. */}
      <circle
        cx={rand(config, 5, 80, 220)}
        cy={baseY + (rand(config, 5, 80, 220) - 80) * (skew / 280)}
        r="1.8"
        fill={palette.accent}
        style={{ animation: "cover-soft-pulse 4.5s ease-in-out infinite" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 8 — Halo
//
// A single hairline rounded square centered with negative space — the
// most restrained of the lot. Internal accent gradient gives it depth;
// gentle scale breathing animates the whole.
// ---------------------------------------------------------------------------

function HaloTheme({ config }: { config: Config }) {
  const { palette } = config;
  const w = rand(config, 0, 110, 150);
  const h = rand(config, 1, 60, 80);
  const x = 140 - w / 2;
  const y = 55 - h / 2;
  const gid = `halo-${config.noiseSeed % 100000}`;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 280 110"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g
        style={{
          transformOrigin: "140px 55px",
          animation: "cover-breathe 12s ease-in-out infinite",
        }}
      >
        <rect x={x} y={y} width={w} height={h} rx="6" fill={`url(#${gid})`} />
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="6"
          fill="none"
          stroke={palette.accent}
          strokeOpacity="0.45"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const THEMES = [
  MonolithTheme,
  HairlineTheme,
  GridTheme,
  StackTheme,
  FieldTheme,
  ArcTheme,
  HorizonTheme,
  HaloTheme,
] as const;
