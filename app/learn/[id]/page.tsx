import Link from "next/link";
import { notFound } from "next/navigation";
import { Quiz } from "@/components/Quiz";
import { Notice, PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { LESSONS, lessonById, quizOf } from "@/lib/lessons";
import { listProgress } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const lesson = lessonById((await params).id);
  if (!lesson) notFound();
  const uid = await currentUid();
  const prev = uid ? (await listProgress(uid)).find((p) => p.id === lesson.id) : undefined;
  const quiz = quizOf(lesson);
  const i = LESSONS.indexOf(lesson);
  const after = LESSONS[i + 1];

  return (
    <>
      <PageHead
        title={lesson.title}
        sub={`適合：${lesson.stages.map((s) => (s === "養之前" ? s : `${s}期`)).join("、")}${lesson.kind === "都適用" ? "" : `的${lesson.kind}`}`}
        action={<Link className="btn small" href="/learn">回小學堂</Link>}
      />
      <section className="card" style={{ marginBottom: 14 }}>
        <ul className="points lesson-points">{lesson.points.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <Quiz lessonId={lesson.id} q={quiz.q} options={quiz.options} before={prev ? prev.correct : undefined} />
      {after && (
        <Link className="item" href={`/learn/${after.id}`} style={{ marginTop: 14 }}>
          <div className="grow"><span className="small muted">下一課</span><br /><b>{after.title}</b></div>
          <span aria-hidden>›</span>
        </Link>
      )}
      <div style={{ marginTop: 16 }}><Notice /></div>
    </>
  );
}
