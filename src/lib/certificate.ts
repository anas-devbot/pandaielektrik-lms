import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { AHZ_LOGO_JPEG_BASE64 } from "@/assets/ahz-logo";

// Susun atur mengikut contoh sijil AHZ (A4 menegak). Semua WORDING dibaca daripada courses.config.certificate
// (CLAUDE.md #12 dan: jangan reka wording sijil). Selagi certificate.wording_approved bukan true, PDF bertanda air DRAF.
export type CertData = { certId: string; type: "theory" | "theory_practical"; holderName: string; courseTitle: string; periodStart: string; periodEnd: string; verifyUrl: string; revoked: boolean };
export type CertConfig = {
  wording_approved?: boolean; issuer_name?: string; issuer_reg_no?: string; organiser?: string; address?: string[];
  signatory_name?: string; signatory_title?: string; disclaimer?: string;
  titles?: Partial<Record<CertData["type"], string>>; achievement_lines?: Partial<Record<CertData["type"], string>>;
};

const W = 595.28, H = 841.89, GOLD = rgb(0.72, 0.53, 0.04), INK = rgb(0.07, 0.07, 0.07);
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d}/${m}/${y}`; };

/** Hanya aksara yang boleh dikodkan oleh fon standard PDF (WinAnsi); selebihnya dinormalkan atau diganti. */
function safe(font: PDFFont, s: string) {
  const ok = new Set(font.getCharacterSet());
  return [...s.normalize("NFC")].map((ch) => {
    if (ok.has(ch.codePointAt(0)!)) return ch;
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return ok.has(base.codePointAt(0) ?? -1) ? base : "?";
  }).join("");
}
function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK, spacing = 0) {
  const t = safe(font, text);
  const width = font.widthOfTextAtSize(t, size) + spacing * (t.length - 1);
  let x = (W - width) / 2;
  if (!spacing) { page.drawText(t, { x, y, size, font, color }); return; }
  for (const ch of t) { page.drawText(ch, { x, y, size, font, color }); x += font.widthOfTextAtSize(ch, size) + spacing; }
}
/** Pecah teks kepada baris yang muat dalam lebar maksimum. */
function wrap(font: PDFFont, text: string, size: number, max: number) {
  const out: string[] = []; let line = "";
  for (const w of safe(font, text).split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export async function buildCertificatePdf(d: CertData, cfg: CertConfig): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${cfg.titles?.[d.type] ?? "Sijil"} ${d.certId}`); pdf.setAuthor(cfg.issuer_name ?? "AHZ"); pdf.setCreator("pandaielektrik.com");
  const page = pdf.addPage([W, H]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman), bold = await pdf.embedFont(StandardFonts.TimesRomanBold), ital = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  // hiasan: bingkai emas halus + selekoh gelap kanan atas (anggaran contoh; GANTI dengan latar asal AHZ)
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: GOLD, borderWidth: 0.8 });
  page.drawSvgPath(`M ${W * 0.58} 0 C ${W * 0.78} 30 ${W * 0.93} 80 ${W} 190 L ${W} 0 Z`, { x: 0, y: H, color: rgb(0.1, 0.1, 0.1) });
  page.drawSvgPath(`M ${W * 0.62} 0 C ${W * 0.8} 24 ${W * 0.94} 70 ${W} 168 L ${W} 150 C ${W * 0.93} 60 ${W * 0.8} 14 ${W * 0.62} 0 Z`, { x: 0, y: H, color: GOLD });

  const logo = await pdf.embedJpg(Buffer.from(AHZ_LOGO_JPEG_BASE64, "base64")); const lw = 190, lh = (lw * logo.height) / logo.width;
  page.drawImage(logo, { x: (W - lw) / 2, y: H - 36 - lh, width: lw, height: lh });

  const title = (cfg.titles?.[d.type] ?? "SIJIL").toUpperCase();
  const tlines = wrap(bold, title, 36, W - 110);
  let y = H - 36 - lh - 44;
  for (const l of tlines) { centered(page, l, y, bold, 36); y -= 44; }
  y -= 10; centered(page, "Adalah disahkan bahawa", y, bold, 10.5, INK, 1.6);
  y -= 46; centered(page, d.holderName.toUpperCase(), y, serif, 25, GOLD);
  y -= 40; centered(page, cfg.achievement_lines?.[d.type] ?? "Telah Berjaya", y, bold, 10.5, INK, 1.2);
  y -= 34; for (const l of wrap(serif, d.courseTitle, 23, W - 130)) { centered(page, l, y, serif, 23); y -= 30; }
  y -= 4; centered(page, "Pada", y, bold, 10.5, INK, 1.6);
  y -= 30; centered(page, `${fmtDate(d.periodStart)} - ${fmtDate(d.periodEnd)}`, y, serif, 21);
  y -= 34; centered(page, "Anjuran", y, bold, 10.5, INK, 1.6);
  y -= 28; centered(page, (cfg.organiser ?? cfg.issuer_name ?? "").toUpperCase(), y, serif, 19);
  y -= 24; centered(page, "Bertempat", y, bold, 10.5, INK, 1.6);
  for (const a of cfg.address ?? []) { y -= 17; centered(page, a, y, serif, 11.5); }

  // pengesahan: QR (semakan awam) di kiri, tandatangan di kanan
  const qr = await pdf.embedPng(await QRCode.toBuffer(d.verifyUrl, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" }));
  page.drawImage(qr, { x: 70, y: 92, width: 92, height: 92 });
  page.drawText(safe(serif, `ID Sijil: ${d.certId}`), { x: 70, y: 79, size: 8.5, font: bold, color: INK });
  page.drawText("Semak keaslian: imbas kod QR", { x: 70, y: 69, size: 7.5, font: ital, color: INK });
  const sx = W - 70 - 190;
  page.drawLine({ start: { x: sx, y: 118 }, end: { x: sx + 190, y: 118 }, thickness: 0.8, color: INK });
  const sl = wrap(bold, (cfg.signatory_name ?? "").toUpperCase(), 9, 190);
  let sy = 106; for (const l of sl) { page.drawText(l, { x: sx, y: sy, size: 9, font: bold, color: INK }); sy -= 11; }
  page.drawText(safe(serif, cfg.signatory_title ?? ""), { x: sx, y: sy, size: 9, font: serif, color: INK });
  if (cfg.disclaimer) { let dy = 34; for (const l of wrap(ital, cfg.disclaimer, 7, W - 150).slice(0, 3).reverse()) { centered(page, l, dy, ital, 7, rgb(0.3, 0.3, 0.3)); dy += 8.5; } }

  if (d.revoked) centered(page, "DIBATALKAN", H / 2 - 20, bold, 90, rgb(0.8, 0.1, 0.1));
  if (!cfg.wording_approved) {   // penanda air dipusatkan dan muat dalam halaman
    const wm = "DRAF: WORDING BELUM DILULUSKAN AHZ", size = 27, deg = 32, rad = (deg * Math.PI) / 180, w = bold.widthOfTextAtSize(wm, size);
    page.drawText(wm, { x: W / 2 - (w / 2) * Math.cos(rad), y: H / 2 - (w / 2) * Math.sin(rad), size, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.35, rotate: degrees(deg) });
  }
  return pdf.save();
}
