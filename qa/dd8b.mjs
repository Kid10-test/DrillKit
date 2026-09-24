/**
 * DD8b — warna peringatan Lk/cnt benar-benar TERCETAK.
 *
 * Skenario dari "Hasil DD8" (IDE-PENGEMBANGAN): count Set 1 dipaksa jadi 1,
 * sehingga semua jarak harus ditempuh dalam satu hitungan. Harapannya:
 *   1. count benar-benar berubah — di layar DAN di basis data;
 *   2. Andra 13 langkah dalam 1 count = Lk/cnt 12,92, **merah** (mustahil),
 *      lengkap dengan legendanya;
 *   3. merahnya sama dengan kata "mustahil" di legenda, dan SEMUA kartu merah
 *      (yang paling ringan pun 8 langkah/count = 960 langkah/menit);
 *   4. warna ukuran langkah TIDAK ikut merah: di mode tetap langkahnya tetap
 *      22,5″ — yang mustahil kecepatannya, bukan panjang langkahnya.
 *
 * 2a — dihidupkan kembali. Selain layar sambutan, dua hal pada rangkaian lama
 * (diperiksa dengan menjalankan versi lamanya, 23 Sep 2026):
 *   - warna dibaca dari "sel terakhir", yang sejak DD10b adalah kolom Ukuran
 *     langkah — ia membaca `<span class="mono">22.5″</span>` yang memang
 *     tidak berwarna, bukan Lk/cnt. Kini kolomnya dicari lewat judul;
 *   - count diubah dengan menimpa `value` lewat setter prototipe dan hasilnya
 *     tidak pernah diperiksa. (Untuk kolom ini setternya ternyata sampai ke
 *     basis data.) Kini DIKETIK seperti pemakai (README), dan hasilnya
 *     diperiksa di layar dan di basis data.
 *
 * Pakai: BASE=http://localhost:4173 node dd8b.mjs
 */
import { gerakPertama, jalankan, kartuMilik, warnaLegenda, warnaSel } from './alat-buku-saku.mjs'

await jalankan('DD8b — warna peringatan tercetak', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /* --------------------------- 1. count jadi 1 --------------------------- */
  sama('1: kolom "Count ke set berikutnya" berisi 1 setelah diketik', await t.isiCount(1), '1')
  const set1 = (await t.setDiDb())[0]
  sama('1: count Set 1 tersimpan 1 di basis data', set1?.counts, 1)

  /* ---------------------- 2. Andra 12,92 — mustahil ---------------------- */
  const kartu = await t.pratinjau({ pemain: null })
  sama('2: satu kartu per pemain (18)', kartu.length, 18)
  const andra = kartuMilik(kartu, 'Andra Pratama')
  cek('2: kartu Andra Pratama ada', !!andra)
  const g = gerakPertama(andra)
  sama('2: Andra — Cnt tercetak 1', g.cnt, 1)
  sama('2: Andra — 13 langkah', g.langkah, 13)
  sama('2: Andra — Lk/cnt 12.92 (IDE-PENGEMBANGAN: "12,92")', g.lpc, 12.92)
  const leg = warnaLegenda(andra)
  cek('2: legenda tercetak, lengkap dengan warna "mustahil"', !!leg.mustahil, JSON.stringify(leg))
  sama('2: Lk/cnt Andra diwarnai "mustahil"', warnaSel(g.lpcHtml), leg.mustahil)
  cek('2: …dan ditebalkan', /font-weight:\s*700/.test(g.lpcHtml ?? ''), g.lpcHtml)
  catat(`Andra: ${g.langkah} langkah / ${g.cnt} count = ${g.lpc} · ${warnaSel(g.lpcHtml)}`)

  /* ------------------ 3. semua kartu merah — sama legenda ------------------ */
  const bukanMerah = kartu.filter((k) => warnaSel(gerakPertama(k).lpcHtml) !== leg.mustahil)
  cek(
    '3: Lk/cnt di SEMUA kartu diwarnai "mustahil"',
    bukanMerah.length === 0,
    bukanMerah.map((k) => `${k.nama}: ${gerakPertama(k).lpcTeks}`).join('; '),
  )
  cek(
    '3: warna "mustahil" berbeda dengan "berat" di legenda',
    !!leg.berat && leg.berat !== leg.mustahil,
    JSON.stringify(leg),
  )

  /* ------------- 4. ukuran langkah tidak ikut disalahkan --------------- */
  sama('4: ukuran langkah Andra tetap 22.5″ (mode tetap)', g.ukuran, 22.5)
  sama('4: ukuran langkah TIDAK diwarnai — yang mustahil kecepatannya', warnaSel(g.ukuranHtml), null)
  await t.simpanGambar('dd8b-mustahil.png')
  await t.tutupSemua()
})
