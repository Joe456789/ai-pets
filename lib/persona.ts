import { findBannedClaim } from "@/lib/ai/guard";
import { writePersona } from "@/lib/ai/tasks";
import { fallbackPersona, PERSONA_QUESTIONS, type Persona } from "@/lib/ar";
import { getDb } from "@/lib/db";
import { getPublicAnimal } from "@/lib/repo";

/**
 * 取得動物的第一人稱自我介紹。每次發布只呼叫一次 AI，結果存起來給所有訪客共用；
 * AI 無法使用或內容沒通過健康宣稱檢查時，改用協會資料組成的固定文字（不存，下次再試）。
 */
export async function getPersona(pid: string): Promise<Persona | null> {
  const a = await getPublicAnimal(pid);
  if (!a) return null;
  const path = `personas/${pid}`;
  const cached = await getDb().get<{ version: string; persona: Persona }>(path);
  if (cached?.version === a.publishedAt) return cached.persona;

  try {
    const r = await writePersona(a.sid, a);
    const answers = [r.likes, r.home, r.firstMeet];
    if (findBannedClaim([r.intro, ...answers].join("\n"))) return fallbackPersona(a);
    const persona: Persona = { intro: r.intro, qa: PERSONA_QUESTIONS.map((q, i) => ({ q, a: answers[i] })), ai: true };
    await getDb().set(path, { version: a.publishedAt, persona });
    return persona;
  } catch {
    return fallbackPersona(a);
  }
}
