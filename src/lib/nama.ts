// Nama penuh akan dipaparkan pada sijil, jadi mesti nama sebenar: sekurang-kurangnya dua perkataan, huruf sahaja.
const CORAK = /^\p{L}[\p{L}'.\- ]*$/u;

export function normalNamaPenuh(nama: string): string {
  return nama.trim().replace(/\s+/g, " ");
}

/** Pulang mesej ralat, atau null jika nama sah. */
export function periksaNamaPenuh(nama: string): string | null {
  const bersih = normalNamaPenuh(nama);
  if (bersih.length < 3 || bersih.length > 100) return "Sila isi nama penuh (3 hingga 100 aksara).";
  if (!CORAK.test(bersih)) return "Nama hanya boleh ada huruf, ruang, titik, sempang dan apostrof.";
  if (bersih.split(" ").length < 2) return "Sila isi nama penuh (sekurang-kurangnya dua perkataan).";
  return null;
}
