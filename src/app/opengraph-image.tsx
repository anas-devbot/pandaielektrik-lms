import { ImageResponse } from "next/og";
import { getLanding } from "@/lib/course";
import { FRAUNCES_B64, SOURCE_SANS_B64 } from "@/assets/og-fonts";
import { MASCOT_PNG_B64 } from "@/assets/og-mascot";

// Gambar pratonton pautan (WhatsApp, Facebook, Telegram, X): 1200x630. Tajuk kursus dibaca dari DB supaya sentiasa sepadan dengan landing.
export const alt = "Pandai Elektrik: kursus elektrik AHZ Teknik";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

const buf = (b64: string) => Buffer.from(b64, "base64");

export default async function Image() {
  const { courses } = await getLanding();
  const title = courses.find((c) => c.slug === "kursus-elektrik")?.title ?? "Kursus elektrik";
  const iconSrc = `data:image/png;base64,${MASCOT_PNG_B64}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf9f6", padding: "64px 72px", borderTop: "14px solid #c9a227", color: "#161616" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={iconSrc} width={84} height={84} alt="" style={{ borderRadius: 42, border: "4px solid #c9a227" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Fraunces", fontSize: 40, lineHeight: 1.1 }}>Pandai Elektrik</div>
            <div style={{ fontFamily: "Source Sans 3", fontSize: 26, color: "#5c5a55" }}>AHZ Teknik</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontFamily: "Fraunces", fontSize: title.length > 40 ? 68 : 78, lineHeight: 1.1, maxWidth: 1050 }}>{title}</div>
          <div style={{ fontFamily: "Source Sans 3", fontSize: 38, color: "#5c5a55", maxWidth: 980 }}>Belajar sendiri ikut masa anda, bersama AHZ Teknik</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Source Sans 3", fontSize: 28, color: "#8a6a00" }}>pandaielektrik.com</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: buf(FRAUNCES_B64), weight: 600, style: "normal" }, { name: "Source Sans 3", data: buf(SOURCE_SANS_B64), weight: 400, style: "normal" }] },
  );
}
