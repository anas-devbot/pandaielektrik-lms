import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { r2Put, r2Delete, signedGetUrl } from "@/lib/r2";

// Fail penghantaran: R2 PRIVATE (CLAUDE.md #7). STORAGE_DRIVER=local hanya untuk dev/ujian tanpa R2 dan DITOLAK di produksi.
const isLocal = () => {
  if (process.env.STORAGE_DRIVER !== "local") return false;
  if (process.env.NODE_ENV === "production") throw new Error("STORAGE_DRIVER=local tidak dibenarkan di produksi");
  return true;
};
const localPath = (key: string) => {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage");
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error("kunci tidak sah");
  return p;
};

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (isLocal()) { const p = localPath(key); await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, body); return; }
  await r2Put(key, body, contentType);
}
export async function deleteObject(key: string) {
  if (isLocal()) { await unlink(localPath(key)).catch(() => {}); return; }
  await r2Delete(key);
}
/** Muat turun PDF (sijil): local = bait terus (dev); R2 = redirect ke signed URL jangka pendek (attachment). */
export async function downloadObject(key: string, filename: string): Promise<{ bytes: Buffer } | { redirect: string }> {
  if (isLocal()) return { bytes: await readFile(localPath(key)) };
  return { redirect: await signedGetUrl(key, filename, false) };
}
/** Paparan imej: local = bait terus (dev); R2 = redirect ke signed URL jangka pendek. */
export async function viewObject(key: string): Promise<{ bytes: Buffer } | { redirect: string }> {
  if (isLocal()) return { bytes: await readFile(localPath(key)) };
  return { redirect: await signedGetUrl(key, "skematik.jpg", true) };
}
