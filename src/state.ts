/**
 * App state + reducer. Single source of truth for the DPS calculator.
 *
 * State changes flow through this reducer; downstream selectors derive:
 *   - the items array (filtered from itemSlots, nulls removed) per loadout
 *   - the resolved trait breakpoints (from activeBreakpoints + setData.traits)
 *   - the DpsInput passed to computeDps() per loadout
 *
 * The reducer is intentionally pure — no async, no side effects. Data loading
 * is handled separately in App.tsx.
 *
 * Loadout A/B: the calculator holds two item plans simultaneously so the user
 * can compare them on the DPS chart. The `activeLoadout` key drives which one
 * is currently being EDITED (slot clicks / breakpoint toggles still affect
 * shared state) and which one feeds the secondary panels (stat table, DPS
 * breakdown, ability detail). Both are always evaluated; the chart overlays
 * them.
 */
import type {
  ActiveBreakpoint,
  Champion,
  Item,
  SetData,
  StarLevel,
  TargetDummy,
} from "./data";

export type ItemSlots = [Item | null, Item | null, Item | null];
export type LoadoutKey = "A" | "B";

export interface AppState {
  setData: SetData | null;
  loadError: string | null;

  champion: Champion | null;
  starLevel: StarLevel;
  /** Two parallel item plans; both evaluated for chart overlay. */
  loadouts: Record<LoadoutKey, ItemSlots>;
  /** Which loadout the UI is currently editing / showing details for. */
  activeLoadout: LoadoutKey;
  activeBreakpoints: ActiveBreakpoint[];
  target: TargetDummy;
  incomingDps: number;
  /** Timeline simulation duration in seconds. */
  simulationDuration: number;
}

export const DEFAULT_TARGET: TargetDummy = {
  health: 2500,
  armor: 60,
  magicResist: 40,
};

const EMPTY_SLOTS: ItemSlots = [null, null, null];

export const INITIAL_STATE: AppState = {
  setData: null,
  loadError: null,
  champion: null,
  starLevel: 2,
  loadouts: { A: [null, null, null], B: [null, null, null] },
  activeLoadout: "A",
  activeBreakpoints: [],
  target: DEFAULT_TARGET,
  incomingDps: 0,
  simulationDuration: 15,
};

export type Action =
  | { type: "set-data-loaded"; setData: SetData }
  | { type: "set-data-error"; message: string }
  | { type: "select-champion"; champion: Champion }
  | { type: "set-star"; star: StarLevel }
  | { type: "set-item"; slot: 0 | 1 | 2; item: Item | null }
  | { type: "set-active-loadout"; loadout: LoadoutKey }
  | { type: "clear-loadout"; loadout: LoadoutKey }
  | { type: "copy-loadout"; from: LoadoutKey; to: LoadoutKey }
  | { type: "toggle-trait-breakpoint"; traitApiName: string; minUnits: number }
  | { type: "set-target"; target: Partial<TargetDummy> }
  | { type: "set-incoming-dps"; value: number }
  | { type: "set-simulation-duration"; value: number }
  | { type: "reset-loadout" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "set-data-loaded":
      return { ...state, setData: action.setData, loadError: null };

    case "set-data-error":
      return { ...state, loadError: action.message };

    case "select-champion":
      // Changing champions clears items + breakpoints to avoid stale references.
      return {
        ...state,
        champion: action.champion,
        starLevel: 2,
        loadouts: { A: [...EMPTY_SLOTS], B: [...EMPTY_SLOTS] },
        activeLoadout: "A",
        activeBreakpoints: [],
      };

    case "set-star":
      return { ...state, starLevel: action.star };

    case "set-item": {
      const cur = state.loadouts[state.activeLoadout];
      const next: ItemSlots = [...cur] as ItemSlots;
      next[action.slot] = action.item;
      return {
        ...state,
        loadouts: { ...state.loadouts, [state.activeLoadout]: next },
      };
    }

    case "set-active-loadout":
      return { ...state, activeLoadout: action.loadout };

    case "clear-loadout":
      return {
        ...state,
        loadouts: { ...state.loadouts, [action.loadout]: [...EMPTY_SLOTS] },
      };

    case "copy-loadout": {
      if (action.from === action.to) return state;
      const src = state.loadouts[action.from];
      return {
        ...state,
        loadouts: { ...state.loadouts, [action.to]: [...src] as ItemSlots },
      };
    }

    case "toggle-trait-breakpoint": {
      // For a given trait, only one breakpoint can be active at a time.
      // Clicking the active one again deactivates it.
      const existing = state.activeBreakpoints.find(
        (b) => b.traitApiName === action.traitApiName,
      );
      const filtered = state.activeBreakpoints.filter(
        (b) => b.traitApiName !== action.traitApiName,
      );
      if (existing && existing.minUnits === action.minUnits) {
        return { ...state, activeBreakpoints: filtered };
      }
      return {
        ...state,
        activeBreakpoints: [
          ...filtered,
          { traitApiName: action.traitApiName, minUnits: action.minUnits },
        ],
      };
    }

    case "set-target":
      return { ...state, target: { ...state.target, ...action.target } };

    case "set-incoming-dps":
      return { ...state, incomingDps: action.value };

    case "set-simulation-duration":
      return { ...state, simulationDuration: action.value };

    case "reset-loadout":
      return {
        ...state,
        starLevel: 2,
        loadouts: { A: [...EMPTY_SLOTS], B: [...EMPTY_SLOTS] },
        activeLoadout: "A",
        activeBreakpoints: [],
      };

    default:
      return state;
  }
}
