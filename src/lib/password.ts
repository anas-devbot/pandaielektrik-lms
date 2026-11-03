// Polisi kata laluan untuk daftar (dan nanti tukar kata laluan). Log masuk TIDAK menguatkuasakan polisi ini,
// supaya akaun sedia ada tetap boleh log masuk. ASSUMPTION: 10 aksara ialah pilihan saya, belum disahkan Saiful.
export const PASSWORD_MIN = 10;
const PASSWORD_MAX_BYTES = 72; // had bcrypt (Supabase Auth guna bcrypt); lebih daripada ini dipotong senyap

// Senarai ringkas kata laluan lazim. ponytail: cukup untuk tangkap yang paling biasa, bukan senarai penuh.
const LEMAH = new Set([
  "password", "password1", "password123", "qwerty123", "qwertyuiop", "abc12345", "abcd1234", "letmein123",
  "iloveyou1", "welcome123", "admin12345", "katalaluan", "katalaluan1", "rahsia1234", "rahsia12345",
  "malaysia123", "malaysia1234", "pandaielektrik", "pandaielektrik1", "ahzteknik1", "ahzteknik123",
  "11111111", "00000000", "12341234", "123456789", "1234567890", "qwertyui", "asdfghjk", "zxcvbnm1",
]);

// Turutan aksara berturut-turut, cth. "12345678" atau "abcdefgh".
const berturut = (pw: string) => [...pw].every((c, i) => i === 0 || c.charCodeAt(0) === pw.charCodeAt(i - 1) + 1);

// Pulang mesej ralat (Bahasa Malaysia) jika tak lulus, atau null jika lulus.
export function periksaKataLaluan(pw: string, emel = ""): string | null {
  if (pw.length < PASSWORD_MIN) return `Kata laluan minimum ${PASSWORD_MIN} aksara.`;
  if (new TextEncoder().encode(pw).length > PASSWORD_MAX_BYTES) return "Kata laluan terlalu panjang.";
  const kecil = pw.toLowerCase();
  if (LEMAH.has(kecil) || /^(.)\1+$/.test(pw) || berturut(pw)) return "Kata laluan terlalu mudah. Cuba gabungan yang lebih rawak.";
  const bahagianEmel = emel.split("@")[0]?.toLowerCase() ?? "";
  if (bahagianEmel.length >= 4 && kecil.includes(bahagianEmel)) return "Kata laluan tidak boleh mengandungi sebahagian emel anda.";
  return null;
}

// Tanpa 0, O, 1, l, I supaya senang dibaca dan ditaip.
const HURUF = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const HAD_BAIT = 256 - (256 % HURUF.length); // buang bait melebihi ini supaya tiada bias modulo

// Jana kata laluan rawak (crypto, bukan Math.random). Berfungsi di klien dan server.
export function cadangKataLaluan(panjang = 16): string {
  let out = "";
  while (out.length < panjang) {
    const [bait] = crypto.getRandomValues(new Uint8Array(1));
    if (bait < HAD_BAIT) out += HURUF[bait % HURUF.length];
  }
  return out;
}
