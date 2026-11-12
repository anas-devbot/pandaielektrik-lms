import "server-only";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Bucket PDF/penghantaran R2 PRIVATE (CLAUDE.md #7). Dihidang HANYA melalui signed URL jangka pendek selepas semak enrollment.
export async function signedGetUrl(key: string, filename: string, inline = false) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2_* tiada dalam env");
  const s3 = new S3Client({
    region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  const ttl = Number(process.env.R2_SIGNED_URL_TTL_SEC ?? 60); // ASSUMPTION: 60s belum disahkan
  const safe = filename.replace(/[^\w.\- ]+/g, "_");
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: R2_BUCKET, Key: key, ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename="${safe}"`,
  }), { expiresIn: ttl });
}

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
function client() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2_* tiada dalam env");
  return { s3: new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } }), Bucket: R2_BUCKET };
}
export async function r2Put(key: string, body: Buffer, contentType: string) {
  const { s3, Bucket } = client();
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
}
export async function r2Delete(key: string) {
  const { s3, Bucket } = client();
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
// Baca objek di server (contoh: poster kursus). Bucket kekal privat; tiada URL R2 didedahkan.
export async function r2Get(key: string): Promise<Buffer> {
  const { s3, Bucket } = client();
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("objek kosong");
  return Buffer.from(bytes);
}
