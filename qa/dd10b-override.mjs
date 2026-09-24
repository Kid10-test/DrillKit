/**
 * DD10b — timpa mode langkah per pemain per perpindahan (panel Detail).
 *
 * Yang diuji:
 *   1. titik dipilih dengan tetikus → tombol Detail → panel "Detail — <nama>";
 *   2. tombol mode bersiklus `drill` → `tetap` → `hitungan` → `drill`, dan
 *      tiap langkahnya TERSIMPAN di basis data (`set.langkah[idPemain]`) —
 *      dicocokkan dengan pemain yang namanya tertulis di judul panel;
 *   3. yang ditimpa ditandai biru; kembali ke `drill` = tanda hilang DAN
 *      timpaannya dihapus dari basis data (bukan disimpan sebagai "drill");
 *   4. angkanya ikut berubah: `hitungan` → 16 langkah · Lk/cnt 1 · 120 lk/mnt
 *      (IDE-PENGEMBANGAN: "16 · 1 · 120"); `tetap` = sama dengan bawaan drill
 *      (karena bawaan drill contoh memang tetap); `drill` = persis angka awal;
 *   5. timpaan bertahan setelah panel ditutup lalu dibuka lagi, DAN setelah
 *      halaman dimuat ulang;
 *   6. timpaan hanya untuk SATU pemain: pemain lain tetap "drill".
 *
 * 2a — dihidupkan kembali. Rangkaian lama hanya mencetak JSON tanpa asersi,
 * jadi ia tidak pernah bisa gagal — dan komentarnya ("setel ke hitungan")
 * tidak sesuai dengan yang dilakukannya: satu klik dari `drill` menghasilkan
 * `tetap` (diperiksa, 23 Sep 2026). Ia juga menutup panel dengan Escape dan
 * mengandalkan pilihan titik yang kebetulan masih bertahan sesudahnya. Kini
 * panel ditutup dengan tombol Tutup seperti pemakai, timpaannya dicocokkan
 * dengan basis data, dan persistensinya diperiksa juga sesudah halaman
 * dimuat ulang.
 *
 * Pakai: BASE=http://localhost:4173 node dd10b-override.mjs
 */
import { barisDetail, jalankan } from './alat-buku-saku.mjs'

await jalankan('DD10b — timpa mode langkah per pemain (Detail)', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /** Timpaan yang TERSIMPAN untuk pemain ini di Set 1 (`null` = ikut drill). */
  const timpaanDb = async (idPemain) => (await t.setDiDb())[0]?.langkah?.[idPemain] ?? null

  /* ----------------------- 1. pilih titik → Detail ----------------------- */
  await t.pilihTitikPertama()
  const awal = await t.bukaDetail()
  cek('1: panel Detail terbuka dengan nama pemain di judulnya', !!awal?.nama, JSON.stringify(awal?.nama))
  const nama = awal.nama
  const anggota = (await t.anggotaDiDb()).find((m) => m.name === nama)
  cek(`1: "${nama}" adalah anggota yang ada di basis data`, !!anggota)
  sama(
    '1: kolom tabel gerak: Perpindahan · Cnt · Langkah · Lk/cnt · Lk/mnt · Ukuran · Mode langkah',
    awal.kepala,
    ['Perpindahan', 'Cnt', 'Langkah', 'Lk/cnt', 'Lk/mnt', 'Ukuran', 'Mode langkah'],
  )
  const b0 = barisDetail(awal)
  sama('1: satu perpindahan, Set 1 → Set 2', b0.perpindahan, 'Set 1 — Blok → Set 2 — Busur')
  sama('1: mode awal "drill", tidak ditandai', [b0.mode, b0.ditandai], ['drill', false])
  sama('1: belum ada timpaan tersimpan', await timpaanDb(anggota.id), null)
  catat(`pemain: ${nama} · awal ${b0.angka.join(' · ')}`)

  /* ------------------------------ 2. siklus ------------------------------ */
  const d1 = barisDetail(await t.klikModeDetail(0))
  sama('2: klik 1 → "tetap", ditandai biru', [d1.mode, d1.ditandai], ['tetap', true])
  sama('2: tersimpan: { mode: tetap, langkahPerCount: 1 }', await timpaanDb(anggota.id), { mode: 'tetap', langkahPerCount: 1 })
  sama('2: "tetap" = angka bawaan drill (bawaannya memang tetap)', d1.angka, b0.angka)

  const d2 = barisDetail(await t.klikModeDetail(0))
  sama('2: klik 2 → "hitungan", ditandai biru', [d2.mode, d2.ditandai], ['hitungan', true])
  sama('2: tersimpan: { mode: menyesuaikan, langkahPerCount: 1 }', await timpaanDb(anggota.id), {
    mode: 'menyesuaikan',
    langkahPerCount: 1,
  })
  sama('2: "hitungan" → 16 langkah · Lk/cnt 1 · 120 lk/mnt', [d2.langkah, d2.lpc, d2.lpm], [16, 1, 120])

  const d3 = barisDetail(await t.klikModeDetail(0))
  sama('2: klik 3 → kembali "drill", tanda biru hilang', [d3.mode, d3.ditandai], ['drill', false])
  sama('3: kembali ke drill = timpaan DIHAPUS dari basis data', await timpaanDb(anggota.id), null)
  sama('3: angkanya persis seperti awal', d3.angka, b0.angka)

  /* -------------------- 4–5. hitungan, lalu tutup-buka -------------------- */
  await t.klikModeDetail(0) // tetap
  const d5 = barisDetail(await t.klikModeDetail(0)) // hitungan
  sama('4: disetel ke "hitungan" untuk uji simpan', d5.mode, 'hitungan')
  await t.tutupDetail()
  const buka = barisDetail(await t.bukaDetail())
  sama('5: ditutup lalu dibuka lagi → masih "hitungan", masih ditandai', [buka.mode, buka.ditandai], ['hitungan', true])
  sama('5: …dengan angka yang sama', buka.angka, d5.angka)
  await t.tutupDetail()

  await t.muatUlangEditor()
  await t.pilihAnggota(nama)
  const ulang = await t.bukaDetail()
  sama('5: setelah halaman dimuat ulang → panel pemain yang sama', ulang.nama, nama)
  const bu = barisDetail(ulang)
  sama('5: …masih "hitungan", masih ditandai', [bu.mode, bu.ditandai], ['hitungan', true])
  sama('5: …dengan angka yang sama', bu.angka, d5.angka)
  await t.tutupDetail()

  /* --------------------- 6. pemain lain tidak ikut --------------------- */
  const lain = (await t.anggotaDiDb()).find((m) => m.name !== nama)
  await t.pilihAnggota(lain.name)
  const dl = await t.bukaDetail()
  sama(`6: pemain lain (${lain.name}) tetap "drill"`, barisDetail(dl)?.mode, 'drill')
  const langkahSet = (await t.setDiDb())[0]?.langkah ?? {}
  sama('6: basis data hanya berisi timpaan untuk satu pemain', Object.keys(langkahSet), [anggota.id])
  await t.tutupDetail()
})
