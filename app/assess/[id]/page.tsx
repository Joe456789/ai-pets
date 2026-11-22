import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { ReportView } from "@/components/ReportView";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { lifetimeCost } from "@/lib/lifetimeCost";
import { costProfileOf } from "@/lib/readiness";
import { getAssessment } from "@/lib/repo";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SavedReport({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="看你的評估報告" />;
  const a = await getAssessment(uid, (await params).id);
  if (!a) notFound();
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title="飼養前評估報告" sub={`${fmtDate(a.at)} 的評估`} action={<Link className="btn small" href="/assess">重新評估</Link>} />
      <ReportView result={a.result} cost={lifetimeCost(costProfileOf(a.result.fit))} report={a.report} />
    </>
  );
}
