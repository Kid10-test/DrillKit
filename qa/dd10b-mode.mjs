/**
 * DD10b — dua cara menghitung langkah, di buku saku.
 *
 *   - **Ukuran langkah tetap** (bawaan): jumlah langkah ditentukan JARAK,
 *     ukurannya dikunci 22,5″ (8-to-5).
 *   - **Langkah ikut hitungan**: jumlah langkah = hitungan × langkah/hitungan,
 *     dan UKURAN langkahnya yang menyesuaikan.
 *
 * Yang diuji (angka acuan dari "Hasil DD10b" di IDE-PENGEMBANGAN):
 *   1. mode tetap: Citra `21 lk / 16 cnt` → Lk/cnt 1,32, ukuran 22,5″; di SEMUA
 *      kartu ukurannya 22,5″ dan tidak diwarnai;
 *   2. pilihan "Langkah ikut hitungan" di ⚙ tersimpan (basis data);
 *   3. mode menyesuaikan: Citra `16 lk / 16 cnt = 1`, ukuran 29,6″; di SEMUA
 *      kartu 16 langkah & Lk/cnt 1 — yang berbeda-beda hanya ukurannya;
 *   4. ukuran langkah konsisten dengan mode tetap: ukuran × langkah = jarak,
 *      sehingga (ukuran ÷ 22,5) × 16 ≈ langkah mode tetap, untuk tiap pemain;
 *   5. warna ukuran langkah mengikuti ambang 22,5 / 30 / 45″: Fajar 45,7″
 *      "mustahil", Maya 42,5″ "berat", Citra 29,6″ tidak diwarnai;
 *   6. legenda menyebut mode "menyesuaikan" hanya saat mode itu dipakai.
 *
 * 2a — dihidupkan kembali. Rangkaian lama hanya mencetak "COCOK/TIDAK-COCOK"
 * ke layar tanpa pernah gagal, dan membaca kolom lewat posisinya.
 *
 * Pakai: BASE=http://localhost:4173 node dd10b-mode.mjs
 */
import { gerakPertama, jalankan, kartuMilik, lkCntSejalan, warnaLegenda, warnaSel } from './alat-buku-saku.mjs'

const UKURAN_TETAP = 22.5

