/**
 * SVG-based DPS timeline chart. No charting library; we hand-render lines
 * because the data shape is simple and we want full control over the visual
 * vocabulary (cumulative damage curve, instantaneous DPS line, cast markers).
 *
 * Supports overlaying TWO loadouts (A + B) for side-by-side comparison. The
 * two series have FIXED colors keyed to the loadout, not to the "active"
 * panel — so switching the active tab on the right doesn't repaint the
 * chart. A is always gold, B is always cyan.
 *
 * Series legend:
 *   - 方案 A: gold cumulative area + blue dashed average-DPS line
 *   - 方案 B: cyan cumulative line (no fill, to avoid stacked-area confusion)
 *             + magenta dashed average-DPS line
 * Cast markers come from whichever series is non-null first (A if present).
 */
import { useMemo } from "react";
import type { Timeline } from "../engine";

interface Props {
  /** Loadout A timeline (always shown when present). */
  a: Timeline | null;
  /** Loadout B timeline. Shown only when non-null. */
  b: Timeline | null;
  /** Which loadout is "active" — only affects subtle emphasis (cast markers),
   * NOT colors. Defaults to "A". */
  active?: "A" | "B";
  /** Logical viewBox dimensions; the SVG fluidly scales to its container width. */
  width?: number;
  height?: number;
}

const PADDING = { top: 14, right: 50, bottom: 28, left: 50 };

