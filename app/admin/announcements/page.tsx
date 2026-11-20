import { deleteAnnouncementAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/ActionButton";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { PageHead } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAnnouncements } from "@/lib/platform";
import { fmtDateTime } from "@/lib/time";

export default async function Announcements() {
  await requireAdmin();
  const list = await listAnnouncements();
  return (
    <>
      <PageHead title="全平台公告" sub="最新 3 則會顯示在所有協會後台的總覽頁。" />
      <div className="grid-even">
        <AnnouncementForm />
        <section className="card">
          <h2>已發布</h2>
          {list.length === 0 && <p className="small muted">還沒有公告。</p>}
          {list.map((a) => (
            <div className="todo" key={a.id}>
              <span>{a.text}<br /><span className="small muted">{fmtDateTime(a.at)}</span></span>
              <ActionButton small label="刪除" confirm="確定刪除這則公告？" run={deleteAnnouncementAction.bind(null, a.id)} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
