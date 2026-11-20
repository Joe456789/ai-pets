
// 用向量插畫代替真實照片，避免使用未授權的動物影像。
export function PetArt({ pet, size }: { pet: { kind: string; color: string; bg: string; name: string }; size?: number }) {
  const dark = isDark(pet.color);
  const line = dark ? "#f6f1e7" : "#2b2622";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${pet.name}的示意插畫`} style={{ display: "block", width: size ?? "100%", height: size ?? "auto" }}>
      <rect width="120" height="120" fill={pet.bg} />
      <circle cx="60" cy="128" r="46" fill={pet.color} />
      {pet.kind === "貓" ? (
        <>
          <path d="M31 52 L33 18 L58 36 Z" fill={pet.color} />
          <path d="M89 52 L87 18 L62 36 Z" fill={pet.color} />
        </>
      ) : (
        <>
          <ellipse cx="29" cy="52" rx="11" ry="24" fill={shade(pet.color)} transform="rotate(14 29 52)" />
          <ellipse cx="91" cy="52" rx="11" ry="24" fill={shade(pet.color)} transform="rotate(-14 91 52)" />
        </>
      )}
      <ellipse cx="60" cy="60" rx="32" ry="29" fill={pet.color} />
      <circle cx="48" cy="55" r="3.6" fill={line} />
      <circle cx="72" cy="55" r="3.6" fill={line} />
      {pet.kind === "貓" ? (
        <>
          <path d="M57 64 L63 64 L60 68 Z" fill={line} />
          <path d="M60 68 Q55 74 50 70 M60 68 Q65 74 70 70" stroke={line} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M38 64 L24 61 M38 69 L24 71 M82 64 L96 61 M82 69 L96 71" stroke={line} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="60" cy="70" rx="13" ry="10" fill={dark ? "#4a4541" : "#fff8ec"} />
          <ellipse cx="60" cy="66" rx="4.6" ry="3.4" fill={dark ? "#f6f1e7" : "#2b2622"} />
          <path d="M60 70 Q60 76 54 76 M60 70 Q60 76 66 76" stroke={dark ? "#f6f1e7" : "#2b2622"} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function isDark(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}
function shade(hex: string) {
  const [r, g, b] = rgb(hex);
  const f = isDark(hex) ? 1.35 : 0.8;
  const c = (v: number) => Math.min(255, Math.round(v * f));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
