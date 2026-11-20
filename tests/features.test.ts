import { beforeEach, describe, expect, it } from "vitest";
import { refreshDemoDates, seedDemo } from "@/demo/seed";
import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { filterOpenAnimals, mapOpenAnimal, type OpenAnimal } from "@/lib/opendata";
import { getAnimal } from "@/lib/repo";
import { createPledge, createSupply, getSupply, publicSupplies, setPledgeStatus } from "@/lib/supplies";
import { daysUntil } from "@/lib/time";

beforeEach(() => resetFileDb());

describe("物資需求", () => {
  it("收到捐贈會累加數量，夠了自動改成已足夠；取消已收到的會扣回來", async () => {
    const s = await createSupply("t", { name: "乾糧", unit: "包", need: 5, note: "", urgent: true });
    const p1 = await createPledge("t", { supplyId: s.id, supplyName: s.name, unit: s.unit, qty: 3, who: "甲", contact: "x", note: "" });
    const p2 = await createPledge("t", { supplyId: s.id, supplyName: s.name, unit: s.unit, qty: 2, who: "乙", contact: "y", note: "" });
    expect((await publicSupplies("t"))[0].pledged).toBe(5);

    await setPledgeStatus("t", p1.id, "已收到");
    expect((await getSupply("t", s.id))?.got).toBe(3);
    await setPledgeStatus("t", p1.id, "已收到"); // 重複按不會重複累加
    expect((await getSupply("t", s.id))?.got).toBe(3);

    await setPledgeStatus("t", p2.id, "已收到");
    expect(await getSupply("t", s.id)).toMatchObject({ got: 5, status: "已足夠" });
    expect(await publicSupplies("t")).toHaveLength(0);

    await setPledgeStatus("t", p2.id, "取消");
    expect(await getSupply("t", s.id)).toMatchObject({ got: 3, status: "需要" });
  });
});

describe("公立收容所開放資料", () => {
  const raw = {
    animal_id: 474127, animal_kind: "狗", animal_Variety: "混種犬   ", animal_sex: "F", animal_bodytype: "BIG", animal_age: "ADULT",
    animal_colour: "黑色", animal_sterilization: "T", animal_status: "OPEN", animal_remark: "可預約參觀", shelter_name: "臺北市動物之家",
    shelter_tel: "02-1234", shelter_address: "臺北市內湖區", album_file: "https://www.pet.gov.tw/upload/pic/1.png", animal_opendate: "2026-11-01", animal_update: "2026-11-09",
  };

  it("把開放資料的代碼轉成中文，縣市從收容所名稱取出", () => {
    expect(mapOpenAnimal(raw)).toMatchObject({ id: "474127", kind: "狗", variety: "混種犬", sex: "母", size: "大型", age: "成年", sterilized: "已絕育", county: "臺北市" });
  });

  it("不是開放中、或照片不是政府網址的資料會被排除或清掉", () => {
    expect(mapOpenAnimal({ ...raw, animal_status: "ADOPTED" })).toBeNull();
    expect(mapOpenAnimal({ ...raw, album_file: "http://example.com/x.png" })?.photo).toBe("");
  });

  it("依縣市和種類篩選，有照片的排前面並分頁", () => {
    const base = mapOpenAnimal(raw) as OpenAnimal;
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...base, id: String(i), photo: i % 2 ? base.photo : "", kind: i < 25 ? "狗" : "貓" } as OpenAnimal));
    const r = filterOpenAnimals(rows, { county: "臺北市", kind: "狗" });
    expect(r.total).toBe(25);
    expect(r.items).toHaveLength(24);
    expect(r.items[0].photo).not.toBe("");
    expect(filterOpenAnimals(rows, { kind: "狗", page: 2 }).items).toHaveLength(1);
  });
});

describe("示範資料日期更新", () => {
  it("疫苗到期日和收容天數會跟著今天移動，照片不會被清掉", async () => {
    await seedDemo("demo-password-123");
    const db = getDb();
    await db.update("shelters/nuanwo/animals/xiaohei", { vaccineDue: "2020/01/01", intakeAt: "2020-01-01T00:00:00.000Z", photos: ["/media/nuanwo/x.jpg"] });
    await refreshDemoDates();
    const a = await getAnimal("nuanwo", "xiaohei");
    expect(daysUntil(a!.vaccineDue)).toBeGreaterThan(0);
    expect(a!.intakeAt > "2026-01-01").toBe(true);
    expect(a!.photos).toEqual(["/media/nuanwo/x.jpg"]);
  });
});
