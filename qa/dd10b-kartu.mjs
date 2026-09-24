/**
 * DD10b — timpaan per gerakan harus ikut TERCETAK di buku saku, pada kartu
 * pemain YANG SAMA dengan yang diubah di panel Detail.
 *
 * Skenario dari "Hasil DD10b" (IDE-PENGEMBANGAN): Andra Pratama, Set 1 →
 * Set 2, ditimpa ke "hitungan". Panel Detail menampilkan `16 · 1 · 120 ·
 * 18,2″`, dan kartu Andra harus mencetak `16 →` · `1` · `18,2″` — sama persis.
 *
 * Yang diuji:
 *   1. sebelum ditimpa: kartu Andra mengikuti bawaan drill (13 langkah, 22,5″);
 *   2. panel Detail Andra → "hitungan": 16 · 1 · 120 · 18,2″;
 *   3. kartu Andra (dipilih sendiri di buku saku) mencetak angka yang SAMA
 *      dengan panel Detail — langkah, Lk/cnt, ukuran — plus panah →;
 *   4. di pratinjau semua pemain, HANYA kartu Andra yang berubah: 17 kartu
 *      lainnya persis seperti sebelum ditimpa;
 *   5. timpaan dikembalikan ke "drill" → kartu Andra kembali seperti semula.
 *
 * 2a — dihidupkan kembali. Rangkaian lama hanya mencetak JSON tanpa asersi,
 * mencari tabel Detail lewat rantai
 * `closest('div[class*="rounded"]').parentElement.parentElement` yang
 * bergantung pada kedalaman susunan DOM, dan memilih pemain dengan menimpa
 * `value` lewat setter prototipe. Kini tabel dicari dari judul panelnya,
 * pemain dipilih lewat `select()` Puppeteer, dan yang dibandingkan bukan
 * hanya kartu Andra tetapi juga 17 kartu lain yang TIDAK boleh ikut berubah.
 *
 * Pakai: BASE=http://localhost:4173 node dd10b-kartu.mjs
 */
import { barisDetail, gerakPertama, jalankan, kartuMilik } from './alat-buku-saku.mjs'

const NAMA = 'Andra Pratama'

/** Ringkasan satu kartu untuk dibandingkan: koordinat, langkah+panah, Lk/cnt, ukuran. */
const sidik = (k) => k.baris.map((b) => b.map((c) => c.teks).join(' | ')).join(' // ')

await jalankan('DD10b — timpaan per gerakan tercetak di kartu pemain yang sama', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /* ---------------------- 1. sebelum ditimpa ---------------------- */
  const semulaSemua = await t.pratinjau({ pemain: null })
  sama('1: satu kartu per pemain (18)', semulaSemua.length, 18)
  const semula = gerakPertama(kartuMilik(semulaSemua, NAMA))
  sama(`1: kartu ${NAMA} mengikuti bawaan drill — 13 langkah · 22.5″`, [semula.langkah, semula.ukuran], [13, 22.5])
  const sidikSemula = new Map(semulaSemua.map((k) => [k.nama, sidik(k)]))
  await t.tutupSemua()

  /* ---------------------- 2. timpa di panel Detail ---------------------- */
  await t.pilihAnggota(NAMA)
  const d0 = await t.bukaDetail()
  sama(`2: panel Detail milik ${NAMA}`, d0?.nama, NAMA)
  let d = barisDetail(d0)
  for (let i = 0; i < 3 && d.mode !== 'hitungan'; i++) d = barisDetail(await t.klikModeDetail(0))
  sama('2: mode baris Set 1 → Set 2 jadi "hitungan"', d.mode, 'hitungan')
  sama(
    '2: Detail menampilkan 16 · 1 · 120 · 18.2″ (IDE-PENGEMBANGAN: "16 · 1 · 120 · 18,2″")',
    [d.langkah, d.lpc, d.lpm, d.ukuran],
    [16, 1, 120, 18.2],
  )
  catat(`Detail: ${d.angka.join(' · ')}`)
  await t.tutupDetail()

  /* -------------------- 3. kartu pemain yang sama -------------------- */
  const sendiri = await t.pratinjau({ pemain: NAMA })
  sama(`3: buku saku berisi satu kartu, milik ${NAMA}`, sendiri.map((k) => k.nama), [NAMA])
  const k = gerakPertama(sendiri[0])
  sama('3: kartu mencetak langkah yang sama dengan Detail (16)', k.langkah, d.langkah)
  sama('3: kartu mencetak Lk/cnt yang sama dengan Detail (1)', k.lpc, d.lpc)
  sama('3: kartu mencetak ukuran yang sama dengan Detail (18.2″)', k.ukuranTeks, d.ukuranTeks)
  sama('3: kartu mencetak panah → ("16 →")', k.panah, ['→'])
  await t.simpanGambar('dd10b-kartu.png')

  /* ------------------ 4. hanya kartu Andra yang berubah ------------------ */
  const semua = await t.pratinjau({ pemain: null })
  sama('4: kartu Andra di pratinjau semua pemain juga 16 · 1 · 18.2″', (() => {
    const g = gerakPertama(kartuMilik(semua, NAMA))
    return [g.langkah, g.lpc, g.ukuran]
  })(), [16, 1, 18.2])
  const ikutBerubah = semua.filter((x) => x.nama !== NAMA && sidik(x) !== sidikSemula.get(x.nama))
  cek(
    '4: 17 kartu lainnya persis seperti sebelum ditimpa',
    ikutBerubah.length === 0 && semua.length === 18,
    ikutBerubah.map((x) => x.nama).join(', '),
  )
  await t.tutupSemua()

  /* ---------------- 5. kembalikan ke drill → kartu kembali ---------------- */
  await t.pilihAnggota(NAMA)
  let e = barisDetail(await t.bukaDetail())
  for (let i = 0; i < 3 && e.mode !== 'drill'; i++) e = barisDetail(await t.klikModeDetail(0))
  sama('5: timpaan dikembalikan ke "drill"', e.mode, 'drill')
  await t.tutupDetail()
  const kembali = await t.pratinjau({ pemain: NAMA })
  sama(`5: kartu ${NAMA} kembali persis seperti semula`, sidik(kembali[0]), sidikSemula.get(NAMA))
  await t.tutupSemua()
})
