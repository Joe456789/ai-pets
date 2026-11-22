import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeView } from "@/components/ChangeView";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { getChange } from "@/lib/repo";
import { fmtDate, taipeiDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SavedChange({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="看你的生活變動準備清單" />;
  const c = await getChange(uid, (await params).id);
  if (!c) notFound();
  const remindOn = c.remindOn && c.remindOn >= taipeiDate() ? c.remindOn : null;
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead
        title="生活變動準備清單"
        sub={`${fmtDate(c.at)} 做的檢查・${c.answers.when}${c.answers.date ? `（${c.answers.date.replaceAll("-", "/")}）` : ""}`}
        action={<Link className="btn small" href={c.petId ? `/change?pet=${c.petId}` : "/change"}>再做一次</Link>}
      />
      <ChangeView plan={c.plan} petName={c.petName} change={c.answers.change} aiNote={c.aiNote} remindOn={remindOn} />
    </>
  );
}
