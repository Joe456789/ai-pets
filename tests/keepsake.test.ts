import { beforeEach, describe, expect, it } from "vitest";
import { resetFileDb } from "@/lib/db/file";
import { memorialReadyCard } from "@/lib/line/messages";
import * as repo from "@/lib/repo";

const uid = "U-keep";

describe("趁牠還在先留下 3D", () => {
  beforeEach(() => resetFileDb());

  it("找得到這隻的生前 3D，一般紀念不算", async () => {
    const pet = await repo.savePet(uid, { name: "小白", kind: "狗" });
    await repo.createMemorial({ uid, petId: pet.id, petName: "小白", kind: "狗", heightCm: 50, photos: ["/files/s/a.jpg"], memories: "" });
    expect(await repo.keepsakeOf(uid, pet.id)).toBeNull();
    const k = await repo.createMemorial({ uid, petId: pet.id, petName: "小白", kind: "狗", heightCm: 50, photos: ["/files/s/b.jpg", "/files/s/c.jpg"], memories: "", keepsake: true });
    expect((await repo.keepsakeOf(uid, pet.id))?.id).toBe(k.id);
    expect(await repo.keepsakeOf("U-other", pet.id)).toBeNull();
  });

  it("牠離開後轉成紀念：同一份模型、寫進回憶，不再算生前 3D", async () => {
    const pet = await repo.savePet(uid, { name: "小白", kind: "狗" });
    const k = await repo.createMemorial({ uid, petId: pet.id, petName: "小白", kind: "狗", heightCm: 50, photos: ["/files/s/b.jpg"], memories: "", keepsake: true });
    await repo.updateMemorial(k.id, { status: "完成", glb: "/files/s/m.glb" });
    const m = await repo.keepsakeToMemorial(uid, pet.id, "最愛在門口等我");
    expect(m?.id).toBe(k.id);
    const saved = await repo.getMemorial(k.id);
    expect(saved).toMatchObject({ keepsake: false, memories: "最愛在門口等我", status: "完成", glb: "/files/s/m.glb" });
    expect(await repo.keepsakeOf(uid, pet.id)).toBeNull();
    expect(await repo.keepsakeToMemorial(uid, pet.id, "")).toBeNull();
  });

  it("刪除毛孩時，生前 3D 的照片和模型也一起刪", async () => {
    const pet = await repo.savePet(uid, { name: "小白", kind: "狗" });
    const k = await repo.createMemorial({ uid, petId: pet.id, petName: "小白", kind: "狗", heightCm: 50, photos: ["/files/s/b.jpg"], memories: "", keepsake: true });
    await repo.updateMemorial(k.id, { glb: "/files/s/m.glb" });
    const files = await repo.deletePet(uid, pet.id);
    expect(files).toEqual(expect.arrayContaining(["/files/s/b.jpg", "/files/s/m.glb"]));
    expect(await repo.getMemorial(k.id)).toBeNull();
  });

  it("做好的通知：生前 3D 不用「紀念」這個字", () => {
    const text = JSON.stringify(memorialReadyCard("小白", "x", true));
    expect(text).not.toContain("紀念");
    expect(JSON.stringify(memorialReadyCard("小白", "x"))).toContain("紀念");
  });
});
