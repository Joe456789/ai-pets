import { PageHead, Stat } from "@/components/ui";
import { defaultMonthlyCap, estimateCostTwd, MODEL } from "@/lib/ai/gemini";
import { aiCapOf } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth";
import { platformOverview } from "@/lib/insights";

export default async function Usage() {
  await requireAdmin();
  const o = await platformOverview();
  const rows = [
    ...o.usageRows.map((u) => ({ name: u.s.name, calls: u.calls ?? 0, i: u.inputTokens ?? 0, out: u.outputTokens ?? 0, cap: aiCapOf(u.s), v: u.videoTokens ?? 0, clips: u.videoClips ?? 0 })),
    { name: "公開網站（媒合說明）", calls: o.platformUsage.calls ?? 0, i: o.platformUsage.inputTokens ?? 0, out: o.platformUsage.outputTokens ?? 0, cap: defaultMonthlyCap(), v: o.platformUsage.videoTokens ?? 0, clips: o.platformUsage.videoClips ?? 0 },
  ];
  return (
    <>
      <PageHead title="AI 用量與成本" sub={`模型 ${MODEL()}。每家協會有每月呼叫上限，超過就停止呼叫，避免費用失控。`} />
      <div className="stats">
        <Stat label="本月呼叫次數" value={o.aiCalls.toLocaleString()} />
        <Stat label="本月費用（估算）" value={`NT$${o.aiCostTwd.toFixed(1)}`} hint="依 token 數與牌價估算，實際以 Google 帳單為準" />
      </div>
      <section className="card table-wrap">
        <table>
          <thead><tr><th>對象</th><th className="num">呼叫次數</th><th className="num">輸入 token</th><th className="num">輸出 token</th><th className="num">AI 影片</th><th className="num">估算費用</th><th>上限使用比例</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const pct = Math.min(100, Math.round((r.calls / r.cap) * 100));
              return (
                <tr key={r.name}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{r.calls.toLocaleString()}</td>
                  <td className="num">{r.i.toLocaleString()}</td>
                  <td className="num">{r.out.toLocaleString()}</td>
                  <td className="num">{r.clips} 段</td>
                  <td className="num">NT${estimateCostTwd(r.i, r.out, r.v).toFixed(2)}</td>
                  <td><div className="row" style={{ flexWrap: "nowrap" }}><div className="usage" style={{ flex: 1 }}><i style={{ width: `${pct}%` }} /></div><span className="small">{pct}%</span></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
