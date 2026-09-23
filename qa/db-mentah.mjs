/**
 * Menulis & membaca IndexedDB **langsung** dari rangkaian uji.
 *
 * Mengapa ini ada: beberapa rangkaian lama menanam data dengan menyisipkan
 * modul aplikasinya sendiri dari dalam halaman —
 *
 *     const { db } = await import('/src/db/db.ts')
 *
 * Itu hanya ada di server pengembangan Vite. Begitu rangkaiannya
 * diarahkan ke versi jadi (`vite preview`), impornya gagal dengan
 * `Failed to fetch dynamically imported module` — mogok sebelum satu pun
 * periksaannya berjalan, dan mogoknya tampak sebagai "uji tanpa
 * ringkasan", bukan sebagai kegagalan yang terang-terangan.
 *
 * Jalan keluar di sini: sentuh IndexedDB-nya sendiri. Dexie menyimpan
 * tiap tabel sebagai object store dengan nama yang sama, jadi `put`,
 * `delete`, dan `getAll` biasa berlaku — tanpa perlu modul aplikasinya.
 *
 * SATU HAL YANG HARUS DIINGAT: `useLiveQuery`-nya Dexie TIDAK bereaksi
 * pada tulisan mentah, karena ia menunggu transaksi yang lewat Dexie
 * sendiri. Karena itu **setelah menanam data halamannya harus dimuat
 * ulang** — `segar()` disediakan untuk itu, dan tiap fungsi yang
 * menulis mengatakannya.
 */

const NAMA_DB = 'drillkit'

/**
 * Dijalankan DI DALAM halaman — karena itu **mandiri**: `page.evaluate`
 * hanya mengirim fungsi yang disebutkan, bukan seluruh isi modulnya.
 * Menyisipkan helper dari lingkup modul menghasilkan
 * "ReferenceError: ... is not defined" di dalam peramban.
 *
 * Tiga fungsi di bawah sengaja mengulang cara membuka basis datanya
 * daripada memanggil satu helper bersama. Pengulangan kecil itu harga
 * yang dibayar supaya masing-masing bisa dikirim sendiri-sendiri.
 */

/** Hapus / tanam / ubah baris pada satu tabel. */
async function tulisDiHalaman(db, tabel, operasi) {
  const koneksi = await new Promise((selesai) => {
    const m = indexedDB.open(db)
    m.onsuccess = () => selesai(m.result)
    m.onerror = () => selesai(null)
    m.onupgradeneeded = () => selesai(null)
  })
  if (!koneksi) return { ok: false, alasan: 'basis data belum ada' }
  if (!koneksi.objectStoreNames.contains(tabel)) {
    koneksi.close()
    return { ok: false, alasan: 'tabel tidak ada: ' + tabel }
  }

  const jalan = (mode, fn) =>
    new Promise((selesai, gagal) => {
      const tx = koneksi.transaction(tabel, mode)
      const req = fn(tx.objectStore(tabel))
      tx.oncomplete = () => selesai(true)
      tx.onerror = () => gagal(tx.error)
      tx.onabort = () => gagal(tx.error)
      if (req) req.onerror = () => gagal(req.error)
    })

  const bacaSatu = (kunci) =>
    new Promise((selesai, gagal) => {
      const tx = koneksi.transaction(tabel, 'readonly')
      const r = tx.objectStore(tabel).get(kunci)
      r.onsuccess = () => selesai(r.result ?? null)
      r.onerror = () => gagal(r.error)
    })

  try {
    for (const kunci of operasi.hapus ?? []) {
      await jalan('readwrite', (s) => s.delete(kunci))
    }
    for (const baris of operasi.taruh ?? []) {
      await jalan('readwrite', (s) => s.put(baris))
    }
    for (const { kunci, patch } of operasi.ubah ?? []) {
      const lama = await bacaSatu(kunci)
      if (lama) await jalan('readwrite', (s) => s.put({ ...lama, ...patch }))
    }
  } catch (e) {
    koneksi.close()
    return { ok: false, alasan: String(e) }
  }
  koneksi.close()
  return { ok: true }
}

/** Semua baris satu tabel. */
async function bacaSemuaDiHalaman(db, tabel) {
  const koneksi = await new Promise((selesai) => {
    const m = indexedDB.open(db)
    m.onsuccess = () => selesai(m.result)
    m.onerror = () => selesai(null)
    m.onupgradeneeded = () => selesai(null)
  })
  if (!koneksi) return []
  if (!koneksi.objectStoreNames.contains(tabel)) {
    koneksi.close()
    return []
  }
  const semua = await new Promise((selesai) => {
    const tx = koneksi.transaction(tabel, 'readonly')
    const r = tx.objectStore(tabel).getAll()
    r.onsuccess = () => selesai(r.result ?? [])
    r.onerror = () => selesai([])
  })
  koneksi.close()
  return semua
}

/* ------------------------------- Antarmuka ------------------------------- */

/**
 * Hapus lagu berjudul `judulLama`, lalu tanam `baris`.
 *
 * WAJIB diikuti `segar(h)`: tanpa pemuatan ulang, datanya sudah ada di
 * basis data tetapi tidak pernah sampai ke layar.
 */
export async function tanamLagu(h, baris, judulLama = []) {
  let hapus = []
  if (judulLama.length) {
    const semua = await bacaSemua(h, 'songs')
    hapus = semua.filter((s) => judulLama.includes(s.title)).map((s) => s.id)
  }
  const hasil = await h.evaluate(tulisDiHalaman, NAMA_DB, 'songs', {
    hapus,
    taruh: baris,
  })
  if (!hasil?.ok) throw new Error('tanamLagu gagal: ' + (hasil?.alasan ?? '?'))
  return hasil
}

/** Tanam baris di tabel mana pun (drill, set, setlist, …). Ikuti dengan `segar`. */
export async function tanamBaris(h, tabel, baris, kunciHapus = []) {
  const hasil = await h.evaluate(tulisDiHalaman, NAMA_DB, tabel, {
    hapus: kunciHapus,
    taruh: Array.isArray(baris) ? baris : [baris],
  })
  if (!hasil?.ok) throw new Error(`tanamBaris(${tabel}) gagal: ` + (hasil?.alasan ?? '?'))
  return hasil
}

/** Ubah sebagian kolom sebuah baris tanpa menimpa yang lain. */
export async function ubahBaris(h, tabel, kunci, patch) {
  const hasil = await h.evaluate(tulisDiHalaman, NAMA_DB, tabel, {
    ubah: [{ kunci, patch }],
  })
  if (!hasil?.ok) throw new Error(`ubahBaris(${tabel}) gagal: ` + (hasil?.alasan ?? '?'))
  return hasil
}

/** Semua baris sebuah tabel — dipakai untuk mencari id yang baru dibuat. */
export async function bacaSemua(h, tabel) {
  return await h.evaluate(bacaSemuaDiHalaman, NAMA_DB, tabel)
}

/**
 * Muat ulang halamannya supaya React membaca ulang basis datanya.
 *
 * Ini bukan formalitas: tulisan mentah tidak memberitahu `useLiveQuery`.
 * Tanpa pemuatan ulang, uji akan gagal pada hal yang sama sekali tidak
 * ada sangkut pautnya dengan yang sedang diuji.
 */
export async function segar(h, ms = 2000) {
  await h.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, ms))
}

export { NAMA_DB }
