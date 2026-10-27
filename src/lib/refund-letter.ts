import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { safe, wrap, type CertConfig } from "@/lib/certificate";

// Surat permohonan refund: DRAF asas, MESTI disemak AHZ (CLAUDE.md bahagian 8). Tidak memutuskan jumlah pemulangan. Butiran akaun bank ditulis tangan oleh pelajar (TIDAK disimpan dalam sistem).
// Tiada No. KP. Wording tambahan daripada courses.config.refund_letter; DRAF watermark selagi refund_letter.approved bukan true.
export type LetterData = { requestId: string; holderName: string; email: string; orderNumber: string; paidAt: string; amountSen: number; currency: string;
  courseTitle: string; requestedAt: string; reason: string | null };
export type LetterConfig = { approved?: boolean; statement?: string };

const W = 595.28, H = 841.89, INK = rgb(0.07, 0.07, 0.07);
const dmy = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

export async function buildRefundLetter(d: LetterData, cfg: LetterConfig, cert: CertConfig): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); pdf.setTitle(`Surat permohonan refund ${d.requestId.slice(0, 8)}`);
  const page = pdf.addPage([W, H]);
  const f = await pdf.embedFont(StandardFonts.TimesRoman), b = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const issuer = cert.issuer_name ?? "AHZ";
  let y = H - 70;
  const line = (text: string, size = 11.5, font = f, x = 70) => { for (const l of wrap(font, text, size, W - 140 - (x - 70))) { page.drawText(l, { x, y, size, font, color: INK }); y -= size + 5; } };
  page.drawText(safe(b, "SURAT PERMOHONAN REFUND"), { x: (W - b.widthOfTextAtSize("SURAT PERMOHONAN REFUND", 18)) / 2, y, size: 18, font: b, color: INK }); y -= 40;
  line(`Kepada: ${issuer}`, 12, b); y -= 8;
  const rows: [string, string][] = [
    ["Nama pelajar", d.holderName], ["Emel akaun", d.email], ["Kursus", d.courseTitle], ["No. order", d.orderNumber], ["Tarikh bayaran", dmy(d.paidAt)],
    ["Jumlah dibayar", `${d.currency} ${(d.amountSen / 100).toFixed(2)}`], ["Tarikh permohonan", dmy(d.requestedAt)], ["Rujukan permohonan", d.requestId.slice(0, 8).toUpperCase()],
  ];
  for (const [k, v] of rows) { page.drawText(safe(b, k), { x: 70, y, size: 11.5, font: b, color: INK }); page.drawText(safe(f, v), { x: 215, y, size: 11.5, font: f, color: INK }); y -= 20; }
  y -= 8; if (d.reason) { line("Sebab (jika ada):", 11.5, b); line(d.reason); y -= 6; }
  line(cfg.statement ?? `Saya memohon refund bagi pendaftaran di atas. Saya faham permohonan ini tertakluk kepada terma dan syarat yang saya setujui semasa pembayaran. Jumlah yang dipulangkan (jika ada) ditentukan oleh ${issuer} mengikut terma tersebut.`);
  y -= 6;
  line("Saya faham bahawa jika refund diluluskan, akses saya kepada kursus akan ditutup dan sijil yang telah dikeluarkan (jika ada) akan dibatalkan.");
  y -= 8; line("Butiran akaun bank untuk pemulangan (diisi tulis tangan):", 11.5, b);
  for (const lbl of ["Nama bank", "No. akaun", "Nama pemegang akaun"]) { page.drawText(lbl, { x: 70, y, size: 11, font: f, color: INK }); page.drawLine({ start: { x: 215, y: y - 2 }, end: { x: 525, y: y - 2 }, thickness: 0.6, color: INK }); y -= 24; }
  y -= 24;
  page.drawLine({ start: { x: 70, y }, end: { x: 270, y }, thickness: 0.8, color: INK }); page.drawLine({ start: { x: 330, y }, end: { x: 525, y }, thickness: 0.8, color: INK });
  y -= 14; page.drawText("Tandatangan pelajar", { x: 70, y, size: 10, font: f, color: INK }); page.drawText("Tarikh", { x: 330, y, size: 10, font: f, color: INK });
  y -= 40; line("Arahan: cetak, tandatangan, kemudian ambil foto atau imbas surat ini dan muat naik di halaman Refund dalam akaun anda.", 9.5, f);
  if (!cfg.approved) {
    const wm = "DRAF: BELUM DILULUSKAN AHZ", size = 38, deg = 32, rad = (deg * Math.PI) / 180, w = b.widthOfTextAtSize(wm, size);
    page.drawText(wm, { x: W / 2 - (w / 2) * Math.cos(rad), y: H / 2 - (w / 2) * Math.sin(rad), size, font: b, color: rgb(0.85, 0.2, 0.2), opacity: 0.3, rotate: degrees(deg) });
  }
  return pdf.save();
}
