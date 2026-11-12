import { AuthShell } from "@/components/auth";

export default function Page() {
  return (
    <AuthShell title="Semak emel anda" lead="Kami telah menghantar pautan pengesahan. Klik pautan itu, kemudian log masuk.">
      <p className="text-sm text-muted">Tidak nampak emel? Semak juga folder spam.</p>
    </AuthShell>
  );
}
