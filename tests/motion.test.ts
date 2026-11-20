import { rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const video = vi.hoisted(() => ({ generateClip: vi.fn() }));
vi.mock("@/lib/ai/video", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/video")>()), generateClip: video.generateClip }));

import { clipPrompt } from "@/lib/ai/video";
import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { cardGlb } from "@/lib/glb";
import { parseRange, saveAsset } from "@/lib/media";
import { generateMotion, reactionClips, setMotionApproved } from "@/lib/motion";
import * as repo from "@/lib/repo";
import type { AnimalDoc } from "@/lib/types";

const SID = "motiontest";
const fakeMp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(32)]);
const animal = (over: Partial<AnimalDoc> = {}): AnimalDoc => ({
  id: "a", code: "X-1", name: "阿福", kind: "狗", sex: "公", age: "", ageGroup: "成年", size: "大型", coat: "", foundAt: "", area: "", neutered: "是",
  status: "開放領養", intakeAt: new Date().toISOString(), vaccineDue: "", traits: ["親人", "活潑"], story: "很棒的狗", needs: [], goodFor: [], photos: ["/media/x/y.jpg"],
  tags: { energy: "中", beginnerOk: "是", kidOk: "是", apartmentOk: "否" }, published: true, ...over,
});

beforeEach(async () => {
  resetFileDb();
  video.generateClip.mockReset();
  rmSync(join(process.cwd(), ".data", "media", SID), { recursive: true, force: true });
  await getDb().set(`shelters/${SID}`, { id: SID, name: "測試協會", area: "台北", status: "使用中", plan: "基本", due: "2099/01/01" });
  await getDb().set(`shelters/${SID}/animals/a`, animal());
  await repo.publishAnimal(SID, "a");
});

describe("AI 動態影片", () => {
  it("依個性挑 2 段反應，不足時補歪頭", () => {
    expect(reactionClips(["親人", "活潑"])).toEqual(["approach", "hop"]);
    expect(reactionClips(["慢熟"])).toEqual(["shy", "tilt"]);
    expect(reactionClips([])).toEqual(["tilt", "nod"]);
  });

  it("提示要求綠幕、鏡頭固定、回到起始姿勢，貓狗用不同動作", () => {
    const p = clipPrompt("貓", "idle");
    expect(p).toContain("cat");
    expect(p).toContain("#00FF00");
    expect(p).toContain("returns to the exact starting pose");
    expect(p).toContain("swishes its tail");
    expect(clipPrompt("狗", "idle")).toContain("wags its tail");
  });

  it("產生 3 段影片並存好，但要協會確認後才公開", async () => {
    video.generateClip.mockImplementation(async () => fakeMp4());
    const before = (await repo.getPublicAnimal(`${SID}__a`))!.publishedAt;
    const r = await generateMotion(SID, "a", Buffer.from("jpeg"));
    expect(r.status).toBe("完成");
    expect(video.generateClip).toHaveBeenCalledTimes(3);
    expect(Object.keys(r.reactions)).toEqual(["approach", "hop"]);
    expect(r.idle).toMatch(/^\/media\/motiontest\/.+\.mp4$/);
    expect((await repo.getPublicAnimal(`${SID}__a`))?.motion).toBeUndefined();

    await setMotionApproved(SID, "a", true);
    const pub = (await repo.getPublicAnimal(`${SID}__a`))!;
    expect(pub.motion?.idle).toBe(r.idle);
    expect(pub.publishedAt).toBe(before); // 只更新素材，不改發布時間，自我介紹不用重寫

    await setMotionApproved(SID, "a", false);
    expect((await repo.getPublicAnimal(`${SID}__a`))?.motion).toBeUndefined();
  });

  it("反應影片失敗時仍保留成功的部分；平常的影片失敗就整個標為失敗", async () => {
    video.generateClip.mockImplementation(async (_s: string, _f: Buffer, _k: string, clip: string) => {
      if (clip === "hop") throw new Error("blocked");
      return fakeMp4();
    });
    const ok = await generateMotion(SID, "a", Buffer.from("jpeg"));
    expect(Object.keys(ok.reactions)).toEqual(["approach"]);

    video.generateClip.mockImplementation(async (_s: string, _f: Buffer, _k: string, clip: string) => {
      if (clip === "idle") throw new Error("逾時");
      return fakeMp4();
    });
    const failed = await generateMotion(SID, "a", Buffer.from("jpeg"));
    expect(failed.status).toBe("失敗");
    expect(failed.error).toContain("逾時");
  });

  it("生成中時不能重複按，避免重複花錢", async () => {
    await repo.updateAnimal(SID, "a", { motion: { status: "生成中", at: new Date().toISOString(), approved: false, reactions: {} } });
    await expect(generateMotion(SID, "a", Buffer.from("jpeg"))).rejects.toThrow("生成中");
    expect(video.generateClip).not.toHaveBeenCalled();
  });
});

describe("素材檔案", () => {
  it("只接受真的 PNG 和 MP4", async () => {
    await expect(saveAsset(SID, Buffer.from("not a png"), "png")).rejects.toThrow("格式");
    await expect(saveAsset(SID, Buffer.from("<html>"), "mp4")).rejects.toThrow("格式");
    await expect(saveAsset(SID, fakeMp4(), "mp4")).resolves.toMatch(/\.mp4$/);
  });

  it("Range 標頭解析（iPhone 播影片需要）", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=100-", 100)).toBe("invalid");
    expect(parseRange("items=0-1", 100)).toBe("invalid");
  });
});

describe("真實大小立牌模型", () => {
  it("產生合法的 GLB，高度等於真實高度", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const glb = cardGlb(png, 200, 100, 0.8);
    const dv = new DataView(glb.buffer);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLen = dv.getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));
    expect(gltf.accessors[0].max).toEqual([0.8, 0.8, 0]); // 寬 = 0.8 × 200/100 = 1.6，左右各 0.8
    expect(gltf.accessors[0].max[1]).toBe(0.8);
    expect(gltf.materials[0].alphaMode).toBe("MASK");
    expect(gltf.bufferViews[4].byteLength).toBe(png.byteLength);
    expect(glb.byteLength % 4).toBe(0);
  });
});