export function DpsTimelineChart({
  a,
  b,
  active = "A",
  width = 540,
  height = 240,
}: Props) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const series = useMemo(() => [a, b].filter((s): s is Timeline => s !== null), [a, b]);

  const { cumMax, dpsMax, duration } = useMemo(() => {
    let cMax = 0;
    let dMax = 0;
    let lastT = 0;
    for (const s of series) {
      for (const p of s.points) {
        if (p.cumulative > cMax) cMax = p.cumulative;
        if (p.dps > dMax) dMax = p.dps;
      }
      const t = s.points[s.points.length - 1]?.t ?? 0;
      if (t > lastT) lastT = t;
    }
    return {
      cumMax: Math.max(cMax, 1),
      dpsMax: Math.max(dMax, 1),
      duration: Math.max(lastT, 1),
    };
  }, [series]);

  const xScale = (t: number) => PADDING.left + (t / duration) * innerW;
  const yScaleCum = (v: number) =>
    PADDING.top + innerH - (v / cumMax) * innerH;
  const yScaleDps = (v: number) =>
    PADDING.top + innerH - (v / dpsMax) * innerH;

  // A is the canonical "filled area" series so the chart still reads at a
  // glance when only A is populated. If A is empty but B is shown (rare —
  // user populated B without ever touching A), we promote B's line into the
  // area to avoid an empty chart.
  const primaryForArea = a ?? b;
  const areaPath = useMemo(
    () => (primaryForArea ? buildAreaPath(primaryForArea, xScale, yScaleCum, duration) : ""),
    [primaryForArea, cumMax, duration, innerW, innerH],
  );
  const areaColor = a ? "var(--accent-gold)" : "var(--accent-cyan)";

  // The "other" series (if both A and B exist) is rendered as a line.
  const overlayCumulative = a && b ? b : null;
  const overlayCumPath = useMemo(
    () =>
      overlayCumulative
        ? buildLinePath(overlayCumulative, xScale, yScaleCum, "cumulative")
        : "",
    [overlayCumulative, cumMax, duration, innerW, innerH],
  );

  // DPS lines: A → blue, B → magenta. Always rendered with the loadout's
  // color regardless of which is "active".
  const dpsPathA = useMemo(
    () => (a ? buildLinePath(a, xScale, yScaleDps, "dps") : ""),
    [a, dpsMax, duration, innerW, innerH],
  );
  const dpsPathB = useMemo(
    () => (b ? buildLinePath(b, xScale, yScaleDps, "dps") : ""),
    [b, dpsMax, duration, innerW, innerH],
  );

  // Cast markers: show from the active loadout's series. Falls back to A.
  const castSource = active === "B" && b ? b : a ?? b;

  // Tick marks on X axis (every 1s if duration ≤ 20, every 5s otherwise).
  const xTickStep = duration <= 20 ? 1 : 5;
  const xTicks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += xTickStep) {
    xTicks.push(Math.round(t * 10) / 10);
  }

  // Y ticks: 4 segments.
  const yTickCount = 4;
  const yTicksCum: number[] = [];
  const yTicksDps: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicksCum.push((cumMax / yTickCount) * i);
    yTicksDps.push((dpsMax / yTickCount) * i);
  }

  function fmt(v: number): string {
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
    return v.toFixed(0);
  }

  const showingBoth = a !== null && b !== null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="dps-chart"
    >
      {/* axes */}
      <line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={PADDING.top + innerH}
        stroke="var(--border)"
      />
      <line
        x1={PADDING.left}
        y1={PADDING.top + innerH}
        x2={PADDING.left + innerW}
        y2={PADDING.top + innerH}
        stroke="var(--border)"
      />

      {/* grid lines + Y ticks (cumulative, left) */}
      {yTicksCum.map((v, i) => {
        const y = yScaleCum(v);
        return (
          <g key={`y-${i}`}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + innerW}
              y2={y}
              stroke="var(--border)"
              strokeOpacity={0.4}
              strokeDasharray="2 4"
            />
            <text
              x={PADDING.left - 6}
              y={y + 3}
              fontSize={10}
              fill="var(--text-2)"
              textAnchor="end"
            >
              {fmt(v)}
            </text>
          </g>
        );
      })}

      {/* Y ticks (DPS, right) */}
      {yTicksDps.map((v, i) => (
        <text
          key={`yr-${i}`}
          x={PADDING.left + innerW + 6}
          y={yScaleDps(v) + 3}
          fontSize={10}
          fill="var(--accent-blue)"
          textAnchor="start"
          opacity={0.7}
        >
          {fmt(v)}
        </text>
      ))}

      {/* X ticks */}
      {xTicks.map((t) => (
        <g key={`x-${t}`}>
          <line
            x1={xScale(t)}
            y1={PADDING.top + innerH}
            x2={xScale(t)}
            y2={PADDING.top + innerH + 4}
            stroke="var(--border)"
          />
          <text
            x={xScale(t)}
            y={PADDING.top + innerH + 16}
            fontSize={10}
            fill="var(--text-2)"
            textAnchor="middle"
          >
            {t}s
          </text>
        </g>
      ))}

      {/* cast markers from the active series only */}
      {castSource?.castTimes.map((t, i) => (
        <line
          key={`cast-${i}`}
          x1={xScale(t)}
          y1={PADDING.top}
          x2={xScale(t)}
          y2={PADDING.top + innerH}
          stroke="var(--accent-purple)"
          strokeOpacity={0.25}
          strokeDasharray="2 3"
        />
      ))}

      {/* cumulative damage area (A by default, B only if A is null) */}
      <path
        d={areaPath}
        fill={areaColor}
        fillOpacity={0.14}
        stroke={areaColor}
        strokeWidth={1.5}
      />

      {/* cumulative damage line for B (only when both shown) */}
      {overlayCumPath && (
        <path
          d={overlayCumPath}
          stroke="var(--accent-cyan)"
          strokeWidth={1.75}
          fill="none"
        />
      )}

      {/* DPS line (A) — blue */}
      {dpsPathA && (
        <path
          d={dpsPathA}
          stroke="var(--accent-blue)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          fill="none"
        />
      )}

      {/* DPS line (B) — magenta */}
      {dpsPathB && (
        <path
          d={dpsPathB}
          stroke="var(--accent-magenta)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          fill="none"
        />
      )}

      {/* axis titles */}
      <text
        x={PADDING.left + 4}
        y={PADDING.top - 4}
        fontSize={10}
        fill="var(--accent-gold)"
      >
        累计伤害{showingBoth ? " (A 金 / B 青)" : ""}
      </text>
      <text
        x={PADDING.left + innerW - 4}
        y={PADDING.top - 4}
        fontSize={10}
        fill="var(--accent-blue)"
        textAnchor="end"
      >
        平均 DPS{showingBoth ? " (A 蓝 / B 品红)" : ""}
      </text>
    </svg>
  );
}

function buildAreaPath(
  tl: Timeline,
  xScale: (t: number) => number,
  yScale: (v: number) => number,
  duration: number,
): string {
  if (tl.points.length === 0) return "";
  const segs: string[] = [];
  segs.push(`M ${xScale(0)} ${yScale(0)}`);
  for (const p of tl.points) {
    segs.push(`L ${xScale(p.t)} ${yScale(p.cumulative)}`);
  }
  segs.push(
    `L ${xScale(duration)} ${yScale(0)}`,
    `L ${xScale(0)} ${yScale(0)} Z`,
  );
  return segs.join(" ");
}

function buildLinePath(
  tl: Timeline,
  xScale: (t: number) => number,
  yScale: (v: number) => number,
  field: "cumulative" | "dps",
): string {
  if (tl.points.length === 0) return "";
  const segs: string[] = [];
  for (let i = 0; i < tl.points.length; i++) {
    const p = tl.points[i];
    const v = field === "cumulative" ? p.cumulative : p.dps;
    segs.push((i === 0 ? "M" : "L") + ` ${xScale(p.t)} ${yScale(v)}`);
  }
  return segs.join(" ");
}
