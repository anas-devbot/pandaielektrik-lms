import { redirect } from "next/navigation";
import { getCourse, rm } from "@/lib/course";
import { getProfile } from "@/lib/auth";
import { salesOpen } from "@/lib/sales";
import BeliForm from "./form";

export default async function Page() {
  const p = await getProfile();
  if (!p) redirect("/log-masuk?next=%2Fbeli");
  if (!salesOpen(p.email)) redirect("/");
  const course = await getCourse();
  if (!course) redirect("/");
  const sla = (course.config as Record<string, number>).sla_business_days;
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">{course.title}</h1>
      <p className="mt-2 text-xl">{rm(course.price)} <span className="text-sm">seluruh program</span></p>
      <p className="mt-1 text-sm">Akaun: {p.email}</p>
      <BeliForm sla={sla} />
    </main>
  );
}
