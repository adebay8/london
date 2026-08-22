"use client";

import { largestOpenBay } from "@/lib/consoles/fit";
import {
  MIN_TOP_DEPTH_CM,
  PS5_DEPTH_CM,
  PS5_HEIGHT_CM,
  PS5_WIDTH_CM,
  SOUNDBAR_DEPTH_CM,
  SOUNDBAR_WIDTH_CM,
  TV_STAND_DEPTH_CM,
  TV_STAND_WIDTH_CM,
  type TvConsole,
} from "@/lib/consoles/types";

// To-scale drawings of the two things that decide this purchase. A spec row
// saying "38cm deep" does not communicate that the soundbar hangs a centimetre
// off the front edge; a drawing does.
//
// Both SVGs use centimetres as their coordinate space via viewBox, so every
// rectangle is literally to scale and stroke widths are expressed in cm too.

const OK = "var(--status-yes)";
const BAD = "var(--status-no)";
const MUTED = "var(--text-muted)";

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-primary)] px-3 text-center text-[11px] text-[var(--text-muted)]">
      {label}
    </div>
  );
}

/** Plan view: looking down at the top surface, TV base at the back, soundbar
 *  in front of it. Overflow past the front edge is drawn, not hidden. */
function TopSurface({ c }: { c: TvConsole }) {
  const w = c.topWidthCm;
  const d = c.topDepthCm;
  if (w == null || d == null) return <Empty label="Top surface dimensions not published" />;

  // The drawing has to show overflow, so the canvas covers whichever is
  // deeper: the console, or the kit standing on it.
  const canvasD = Math.max(d, MIN_TOP_DEPTH_CM) + 4;
  const canvasW = Math.max(w, TV_STAND_WIDTH_CM) + 4;
  const ox = (canvasW - w) / 2;

  const standX = ox + (w - TV_STAND_WIDTH_CM) / 2;
  const barX = ox + (w - SOUNDBAR_WIDTH_CM) / 2;
  const barY = 2 + TV_STAND_DEPTH_CM;
  const barOverflows = d < MIN_TOP_DEPTH_CM;
  const standOverflows = w < TV_STAND_WIDTH_CM || d < TV_STAND_DEPTH_CM;

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasD}`}
      className="w-full"
      role="img"
      aria-label={`Plan view: a ${w} by ${d} centimetre top surface with the TV stand and soundbar drawn to scale`}
    >
      {/* the console top */}
      <rect
        x={ox}
        y={2}
        width={w}
        height={d}
        fill="var(--bg-secondary)"
        stroke="var(--border-primary)"
        strokeWidth={0.5}
        rx={1}
      />
      {/* TV stand footprint */}
      <rect
        x={standX}
        y={2}
        width={TV_STAND_WIDTH_CM}
        height={TV_STAND_DEPTH_CM}
        fill={standOverflows ? BAD : "var(--accent)"}
        fillOpacity={0.28}
        stroke={standOverflows ? BAD : "var(--accent)"}
        strokeWidth={0.4}
      />
      {/* soundbar footprint */}
      <rect
        x={barX}
        y={barY}
        width={SOUNDBAR_WIDTH_CM}
        height={SOUNDBAR_DEPTH_CM}
        fill={barOverflows ? BAD : OK}
        fillOpacity={0.28}
        stroke={barOverflows ? BAD : OK}
        strokeWidth={0.4}
      />
      {/* front edge of the console, so overflow reads as overflow */}
      <line x1={ox} y1={2 + d} x2={ox + w} y2={2 + d} stroke={barOverflows ? BAD : MUTED} strokeWidth={0.5} />
      <text x={ox + w / 2} y={1.4} fontSize={2.6} fill={MUTED} textAnchor="middle">
        {w}cm wide
      </text>
      <text x={ox + w / 2} y={2 + d + 3} fontSize={2.6} fill={barOverflows ? BAD : MUTED} textAnchor="middle">
        {barOverflows
          ? `${d}cm deep — soundbar overhangs by ${Math.round((MIN_TOP_DEPTH_CM - d) * 10) / 10}cm`
          : `${d}cm deep — TV base + soundbar fit in line`}
      </text>
    </svg>
  );
}

/** Front elevation of the largest open bay, with a PS5 lying flat in it. */
function Ps5Bay({ c }: { c: TvConsole }) {
  const bay = largestOpenBay(c.bays);
  if (!bay || bay.widthCm == null || bay.heightCm == null) {
    return <Empty label="No open bay with published internal dimensions" />;
  }

  const bw = bay.widthCm;
  const bh = bay.heightCm;
  const canvasW = Math.max(bw, PS5_WIDTH_CM) + 4;
  const canvasH = Math.max(bh, PS5_HEIGHT_CM) + 8;
  const ox = (canvasW - bw) / 2;

  const tooNarrow = bw < PS5_WIDTH_CM;
  const tooLow = bh < PS5_HEIGHT_CM;
  const tooShallow = bay.depthCm != null && bay.depthCm < PS5_DEPTH_CM;
  const bad = tooNarrow || tooLow || tooShallow;

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="w-full"
      role="img"
      aria-label={`Front view: a ${bw} by ${bh} centimetre open bay with a PS5 drawn to scale`}
    >
      <rect
        x={ox}
        y={2}
        width={bw}
        height={bh}
        fill="var(--bg-secondary)"
        stroke="var(--border-primary)"
        strokeWidth={0.35}
        rx={0.6}
      />
      {/* PS5 sitting on the bay floor */}
      <rect
        x={(canvasW - PS5_WIDTH_CM) / 2}
        y={2 + bh - PS5_HEIGHT_CM}
        width={PS5_WIDTH_CM}
        height={PS5_HEIGHT_CM}
        fill={bad ? BAD : OK}
        fillOpacity={0.28}
        stroke={bad ? BAD : OK}
        strokeWidth={0.3}
        rx={0.4}
      />
      <text x={canvasW / 2} y={2 + bh + 3.5} fontSize={2} fill={bad ? BAD : MUTED} textAnchor="middle">
        {bw}×{bay.depthCm ?? "?"}×{bh}cm bay
        {tooNarrow ? " — too narrow" : tooLow ? " — too low" : tooShallow ? " — too shallow" : " — PS5 fits flat"}
      </text>
    </svg>
  );
}

export default function FitDiagram({ console: c }: { console: TvConsole }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Top surface, from above
        </div>
        <TopSurface c={c} />
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Largest open bay, from the front
        </div>
        <Ps5Bay c={c} />
      </div>
    </div>
  );
}
