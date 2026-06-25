/**
 * Data fetcher — abstracts where the raw cdragon JSON comes from so the engine
 * and data layer work identically across:
 *   - Tauri desktop: Rust command `load_or_fetch_tft` does HTTP fetch + cache
 *     and returns raw JSON. Wired via `installTauriProvider()`.
 *   - Web dev (vite): reads `/tft.json` served from the project root (we copy
 *     the local fixture into Vite's `publicDir`). Offline-friendly.
 *   - Direct cdragon: fallback that fetches the live URL when neither is
 *     available.
 *   - Tests: an injected provider supplies raw JSON.
 *
 * The fetcher always returns *raw* JSON; normalization happens in `normalize.ts`.
 */
import { normalizeTftJson } from "./normalize";
import type { SetData } from "./types";

export const TFT_JSON_URL =
  "https://raw.communitydragon.org/latest/cdragon/tft/en_us/tft.json";

/** Pluggable raw-JSON provider. Default = local /tft.json then cdragon. */
export interface RawJsonProvider {
  loadOrFetch(set?: number): Promise<unknown>;
}

/**
 * Browser default: try `/tft.json` (local fixture under Vite's publicDir) first,
 * then fall back to live cdragon. Local hit means dev/offline runs are instant.
 */
export const fetchProvider: RawJsonProvider = {
  async loadOrFetch(): Promise<unknown> {
    try {
      const res = await fetch("/tft.json");
      if (res.ok) return await res.json();
    } catch {
      // local miss -> fall through
    }
    const res = await fetch(TFT_JSON_URL);
    if (!res.ok) throw new Error(`tft.json fetch failed: ${res.status}`);
    return res.json();
  },
};

let provider: RawJsonProvider = fetchProvider;

/** Override the provider (e.g. wire to the Tauri command at app startup). */
export function setRawJsonProvider(p: RawJsonProvider): void {
  provider = p;
}

export interface LoadResult {
  data: SetData;
  fromCache: boolean;
}

/** Fetch (via provider) + normalize. Caller caches the normalized SetData. */
export async function loadSetData(set?: number): Promise<LoadResult> {
  const raw = await provider.loadOrFetch(set);
  return {
    data: normalizeTftJson(raw, set ? { setNumber: set } : undefined),
    fromCache: false,
  };
}

/**
 * Tauri provider — used when running inside the desktop shell. Lazily imports
 * the Tauri API so this module stays importable in pure-Node tests / web builds.
 */
export function installTauriProvider(): void {
  provider = {
    async loadOrFetch(set?: number): Promise<unknown> {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ raw: unknown; fromCache: boolean }>(
        "load_or_fetch_tft",
        { set: set ?? null },
      );
      return result.raw;
    },
  };
}

/** Returns true when we're running inside a Tauri webview. */
export function isTauri(): boolean {
  // Tauri v2 exposes this global on the window when the runtime is present.
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
