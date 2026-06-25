/**
 * App root. Loads tft.json once (Tauri command if available, else web fetch),
 * normalizes Set 17, and renders the calculator.
 *
 * State flows through a single useReducer. Every render derives the DpsInput
 * from state and pipes it through computeDps() — all calculations are sync
 * and microsecond-scale, so no memoization is needed.
 */
import { useEffect, useMemo, useReducer } from "react";
import "./App.css";
import {
  isTauri,
  loadSetData,
  type TraitBreakpoint,
} from "./data";
import { computeDps, simulateTimeline, type DpsBreakdown, type Timeline } from "./engine";
import { INITIAL_STATE, reducer, type LoadoutKey } from "./state";
import { ChampionSelector } from "./components/ChampionSelector";
import { StarLevelButtons } from "./components/StarLevelButtons";
import { ItemSlots } from "./components/ItemSlots";
import { TraitPanel } from "./components/TraitPanel";
import { TargetConfig } from "./components/TargetConfig";
import { DpsSummary } from "./components/DpsSummary";
import { StatTable } from "./components/StatTable";
import { DpsBreakdownTable } from "./components/DpsBreakdownTable";
import { AbilityDetail } from "./components/AbilityDetail";
import { DpsTimelineChart } from "./components/DpsTimelineChart";
import { LoadoutCompareBar } from "./components/LoadoutCompareBar";

