import Link from "next/link";
import { notFound } from "next/navigation";
import { quizContext, rpc } from "@/lib/quiz";
import StartForm from "../../start-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(chapterId)) notFound();
  const { course } = await quizContext();
  const db = rpc();
  const { data: ch } = await db.from("chapters").select("id, position, title").eq("id", chapterId).eq("course_id", course.id).maybeSingle();
  if (!ch) notFound();
  const { count } = await db.from("quiz_questions").select("*", { count: "exact", head: true }).eq("chapter_id", ch.id).eq("type", "practice");
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link className="text-sm underline" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Kuiz latihan: Bab {ch.position}</h1>
      <p className="mt-1">{ch.title}</p>
      {count ? (<>
        <p className="mt-2 text-sm">{count} soalan. Latihan tidak menghalang dan boleh diulang. Jawapan dan penjelasan dipaparkan selepas anda hantar.</p>
        <StartForm type="practice" chapter={ch.id} label="Mula latihan" />
      </>) : <p className="mt-2 text-sm">Soalan latihan untuk bab ini belum tersedia.</p>}
    </main>
  );
}
