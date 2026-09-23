/**
 * M1 — Suara manusia untuk hitung mundur (count-off).
 *
 * Memakai **Web Speech API** yang sudah ada di browser, jadi:
 * - tidak menambah ukuran aplikasi sedikit pun (tidak ada berkas audio),
 * - tetap jalan offline, termasuk di berkas portabel `DrillKit.html`.
 *
 * Keterbatasan yang perlu diketahui (dan sengaja tidak disembunyikan):
 * - **Ucapannya tidak bisa dijadwalkan sepresisi Web Audio.** Ada jeda
 *   antara permintaan dan bunyi, biasanya 50–200 ms tergantung perangkat.
 * - Karena itu ucapan hanya dipakai sebagai **lapisan** di atas hitung
 *   mundur. Yang menentukan tempo tetap bunyi klik yang dijadwalkan Web
 *   Audio, dan **ketukan pertama lagu selalu presisi**.
 * - Kalau perangkat tidak punya suara (sering terjadi di Linux), kelas ini
 *   diam saja dan bunyi klik tetap jalan — pemakai tidak melihat error.
 */

/** Nada dasar untuk memilih suara; tidak dipakai untuk apa pun selain preferensi. */
let pilihanSuara: SpeechSynthesisVoice | null = null

/** Apakah speech synthesis tersedia di perangkat ini. */
export function bisaUcap(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}

/**
 * Daftar suara yang tersedia. Boleh dipanggil berulang — di beberapa browser
 * daftarnya baru terisi setelah panggilan pertama.
 */
export function daftarSuara(): SpeechSynthesisVoice[] {
  if (!bisaUcap()) return []
  try {
    return window.speechSynthesis.getVoices() ?? []
  } catch {
    return []
  }
}

/** Simpan pilihan suara (objek `SpeechSynthesisVoice`, bukan sekadar nama). */
export function pilihSuara(v: SpeechSynthesisVoice | null) {
  pilihanSuara = v
}

/** Suara yang sedang dipilih, atau `null` kalau pakai bawaan browser. */
export function suaraDipilih(): SpeechSynthesisVoice | null {
  return pilihanSuara
}

/**
 * Ucapkan satu frasa. Mengembalikan `true` kalau permintaan terkirim.
 *
 * Ucapan sebelumnya dibatalkan dulu — penting saat tempo cepat, supaya
 * antrean ucapan tidak menumpuk dan tertinggal dari ketukannya.
 */
export function ucap(teks: string, opsi?: { laju?: number; nada?: number; volume?: number }): boolean {
  if (!bisaUcap()) return false
  try {
    // Batalkan sisa ucapan lama agar tidak menumpuk.
    window.speechSynthesis.cancel()
    const u = new window.SpeechSynthesisUtterance(teks)
    u.rate = Math.min(2, Math.max(0.5, opsi?.laju ?? 1.15))
    u.pitch = Math.min(2, Math.max(0, opsi?.nada ?? 1.25))
    u.volume = Math.min(1, Math.max(0, opsi?.volume ?? 1))
    if (pilihanSuara) u.voice = pilihanSuara
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

/** Hentikan semua ucapan yang masih berjalan. */
export function diam() {
  if (!bisaUcap()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // abaikan
  }
}

/**
 * Ucapkan angka untuk hitung mundur. Angka 1–99 ditulis apa adanya; sisanya
 * ditulis angkanya juga (browser cukup pintar membaca angka).
 */
export function ucapAngka(n: number): boolean {
  return ucap(String(n))
}
