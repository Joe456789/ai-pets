import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db, Where } from "./index";

type Store = Map<string, Record<string, unknown>>;

// 開發用資料庫：所有文件放在記憶體，寫入時同步存成 JSON。
// LL_DB_FILE=:memory: 時只放記憶體，給測試使用。
const g = globalThis as unknown as { __llStore?: Store; __llMtime?: number };

function filePath() {
  return process.env.LL_DB_FILE ?? join(/*turbopackIgnore: true*/ process.cwd(), ".data", "db.json");
}

function load(): Store {
  const path = filePath();
  // 另一個程序（例如設定腳本）改過檔案時要重新讀取，否則開發伺服器會看到舊資料。
  const mtime = path !== ":memory:" && existsSync(/*turbopackIgnore: true*/ path) ? statSync(/*turbopackIgnore: true*/ path).mtimeMs : undefined;
  if (g.__llStore && mtime === g.__llMtime) return g.__llStore;
  const store: Store = new Map();
  if (mtime !== undefined) {
    const raw = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")) as Record<string, Record<string, unknown>>;
    for (const [k, v] of Object.entries(raw)) store.set(k, v);
  }
  g.__llStore = store;
  g.__llMtime = mtime;
  return store;
}

function save() {
  const path = filePath();
  if (path === ":memory:") return;
  mkdirSync(/*turbopackIgnore: true*/ dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(/*turbopackIgnore: true*/ tmp, JSON.stringify(Object.fromEntries(g.__llStore ?? [])));
  renameSync(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ path);
  g.__llMtime = statSync(/*turbopackIgnore: true*/ path).mtimeMs;
}

export function resetFileDb() {
  g.__llStore = new Map();
  g.__llMtime = undefined;
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const isChild = (path: string, coll: string) => path.startsWith(`${coll}/`) && !path.slice(coll.length + 1).includes("/");

export function fileDb(): Db {
  return {
    async get<T>(path: string) {
      const v = load().get(path);
      return v ? (clone(v) as T) : null;
    },
    async set(path, data) {
      load().set(path, clone(data) as Record<string, unknown>);
      save();
    },
    async update(path, patch) {
      const s = load();
      const cur = s.get(path);
      if (!cur) throw new Error(`文件不存在：${path}`);
      s.set(path, clone({ ...cur, ...patch }));
      save();
    },
    async create(path, data) {
      const s = load();
      if (s.has(path)) return false;
      s.set(path, clone(data) as Record<string, unknown>);
      save();
      return true;
    },
    async delete(path) {
      load().delete(path);
      save();
    },
    async list<T>(coll: string, where: Where[] = []) {
      const out: T[] = [];
      for (const [k, v] of load()) {
        if (isChild(k, coll) && where.every(([f, val]) => v[f] === val)) out.push(clone(v) as T);
      }
      return out;
    },
    async increment(path, fields) {
      const s = load();
      const cur = { ...(s.get(path) ?? {}) } as Record<string, number>;
      for (const [k, n] of Object.entries(fields)) cur[k] = (cur[k] ?? 0) + n;
      s.set(path, cur);
      save();
    },
    async listRecent<T>(coll: string, field: string, limit: number) {
      const rows: Record<string, unknown>[] = [];
      for (const [k, v] of load()) if (isChild(k, coll)) rows.push(clone(v));
      return rows.sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? ""))).slice(0, limit) as T[];
    },
    async nextCounter(path) {
      const s = load();
      const n = ((s.get(path)?.n as number) ?? 0) + 1;
      s.set(path, { n });
      save();
      return n;
    },
  };
}
