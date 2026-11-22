# 從此有你：設定步驟

> 舊的收容版（浪浪夥伴）完整保留在 git 標籤 `shelter-version`：`git checkout shelter-version` 就能看到。

## 本機執行

```bash
npm install
npm run dev:local
```

開啟 http://localhost:3100。資料存在 `.data/`，第一次啟動會自動放入示範帳號（虛構資料）。

- 「看示範」：http://localhost:3100/demo，唯讀。
- 本機測試登入：在需要登入的頁面按「本機測試登入」（只有本機有）。

```bash
npm test
```

## 一、建立 LINE 官方帳號和 LIFF（你要做的）

兩個頻道要放在**同一個 Provider** 底下，LIFF 拿到的使用者 ID 才會和聊天室的一樣。

### 1. 官方帳號（Messaging API）

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立官方帳號，名稱「從此有你」。
2. 「設定 → Messaging API」按「啟用 Messaging API」，選擇或建立 Provider。
3. 到 [LINE Developers Console](https://developers.line.biz/console/) 打開這個 Channel：
   - Basic settings：複製 **Channel secret**
   - Messaging API 分頁最下方：按 Issue，複製 **Channel access token (long-lived)**
4. 回到 Official Account Manager 的「設定 → 回應設定」：Webhook 開、加入好友的歡迎訊息關、自動回應訊息關。
5. 「首頁 → 加入好友的工具」複製加好友網址（`https://lin.ee/…`）。

### 2. LINE Login 頻道和 LIFF

1. 在同一個 Provider 按「Create a new channel → LINE Login」。App types 勾 **Web app**。
2. Basic settings 複製 **Channel ID**。
3. LIFF 分頁按 Add：
   - Size：Full
   - Endpoint URL：網站網址（例如 `https://langlang-partner-170619611244.asia-east1.run.app`）
   - Scopes：勾 `openid` 和 `profile`
   - Bot link feature：On (Aggressive)，登入時會順便請飼主加官方帳號好友
4. 複製 **LIFF ID**（像 `2001234567-AbCdEfGh`）。
5. 頻道狀態從 Developing 改成 **Published**，其他人才能登入。

### 3. 填進 `.env.local`（不要貼在聊天裡）

```
LINE_CHANNEL_SECRET=官方帳號的 Channel secret
LINE_CHANNEL_ACCESS_TOKEN=官方帳號的 Channel access token
LINE_LOGIN_CHANNEL_ID=LINE Login 的 Channel ID
LIFF_ID=LIFF ID
LINE_ADD_URL=加好友網址
APP_URL=網站網址（https，不要結尾斜線）
```

### 4. 接上

```bash
npm run setup:line
```

會上傳選單圖片、設定預設選單、設定 Webhook（`<APP_URL>/api/line`）並測試連線。

## 二、部署到 Cloud Run

專案是 `langlang-partner-2026`。**一定要加 `--project`**，你電腦的預設專案是別的。

```bash
gcloud run deploy langlang-partner --source . --region asia-east1 --project langlang-partner-2026 --quiet
```

正式環境需要的環境變數（第一次設定，之後部署會保留）：

```bash
gcloud run services update langlang-partner --region asia-east1 --project langlang-partner-2026 --update-env-vars LINE_LOGIN_CHANNEL_ID=…,LIFF_ID=…,LINE_ADD_URL=…,WORKER_TOKEN=…,CRON_SECRET=…
```

更新正式站的示範帳號：

```bash
GOOGLE_CLOUD_PROJECT=langlang-partner-2026 GCS_BUCKET=langlang-partner-2026-media npm run demo:seed
```

### 每天的回診提醒

Cloud Scheduler 每天早上 9 點呼叫一次（免費額度內）：

```bash
gcloud scheduler jobs create http cy-reminders --project langlang-partner-2026 --location asia-east1 --schedule "0 9 * * *" --time-zone "Asia/Taipei" --uri "<APP_URL>/api/cron/reminders" --http-method POST --headers "X-Cron-Key=<CRON_SECRET>"
```

## 三、3D 紀念工作站（你的電腦）

需要 Docker Desktop 和已經建好的 `langlang-trellis` 映像（見 `3d-lab/`）。

1. `3d-lab/worker.env`：
   ```
   SERVER=網站網址
   WORKER_TOKEN=和 Cloud Run 上的 WORKER_TOKEN 相同
   ```
2. 在 `3d-lab` 執行：
   ```bash
   python -X utf8 worker.py
   ```
   每 30 秒看一次有沒有新的紀念任務，做好會自動上傳並用 LINE 通知飼主。電腦沒開時任務會排隊等著。
   第一次處理沒有去背的照片時，會自動下載去背模型（約 170 MB）。

## 資料與隱私

- 飼主的照片、單據和 3D 模型存在 Cloud Storage 的私人路徑，只有本人登入或帶伺服器簽章的連結能讀。
- **用真實飼主資料（尤其醫療單據）之前，Gemini 要改用付費方案**；免費方案的輸入可能被 Google 用來改善產品。
- 示範帳號、示範單據和示範醫院都是虛構的。
