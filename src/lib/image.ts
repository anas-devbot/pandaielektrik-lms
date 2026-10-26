import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";

// Skematik: terima JPEG/PNG/HEIC (default iPhone), jenis disahkan melalui BYTE AWAL (bukan nama atau MIME dari klien),
// keluaran sentiasa JPEG: HEIC ditukar di server, orientasi EXIF dilaraskan, SEMUA metadata (GPS dsb.) dibuang.
export type Normalized = { ok: true; jpeg: Buffer; width: number; height: number } | { ok: false; error: "too_large" | "bad_type" | "unreadable" };

export function sniff(b: Buffer): "jpeg" | "png" | "heic" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(b.subarray(8, 12).toString("latin1"))) return "heic";
  return null;
}

const MAX_PIXELS = 50_000_000; // elak "decompression bomb"

export async function normalizeSchematic(input: Buffer, maxBytes: number): Promise<Normalized> {
  if (input.length > maxBytes) return { ok: false, error: "too_large" };
  const kind = sniff(input);
  if (!kind) return { ok: false, error: "bad_type" };
  try {
    const src = kind === "heic" ? Buffer.from(await heicConvert({ buffer: input, format: "JPEG", quality: 0.9 })) : input;
    const { data, info } = await sharp(src, { limitInputPixels: MAX_PIXELS }).rotate().jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    return { ok: true, jpeg: data, width: info.width, height: info.height };
  } catch {
    return { ok: false, error: "unreadable" };
  }
}
