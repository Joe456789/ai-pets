import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { nowIso } from "@/lib/time";

// 物資需求：協會列出缺的物資，民眾在公開頁登記「我可以捐」，協會收到後確認。
// 捐贈人的聯絡方式只有該協會的管理者看得到，不會公開，也不會送給 AI。

export type SupplyDoc = {
  id: string; name: string; unit: string; need: number; got: number; note: string; urgent: boolean;
  status: "需要" | "已足夠"; createdAt: string; updatedAt: string;
};
export type PledgeStatus = "待確認" | "已收到" | "取消";
export type PledgeDoc = {
  id: string; supplyId: string; supplyName: string; unit: string; qty: number; who: string; contact: string; note: string;
  status: PledgeStatus; createdAt: string;
};
export type PublicSupply = Pick<SupplyDoc, "id" | "name" | "unit" | "need" | "got" | "note" | "urgent"> & { pledged: number };

const db = () => getDb();
const supplyPath = (sid: string, id = "") => `shelters/${sid}/supplies${id ? `/${id}` : ""}`;
const pledgePath = (sid: string, id = "") => `shelters/${sid}/pledges${id ? `/${id}` : ""}`;

export async function listSupplies(sid: string) {
  const rows = await db().list<SupplyDoc>(supplyPath(sid));
  return rows.sort((a, b) => Number(a.status === "已足夠") - Number(b.status === "已足夠") || Number(b.urgent) - Number(a.urgent) || b.updatedAt.localeCompare(a.updatedAt));
}
export const getSupply = (sid: string, id: string) => db().get<SupplyDoc>(supplyPath(sid, id));

export async function createSupply(sid: string, input: Pick<SupplyDoc, "name" | "unit" | "need" | "note" | "urgent">) {
  const now = nowIso();
  const doc: SupplyDoc = { ...input, id: randomUUID(), got: 0, status: "需要", createdAt: now, updatedAt: now };
  await db().set(supplyPath(sid, doc.id), doc);
  return doc;
}
export const updateSupply = (sid: string, id: string, patch: Partial<Omit<SupplyDoc, "id" | "createdAt">>) =>
  db().update(supplyPath(sid, id), { ...patch, updatedAt: nowIso() });
export const deleteSupply = (sid: string, id: string) => db().delete(supplyPath(sid, id));

export async function listPledges(sid: string) {
  const rows = await db().list<PledgeDoc>(pledgePath(sid));
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const getPledge = (sid: string, id: string) => db().get<PledgeDoc>(pledgePath(sid, id));

export async function createPledge(sid: string, input: Omit<PledgeDoc, "id" | "status" | "createdAt">) {
  const doc: PledgeDoc = { ...input, id: randomUUID(), status: "待確認", createdAt: nowIso() };
  await db().set(pledgePath(sid, doc.id), doc);
  return doc;
}

/** 收到捐贈時把數量加到「已收到」，數量足夠就自動改成已足夠。 */
export async function setPledgeStatus(sid: string, id: string, status: PledgeStatus) {
  const p = await getPledge(sid, id);
  if (!p) throw new Error("找不到這筆登記");
  if (p.status === status) return p;
  await db().update(pledgePath(sid, id), { status });
  const s = await getSupply(sid, p.supplyId);
  if (s) {
    const delta = (status === "已收到" ? p.qty : 0) - (p.status === "已收到" ? p.qty : 0);
    if (delta) {
      const got = Math.max(0, s.got + delta);
      await updateSupply(sid, s.id, { got, status: got >= s.need ? "已足夠" : "需要" });
    }
  }
  return { ...p, status };
}

/** 公開頁顯示的物資：只列還需要的，附上已登記但還沒收到的數量。 */
export async function publicSupplies(sid: string): Promise<PublicSupply[]> {
  const [supplies, pledges] = await Promise.all([listSupplies(sid), listPledges(sid)]);
  return supplies
    .filter((s) => s.status === "需要")
    .map((s) => ({
      id: s.id, name: s.name, unit: s.unit, need: s.need, got: s.got, note: s.note, urgent: s.urgent,
      pledged: pledges.filter((p) => p.supplyId === s.id && p.status === "待確認").reduce((n, p) => n + p.qty, 0),
    }));
}
