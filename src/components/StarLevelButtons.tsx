import type { StarLevel } from "../data";

interface Props {
  star: StarLevel;
  onChange: (s: StarLevel) => void;
}

export function StarLevelButtons({ star, onChange }: Props) {
  return (
    <div className="star-buttons">
      {([1, 2, 3] as StarLevel[]).map((s) => (
        <button
          key={s}
          className={star === s ? "active" : ""}
          onClick={() => onChange(s)}
        >
          {"★".repeat(s)}
        </button>
      ))}
    </div>
  );
}
