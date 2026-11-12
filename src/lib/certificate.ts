import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { AHZ_LOGO_JPEG_BASE64 } from "@/assets/ahz-logo";
import { SIJIL_LATAR_JPEG_BASE64 } from "@/assets/sijil-latar";
import { SIJIL_TANDATANGAN_PNG_BASE64 } from "@/assets/sijil-tandatangan";

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
export function safe(font: PDFFont, s: string) {
  const ok = new Set(font.getCharacterSet());
  return [...s.normalize("NFC")].map((ch) => {
    if (ok.has(ch.codePointAt(0)!)) return ch;
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return ok.has(base.codePointAt(0) ?? -1) ? base : "?";
  }).join("");
}
function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK, spacing = 0, cx = W / 2) {
  const t = safe(font, text);
  const width = font.widthOfTextAtSize(t, size) + spacing * (t.length - 1);
  let x = cx - width / 2;
  if (!spacing) { page.drawText(t, { x, y, size, font, color }); return; }
  for (const ch of t) { page.drawText(ch, { x, y, size, font, color }); x += font.widthOfTextAtSize(ch, size) + spacing; }
}
/** Pecah teks kepada baris yang muat dalam lebar maksimum. */
export function wrap(font: PDFFont, text: string, size: number, max: number) {
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

  // latar: bingkai, selekoh, garis tandatangan dan lencana sudah ada dalam imej latar kosong AHZ
  const latar = await pdf.embedJpg(Buffer.from(SIJIL_LATAR_JPEG_BASE64, "base64"));
  page.drawImage(latar, { x: 0, y: 0, width: W, height: H });

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
  y -= 24;   // alamat kekal tanpa label "Bertempat" (keputusan Bos)
  for (const a of cfg.address ?? []) { y -= 17; centered(page, a, y, serif, 11.5); }

  // pengesahan: QR (semakan awam) di kiri, atas lencana. Tandatangan di bawah garis latar (x 370-463, y 119).
  // Disclaimer di tengah-bawah antara lencana (kiri) dan ornamen (kanan); koordinat diukur daripada latar AHZ.
  const SIG_CX = (370 + 463) / 2, DISC_CX = 320;
  const qr = await pdf.embedPng(await QRCode.toBuffer(d.verifyUrl, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" }));
  page.drawImage(qr, { x: 40, y: 175, width: 92, height: 92 });
  page.drawText(safe(serif, `ID Sijil: ${d.certId}`), { x: 40, y: 163, size: 8.5, font: bold, color: INK });
  // URL semakan penuh (token) dicetak supaya sijil yang tak boleh diimbas masih boleh disahkan
  page.drawText(safe(ital, `Semak: ${d.verifyUrl.replace(/^https?:\/\//, "")}`), { x: 40, y: 153, size: 7.5, font: ital, color: INK });
  const ttd = await pdf.embedPng(Buffer.from(SIJIL_TANDATANGAN_PNG_BASE64, "base64"));
  const ttdW = 110, ttdH = (ttdW * ttd.height) / ttd.width;
  page.drawImage(ttd, { x: SIG_CX - ttdW / 2, y: 121, width: ttdW, height: ttdH });   // di atas garis latar
  let sy = 106; for (const l of wrap(bold, (cfg.signatory_name ?? "").toUpperCase(), 9, 200)) { centered(page, l, sy, bold, 9, INK, 0, SIG_CX); sy -= 11; }
  centered(page, cfg.signatory_title ?? "", sy, serif, 9, INK, 0, SIG_CX);
  if (cfg.disclaimer) { let dy = 50; for (const l of wrap(ital, cfg.disclaimer, 7, 280).slice(0, 3).reverse()) { centered(page, l, dy, ital, 7, rgb(0.3, 0.3, 0.3), 0, DISC_CX); dy += 8.5; } }

  if (d.revoked) centered(page, "DIBATALKAN", H / 2 - 20, bold, 90, rgb(0.8, 0.1, 0.1));
  if (!cfg.wording_approved) {   // penanda air dipusatkan dan muat dalam halaman
    const wm = "DRAF: WORDING BELUM DILULUSKAN AHZ", size = 27, deg = 32, rad = (deg * Math.PI) / 180, w = bold.widthOfTextAtSize(wm, size);
    page.drawText(wm, { x: W / 2 - (w / 2) * Math.cos(rad), y: H / 2 - (w / 2) * Math.sin(rad), size, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.35, rotate: degrees(deg) });
  }
  return pdf.save();
}
