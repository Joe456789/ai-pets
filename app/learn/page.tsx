import Link from "next/link";
import { DemoBanner } from "@/components/Gate";
import { Badge, PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { doneIds, LESSONS, lessonsFor, nextLesson, STAGES, type Lesson, type Timing } from "@/lib/lessons";
import { listPets, listProgress } from "@/lib/repo";
import type { LessonProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; list: Lesson[] }[] = [
  ...STAGES.map((stage) => ({ title: stage === "養之前" ? "養之前" : `${stage}期`, list: LESSONS.filter((l) => !l.season && l.stages[0] === stage) })),
  { title: "季節", list: LESSONS.filter((l) => l.season) },
];

/** 飼主小學堂。不用登入也能看全部課程；登入後依毛孩的月齡和季節推薦下一課，並記錄答過的題目。 */
export default async function LearnPage() {
  const uid = await currentUid();
  const [pets, progress] = uid ? await Promise.all([listPets(uid), listProgress(uid)]) : [[], []];
  const answered = new Map(progress.map((p) => [p.id, p]));
  const done = doneIds(progress);
  const mine = uid ? lessonsFor(pets) : null;
  const next = uid ? nextLesson(pets, progress) : null;
  const mineDone = mine ? mine.lessons.filter((l) => done.has(l.id)).length : 0;

  return (
    <>
      {uid && <DemoBanner uid={uid} />}
      <PageHead title="飼主小學堂" sub="一次一課，三分鐘讀完，附一題小測驗。依毛孩的月齡排課：疫苗、結紮這類有時機的課，時間到了就推到 LINE；平常每月一課，颱風、寒流等季節課會排在前面。" />

      {mine && (
        <section className="card stack" style={{ marginBottom: 18 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>{next ? "給你的下一課" : "現在適合你的課都上完了"}</h2>
            <span className="small muted">已完成 {mineDone} / {mine.lessons.length}</span>
          </div>
          <div className="dim-bar"><span style={{ width: `${(mineDone / Math.max(1, mine.lessons.length)) * 100}%`, background: "var(--moss)" }} /></div>
          {next ? (
            <Link className="item" href={`/learn/${next.lesson.id}`}>
              <div className="grow"><b>{next.lesson.title}</b><br /><span className="small muted">{next.why}</span></div>
              <span className="btn small primary">開始</span>
            </Link>
          ) : <p className="small muted">很棒！毛孩長大、換季時會有新的課，也可以回去複習。</p>}
        </section>
      )}

      {SECTIONS.map(({ title, list }) => (
        <section key={title} style={{ marginBottom: 18 }}>
          <h2 className="section-title">{title}</h2>
          <div className="list">
            {list.map((l) => (
              <Link className="item" key={l.id} href={`/learn/${l.id}`}>
                <div className="grow">
                  <b>{l.title}</b>{l.kind !== "都適用" && <span className="small muted">　{l.kind}</span>}
                  {l.season && <><br /><span className="small muted">{l.season.months.join("、")} 月</span></>}
                </div>
                <Status p={answered.get(l.id)} done={done.has(l.id)} t={mine?.timing.get(l.id)} />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Status({ p, done, t }: { p?: LessonProgress; done: boolean; t?: Timing }) {
  if (p && done) return <Badge tone={p.correct ? "good" : "warn"}>{p.correct ? "答對了" : "答過了"}</Badge>;
  if (t?.tier === 0) return <Badge tone="warn">正是時候</Badge>;
  if (t?.tier === 1) return <Badge tone="warn">這個季節</Badge>;
  if (t?.tier === 3) return <span className="small muted">之後再上</span>;
  return <span className="small muted">未讀</span>;
}
