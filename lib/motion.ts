import { AiUnavailableError } from "@/lib/ai/gemini";
import { generateClip, type ClipKey } from "@/lib/ai/video";
import { reactionsFor, type ReactionKey } from "@/lib/ar";
import { saveAsset } from "@/lib/media";
import { getAnimal, publishAnimal, updateAnimal } from "@/lib/repo";
import { nowIso } from "@/lib/time";
import type { MotionDoc } from "@/lib/types";

const STUCK_MS = 5 * 60 * 1000;
export const IDLE_SECONDS = 5;
export const REACTION_SECONDS = 4;

/** 依個性挑兩段反應影片，不足時補上歪頭和點頭。 */
export function reactionClips(traits: string[]): ReactionKey[] {
  const keys: ReactionKey[] = reactionsFor(traits).filter((k) => k !== "tilt");
  for (const extra of ["tilt", "nod"] as ReactionKey[]) if (keys.length < 2 && !keys.includes(extra)) keys.push(extra);
  return keys.slice(0, 2);
}

/** 產生一隻動物的 3 段動態影片（平常的樣子＋2 段反應）。完成後要協會確認才會公開。 */
export async function generateMotion(sid: string, animalId: string, greenFrameJpeg: Buffer) {
  const a = await getAnimal(sid, animalId);
  if (!a) throw new Error("找不到這隻動物");
  if (a.motion?.status === "生成中" && Date.now() - new Date(a.motion.at).getTime() < STUCK_MS) throw new Error("影片正在生成中，請稍候");

  const reactions = reactionClips(a.traits);
  const pending: MotionDoc = { status: "生成中", at: nowIso(), approved: false, reactions: {} };
  await updateAnimal(sid, animalId, { motion: pending });

  const jobs: [ClipKey, number][] = [["idle", IDLE_SECONDS], ...reactions.map((k): [ClipKey, number] => [k, REACTION_SECONDS])];
  const results = await Promise.allSettled(jobs.map(([clip, sec]) => generateClip(sid, greenFrameJpeg, a.kind, clip, sec)));

  const idle = results[0];
  if (idle.status === "rejected") {
    const reason = idle.reason instanceof AiUnavailableError ? idle.reason.message : `影片生成失敗：${(idle.reason as Error).message}`;
    const failed: MotionDoc = { status: "失敗", at: nowIso(), approved: false, reactions: {}, error: reason.slice(0, 200) };
    await updateAnimal(sid, animalId, { motion: failed });
    return failed;
  }
  const done: MotionDoc = { status: "完成", at: nowIso(), approved: false, idle: await saveAsset(sid, idle.value, "mp4"), reactions: {} };
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") done.reactions[jobs[i][0]] = await saveAsset(sid, r.value, "mp4");
  }
  await updateAnimal(sid, animalId, { motion: done });
  // 舊的已公開影片在協會確認新影片前先撤下，避免公開頁和後台不一致。
  if (a.published) await publishAnimal(sid, animalId, { keepPublishedAt: true });
  return done;
}

export async function setMotionApproved(sid: string, animalId: string, approved: boolean) {
  const a = await getAnimal(sid, animalId);
  if (!a?.motion || a.motion.status !== "完成") throw new Error("還沒有可以公開的影片");
  await updateAnimal(sid, animalId, { motion: { ...a.motion, approved } });
  if (a.published) await publishAnimal(sid, animalId, { keepPublishedAt: true });
}

export async function saveCutout(sid: string, animalId: string, png: Buffer) {
  const a = await getAnimal(sid, animalId);
  if (!a) throw new Error("找不到這隻動物");
  const url = await saveAsset(sid, png, "png");
  await updateAnimal(sid, animalId, { cutout: url });
  if (a.published) await publishAnimal(sid, animalId, { keepPublishedAt: true });
  return url;
}
