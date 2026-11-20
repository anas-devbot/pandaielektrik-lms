// Senarai bank untuk borang (klien dan server). TANPA node:crypto: boleh dibundel ke klien.
// ASSUMPTION: senarai bank ringkas (bank komersial/Islam/koperasi utama). Semak dengan AHZ sebelum launch.
export const BANK_LIST = [
  "Affin Bank", "Agrobank", "Alliance Bank", "AmBank", "Bank Islam", "Bank Muamalat", "Bank Rakyat",
  "Bank Simpanan Nasional (BSN)", "CIMB Bank", "Hong Leong Bank", "HSBC Bank Malaysia", "Maybank",
  "OCBC Bank (Malaysia)", "Public Bank", "RHB Bank", "Standard Chartered Malaysia", "UOB Malaysia",
] as const;
