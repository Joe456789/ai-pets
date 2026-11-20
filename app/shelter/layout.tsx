import { logoutAction } from "@/app/login/shelter/actions";
import { SideNav } from "@/components/SideNav";
import { requireManager } from "@/lib/auth";
import { planExpired, trialExpired } from "@/lib/plans";
import { getShelter, listApplications, listConversations } from "@/lib/repo";
import { listPledges } from "@/lib/supplies";

export default async function ShelterLayout({ children }: { children: React.ReactNode }) {
  const { sid, name } = await requireManager();
  const [shelter, apps, convs, pledges] = await Promise.all([getShelter(sid), listApplications(sid), listConversations(sid), listPledges(sid)]);
  const items = [
    { href: "/shelter", label: "總覽" },
    { href: "/shelter/animals", label: "動物管理" },
    { href: "/shelter/content", label: "送養內容" },
    { href: "/shelter/applications", label: "領養申請", count: apps.filter((a) => a.status === "待審核").length },
    { href: "/shelter/suggestions", label: "AI 建議" },
    { href: "/shelter/messages", label: "領養人訊息", count: convs.filter((c) => c.status === "待處理").length },
    { href: "/shelter/supplies", label: "物資需求", count: pledges.filter((p) => p.status === "待確認").length },
    { href: "/shelter/staff", label: "人員與工作號" },
    { href: "/shelter/reports", label: "資料報表" },
    { href: "/shelter/settings", label: "協會與 LINE 設定" },
  ];
  return (
    <div className="app">
      <SideNav
        brand={shelter?.name ?? "協會"} who={`管理者 ${name}`} items={items} base="/shelter" variant="shelter"
        footer={<form action={logoutAction}><button>登出</button></form>}
      />
      <main className="main">
        {shelter && trialExpired(shelter) && <p className="error-box" style={{ marginBottom: 14 }}>試用期已於 {shelter.due} 結束，AI 功能已暫停，其他資料都保留著。請聯絡平台管理者開通正式方案。</p>}
        {shelter && !trialExpired(shelter) && planExpired(shelter) && <p className="notice" style={{ marginBottom: 14 }}>{shelter.plan}方案已於 {shelter.due} 到期，服務仍可使用，請聯絡平台管理者續約。</p>}
        {children}
      </main>
    </div>
  );
}
