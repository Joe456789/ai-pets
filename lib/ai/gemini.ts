import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { aiCapOf, trialExpired } from "@/lib/plans";
import { monthKey } from "@/lib/time";
import type { ShelterDoc } from "@/lib/types";

export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class AiUnavailableError extends Error {}

export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const MODEL = () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const MONTHLY_CALL_CAP = () => Number(process.env.AI_MONTHLY_CALL_CAP ?? 3000);

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
export const recordUsage = (scope: string, fields: Record<string, number>) => getDb().increment(usagePath(scope), fields);

/** 檢查試用是否到期、本月次數是否用完。 */
export async function assertQuota(scope: string, needed = 1) {
  const [usage, shelter] = await Promise.all([getUsage(scope), getDb().get<ShelterDoc>(`shelters/${scope}`)]);
  if (shelter && trialExpired(shelter)) throw new AiUnavailableError("試用期已結束，AI 功能暫停，請聯絡平台管理者");
  const cap = shelter ? aiCapOf(shelter) : MONTHLY_CALL_CAP();
  if ((usage.calls ?? 0) + needed > cap) throw new AiUnavailableError("本月 AI 使用量已達方案上限");
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

/** 呼叫 Gemini 取得結構化 JSON。scope 用來分開記錄各協會的用量和上限。 */
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
