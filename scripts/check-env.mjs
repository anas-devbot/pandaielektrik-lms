// Gagal build jika rahsia bernama NEXT_PUBLIC_* (akan bocor ke bundle klien).
import { readFileSync, existsSync } from "node:fs";
const bad = /^NEXT_PUBLIC_\w*(SERVICE_ROLE|SECRET|PRIVATE)\w*$/;
const names = new Set(Object.keys(process.env));
for (const f of [".env.example", ".env.local", ".env.production"])
  if (existsSync(f))
    for (const l of readFileSync(f, "utf8").split("\n")) names.add(l.split("=")[0].trim());
const hit = [...names].filter((n) => bad.test(n));
if (hit.length) { console.error("RAHSIA dalam NEXT_PUBLIC_*:", hit.join(", ")); process.exit(1); }
