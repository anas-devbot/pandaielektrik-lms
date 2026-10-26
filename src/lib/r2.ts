import "server-only";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Bucket PDF/penghantaran R2 PRIVATE (CLAUDE.md #7). Dihidang HANYA melalui signed URL jangka pendek selepas semak enrollment.
export async function signedGetUrl(key: string, filename: string) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2_* tiada dalam env");
  const s3 = new S3Client({
    region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  const ttl = Number(process.env.R2_SIGNED_URL_TTL_SEC ?? 60); // ASSUMPTION: 60s belum disahkan
  const safe = filename.replace(/[^\w.\- ]+/g, "_");
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: R2_BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${safe}"`,
  }), { expiresIn: ttl });
}
