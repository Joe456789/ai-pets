import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { monthKey } from "@/lib/time";

export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class AiUnavailableError extends Error {}

export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const MODEL = () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
// 全平台每月上限，以及每位飼主每月上限（公開評估頁共用 "public"），避免費用失控。
const MONTHLY_CALL_CAP = () => Number(process.env.AI_MONTHLY_CALL_CAP ?? 3000);
const OWNER_CALL_CAP = () => Number(process.env.AI_OWNER_MONTHLY_CAP ?? 80);
const PUBLIC_CALL_CAP = () => Number(process.env.AI_PUBLIC_MONTHLY_CAP ?? 500);

let client: GoogleGenAI | null = null;
export function ai() {
  if (!process.env.GEMINI_API_KEY) throw new AiUnavailableError("尚未設定 GEMINI_API_KEY");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 45_000 } });
  return client;
}

const usagePath = (scope: string) => `usage/${scope}__${monthKey()}`;
export const defaultMonthlyCap = () => MONTHLY_CALL_CAP();

/** 依 token 數估算台幣費用。價格和匯率可用環境變數調整，預設是 gemini-3.5-flash-lite 與 Omni Flash 影片的牌價。 */
export function estimateCostTwd(inputTokens = 0, outputTokens = 0, videoTokens = 0) {
  const usdIn = Number(process.env.GEMINI_PRICE_IN ?? 0.3);
  const usdOut = Number(process.env.GEMINI_PRICE_OUT ?? 2.5);
  const usdVideo = Number(process.env.GEMINI_VIDEO_PRICE ?? 12);
  const rate = Number(process.env.USD_TWD ?? 32);
  return ((inputTokens / 1e6) * usdIn + (outputTokens / 1e6) * usdOut + (videoTokens / 1e6) * usdVideo) * rate;
}

export type Usage = { calls?: number; inputTokens?: number; outputTokens?: number; videoTokens?: number; videoClips?: number };
export async function getUsage(scope: string) {
  return (await getDb().get<Usage>(usagePath(scope))) ?? {};
}
export async function recordUsage(scope: string, fields: Record<string, number>) {
  await Promise.all([getDb().increment(usagePath(scope), fields), getDb().increment(usagePath("all"), fields)]);
}

/** 檢查本月次數是否用完：全平台和這位飼主各有上限。 */
export async function assertQuota(scope: string, needed = 1) {
  const [usage, all] = await Promise.all([getUsage(scope), getUsage("all")]);
  if ((all.calls ?? 0) + needed > MONTHLY_CALL_CAP()) throw new AiUnavailableError("本月 AI 使用量已達上限，請下個月再試");
  const cap = scope === "public" ? PUBLIC_CALL_CAP() : OWNER_CALL_CAP();
  if ((usage.calls ?? 0) + needed > cap) throw new AiUnavailableError("你這個月的 AI 使用次數已經用完，下個月會恢復");
}

// Gemini 的 JSON Schema 只支援部分語法，去掉它不需要的欄位。
function toGeminiSchema(schema: z.ZodType) {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "$schema" && k !== "additionalProperties").map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  return strip(z.toJSONSchema(schema));
}

/** 呼叫 Gemini 取得結構化 JSON。scope 是飼主 ID（或公開頁的 "public"），用來分開記錄用量和上限。 */
export async function generateJson<T>(opts: { scope: string; system: string; parts: AiPart[]; schema: z.ZodType<T>; temperature?: number }): Promise<T> {
  await assertQuota(opts.scope);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: MODEL(),
        contents: [{ role: "user", parts: opts.parts }],
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(opts.schema),
        },
      });
      await recordUsage(opts.scope, {
        calls: 1,
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
      });
      return opts.schema.parse(JSON.parse(res.text ?? ""));
    } catch (e) {
      if (e instanceof AiUnavailableError) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
