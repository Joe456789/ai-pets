import { FieldValue, Firestore } from "@google-cloud/firestore";
import type { Db, Where } from "./index";

const ALREADY_EXISTS = 6;

// 憑證使用 Application Default Credentials：雲端用服務帳號，本機用 gcloud 登入，不需要金鑰檔。
export function firestoreDb(projectId: string): Db {
  // preferRest：冷啟動時不用先建立 gRPC 連線，第一個請求會快上幾秒。
  const fs = new Firestore({ projectId, ignoreUndefinedProperties: true, preferRest: true });
  return {
    async get<T>(path: string) {
      const snap = await fs.doc(path).get();
      return snap.exists ? (snap.data() as T) : null;
    },
    async set(path, data) {
      await fs.doc(path).set(data as FirebaseFirestore.DocumentData);
    },
    async update(path, patch) {
      await fs.doc(path).update(patch);
    },
    async create(path, data) {
      try {
        await fs.doc(path).create(data as FirebaseFirestore.DocumentData);
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === ALREADY_EXISTS) return false;
        throw e;
      }
    },
    async delete(path) {
      await fs.doc(path).delete();
    },
    async list<T>(coll: string, where: Where[] = []) {
      let q: FirebaseFirestore.Query = fs.collection(coll);
      for (const [f, v] of where) q = q.where(f, "==", v);
      const snap = await q.get();
      return snap.docs.map((d) => d.data() as T);
    },
    async increment(path, fields) {
      const patch = Object.fromEntries(Object.entries(fields).map(([k, n]) => [k, FieldValue.increment(n)]));
      await fs.doc(path).set(patch, { merge: true });
    },
    async listRecent<T>(coll: string, field: string, limit: number) {
      const snap = await fs.collection(coll).orderBy(field, "desc").limit(limit).get();
      return snap.docs.map((d) => d.data() as T);
    },
    async nextCounter(path) {
      const ref = fs.doc(path);
      return fs.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const n = ((snap.data()?.n as number) ?? 0) + 1;
        tx.set(ref, { n });
        return n;
      });
    },
  };
}
