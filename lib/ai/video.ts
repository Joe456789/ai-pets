import { ai, assertQuota, recordUsage } from "@/lib/ai/gemini";
import type { ReactionKey } from "@/lib/ar";

// AI 動態影片：把去背後的動物放在純綠背景上，請 Gemini Omni Flash 生成短片，播放時再去掉綠色。
// 開頭和結尾用同一張圖，影片可以無縫循環，也能從反應影片接回平常的樣子。

export const VIDEO_MODEL = () => process.env.GEMINI_VIDEO_MODEL ?? "gemini-omni-1.2-flash";
export type ClipKey = "idle" | ReactionKey;

const ACTIONS: Record<ClipKey, { dog: string; cat: string }> = {
  idle: { dog: "breathes calmly, gently wags its tail, blinks, and slightly turns its head toward the camera", cat: "breathes calmly, slowly swishes its tail, blinks, and slightly turns its head toward the camera" },
  approach: { dog: "happily wags its tail and leans forward toward the camera as if wanting to be petted, then leans back", cat: "slowly blinks, leans forward toward the camera as if wanting to be petted, then leans back" },
  hop: { dog: "bounces playfully in place with excitement while wagging its tail", cat: "crouches playfully and does a small excited hop in place" },
  shy: { dog: "lowers its head and ears shyly and glances away, then slowly looks back toward the camera", cat: "flattens its ears a little and glances away shyly, then slowly looks back toward the camera" },
  nod: { dog: "calmly blinks slowly and gives a gentle, relaxed nod", cat: "calmly does a slow blink and gives a gentle, relaxed nod" },
  tilt: { dog: "tilts its head to one side curiously, then back", cat: "tilts its head to one side curiously, then back" },
};

export function clipPrompt(kind: string, clip: ClipKey) {
  const cat = kind === "貓";
  const animal = cat ? "cat" : kind === "狗" ? "dog" : "animal";
  return [
    `Realistic footage of this exact ${animal} standing in place on a flat, uniform, pure bright green screen background (#00FF00).`,
    `The ${animal} ${ACTIONS[clip][cat ? "cat" : "dog"]}, then returns to the exact starting pose.`,
    `The camera is completely static. The ${animal} stays in the same spot and does not walk away.`,
    "Keep the background a flat pure green with no floor, no shadow, no texture and no other objects.",
    `Keep the ${animal}'s appearance, fur colors and size identical to the image. No sound, no music.`,
  ].join(" ");
}

/** 生成一段循環短片，回傳 MP4。每段計一次 AI 呼叫，並記錄影片 token 供估算費用。 */
export async function generateClip(scope: string, greenFrameJpeg: Buffer, kind: string, clip: ClipKey, seconds: number) {
  await assertQuota(scope);
  const frame = greenFrameJpeg.toString("base64");
  const interaction = (await ai().interactions.create({
    model: VIDEO_MODEL(),
    input: [
      { type: "image", data: frame, mime_type: "image/jpeg" },
      { type: "image", data: frame, mime_type: "image/jpeg" },
      { type: "text", text: clipPrompt(kind, clip) },
    ],
    response_format: { type: "video", resolution: "720p", aspect_ratio: "16:9", duration: `${seconds}s` },
  } as never)) as { output_video?: { data?: string }; usage?: { total_output_tokens?: number; total_input_tokens?: number } };
  const data = interaction.output_video?.data;
  await recordUsage(scope, {
    calls: 1,
    videoClips: data ? 1 : 0,
    videoTokens: interaction.usage?.total_output_tokens ?? 0,
    inputTokens: interaction.usage?.total_input_tokens ?? 0,
  });
  if (!data) throw new Error("AI 沒有產生影片，可能是內容被安全規則擋下，請換一張照片再試");
  return Buffer.from(data, "base64");
}
