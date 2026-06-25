/** Target mitigation helpers. Pure. */
import type { DamageType, TargetDummy } from "../data/types";
import type { Tuning } from "./tuning";
import { DEFAULT_TUNING } from "./tuning";

/**
 * Damage multiplier applied to a hit of `type` against `target`.
 * physical -> armor, magic -> magicResist, true -> 1.0.
 * Formula: K / (K + resist). Negative resist amplifies (>1).
 * Flat reduction (e.g. Last Whisper shred) is applied to effective resist first.
 */
export function damageMultiplier(
  type: DamageType,
  target: TargetDummy,
  tuning: Tuning = DEFAULT_TUNING,
): number {
  switch (type) {
    case "true":
      return 1;
    case "physical": {
      const resist = target.armor - (target.flatReductionPhysical ?? 0);
      return tuning.armorK / (tuning.armorK + resist);
    }
    case "magic": {
      const resist = target.magicResist - (target.flatReductionMagic ?? 0);
      return tuning.armorK / (tuning.armorK + resist);
    }
  }
}
