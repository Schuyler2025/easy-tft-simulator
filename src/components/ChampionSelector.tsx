/**
 * Champion picker — searchable dropdown. Filters by name (zh) + apiName +
 * traits. Shows cost dot for quick visual scanning.
 *
 * Dropdown uses position:fixed because the sidebar panel has overflow:auto,
 * which would clip an absolutely-positioned panel back into the 380px column.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Champion, SetData } from "../data";

interface Props {
  setData: SetData;
  selected: Champion | null;
  onSelect: (champ: Champion) => void;
}

/**
 * Filter heuristics — Set 17 has 83 champions; we want playable carries (cost
 * 1-5 with non-empty traits) and skip placeholder/dummy units (cost 0, no
 * traits, e.g. TFT_BlueGolem / 峡谷迅捷蟹).
 */
function playableChampions(setData: SetData): Champion[] {
  return setData.champions
    .filter((c) => c.cost > 0 && c.traits.length > 0)
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "zh"));
}

export function ChampionSelector({ setData, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const champs = useMemo(() => playableChampions(setData), [setData]);

  const filtered = useMemo(() => {
    if (!query.trim()) return champs;
    const q = query.toLowerCase();
    return champs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.apiName.toLowerCase().includes(q) ||
        c.traits.some((t) => t.toLowerCase().includes(q)),
    );
  }, [champs, query]);

  // Measure input position on open + while scrolling/resizing so the fixed
  // dropdown tracks it. Cheap — getBoundingClientRect on one element.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click. Input's onBlur isn't enough because mousedown on
  // the (now fixed) dropdown is outside the input's React tree subtree only
  // if the dropdown is rendered through a portal — we keep it in-tree so blur
  // works, but a global escape listener handles the rest.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="champ-dropdown">
      <input
        ref={inputRef}
        type="text"
        placeholder={selected ? selected.name : "搜索英雄..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && anchor && (
        <div
          className="champ-dropdown-list"
          style={{
            top: anchor.top,
            left: anchor.left,
            // anchor.width is the input width; dropdown is wider via CSS min().
          }}
        >
          {filtered.map((c) => (
            <div
              key={c.apiName}
              className="champ-dropdown-item"
              title={`${c.name} · ${c.cost}费 · ${c.traits.join("/")}`}
              onMouseDown={(e) => {
                // mousedown fires before input blur => prevents losing selection
                e.preventDefault();
                onSelect(c);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className={`cost-dot cost-${c.cost}`} />
              <span className="champ-name">{c.name}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="selected-champion" style={{ marginTop: 10 }}>
          <span className={`cost-dot cost-${selected.cost}`} />
          <div>
            <div className="name">{selected.name}</div>
            <div className="role muted">
              {selected.cost}费 · 攻击距离 {selected.baseStats.star1.range}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
