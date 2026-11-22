import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";

// 飼主的照片、醫療單據和 3D 模型都是私人檔案，存在 Cloud Storage（未設定 GCS_BUCKET 時存在本機 .data）。
// 網址是 /files/<範圍>/<檔名>，只有本人登入、或帶著伺服器簽發的簽章才能讀取（見 app/files 路由）。
// 範圍是飼主 ID 的雜湊，網址裡不會出現 LINE 使用者 ID。照片存入前會縮圖並移除 EXIF。
const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|glb)$/;
const SCOPE_RE = /^o-[0-9a-f]{16}$/;
const TYPES = { jpg: "image/jpeg", png: "image/png", glb: "model/gltf-binary" } as const;
type Ext = keyof typeof TYPES;

export const scopeOf = (uid: string) => `o-${createHash("sha256").update(`owner:${uid}`).digest("hex").slice(0, 16)}`;
export const mediaType = (file: string) => TYPES[file.split(".").pop() as Ext] ?? "application/octet-stream";
export const validFile = (scope: string, file: string) => SCOPE_RE.test(scope) && FILE_RE.test(file);

const localPath = (scope: string, file: string) => join(/*turbopackIgnore: true*/ process.cwd(), ".data", "files", scope, file);
const objectName = (scope: string, file: string) => `files/${scope}/${file}`;
const bucket = () => new Storage().bucket(process.env.GCS_BUCKET as string);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("缺少 SESSION_SECRET");
  return "dev-only-session-secret";
}

/** 給分享頁和工作站用的簽章，讓沒有登入的人也能讀取這一個檔案。 */
export function signFile(url: string) {
  return createHmac("sha256", secret()).update(`file:${url}`).digest("base64url").slice(0, 22);
}
export function verifyFileSig(url: string, sig: string | null) {
  if (!sig) return false;
  const a = Buffer.from(signFile(url));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const signedUrl = (url: string) => `${url}?s=${signFile(url)}`;

export function parseFileUrl(url: string) {
  const m = /^\/files\/([^/]+)\/([^/?]+)$/.exec(url);
  return m && validFile(m[1], m[2]) ? { scope: m[1], file: m[2] } : null;
}

async function writeObject(scope: string, file: string, data: Buffer) {
  if (process.env.GCS_BUCKET) {
    await bucket().file(objectName(scope, file)).save(data, { contentType: mediaType(file), resumable: false });
  } else {
    const p = localPath(scope, file);
    mkdirSync(/*turbopackIgnore: true*/ dirname(p), { recursive: true });
    writeFileSync(/*turbopackIgnore: true*/ p, data);
  }
  return `/files/${scope}/${file}`;
}

/** 照片和單據：轉正、縮到 1600 像素、去掉 EXIF。單據要看得清楚字，所以比一般照片大一點。 */
export async function savePhoto(uid: string, input: Buffer, maxSide = 1600) {
  const data = await sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return writeObject(scopeOf(uid), `${randomUUID()}.jpg`, data);
}

const GLB_LIMIT = 15 * 1024 * 1024;

/** 工作站做好的 3D 模型。會檢查 GLB 檔頭。 */
export async function saveGlb(uid: string, data: Buffer) {
  if (data.length < 20 || data.length > GLB_LIMIT) throw new Error("模型檔太大或是空的");
  if (data.subarray(0, 4).toString("latin1") !== "glTF") throw new Error("不是 GLB 檔");
  return writeObject(scopeOf(uid), `${randomUUID()}.glb`, data);
}

export async function readFile(scope: string, file: string): Promise<Buffer | null> {
  if (!validFile(scope, file)) return null;
  if (process.env.GCS_BUCKET) {
    const f = bucket().file(objectName(scope, file));
    const [exists] = await f.exists();
    if (!exists) return null;
    const [buf] = await f.download();
    return buf;
  }
  const p = localPath(scope, file);
  return existsSync(/*turbopackIgnore: true*/ p) ? readFileSync(/*turbopackIgnore: true*/ p) : null;
}

export async function readFileByUrl(url: string) {
  const f = parseFileUrl(url);
  return f ? readFile(f.scope, f.file) : null;
}

export async function deleteFileByUrl(url: string) {
  const f = parseFileUrl(url);
  if (!f) return;
  if (process.env.GCS_BUCKET) await bucket().file(objectName(f.scope, f.file)).delete({ ignoreNotFound: true });
  else rmSync(/*turbopackIgnore: true*/ localPath(f.scope, f.file), { force: true });
}
