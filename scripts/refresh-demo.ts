// 把示範資料的日期更新到今天（收容天數、疫苗到期、照護回報、申請與訊息時間、歷史領養）。
// 用法：npm run demo:refresh。也可以在平台總後台「系統狀態」頁按按鈕執行。
import { refreshDemoDates } from "@/demo/seed";

refreshDemoDates()
  .then((n) => { console.log(`已更新 ${n} 隻示範動物和相關紀錄的日期`); process.exit(0); })
  .catch((e) => { console.error((e as Error).message); process.exit(1); });
