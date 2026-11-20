import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";

// 照片、去背圖和動態影片存在 Cloud Storage（未設定 GCS_BUCKET 時存在本機 .data），由本站 /media 路徑提供。
// 檔名是隨機 UUID；照片存入前先縮圖並移除 EXIF，避免把拍攝地點等資訊一起公開。
const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|mp4)$/;
const SID_RE = /^[a-z0-9-]+$/;
const TYPES = { jpg: "image/jpeg", png: "image/png", mp4: "video/mp4" } as const;
type Ext = keyof typeof TYPES;

const localPath = (sid: string, file: string) => join(/*turbopackIgnore: true*/ process.cwd(), ".data", "media", sid, file);
const objectName = (sid: string, file: string) => `media/${sid}/${file}`;
const bucket = () => new Storage().bucket(process.env.GCS_BUCKET as string);
const valid = (sid: string, file: string) => SID_RE.test(sid) && FILE_RE.test(file);
export const mediaType = (file: string) => TYPES[file.split(".").pop() as Ext] ?? "application/octet-stream";

async function writeObject(sid: string, file: string, data: Buffer) {
  if (process.env.GCS_BUCKET) {
    await bucket().file(objectName(sid, file)).save(data, { contentType: mediaType(file), resumable: false });
  } else {
    const p = localPath(sid, file);
    mkdirSync(/*turbopackIgnore: true*/ dirname(p), { recursive: true });
    writeFileSync(/*turbopackIgnore: true*/ p, data);
  }
  return `/media/${sid}/${file}`;
}

export async function savePhoto(sid: string, input: Buffer) {
  const data = await sharp(input).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return writeObject(sid, `${randomUUID()}.jpg`, data);
}

const LIMITS: Record<"png" | "mp4", number> = { png: 4 * 1024 * 1024, mp4: 30 * 1024 * 1024 };

/** 儲存去背圖（PNG）或動態影片（MP4）。會檢查檔頭，不接受其他格式。 */
export async function saveAsset(sid: string, data: Buffer, ext: "png" | "mp4") {
  if (data.length === 0 || data.length > LIMITS[ext]) throw new Error("檔案太大或是空的");
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isMp4 = data.subarray(4, 8).toString("latin1") === "ftyp";
  if ((ext === "png" && !isPng) || (ext === "mp4" && !isMp4)) throw new Error("檔案格式不正確");
  return writeObject(sid, `${randomUUID()}.${ext}`, data);
}

export async function readPhoto(sid: string, file: string): Promise<Buffer | null> {
  if (!valid(sid, file)) return null;
  if (process.env.GCS_BUCKET) {
    const f = bucket().file(objectName(sid, file));
    const [exists] = await f.exists();
    if (!exists) return null;
    const [buf] = await f.download();
    return buf;
  }
  const p = localPath(sid, file);
  return existsSync(/*turbopackIgnore: true*/ p) ? readFileSync(/*turbopackIgnore: true*/ p) : null;
}

export async function readPhotoByUrl(url: string) {
  const m = /^\/media\/([^/]+)\/([^/]+)$/.exec(url);
  return m ? readPhoto(m[1], m[2]) : null;
}

export async function mediaSize(sid: string, file: string): Promise<number | null> {
  if (!valid(sid, file)) return null;
  if (process.env.GCS_BUCKET) {
    const f = bucket().file(objectName(sid, file));
    const [exists] = await f.exists();
    if (!exists) return null;
    const [meta] = await f.getMetadata();
    return Number(meta.size);
  }
  const p = localPath(sid, file);
  return existsSync(/*turbopackIgnore: true*/ p) ? statSync(/*turbopackIgnore: true*/ p).size : null;
}

/** 讀取一段位元組（end 含在內）。iPhone 的 Safari 播影片時一定會用分段請求。 */
export async function readMediaRange(sid: string, file: string, start: number, end: number): Promise<Buffer> {
  if (process.env.GCS_BUCKET) {
    const [buf] = await bucket().file(objectName(sid, file)).download({ start, end });
    return buf;
  }
  return readFileSync(/*turbopackIgnore: true*/ localPath(sid, file)).subarray(start, end + 1);
}

/** 解析 Range 標頭。沒有標頭回 null；格式錯誤或超出範圍回 "invalid"。 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
