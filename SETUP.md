# 浪浪夥伴：設定步驟

## 本機執行

```bash
npm install
npm run dev
```

開啟 http://localhost:3100。沒有 Google Cloud 也能跑，資料存在 `.data/`，第一次啟動會自動放入虛構的示範資料。

示範管理者帳號：`demo@langlang.test`，密碼是 `.env.local` 的 `DEMO_MANAGER_PASSWORD`（本機預設 `langlang-demo`）。

```bash
npm test
```

## 第一階段：接上真的 LINE 和 Gemini（不需要 Google Cloud）

### 建立 LINE 官方帳號

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立官方帳號。
2. 進入帳號的「設定 → Messaging API」，按「啟用 Messaging API」，選擇或建立 Provider。
3. 到 [LINE Developers Console](https://developers.line.biz/console/) 打開這個 Channel：
   - Basic settings：複製 **Channel secret**
   - Messaging API 分頁最下方：按 Issue，複製 **Channel access token (long-lived)**
4. 回到 Official Account Manager 的「設定 → 回應設定」：
   - Webhook：開
   - 聊天：開（管理者才能直接和領養人對話）
   - 加入好友的歡迎訊息：關
   - 自動回應訊息：關

### 建立 Gemini 金鑰

到 [Google AI Studio](https://aistudio.google.com/apikey) 建立金鑰。

免費方案的輸入內容可能被 Google 用來改善產品。Demo 只用虛構資料沒有問題，但**接上真實協會的資料前要改用付費方案**。

### 把金鑰填進 `.env.local`

填 `GEMINI_API_KEY`、`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。

### 連上 LINE

LINE 需要公開的 https 網址，開發時用 Cloudflare 臨時通道：

```bash
cloudflared tunnel --url http://localhost:3100
```

把畫面上的 `https://xxxx.trycloudflare.com` 填到 `.env.local` 的 `APP_URL`，然後：

```bash
npm run setup:line
```

這個指令會上傳兩套選單圖片、設定預設選單、設定 Webhook 網址並測試連線。臨時通道的網址每次都會變，變了就重跑一次。

### 用手機測試

1. 加官方帳號好友，下方會出現領養人選單。
2. 傳 `A27391568`（示範人員林小芸的工作號），選單會切換成工作選單。
3. 按「新增動物」，傳照片和語音；按「回報照護」，講「A 區都正常，小黑今天沒吃」。

## 第二階段：部署到 Google Cloud

需要先綁定帳單帳戶（Cloud Run 和 Cloud Storage 都要求），並設定預算警示。

**請建立新專案。** 不要部署到其他專案，先確認 `gcloud config get-value project` 指向的是這個專案。

```bash
gcloud projects create <專案ID>
gcloud config set project <專案ID>
gcloud services enable run.googleapis.com firestore.googleapis.com storage.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud firestore databases create --location=asia-east1
gcloud storage buckets create gs://<專案ID>-media --location=asia-east1 --uniform-bucket-level-access
```

部署。CPU 要一直配置（`--no-cpu-throttling`），webhook 才能在回應 LINE 之後繼續跑 AI：

```bash
gcloud run deploy langlang-partner --source . --region asia-east1 --allow-unauthenticated --no-cpu-throttling --min-instances 0 --max-instances 1 --set-env-vars GOOGLE_CLOUD_PROJECT=<專案ID>,GCS_BUCKET=<專案ID>-media,GEMINI_MODEL=gemini-3.5-flash-lite,SESSION_SECRET=<隨機字串>,GEMINI_API_KEY=<金鑰>
```

`--max-instances 1` 是因為同一位使用者的訊息目前靠單一程序內的佇列排序，多台同時跑時，連續傳來的照片和語音可能互相覆蓋。

寫入示範資料並接上 LINE（`.env.local` 的 `GOOGLE_CLOUD_PROJECT` 和 `APP_URL` 要改成正式值，並先執行 `gcloud auth application-default login`）：

```bash
npm run seed
npm run setup:line
```

## 網址

| 用途 | 網址 |
|---|---|
| 首頁 | https://langlang-partner-170619611244.asia-east1.run.app |
| 協會後台 | /login/shelter（協會管理者帳號） |
| 平台總後台 | /login/admin（平台管理者帳號，用 `npm run create-admin` 建立，密碼在 `.env.local` 的 `ADMIN_PASSWORD`） |
| 公開領養頁 | /adopt |
| 公立收容所的毛孩（開放資料） | /adopt/public |
| 捐物資 | /adopt/supplies（網址加 ?s=協會代號 只看一家） |

新協會在總後台「協會管理 → 開通新協會」建立，會產生管理者的臨時密碼；再到該協會頁面貼上 LINE 憑證，系統會自動上傳選單並設定 Webhook。

## 示範資料的日期

示範協會的收容天數、疫苗到期、照護回報和申請時間會隨時間變舊。給評審或協會看之前，到平台總後台「系統狀態」頁按「把示範資料日期更新到今天」，或執行 `npm run demo:refresh`。照片、AI 動態影片、人員綁定和協會設定不會變動。

本機想測試又不想動到正式資料時，用 `npm run dev:local`：資料庫改用本機的 `.data/db.json`。

## 回覆速度

伺服器閒置一段時間後會關閉，下一則訊息要先重新啟動，會多等幾秒。錄 Demo 或比賽當天可以先開啟「保持暖機」，結束後關閉（開著約每天 1.7 美元（約 NT$55），這是依官方牌價估算，免費額度可能抵掉一部分）：

```bash
npm run warm:on
npm run warm:off
```

## 目前的限制

- 示範用的 LINE 模擬頁和虛構資料放在 `demo/`，說明見 `demo/README.md`。
- LINE 憑證存在 Firestore 的私密文件，只有伺服器讀得到，但沒有另外加密。接真實協會前建議改放 Secret Manager。

## 使用的外部資源（簡報要揭露）

比賽注意事項第 12、13、16 點要求說明使用的模型、API 和第三方素材：

| 資源 | 用途 | 授權或條款 |
|---|---|---|
| Google Gemini API（gemini-3.5-flash-lite） | 建檔整理、照護拆解、送養文案、問答、媒合說明、自我介紹 | Google API 服務條款 |
| LINE Messaging API | 現場人員與領養人的 LINE 介面 | LINE 開發者條款 |
| MediaPipe Tasks Vision 0.10.35 | AR 試放在瀏覽器裡去背 | Apache-2.0 |
| MediaPipe MagicTouch 模型 | 依點選位置分割出動物 | 請依官方 model card 確認授權後再揭露 |
| Gemini Omni Flash（gemini-omni-1.2-flash） | AR 試放的 AI 動態影片（綠幕短片），影片內含 Google SynthID 浮水印 | Google API 服務條款 |
| model-viewer 4.3.1、three.js 0.183 | 手機內建 AR 的真實大小立牌（iPhone 快速查看、Android） | Apache-2.0、MIT |
| 示範用德國牧羊犬照片（rawpixel） | 示範動物「阿福」的照片與動態影片來源 | CC0，https://www.rawpixel.com/image/3338497 |
| Google Cloud Run、Firestore、Cloud Storage | 網站、資料庫、照片 | Google Cloud 條款 |
| Noto Sans TC、Noto Serif TC | 介面與選單圖片字型 | SIL Open Font License |
| 農業部動物認領養開放資料（UnitId QcbUEzN6E6DL） | 簡報中的問題分析；公開網站「公立收容所的毛孩」頁顯示全國開放認養的貓狗與收容所提供的照片，每 6 小時更新，頁面標示來源；AI 只用種類、體型、毛色等欄位整理介紹，不送備註 | 政府資料開放授權條款第 1 版（須標示來源） |

AR 試放的大小是依體型估計（狗：小型約 40、中型約 60、大型約 80 公分高；貓約 30 公分）。動態影片由協會在後台按鈕產生、預覽確認後才公開，每隻約 NT$30；點擊反應依協會寫的個性關鍵字挑選影片或動畫，沒有另外訓練模型。
