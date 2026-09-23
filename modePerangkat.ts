/**
 * Mode perangkat: **pelatih** atau **anggota**.
 *
 * Permintaan yang memicunya: *"aku mau mode anggota tidak bisa masuk mode
 * pelatih."*
 *
 * Tiga jalan keluar yang harus ditutup, dan hanya yang pertama yang kentara:
 *
 * 1. **Tombol "Kembali ke mode pelatih"** — jalan yang paling jelas.
 * 2. **Rute pelatih lewat URL langsung** — menu sudah disaring, tetapi
 *    mengetik `#/anggota` di bilah alamat tetap membuka halamannya.
 *    Menyaring menu tanpa menjaga rutenya seperti menggembok pintu depan
 *    sambil membiarkan jendela terbuka.
 * 3. **Menyunting `localStorage`** — **tidak bisa dicegah**, dan harus
 *    dikatakan terus terang. Mode disimpan di `localStorage`, yang bisa
 *    dibuka siapa pun lewat perkakas pengembang peramban.
 *
 * Karena itu modul ini adalah **pagar antarmuka, bukan pengaman**. Ia
 * menghentikan anggota yang *tidak sengaja* tersasar — bukan anggota yang
 * sengaja membongkar. Menyebutnya pengaman akan memberi rasa aman palsu,
 * persis seperti cacat penyaringan tampilan pada berkas berbagi.
 *
 * ### Mengapa tanpa PIN tidak dikunci
 *
 * Aturan `bolehKePelatih` mengizinkan kembali **bila belum ada PIN**.
 * Sengaja: kalau mode anggota dikunci tanpa ada PIN, pelatih yang mencoba
 * mode ini di perangkatnya sendiri akan **terkunci selamanya** dan tidak
 * bisa kembali kecuali dengan membersihkan data peramban. Mengunci pemilik
 * yang sah jauh lebih buruk daripada membiarkan anggota melihat menu yang
 * kosong. Karenanya menyalakan mode anggota **menganjurkan PIN lebih dulu**
 * (lihat `wajibPasangPin`), bukan memaksanya.
 */

export type ModePerangkat = 'coach' | 'member'

/** Satu-satunya rute yang boleh dibuka di mode anggota. */
export const RUTE_ANGGOTA = '/berbagi'

/**
 * Bolehkah rute ini dibuka pada mode tersebut?
 *
 * Di mode anggota, **hanya** `/berbagi`. Segala yang lain — termasuk `/`
 * (dashboard) — dialihkan ke sana.
 */
export function bolehBuka(mode: ModePerangkat, path: string): boolean {
  if (mode !== 'member') return true
  return path === RUTE_ANGGOTA
}

/**
 * Perlukah memasang PIN lebih dulu sebelum mode anggota dinyalakan?
 *
 * Benar bila PIN **belum** terpasang. Ini anjuran, bukan paksaan:
 * menolak menyalakan mode anggota tanpa PIN akan menghalangi pelatih yang
 * sekadar ingin mencobanya.
 */
export function wajibPasangPin(adaPin: boolean): boolean {
  return !adaPin
}

/**
 * Bolehkah kembali ke mode pelatih?
 *
 * - **PIN terpasang** → hanya bila PIN-nya diterima. Inilah yang diminta.
 * - **PIN belum terpasang** → diizinkan, supaya pelatih tidak pernah
 *   mengurung dirinya sendiri. Keadaan ini ditandai jelas di antarmuka.
 */
export function bolehKePelatih(adaPin: boolean, pinDiterima: boolean): boolean {
  if (!adaPin) return true
  return pinDiterima
}

/**
 * Peringatan yang tampil di mode anggota bila PIN belum terpasang.
 *
 * Sengaja **tidak** mengatakan "terkunci", karena memang belum terkunci.
 * Lebih baik mengakui keadaan yang sebenarnya daripada mengaku lebih aman
 * daripada kenyataannya.
 */
export function teksTanpaPin(): string {
  return 'Mode anggota belum dikunci karena belum ada PIN. Pasang PIN di Pengaturan supaya anggota tidak bisa keluar dari mode ini.'
}

/** Penjelasan yang tampil di kunci keluarnya. */
export function teksKunci(adaPin: boolean): string {
  return adaPin
    ? 'Masukkan PIN pelatih untuk keluar dari mode anggota.'
    : 'Belum ada PIN, jadi mode ini belum dikunci. Tekan Lanjut untuk keluar.'
}

/* --------------------------------- Simpanan -------------------------------- */

/**
 * Kunci `localStorage` untuk mode perangkat.
 *
 * **Sengaja dibaca-tulis secara terbuka**, karena mode ini memang hanya
 * pagar antarmuka: siapa pun yang membuka perkakas pengembang peramban bisa
 * mengubahnya. Tidak ada gunanya menyandikan nilai yang tidak dimaksudkan
 * sebagai pengaman — itu hanya akan membuatnya *tampak* seperti pengaman.
 */
export const KUNCI_MODE = 'drillkit.mode'

/** Mode yang tersimpan di perangkat ini; `coach` bila belum pernah dipilih. */
export function bacaMode(): ModePerangkat {
  try {
    return (localStorage.getItem(KUNCI_MODE) as ModePerangkat) ?? 'coach'
  } catch {
    // localStorage bisa diblokir (mode privat). Anggap pelatih.
    return 'coach'
  }
}

/** Simpan pilihan mode untuk perangkat ini. */
export function simpanMode(m: ModePerangkat) {
  try {
    localStorage.setItem(KUNCI_MODE, m)
  } catch {
    // abaikan — mode tetap berjalan walau tidak tersimpan
  }
}

/**
 * Sudah pernahkah mode dipilih di perangkat ini?
 *
 * Dibedakan dari `bacaMode` karena **belum memilih** dan **memilih pelatih**
 * itu dua keadaan berbeda: yang pertama harus ditanya lebih dulu, yang
 * kedua tidak. Tanpa pembedaan ini, setiap pelatih akan ditanya ulang
 * setiap kali membuka aplikasi.
 *
 * Bila `localStorage` tidak tersedia, mengembalikan `true` (anggap sudah
 * memilih). Sengaja: kalau tidak bisa mengingat, menanyai berulang-ulang
 * jauh lebih menyusahkan daripada menebak pelatih.
 */
export function pernahMemilih(): boolean {
  try {
    return localStorage.getItem(KUNCI_MODE) != null
  } catch {
    return true
  }
}

/*
 * Tidak ada fungsi `simpanPilihan` terpisah: menulis mode sudah berarti
 * menulis fakta bahwa pilihan pernah dibuat, karena `pernahMemilih()`
 * memeriksa ada-tidaknya kuncinya — bukan nilainya. Dua fungsi untuk satu
 * maksud hanya akan mengundang pertanyaan "yang mana yang benar?".
 */
