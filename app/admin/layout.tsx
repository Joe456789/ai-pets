import { adminLogoutAction } from "@/app/login/admin/actions";
import { SideNav } from "@/components/SideNav";
import { requireAdmin } from "@/lib/auth";
import { listAiLogs } from "@/lib/platform";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const logs = await listAiLogs(100);
  const items = [
    { href: "/admin", label: "全平台總覽" },
    { href: "/admin/shelters", label: "協會管理" },
    { href: "/admin/usage", label: "AI 用量與成本" },
    { href: "/admin/billing", label: "訂閱與收費" },
    { href: "/admin/ai-logs", label: "AI 回覆紀錄", count: logs.filter((l) => l.state === "已攔截").length },
    { href: "/admin/system", label: "系統狀態" },
    { href: "/admin/audit", label: "操作紀錄" },
    { href: "/admin/announcements", label: "全平台公告" },
  ];
  return (
    <div className="app">
      <SideNav brand="浪浪夥伴" who={`平台總後台・${admin.name}`} items={items} base="/admin" variant="admin" footer={<form action={adminLogoutAction}><button>登出</button></form>} />
      <main className="main">{children}</main>
    </div>
  );
}