await jalankan('DD10b — mode langkah tetap vs ikut hitungan', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /* ------------------------------ 1. mode tetap ----------------------------- */
  sama('1: drill contoh mulai dengan mode bawaan (tetap)', (await t.drillDiDb())?.setelanLangkah?.mode ?? 'tetap', 'tetap')
  const tetap = await t.pratinjau({ pemain: null })
  sama('1: satu kartu per pemain (18)', tetap.length, 18)
  const cT = gerakPertama(kartuMilik(tetap, 'Citra Dewi'))
  sama('1: Citra — 21 langkah dalam 16 count', [cT.langkah, cT.cnt], [21, 16])
  sama('1: Citra — Lk/cnt 1.32 (IDE-PENGEMBANGAN: "1,32")', cT.lpc, 1.32)
  cek('1: Citra — 21 ÷ 16 sejalan dengan Lk/cnt ("COCOK")', lkCntSejalan(cT.langkah, cT.cnt, cT.lpc))
  const bukanTetap = tetap.filter((k) => gerakPertama(k).ukuran !== UKURAN_TETAP)
  cek(
    '1: ukuran langkah 22.5″ di SEMUA kartu',
    bukanTetap.length === 0,
    bukanTetap.map((k) => `${k.nama}: ${gerakPertama(k).ukuranTeks}`).join('; '),
  )
  cek('1: ukuran 22.5″ tidak pernah diwarnai', tetap.every((k) => warnaSel(gerakPertama(k).ukuranHtml) === null))
  cek(
    '1: legenda ukuran TIDAK menyebut mode menyesuaikan',
    tetap[0].legenda.some((l) => l.startsWith('Ukuran langkah =')) && !tetap[0].legenda.some((l) => /menyesuaikan/.test(l)),
  )
  const langkahTetap = new Map(tetap.map((k) => [k.nama, gerakPertama(k).langkah]))
  await t.simpanGambar('dd10b-tetap.png')
  await t.tutupSemua()

  /* ------------------ 2. pilih "Langkah ikut hitungan" ------------------- */
  const pilih = await t.ubahSetelanDrill(() => t.klikTeks('Langkah ikut hitungan', { jendela: 'Pengaturan drill' }))
  cek('2: pilihan "Langkah ikut hitungan" ada di ⚙', pilih)
  const setelan = (await t.drillDiDb())?.setelanLangkah
  sama('2: tersimpan di basis data: mode menyesuaikan, 1 langkah/hitungan', setelan, {
    mode: 'menyesuaikan',
    langkahPerCount: 1,
  })

  /* ----------------------- 3. mode menyesuaikan ---------------------------- */
  const sesuai = await t.pratinjau()
  sama('3: satu kartu per pemain (18)', sesuai.length, 18)
  const cS = gerakPertama(kartuMilik(sesuai, 'Citra Dewi'))
  sama('3: Citra — 16 langkah dalam 16 count (IDE-PENGEMBANGAN: "16 lk / 16 cnt")', [cS.langkah, cS.cnt], [16, 16])
  sama('3: Citra — Lk/cnt 1', cS.lpc, 1)
  sama('3: Citra — ukuran 29.6″ (IDE-PENGEMBANGAN: "29,6″")', cS.ukuran, 29.6)
  const tidak16 = sesuai.filter((k) => {
    const g = gerakPertama(k)
    return g.langkah !== 16 || g.lpc !== 1
  })
  cek(
    '3: di SEMUA kartu 16 langkah & Lk/cnt 1 — jumlah langkah mengikuti hitungan',
    tidak16.length === 0,
    tidak16.map((k) => `${k.nama}: ${gerakPertama(k).langkah} / ${gerakPertama(k).lpc}`).join('; '),
  )
  const ukuranUnik = new Set(sesuai.map((k) => gerakPertama(k).ukuran))
  cek('3: yang berbeda-beda kini ukuran langkahnya', ukuranUnik.size > 5, `${ukuranUnik.size} ukuran berbeda`)

  /* ----------- 4. ukuran × langkah = jarak (sepakat dengan mode tetap) ----------- */
  const tidakSepakat = sesuai
    .map((k) => {
      const g = gerakPertama(k)
      return { nama: k.nama, turunan: (g.ukuran / UKURAN_TETAP) * g.langkah, tetap: langkahTetap.get(k.nama) }
    })
    // Langkah mode tetap dibulatkan ke bilangan bulat, ukuran ke 0,1″: batas ±0,6.
    .filter((x) => !(Math.abs(x.turunan - x.tetap) <= 0.6))
  cek(
    '4: (ukuran ÷ 22.5″) × 16 = langkah mode tetap, untuk tiap pemain — dua mode membaca jarak yang sama',
    tidakSepakat.length === 0,
    tidakSepakat.map((x) => `${x.nama}: ${x.turunan.toFixed(2)} vs ${x.tetap}`).join('; '),
  )

  /* ------------------------ 5. warna ukuran langkah ------------------------ */
  const leg = warnaLegenda(kartuMilik(sesuai, 'Citra Dewi'))
  const fajar = gerakPertama(kartuMilik(sesuai, 'Fajar Nugroho'))
  const maya = gerakPertama(kartuMilik(sesuai, 'Maya Anggraini'))
  sama('5: Fajar — 45.7″', fajar.ukuran, 45.7)
  sama('5: Fajar 45.7″ (> 45″) diwarnai "mustahil"', warnaSel(fajar.ukuranHtml), leg.mustahil)
  sama('5: Maya — 42.5″', maya.ukuran, 42.5)
  sama('5: Maya 42.5″ (30–45″) diwarnai "berat"', warnaSel(maya.ukuranHtml), leg.berat)
  sama('5: Citra 29.6″ (≤ 30″) tidak diwarnai', warnaSel(cS.ukuranHtml), null)
  catat(`ukuran: Citra ${cS.ukuran}″ · Maya ${maya.ukuran}″ · Fajar ${fajar.ukuran}″`)

  /* -------------------------------- 6. legenda ------------------------------- */
  cek(
    '6: legenda menyebut mode "menyesuaikan"',
    sesuai[0].legenda.some((l) => l.includes('Mode drill ini menyesuaikan')),
    sesuai[0].legenda.join(' / '),
  )
  await t.simpanGambar('dd10b-sesuai.png')
  await t.tutupSemua()
})
