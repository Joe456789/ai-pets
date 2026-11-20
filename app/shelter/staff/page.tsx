import { StaffPanel } from "@/components/StaffPanel";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { limitText, staffQuota } from "@/lib/plans";
import { getShelter, listStaff } from "@/lib/repo";

export default async function Staff() {
  const { sid } = await requireManager();
  const [staff, shelter] = await Promise.all([listStaff(sid), getShelter(sid)]);
  const quota = await staffQuota(shelter!);
  return (
    <>
      <PageHead title="人員與工作號" sub="每位現場人員有一組專屬工作號，在 LINE 傳送後綁定身分。每組工作號只能綁定一個 LINE 帳號，停用後立刻失效。" />
      <p className={quota.full ? "notice" : "small muted"} style={{ marginBottom: 12 }}>
        {shelter!.plan}方案的工作號：使用中 {quota.used} / {limitText(quota.limit)}{quota.full ? "，已達上限。可以先停用不用的工作號，或請平台升級方案。" : ""}
      </p>
      <StaffPanel staff={staff.sort((a, b) => Number(a.disabled) - Number(b.disabled))} areas={shelter?.areas ?? []} />
    </>
  );
}
