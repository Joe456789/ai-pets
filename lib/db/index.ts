import { fileDb } from "./file";
import { firestoreDb } from "./firestore";

export type Where = [field: string, value: unknown];

// 所有資料存取都走這個介面。開發和測試用本機檔案，正式環境用 Firestore。
export interface Db {
  get<T>(path: string): Promise<T | null>;
  set<T extends object>(path: string, data: T): Promise<void>;
  update(path: string, patch: Record<string, unknown>): Promise<void>;
  /** 文件已存在時回傳 false，用來做「只處理一次」。 */
  create<T extends object>(path: string, data: T): Promise<boolean>;
  delete(path: string): Promise<void>;
  list<T>(collection: string, where?: Where[]): Promise<T[]>;
  /** 以原子方式加總數字欄位，文件不存在時會建立。 */
  increment(path: string, fields: Record<string, number>): Promise<void>;
  /** 以原子方式取得下一個流水號。 */
  nextCounter(path: string): Promise<number>;
  /** 依欄位由新到舊取最近 limit 筆。 */
  listRecent<T>(collection: string, field: string, limit: number): Promise<T[]>;
}

let cached: Db | null = null;

/** 本機測試設定 LL_LOCAL_DATA=1 時，即使 .env.local 有雲端專案，也改用本機檔案資料庫，避免動到正式資料。 */
export function usingFirestore() {
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT) && !process.env.LL_LOCAL_DATA;
}

export function getDb(): Db {
  if (cached) return cached;
  if (usingFirestore()) {
    cached = firestoreDb(process.env.GOOGLE_CLOUD_PROJECT as string);
    return cached;
  }
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !process.env.LL_ALLOW_FILE_DB) {
    throw new Error("正式環境必須設定 GOOGLE_CLOUD_PROJECT，本機檔案資料庫在雲端重啟後會消失。");
  }
  cached = fileDb();
  return cached;
}
