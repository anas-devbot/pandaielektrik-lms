// Guna: node scripts/r2-upload.mjs <fail> [key]. Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const [file, key = `db/${basename(process.argv[2] ?? "")}`] = process.argv.slice(2);
const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BACKUP_BUCKET"];
const missing = need.filter((n) => !process.env[n]);
if (!file || missing.length) { console.error("Guna: r2-upload.mjs <fail>; env tiada:", missing.join(", ")); process.exit(2); }

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const Bucket = process.env.R2_BACKUP_BUCKET;
const Body = readFileSync(file);
await s3.send(new PutObjectCommand({ Bucket, Key: key, Body }));
// Sahkan objek wujud dan saiz sepadan sebelum lapor berjaya.
const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
if (head.ContentLength !== Body.length) { console.error("Saiz tak sepadan selepas upload"); process.exit(1); }
console.log(`upload ok: ${Bucket}/${key} (${Body.length} bait)`);
