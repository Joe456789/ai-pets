// 產生「從此有你」的 LINE 圖文選單圖片（2500x1686，LINE 上限 1MB）。
// 用法：node scripts/render-rich-menus.mjs
import { mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const INK = "#26302b";
const MOSS = "#2f5d50";
const MOSS_DEEP = "#234539";
const CLAY = "#bd5a33";
const BUTTER = "#f2cf7a";
const PAPER = "#fffdf8";
const SAGE = "#dfeae3";
const PEACH = "#f7e3d8";

const s = `stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"`;

const paw = (cx, cy, r, fill) => `
  <g fill="${fill}">
    <ellipse cx="${cx}" cy="${cy + r * 0.35}" rx="${r * 0.62}" ry="${r * 0.5}"/>
    <ellipse cx="${cx - r * 0.72}" cy="${cy - r * 0.12}" rx="${r * 0.22}" ry="${r * 0.3}"/>
    <ellipse cx="${cx - r * 0.27}" cy="${cy - r * 0.55}" rx="${r * 0.23}" ry="${r * 0.32}"/>
    <ellipse cx="${cx + r * 0.27}" cy="${cy - r * 0.55}" rx="${r * 0.23}" ry="${r * 0.32}"/>
    <ellipse cx="${cx + r * 0.72}" cy="${cy - r * 0.12}" rx="${r * 0.22}" ry="${r * 0.3}"/>
  </g>`;

const check = (cx, cy, r, stroke = PAPER) =>
  `<path d="M${cx - r * 0.5} ${cy + r * 0.02} L${cx - r * 0.12} ${cy + r * 0.4} L${cx + r * 0.52} ${cy - r * 0.36}" fill="none" stroke="${stroke}" stroke-width="${r * 0.3}" stroke-linecap="round" stroke-linejoin="round"/>`;

const heart = (cx, cy, r, fill) =>
  `<path d="M${cx} ${cy + r} C${cx - r * 1.5} ${cy} ${cx - r} ${cy - r} ${cx} ${cy - r * 0.32} C${cx + r} ${cy - r} ${cx + r * 1.5} ${cy} ${cx} ${cy + r} Z" fill="${fill}" ${s}/>`;

const dogFace = (cx, cy, k, fur, ear) => `
  <g transform="translate(${cx} ${cy}) scale(${k})">
    <ellipse cx="-40" cy="-6" rx="17" ry="34" fill="${ear}" transform="rotate(14 -40 -6)" ${s}/>
    <ellipse cx="40" cy="-6" rx="17" ry="34" fill="${ear}" transform="rotate(-14 40 -6)" ${s}/>
    <ellipse cx="0" cy="0" rx="42" ry="39" fill="${fur}" ${s}/>
    <ellipse cx="0" cy="15" rx="20" ry="16" fill="${PAPER}"/>
    <circle cx="-16" cy="-8" r="5.5" fill="${INK}"/><circle cx="16" cy="-8" r="5.5" fill="${INK}"/>
    <ellipse cx="0" cy="9" rx="7" ry="5.5" fill="${INK}"/>
    <path d="M0 14 Q0 23 -9 23 M0 14 Q0 23 9 23" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
  </g>`;

const catFace = (cx, cy, k, fur) => `
  <g transform="translate(${cx} ${cy}) scale(${k})">
    <path d="M-38 -6 L-36 -52 L-4 -30 Z" fill="${fur}" ${s}/>
    <path d="M38 -6 L36 -52 L4 -30 Z" fill="${fur}" ${s}/>
    <ellipse cx="0" cy="0" rx="42" ry="37" fill="${fur}" ${s}/>
    <circle cx="-16" cy="-5" r="5.5" fill="${INK}"/><circle cx="16" cy="-5" r="5.5" fill="${INK}"/>
    <path d="M-4 7 L4 7 L0 12 Z" fill="${INK}"/>
    <path d="M0 12 Q-6 20 -12 15 M0 12 Q6 20 12 15" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M-27 6 L-48 2 M-27 14 L-47 17 M27 6 L48 2 M27 14 L47 17" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  </g>`;

const icons = {
  camera: `
    <path d="M68 60 L80 34 H122 L134 60 Z" fill="${PAPER}" ${s}/>
    <rect x="20" y="58" width="162" height="116" rx="24" fill="${PAPER}" ${s}/>
    <circle cx="101" cy="116" r="44" fill="${MOSS}" ${s}/>
    ${paw(101, 116, 28, BUTTER)}
    <circle cx="164" cy="44" r="30" fill="${CLAY}" ${s}/>
    <path d="M164 28 V60 M148 44 H180" stroke="${PAPER}" stroke-width="10" stroke-linecap="round"/>`,
  voice: `
    <path d="M44 22 H156 A30 30 0 0 1 186 52 V112 A30 30 0 0 1 156 142 H84 L46 178 L52 142 H44 A30 30 0 0 1 14 112 V52 A30 30 0 0 1 44 22 Z" fill="${PAPER}" ${s}/>
    <g stroke="${MOSS}" stroke-width="13" stroke-linecap="round">
      <path d="M50 72 V92"/><path d="M78 56 V108"/><path d="M106 42 V122"/><path d="M134 60 V104"/><path d="M160 72 V92"/>
    </g>
    <circle cx="156" cy="152" r="30" fill="${BUTTER}" ${s}/>
    ${check(156, 152, 20, INK)}`,
  search: `
    <path d="M128 128 L178 178" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
    <path d="M128 128 L178 178" stroke="${CLAY}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="86" cy="84" r="62" fill="${PAPER}" ${s}/>
    ${paw(86, 86, 38, MOSS)}`,
  clipboard: `
    <rect x="38" y="34" width="124" height="150" rx="18" fill="${PAPER}" ${s}/>
    <rect x="72" y="18" width="56" height="34" rx="10" fill="${BUTTER}" ${s}/>
    <circle cx="66" cy="86" r="13" fill="${MOSS}"/>${check(66, 86, 10)}
    <path d="M92 86 H140" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="66" cy="122" r="13" fill="${CLAY}"/>
    <path d="M66 114 V124 M66 130 V130.5" stroke="${PAPER}" stroke-width="5" stroke-linecap="round"/>
    <path d="M92 122 H140" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="66" cy="158" r="13" fill="${MOSS}"/>${check(66, 158, 10)}
    <path d="M92 158 H126" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`,
  badge: `
    <path d="M78 14 L100 50 L122 14" fill="none" stroke="${INK}" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>
    <rect x="86" y="42" width="28" height="22" rx="6" fill="${BUTTER}" ${s}/>
    <rect x="18" y="60" width="164" height="118" rx="18" fill="${PAPER}" ${s}/>
    <circle cx="64" cy="112" r="28" fill="${SAGE}" ${s}/>
    <circle cx="64" cy="104" r="11" fill="${MOSS}"/>
    <path d="M44 130 Q64 108 84 130" fill="${MOSS}"/>
    <path d="M108 100 H160 M108 126 H146" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M40 158 H160" stroke="${CLAY}" stroke-width="10" stroke-linecap="round" stroke-dasharray="1 20"/>`,
  book: `
    <path d="M100 48 C84 30 50 28 18 36 V164 C50 156 84 158 100 176 C116 158 150 156 182 164 V36 C150 28 116 30 100 48 Z" fill="${PAPER}" ${s}/>
    <path d="M100 48 V176" ${s}/>
    <path d="M38 66 C52 62 66 62 80 68 M38 94 C52 90 66 90 80 96" stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M124 80 C124 62 158 62 158 82 C158 98 141 96 141 112" stroke="${CLAY}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="141" cy="132" r="7.5" fill="${CLAY}"/>`,
  pets: `${dogFace(66, 84, 1.3, "#c98f45", "#a56f2e")}${catFace(140, 124, 1.2, "#f6f1e7")}`,
  faq: `
    <path d="M36 18 H128 A24 24 0 0 1 152 42 V86 A24 24 0 0 1 128 110 H74 L40 140 L44 110 H36 A24 24 0 0 1 12 86 V42 A24 24 0 0 1 36 18 Z" fill="${PAPER}" ${s}/>
    <path d="M64 50 C64 32 100 32 100 53 C100 70 82 66 82 82" stroke="${CLAY}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="82" cy="99" r="7" fill="${CLAY}"/>
    <path d="M122 92 H164 A22 22 0 0 1 186 114 V146 A22 22 0 0 1 164 168 H158 L162 190 L132 168 H122 A22 22 0 0 1 100 146 V114 A22 22 0 0 1 122 92 Z" fill="${BUTTER}" ${s}/>
    <circle cx="124" cy="130" r="7" fill="${INK}"/><circle cx="143" cy="130" r="7" fill="${INK}"/><circle cx="162" cy="130" r="7" fill="${INK}"/>`,
  steps: `
    <path d="M52 44 V156" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="52" cy="36" r="25" fill="${MOSS}" ${s}/>${check(52, 36, 18)}
    <circle cx="52" cy="100" r="25" fill="${MOSS}" ${s}/>${check(52, 100, 18)}
    <circle cx="52" cy="164" r="25" fill="${PAPER}" ${s}/>
    <circle cx="52" cy="164" r="8" fill="${CLAY}"/>
    <rect x="102" y="24" width="84" height="32" rx="16" fill="${PAPER}" ${s}/>
    <rect x="102" y="84" width="72" height="32" rx="16" fill="${PAPER}" ${s}/>
    <rect x="102" y="144" width="84" height="32" rx="16" fill="${BUTTER}" ${s}/>`,
  care: `
    <path d="M42 22 H158 A28 28 0 0 1 186 50 V116 A28 28 0 0 1 158 144 H92 L52 180 L58 144 H42 A28 28 0 0 1 14 116 V50 A28 28 0 0 1 42 22 Z" fill="${PAPER}" ${s}/>
    ${paw(90, 84, 38, MOSS)}
    ${heart(148, 122, 25, CLAY)}`,
  contact: `
    <path d="M36 186 C36 140 66 124 100 124 C134 124 164 140 164 186 Z" fill="${MOSS}" ${s}/>
    <circle cx="100" cy="74" r="44" fill="#f4d9b8" ${s}/>
    <path d="M46 78 C46 8 154 8 154 78" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
    <rect x="34" y="66" width="22" height="42" rx="11" fill="${CLAY}" ${s}/>
    <rect x="144" y="66" width="22" height="42" rx="11" fill="${CLAY}" ${s}/>
    <path d="M155 106 C155 124 138 128 118 128" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="84" cy="74" r="5.5" fill="${INK}"/><circle cx="116" cy="74" r="5.5" fill="${INK}"/>
    <path d="M86 92 Q100 104 114 92" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  photo: `
    <g transform="rotate(-6 100 100)">
      <rect x="28" y="20" width="136" height="160" rx="12" fill="${PAPER}" ${s}/>
      <rect x="42" y="34" width="108" height="100" rx="6" fill="${SAGE}" ${s}/>
      ${catFace(96, 90, 0.82, "#dd8a3e")}
    </g>
    <circle cx="150" cy="150" r="36" fill="${CLAY}" ${s}/>
    <path d="M150 170 C126 152 134 134 150 146 C166 134 174 152 150 170 Z" fill="${PAPER}"/>`,
};

const ROSE = "#b5523b";
const DUSK = "#3b3a4a";
icons.memorial = `
    <path d="M100 20 C60 20 40 50 40 84 V184 H160 V84 C160 50 140 20 100 20 Z" fill="${PAPER}" ${s}/>
    ${dogFace(100, 96, 0.9, "#c98f45", "#a56f2e")}
    ${heart(100, 158, 16, ROSE)}`;
icons.receipt = `
    <path d="M44 18 H156 V184 L138 170 L120 184 L100 170 L80 184 L62 170 L44 184 Z" fill="${PAPER}" ${s}/>
    <path d="M66 54 H134 M66 82 H134 M66 110 H112" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="150" cy="150" r="34" fill="${MOSS}" ${s}/>
    <circle cx="150" cy="150" r="14" fill="${PAPER}"/>`;

icons.calendar = `
    <rect x="20" y="34" width="160" height="148" rx="22" fill="${PAPER}" ${s}/>
    <path d="M20 78 H180" ${s}/>
    <rect x="20" y="34" width="160" height="44" rx="22" fill="${MOSS}" ${s}/>
    <path d="M62 18 V50 M138 18 V50" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
    <g fill="${INK}" opacity=".25">
      <rect x="44" y="96" width="24" height="20" rx="5"/><rect x="88" y="96" width="24" height="20" rx="5"/><rect x="132" y="96" width="24" height="20" rx="5"/>
      <rect x="44" y="132" width="24" height="20" rx="5"/>
    </g>
    <circle cx="138" cy="142" r="30" fill="${CLAY}" ${s}/>
    ${check(138, 142, 20)}`;

const menus = {
  owner: {
    bg: ROSE,
    tiles: [
      { icon: "clipboard", label: "飼養前評估", sub: "養之前先想清楚", fill: BUTTER, text: INK, subColor: "#4d3a0d" },
      { icon: "pets", label: "我的毛孩", sub: "資料和紀錄", fill: PAPER, text: INK, subColor: "#55605a" },
      { icon: "receipt", label: "拍醫療單據", sub: "AI 幫你整理", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "calendar", label: "照顧日曆", sub: "驅蟲疫苗前一天提醒", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "book", label: "飼主小學堂", sub: "每月一課加小測驗", fill: BUTTER, text: INK, subColor: "#4d3a0d" },
      { icon: "memorial", label: "紀念與告別", sub: "3D 留下牠的樣子", fill: DUSK, text: PAPER, subColor: "#e8e2ea" },
    ],
  },
};

// 直接組成一張 SVG，用 sharp 轉成 PNG（不需要瀏覽器）。字型用系統的正黑體，沒有的話退回 Noto Sans TC。
const FONT = "Microsoft JhengHei, Noto Sans TC, PingFang TC, sans-serif";
const W = 2500, H = 1686, GAP = 16;
const tw = (W - GAP * 4) / 3, th = (H - GAP * 3) / 2;
const svg = (m) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${m.bg}"/>
${m.tiles.map((t, i) => {
  const x = GAP + (i % 3) * (tw + GAP), y = GAP + Math.floor(i / 3) * (th + GAP), cx = x + tw / 2;
  return `<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="44" fill="${t.fill}"/>
  <svg x="${cx - 190}" y="${y + 50}" width="380" height="380" viewBox="0 0 200 200" overflow="visible">${icons[t.icon]}</svg>
  <text x="${cx}" y="${y + 590}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="120" fill="${t.text}">${t.label}</text>
  <text x="${cx}" y="${y + 700}" text-anchor="middle" font-family="${FONT}" font-size="66" fill="${t.subColor}">${t.sub}</text>`;
}).join("")}
</svg>`;

const outDir = resolve("public/richmenu");
mkdirSync(outDir, { recursive: true });
for (const [name, menu] of Object.entries(menus)) {
  const out = join(outDir, `${name}.png`);
  await sharp(Buffer.from(svg(menu))).png({ compressionLevel: 9, palette: true }).toFile(out);
  const size = statSync(out).size;
  console.log(name, `${Math.round(size / 1024)} KB`, size > 1024 * 1024 ? "超過 LINE 1MB 上限" : "OK");
}