export function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Load Set 17 data once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await loadSetData(17);
        if (!cancelled) dispatch({ type: "set-data-loaded", setData: data });
      } catch (e) {
        if (!cancelled)
          dispatch({ type: "set-data-error", message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve active breakpoints from the trait registry. The engine takes the
  // resolved `TraitBreakpoint[]` (with `variables`), not the lightweight
  // `ActiveBreakpoint` user-selection markers.
  const resolvedBreakpoints = useMemo<TraitBreakpoint[]>(() => {
    if (!state.setData) return [];
    const out: TraitBreakpoint[] = [];
    for (const active of state.activeBreakpoints) {
      const trait = state.setData.traits.find(
        (t) => t.apiName === active.traitApiName,
      );
      if (!trait) continue;
      const bp = trait.breakpoints.find((b) => b.minUnits === active.minUnits);
      if (bp) out.push(bp);
    }
    return out;
  }, [state.setData, state.activeBreakpoints]);

  // Run the engine for BOTH loadouts. Cheap (microseconds), no memo gymnastics.
  // breakdown.A/B are always non-null when a champion is picked. Loadout B is
  // "active for compare" only when it has at least one item — empty B is
  // hidden from the chart so the user doesn't see a degenerate "auto-attack
  // only with no items" curve unless they explicitly populated it.
  const breakdowns = useMemo<Record<LoadoutKey, DpsBreakdown> | null>(() => {
    if (!state.champion) return null;
    const run = (loadout: LoadoutKey) => {
      const items = state.loadouts[loadout].filter(
        (i): i is NonNullable<typeof i> => i !== null,
      );
      return computeDps({
        champion: state.champion!,
        starLevel: state.starLevel,
        items,
        breakpoints: resolvedBreakpoints,
        target: state.target,
        incomingDps: state.incomingDps,
      });
    };
    return { A: run("A"), B: run("B") };
  }, [
    state.champion,
    state.starLevel,
    state.loadouts,
    resolvedBreakpoints,
    state.target,
    state.incomingDps,
  ]);

  const loadoutBHasItems = state.loadouts.B.some((s) => s !== null);

  // Time-step simulation for the DPS curve, per loadout. Same inputs.
  const timelines = useMemo<Record<LoadoutKey, Timeline> | null>(() => {
    if (!state.champion) return null;
    const run = (loadout: LoadoutKey) => {
      const items = state.loadouts[loadout].filter(
        (i): i is NonNullable<typeof i> => i !== null,
      );
      return simulateTimeline({
        champion: state.champion!,
        starLevel: state.starLevel,
        items,
        breakpoints: resolvedBreakpoints,
        target: state.target,
        incomingDps: state.incomingDps,
        duration: state.simulationDuration,
        dt: 0.05,
      });
    };
    return { A: run("A"), B: run("B") };
  }, [
    state.champion,
    state.starLevel,
    state.loadouts,
    resolvedBreakpoints,
    state.target,
    state.incomingDps,
    state.simulationDuration,
  ]);

  // Active loadout drives the secondary panels (stat table, breakdown, ability
  // detail) only. The chart shows BOTH series with fixed colors keyed to the
  // loadout (A=gold, B=cyan) — switching the active tab repaints the panels,
  // never the chart.
  const activeBreakdown = breakdowns?.[state.activeLoadout] ?? null;
  const timelineA = timelines?.A ?? null;
  const timelineB = loadoutBHasItems ? (timelines?.B ?? null) : null;
  const showingBoth = timelineA !== null && timelineB !== null;

  // --- render branches -----------------------------------------------------

  if (state.loadError) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>TFT DPS 模拟器</h1>
        </header>
        <div className="loading-screen">
          <div>无法加载 tft.json</div>
          <div className="muted" style={{ maxWidth: 480, textAlign: "center" }}>
            {state.loadError}
          </div>
        </div>
      </div>
    );
  }

  if (!state.setData) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>TFT DPS 模拟器</h1>
        </header>
        <div className="loading-screen">
          <div className="spinner" />
          <div>正在加载 Set 17 数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>TFT DPS 模拟器 · Set {state.setData.setNumber}</h1>
        <div className="meta">
          {state.setData.champions.length} 英雄 · {state.setData.traits.length}{" "}
          羁绊 · {state.setData.items.length} 装备
        </div>
      </header>

      <main className="app-main">
        {/* ---- left: inputs ---- */}
        <div className="panel-stack">
          <div className="panel">
            <div className="panel-title">英雄</div>
            <ChampionSelector
              setData={state.setData}
              selected={state.champion}
              onSelect={(c) => dispatch({ type: "select-champion", champion: c })}
            />
            {state.champion && (
              <div style={{ marginTop: 10 }}>
                <StarLevelButtons
                  star={state.starLevel}
                  onChange={(s) => dispatch({ type: "set-star", star: s })}
                />
              </div>
            )}
          </div>

          {state.champion && (
            <>
              <div className="panel">
                <div className="panel-title">装备 (最多 3 件)</div>
                <ItemSlots
                  setData={state.setData}
                  slots={state.loadouts[state.activeLoadout]}
                  onChange={(slot, item) =>
                    dispatch({ type: "set-item", slot, item })
                  }
                  loadout={{
                    active: state.activeLoadout,
                    onSwitch: (loadout) =>
                      dispatch({ type: "set-active-loadout", loadout }),
                    onClear: (loadout) =>
                      dispatch({ type: "clear-loadout", loadout }),
                    onCopy: (from, to) =>
                      dispatch({ type: "copy-loadout", from, to }),
                    counts: {
                      A: state.loadouts.A.filter((s) => s !== null).length,
                      B: state.loadouts.B.filter((s) => s !== null).length,
                    },
                  }}
                />
              </div>

              <div className="panel">
                <div className="panel-title">羁绊断点</div>
                <TraitPanel
                  setData={state.setData}
                  champion={state.champion}
                  active={state.activeBreakpoints}
                  onToggle={(traitApiName, minUnits) =>
                    dispatch({
                      type: "toggle-trait-breakpoint",
                      traitApiName,
                      minUnits,
                    })
                  }
                />
              </div>
            </>
          )}

          <div className="panel">
            <div className="panel-title">目标</div>
            <TargetConfig
              target={state.target}
              incomingDps={state.incomingDps}
              onTarget={(t) => dispatch({ type: "set-target", target: t })}
              onIncomingDps={(v) =>
                dispatch({ type: "set-incoming-dps", value: v })
              }
            />
          </div>
        </div>

        {/* ---- right: outputs ---- */}
        <div className="panel-stack">
          {breakdowns && activeBreakdown && state.champion ? (
            <div className="results-grid">
              <div className="full-row">
                <LoadoutCompareBar
                  a={breakdowns.A}
                  b={loadoutBHasItems ? breakdowns.B : null}
                  active={state.activeLoadout}
                  onSwitch={(loadout) =>
                    dispatch({ type: "set-active-loadout", loadout })
                  }
                />
              </div>
              <div className="full-row">
                <DpsSummary breakdown={activeBreakdown} />
              </div>
              {timelineA && (
                <div className="panel section-card full-row">
                  <div className="panel-header">
                    <div className="panel-title" style={{ margin: 0 }}>
                      DPS 时间曲线 ({state.simulationDuration}s 模拟)
                      {showingBoth && (
                        <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                          · A vs B 对比中
                        </span>
                      )}
                    </div>
                    <div className="duration-picker">
                      {[5, 10, 15, 30, 60].map((s) => (
                        <button
                          key={s}
                          className={
                            "duration-btn" +
                            (state.simulationDuration === s ? " active" : "")
                          }
                          onClick={() =>
                            dispatch({ type: "set-simulation-duration", value: s })
                          }
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <DpsTimelineChart
                    a={timelineA}
                    b={timelineB}
                    active={state.activeLoadout}
                  />
                  <div
                    className="muted"
                    style={{ fontSize: 11, marginTop: 6, textAlign: "center" }}
                  >
                    {showingBoth && timelineB ? (
                      <>
                        方案 A · 总伤 {timelineA.totalDamage.toFixed(0)} · 平均 DPS{" "}
                        {timelineA.averageDps.toFixed(1)} · 施法{" "}
                        {timelineA.castCount} 次
                        <span style={{ marginLeft: 12 }}>
                          · 方案 B · 总伤 {timelineB.totalDamage.toFixed(0)} ·
                          平均 DPS {timelineB.averageDps.toFixed(1)} · 施法{" "}
                          {timelineB.castCount} 次
                        </span>
                      </>
                    ) : (
                      <>
                        总伤 {timelineA.totalDamage.toFixed(0)} · 平均 DPS{" "}
                        {timelineA.averageDps.toFixed(1)} · 施法{" "}
                        {timelineA.castCount} 次
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="panel section-card">
                <div className="panel-title">
                  有效属性 <span className="muted">· 方案 {state.activeLoadout}</span>
                </div>
                <StatTable breakdown={activeBreakdown} />
              </div>
              <div className="panel section-card">
                <div className="panel-title">
                  DPS 拆分 <span className="muted">· 方案 {state.activeLoadout}</span>
                </div>
                <DpsBreakdownTable breakdown={activeBreakdown} />
              </div>
              <div className="panel section-card full-row">
                <div className="panel-title">
                  技能详情 <span className="muted">· 方案 {state.activeLoadout}</span>
                </div>
                <AbilityDetail
                  champion={state.champion}
                  starLevel={state.starLevel}
                  breakdown={activeBreakdown}
                />
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="placeholder">请先选择一个英雄</div>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <span>
          数据源：CommunityDragon · Patch{" "}
          <span className="muted">{state.setData.patch}</span>
        </span>
        <span>
          {isTauri() ? "桌面模式 (Tauri)" : "Web 模式"}
        </span>
      </footer>
    </div>
  );
}
