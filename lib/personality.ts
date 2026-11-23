import type { Trait } from "@/lib/types";

/** 新增毛孩時可以勾的個性，最多 4 個。 */
export const TRAITS: readonly Trait[] = ["活潑好動", "愛玩", "黏人", "愛撒嬌", "獨立", "膽小", "愛睡覺", "貪吃", "好奇", "安靜"];
export const MAX_TRAITS = 4;

/**
 * 個性 → 3D 裡的動作習慣。每個值 0～1：
 * - energy：多常自己跑、跳，跑多快
 * - affection：多常跑回你身邊、搖尾巴
 * - calm：多常坐下、安靜待著
 * - curious：多常東張西望、歪頭
 */
export type Temper = { energy: number; affection: number; calm: number; curious: number };

const EFFECT: Record<Trait, Partial<Temper>> = {
  活潑好動: { energy: 0.35, calm: -0.2 },
  愛玩: { energy: 0.25, affection: 0.1 },
  黏人: { affection: 0.35 },
  愛撒嬌: { affection: 0.3, calm: 0.05 },
  獨立: { affection: -0.25, calm: 0.1 },
  膽小: { energy: -0.15, curious: -0.1, calm: 0.1 },
  愛睡覺: { energy: -0.25, calm: 0.35 },
  貪吃: { affection: 0.1 },
  好奇: { curious: 0.4, energy: 0.1 },
  安靜: { energy: -0.2, calm: 0.3 },
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function temperOf(traits: Trait[] = []): Temper {
  const t: Temper = { energy: 0.45, affection: 0.45, calm: 0.35, curious: 0.35 };
  for (const tr of traits) for (const [k, v] of Object.entries(EFFECT[tr] ?? {})) t[k as keyof Temper] += v as number;
  return { energy: clamp01(t.energy), affection: clamp01(t.affection), calm: clamp01(t.calm), curious: clamp01(t.curious) };
}

/** 表單送來的個性：只留認得的、不重複、最多 4 個。 */
export function cleanTraits(input: unknown[]): Trait[] {
  const out: Trait[] = [];
  for (const v of input) if (TRAITS.includes(v as Trait) && !out.includes(v as Trait) && out.length < MAX_TRAITS) out.push(v as Trait);
  return out;
}
