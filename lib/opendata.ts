// 農業部「動物認領養」開放資料：全國公立收容所開放認養的貓狗。
// 授權：政府資料開放授權條款－第 1 版，使用時須標示來源。資料每天更新，這裡在伺服器快取 6 小時。
// 這些動物不在浪浪夥伴的協會裡，認養要直接聯絡各收容所；本站只幫忙曝光，並用 AI 把欄位整理成好讀的介紹。

export const OPEN_DATA_URL = "https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL&IsTransData=1";
export const OPEN_DATA_PAGE = "https://data.moa.gov.tw/open_detail.aspx?id=QcbUEzN6E6DL";
export const OPEN_DATA_CREDIT = "資料來源：農業部「動物認領養」開放資料（政府資料開放授權條款－第 1 版）";

export type OpenAnimal = {
  id: string; kind: "狗" | "貓" | "其他"; variety: string; sex: "公" | "母" | "未知"; size: "小型" | "中型" | "大型" | "未知";
  age: "幼年" | "成年" | "未知"; colour: string; sterilized: "已絕育" | "未絕育" | "未知"; remark: string;
  shelter: string; shelterTel: string; shelterAddr: string; county: string; photo: string; openDate: string; updated: string;
};

type Raw = Record<string, string | number | null | undefined>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const COUNTY_RE = /^(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/;

export function mapOpenAnimal(r: Raw): OpenAnimal | null {
  const id = str(r.animal_id);
  if (!/^\d+$/.test(id) || str(r.animal_status) !== "OPEN") return null;
  const kind = str(r.animal_kind);
  const shelter = str(r.shelter_name) || str(r.animal_place);
  const photo = str(r.album_file);
  return {
    id,
    kind: kind === "狗" ? "狗" : kind === "貓" ? "貓" : "其他",
    variety: str(r.animal_Variety),
    sex: ({ M: "公", F: "母" } as const)[str(r.animal_sex) as "M" | "F"] ?? "未知",
    size: ({ SMALL: "小型", MEDIUM: "中型", BIG: "大型" } as const)[str(r.animal_bodytype) as "SMALL"] ?? "未知",
    age: ({ CHILD: "幼年", ADULT: "成年" } as const)[str(r.animal_age) as "CHILD"] ?? "未知",
    colour: str(r.animal_colour),
    sterilized: ({ T: "已絕育", F: "未絕育" } as const)[str(r.animal_sterilization) as "T"] ?? "未知",
    remark: str(r.animal_remark).slice(0, 300),
    shelter,
    shelterTel: str(r.shelter_tel),
    shelterAddr: str(r.shelter_address),
    county: (shelter.match(COUNTY_RE)?.[1] ?? "其他").replace(/^台/, "臺"),
    photo: /^https:\/\/[\w.-]+\.gov\.tw\//.test(photo) ? photo : "",
    openDate: str(r.animal_opendate),
    updated: str(r.animal_update),
  };
}

let cache: { at: number; rows: OpenAnimal[] } | null = null;
let loading: Promise<OpenAnimal[]> | null = null;
const TTL = 6 * 3600_000;
const SNAPSHOT = "cache/opendata.json";

// 政府的檔案約 9MB、下載要十幾秒，所以整理後的資料另存一份（Cloud Storage 或本機 .data），
// 伺服器重啟後先讀這份，過期才在背景重新下載，訪客不用等。
async function readSnapshot(): Promise<{ at: number; rows: OpenAnimal[] } | null> {
  try {
    if (process.env.GCS_BUCKET) {
      const { Storage } = await import("@google-cloud/storage");
      const [buf] = await new Storage().bucket(process.env.GCS_BUCKET).file(SNAPSHOT).download();
      return JSON.parse(buf.toString("utf8"));
    }
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return JSON.parse(readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), ".data", "opendata.json"), "utf8"));
  } catch {
    return null;
  }
}
async function writeSnapshot(data: { at: number; rows: OpenAnimal[] }) {
  try {
    const body = JSON.stringify(data);
    if (process.env.GCS_BUCKET) {
      const { Storage } = await import("@google-cloud/storage");
      await new Storage().bucket(process.env.GCS_BUCKET).file(SNAPSHOT).save(body, { contentType: "application/json", resumable: false });
      return;
    }
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    mkdirSync(join(/*turbopackIgnore: true*/ process.cwd(), ".data"), { recursive: true });
    writeFileSync(join(/*turbopackIgnore: true*/ process.cwd(), ".data", "opendata.json"), body);
  } catch (e) {
    console.warn("開放資料快取寫入失敗", (e as Error).message);
  }
}

async function download() {
  const res = await fetch(OPEN_DATA_URL, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`開放資料回應 ${res.status}`);
  const raw = (await res.json()) as Raw[];
  return raw.map(mapOpenAnimal).filter((x): x is OpenAnimal => Boolean(x));
}

function refresh() {
  loading ??= (async () => {
    try {
      const rows = await download();
      cache = { at: Date.now(), rows };
      await writeSnapshot(cache);
      return rows;
    } catch (e) {
      console.warn("讀取農業部開放資料失敗", (e as Error).message);
      return cache?.rows ?? [];
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** 取得全部開放認養的動物。有舊資料就先回傳，過期時在背景更新；完全沒有資料時才等下載。 */
export async function listOpenAnimals(): Promise<OpenAnimal[]> {
  if (!cache) {
    const snap = await readSnapshot();
    if (snap?.rows?.length) cache = snap;
  }
  if (cache) {
    if (Date.now() - cache.at > TTL) void refresh();
    return cache.rows;
  }
  return refresh();
}

export async function getOpenAnimal(id: string) {
  if (!/^\d{1,12}$/.test(id)) return null;
  return (await listOpenAnimals()).find((a) => a.id === id) ?? null;
}

export type OpenFilter = { county?: string; kind?: string; size?: string; page?: number };
export const OPEN_PAGE_SIZE = 24;

/** 依縣市、種類、體型篩選，有照片的排前面，再依開放認養日期由新到舊。 */
export function filterOpenAnimals(rows: OpenAnimal[], f: OpenFilter) {
  const list = rows
    .filter((a) => (!f.county || a.county === f.county) && (!f.kind || a.kind === f.kind) && (!f.size || a.size === f.size))
    .sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)) || b.openDate.localeCompare(a.openDate));
  const page = Math.max(1, f.page ?? 1);
  return { total: list.length, page, pages: Math.max(1, Math.ceil(list.length / OPEN_PAGE_SIZE)), items: list.slice((page - 1) * OPEN_PAGE_SIZE, page * OPEN_PAGE_SIZE) };
}

export const countiesOf = (rows: OpenAnimal[]) => {
  const n = new Map<string, number>();
  for (const a of rows) n.set(a.county, (n.get(a.county) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([county, count]) => ({ county, count }));
};
