import type { TargetDummy } from "../data";

interface Props {
  target: TargetDummy;
  incomingDps: number;
  onTarget: (t: Partial<TargetDummy>) => void;
  onIncomingDps: (v: number) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider-field">
      <div className="slider-label">
        <span>{label}</span>
        <span className="slider-value">
          {format ? format(value) : value.toFixed(0)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function TargetConfig({
  target,
  incomingDps,
  onTarget,
  onIncomingDps,
}: Props) {
  return (
    <div>
      <div className="target-grid">
        <Slider
          label="护甲"
          value={target.armor}
          min={0}
          max={300}
          onChange={(v) => onTarget({ armor: v })}
        />
        <Slider
          label="魔抗"
          value={target.magicResist}
          min={0}
          max={300}
          onChange={(v) => onTarget({ magicResist: v })}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Slider
          label="目标 HP"
          value={target.health}
          min={500}
          max={20000}
          step={100}
          onChange={(v) => onTarget({ health: v })}
          format={(v) => v.toFixed(0)}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Slider
          label="承受 DPS（用于回蓝计算）"
          value={incomingDps}
          min={0}
          max={500}
          step={10}
          onChange={onIncomingDps}
        />
      </div>
    </div>
  );
}
