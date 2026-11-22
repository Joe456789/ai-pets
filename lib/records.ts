import { findBannedClaim } from "@/lib/ai/guard";
import type { PetDoc, RecordDoc, RecordDraft } from "@/lib/types";

/** 把各種寫法的日期（2026/3/5、115.03.05、2026年3月5日）整理成 2026-03-05；看不懂就回空字串。 */
export function normalizeDate(s: string) {
  const m = /(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/.exec(s.trim());
  if (!m) return "";
  let y = Number(m[1]);
  if (y < 1000) y += 1911; // 民國年
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * AI 讀出來的單據再過一次規則：日期統一格式、金額要合理、名詞解釋有診斷或用藥字眼就拿掉。
 * 單據上原本寫的項目和藥名照原文保留，不做判讀。
 */
export function cleanDraft(d: RecordDraft): RecordDraft {
  const total = typeof d.total === "number" && d.total > 0 && d.total < 1_000_000 ? Math.round(d.total) : null;
  return {
    ...d,
    visitDate: normalizeDate(d.visitDate),
    followUp: normalizeDate(d.followUp),
    clinic: d.clinic.trim().slice(0, 40),
    items: d.items.filter((i) => i.name.trim()).slice(0, 20),
    meds: d.meds.filter((m) => m.name.trim()).slice(0, 12),
    total,
    terms: d.terms.filter((t) => t.term.trim() && t.plain.trim() && !findBannedClaim(t.plain)).slice(0, 8),
  };
}

/** 依年份加總醫療花費（只算有寫金額的單據）。 */
export function spendByYear(records: RecordDoc[]) {
  const out = new Map<string, number>();
  for (const r of records) {
    if (!r.total) continue;
    const y = (r.visitDate || r.createdAt).slice(0, 4);
    out.set(y, (out.get(y) ?? 0) + r.total);
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, amount]) => ({ year, amount }));
}

/** 毛孩幾歲（依 birth 2020-05），不知道回 null。 */
export function ageYears(pet: Pick<PetDoc, "birth">, now = new Date()) {
  if (!pet.birth) return null;
  const [y, m] = pet.birth.split("-").map(Number);
  if (!y) return null;
  return Math.max(0, now.getFullYear() - y - ((now.getMonth() + 1) < (m || 1) ? 1 : 0));
}

/**
 * 建議每月存多少醫療預備金：最近一年的醫療花費 × 1.5（保留突發的空間），
 * 老年（狗 8 歲、貓 10 歲以上）再多 30%，最少每月 500 元。這是規則算出來的建議，不是保險精算。
 */
export function monthlyReserve(pet: Pick<PetDoc, "kind" | "birth">, records: RecordDoc[], now = new Date()) {
  const yearAgo = new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const lastYear = records.filter((r) => (r.visitDate || r.createdAt.slice(0, 10)) >= yearAgo).reduce((s, r) => s + (r.total ?? 0), 0);
  const age = ageYears(pet, now);
  const senior = age !== null && age >= (pet.kind === "貓" ? 10 : 8);
  const base = (lastYear * 1.5) / 12;
  const amount = Math.max(500, Math.round((base * (senior ? 1.3 : 1)) / 100) * 100);
  return { amount, lastYear, senior, age };
}
