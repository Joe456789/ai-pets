# 示範內容

這個資料夾放示範用的內容，協會、人員、動物和數字都是虛構的。

- `line-sim/`：LINE 操作模擬頁，已經不是網站頁面。要拍 Demo 影片或簡報截圖時，把 `staff-page.tsx` 移回 `app/line/staff/page.tsx`、`adopter-page.tsx` 移回 `app/line/adopter/page.tsx` 就能用。
- `data.ts`：虛構資料。總後台、AI 建議、資料報表目前還在使用，接上真實資料後才能移除。
- `seed.ts`：把虛構資料寫進資料庫。本機第一次啟動時會自動執行，也可以用 `npm run seed` 執行。
