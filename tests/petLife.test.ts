import { beforeEach, describe, expect, it } from "vitest";
import { resetFileDb } from "@/lib/db/file";
import { jumpCurve } from "@/lib/petAnim";
import { cleanTraits, temperOf, TRAITS } from "@/lib/personality";
import { dutyOf, legOffset } from "@/lib/petSkeleton";
import * as repo from "@/lib/repo";
import { taipeiDate } from "@/lib/time";

const frac = (x: number) => x - Math.floor(x);

describe("個性", () => {
  it("沒勾個性也有一組中間值，每個值都在 0～1", () => {
    for (const t of [temperOf(), ...TRAITS.map((x) => temperOf([x])), temperOf([...TRAITS])]) {
      for (const v of Object.values(t)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });

  it("活潑的比愛睡覺的常跑跳，愛睡覺的比較常坐著，黏人的比較常回到你身邊", () => {
    expect(temperOf(["活潑好動"]).energy).toBeGreaterThan(temperOf(["愛睡覺"]).energy);
    expect(temperOf(["愛睡覺"]).calm).toBeGreaterThan(temperOf(["活潑好動"]).calm);
    expect(temperOf(["黏人"]).affection).toBeGreaterThan(temperOf(["獨立"]).affection);
  });

  it("表單送來的個性只留認得的、不重複、最多 4 個", () => {
    expect(cleanTraits(["黏人", "黏人", "會飛", "愛玩", "好奇", "貪吃", "安靜"])).toEqual(["黏人", "愛玩", "好奇", "貪吃"]);
  });
});

describe("跑和跳", () => {
  it("奔跑時後腳兩隻接近一起、前腳兩隻接近一起，前後差半圈", () => {
    const [fl, fr, bl, br] = [0, 1, 2, 3].map((k) => frac(legOffset(k, 1, 1)));
    expect(Math.abs(fl - fr)).toBeLessThan(0.15);
    expect(Math.abs(bl - br)).toBeLessThan(0.15);
    expect(Math.abs(frac(fl - bl) - 0.5)).toBeLessThan(0.15);
  });

  it("跑越快，腳踩在地上的時間比例越短", () => {
    expect(dutyOf(0, 0)).toBeGreaterThan(dutyOf(1, 0));
    expect(dutyOf(1, 0)).toBeGreaterThan(dutyOf(1, 1));
    expect(dutyOf(1, 1)).toBeGreaterThan(0.2);
  });

  it("往前跳：從地上開始、先蹲、跳到空中收腳、最後回到地上", () => {
    const at = (t: number) => jumpCurve(t);
    expect(at(0).lift).toBe(0);
    expect(at(0.2).crouch).toBeGreaterThan(0.05);
    expect(at(0.2).fwd).toBe(0); // 蹲的時候不往前
    const top = Math.max(...Array.from({ length: 50 }, (_, i) => at(0.4 + i * 0.01).lift));
    expect(top).toBeGreaterThan(0.25);
    expect(at(0.58).tuck).toBeGreaterThan(0.5);
    expect(at(0.58).fwd).toBeGreaterThan(0);
    expect(at(1.2)).toEqual({ lift: 0, crouch: 0, rock: 0, tuck: 0, fwd: 0 });
  });
});

describe("刪除毛孩", () => {
  beforeEach(() => resetFileDb());

  it("連同紀錄、提醒、生活變動、紀念一起刪掉，回傳要刪的檔案；別的毛孩不受影響", async () => {
    const uid = "U-del";
    const pet = await repo.savePet(uid, { name: "小白", kind: "狗", photo: "/files/s/pet.jpg" });
    const other = await repo.savePet(uid, { name: "小黑", kind: "貓" });
    const future = taipeiDate(new Date(Date.now() + 10 * 864e5));
    const rec = await repo.saveRecord(uid, "小白", { petId: pet.id, photo: "/files/s/rec.jpg", isMedicalDoc: true, visitDate: "", clinic: "", items: [], meds: [], followUp: future, total: 0, terms: [] } as never);
    await repo.saveRecord(uid, "小黑", { petId: other.id, photo: "/files/s/rec2.jpg", isMedicalDoc: true, visitDate: "", clinic: "", items: [], meds: [], followUp: "", total: 0, terms: [] } as never);
    await repo.addCare({ uid, petId: pet.id, petName: "小白", kind: "驅蟲", label: "體內驅蟲", everyMonths: 3, lastDone: taipeiDate() } as never);
    const chg = await repo.saveChange(uid, { petId: pet.id, petName: "小白" } as never);
    await repo.addReminder({ id: `chg-${chg.id}`, uid, petId: pet.id, petName: "小白", date: future, text: "x", sent: false, kind: "生活變動" });
    const mem = await repo.createMemorial({ uid, petId: pet.id, petName: "小白", kind: "狗", heightCm: 50, photos: ["/files/s/m1.jpg"], memories: "" });
    await repo.updateMemorial(mem.id, { glb: "/files/s/m.glb" });

    const files = await repo.deletePet(uid, pet.id);
    expect(files.sort()).toEqual(["/files/s/m.glb", "/files/s/m1.jpg", "/files/s/pet.jpg", "/files/s/rec.jpg"]);
    expect(await repo.getPet(uid, pet.id)).toBeNull();
    expect(await repo.getRecord(uid, rec.id)).toBeNull();
    expect((await repo.listCare(uid)).filter((c) => c.petId === pet.id)).toEqual([]);
    expect(await repo.listChanges(uid)).toEqual([]);
    expect(await repo.getMemorial(mem.id)).toBeNull();
    expect((await repo.dueReminders(taipeiDate(new Date(Date.now() + 9 * 864e5)))).length).toBe(0);
    // 小黑還在
    expect(await repo.getPet(uid, other.id)).not.toBeNull();
    expect((await repo.listRecords(uid, other.id)).length).toBe(1);
  });
});
