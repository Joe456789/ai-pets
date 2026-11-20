// 產生 LINE 圖文選單圖片（2500x1686，LINE 上限 1MB）。
// 用法：node scripts/render-rich-menus.mjs
// 以 Edge 無頭模式把 HTML 截圖成 PNG，文字用 Noto Sans TC（SIL OFL 授權）。
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

const menus = {
  staff: {
    bg: MOSS_DEEP,
    tiles: [
      { icon: "camera", label: "新增動物", sub: "拍照＋講一段話", fill: BUTTER, text: INK, subColor: "#4d3a0d" },
      { icon: "voice", label: "回報照護", sub: "只講有狀況的", fill: CLAY, text: PAPER, subColor: "#fff1e8" },
      { icon: "search", label: "查詢動物", sub: "輸入名字或編號", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "clipboard", label: "今日摘要", sub: "待辦和提醒", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "badge", label: "我的資料", sub: "工作號和區域", fill: PAPER, text: INK, subColor: "#55605a" },
      { icon: "book", label: "使用說明", sub: "第一次用看這裡", fill: PAPER, text: INK, subColor: "#55605a" },
    ],
  },
  adopter: {
    bg: CLAY,
    tiles: [
      { icon: "pets", label: "看領養動物", sub: "誰在等一個家", fill: BUTTER, text: INK, subColor: "#4d3a0d" },
      { icon: "faq", label: "常見問題", sub: "費用、流程、時間", fill: PAPER, text: INK, subColor: "#55605a" },
      { icon: "steps", label: "申請進度", sub: "輸入申請編號", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "care", label: "問照顧問題", sub: "AI 先幫你解答", fill: SAGE, text: INK, subColor: "#37503f" },
      { icon: "contact", label: "聯絡協會", sub: "找真人協助", fill: PEACH, text: INK, subColor: "#6b3b24" },
      { icon: "photo", label: "分享近況", sub: "傳照片給協會", fill: PAPER, text: INK, subColor: "#55605a" },
    ],
  },
};

const html = (m) => `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@500;900&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 2500px; height: 1686px; overflow: hidden; background: ${m.bg}; }
  body { font-family: "Noto Sans TC", sans-serif; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 16px; padding: 16px; }
  .tile { border-radius: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 30px 20px; }
  .tile svg { width: 400px; height: 400px; display: block; overflow: visible; }
  .label { font-weight: 900; font-size: 128px; line-height: 1.1; letter-spacing: 2px; white-space: nowrap; }
  .sub { font-weight: 500; font-size: 68px; line-height: 1.15; white-space: nowrap; }
</style></head><body>
${m.tiles.map((t) => `<div class="tile" style="background:${t.fill}">
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${icons[t.icon]}</svg>
  <div class="label" style="color:${t.text}">${t.label}</div>
  <div class="sub" style="color:${t.subColor}">${t.sub}</div>
</div>`).join("\n")}
</body></html>`;

const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!edge) throw new Error("找不到 Edge 或 Chrome");

const outDir = resolve("public/richmenu");
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "richmenu-"));

for (const [name, menu] of Object.entries(menus)) {
  const htmlPath = join(work, `${name}.html`);
  const rawPng = join(work, `${name}.png`);
  writeFileSync(htmlPath, html(menu));
  execFileSync(edge, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=2500,1686", "--virtual-time-budget=15000", `--user-data-dir=${join(work, "profile")}`,
    `--screenshot=${rawPng}`, pathToFileURL(htmlPath).href,
  ], { stdio: "ignore", timeout: 120000 });
  const out = join(outDir, `${name}.png`);
  await sharp(rawPng).resize(2500, 1686, { fit: "cover", position: "top" }).png({ compressionLevel: 9 }).toFile(out);
  const size = statSync(out).size;
  console.log(name, `${Math.round(size / 1024)} KB`, size > 1024 * 1024 ? "超過 LINE 1MB 上限" : "OK");
}
