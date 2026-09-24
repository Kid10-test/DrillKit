/**
 * 2b — kartu lipat buku saku: satu kartu per pemain, dua kartu per lembar A4.
 *
 * Yang diuji, dari pratinjau yang benar-benar dirender:
 *   1. show pendek (2 set, data contoh): satu kartu bermuka dua — muka depan
 *      memuat kepala + kompas + semua baris, muka belakang memuat keterangan;
 *   2. show panjang (64 set, via Duplikat): set terbagi ke dua kartu dengan
 *      nomor baris global yang urut 1–64, lengkap dengan penanda sambungan
 *      dan penomoran kartu — tidak satu baris pun hilang atau ganda;
 *   3. ukuran sejati: tiap kartu 190 × 135 mm, dan isi tiap muka tidak meluap;
 *   4. pilihan mati (tanpa Lk/cnt, ukuran, kompas) dan format Lembar A4
 *      tetap jalan.
 *
 * Pakai: BASE=http://localhost:4173 node kartu-lipat.mjs
 */
import { jalankan, JENDELA } from './alat-buku-saku.mjs'

/** Baca struktur lipat di dalam bingkai pratinjau — mandiri (evaluate). */
function bacaLipatDiBingkai() {
  const bersih = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  const kartu = [...document.querySelectorAll('.kartu')].map((sec) => {
    const depan = sec.querySelector('.muka.depan')
    const belakang = sec.querySelector('.muka:not(.depan)')
    const baris = (muka) =>
      muka ? [...muka.querySelectorAll('tbody tr')].map((tr) => bersih(tr.children[0]?.textContent)) : []
    const r = sec.getBoundingClientRect()
    return {
      pemain: sec.dataset.pemain ?? '',
      nomor: sec.dataset.kartu ?? '',
      depan: baris(depan),
      belakang: baris(belakang),
      kakiDepan: bersih(depan?.querySelector('.kaki')?.textContent),
      kakiBelakang: bersih(belakang?.querySelector('.kaki')?.textContent),
      sambung: bersih(belakang?.querySelector('.sambung')?.textContent),
      penuh: bersih(belakang?.querySelector('.muka-penuh')?.textContent),
      legenda: belakang ? belakang.querySelectorAll('.legend').length : 0,
      kompas: !!depan?.querySelector('.kompas'),
      // Sel terpotong selain kolom Set (indeks 1) — kolom Set memang boleh terelipsis.
      terpotong: [...sec.querySelectorAll('tbody td')].filter((td) => td.cellIndex !== 1 && td.scrollWidth > td.clientWidth + 1).length,
      // Judul kolom tak boleh terpotong satu pun.
      judulTerpotong: [...sec.querySelectorAll('thead th')].filter((th) => th.scrollWidth > th.clientWidth + 1).length,
      w: Math.round(r.width),
      h: Math.round(r.height),
      luapDepan: depan ? depan.scrollHeight - depan.clientHeight : -1,
      luapBelakang: belakang ? belakang.scrollHeight - belakang.clientHeight : -1,
    }
  })
  const halamanA4 = [...document.querySelectorAll('section.page')].map((sec) => ({
    baris: [...sec.querySelectorAll('tbody tr')].length,
  }))
  return { css, kartu, halamanA4, halaman: document.querySelectorAll('.halaman').length }
}

const nomorUrut = (n) => Array.from({ length: n }, (_, i) => String(i + 1))

await jalankan('kartu lipat buku saku (2b)', async (t) => {
  await t.siapkan()

  const bingkai = async () => {
    const el = await t.p.$('iframe[title="Pratinjau cetak"]')
    if (!el) throw new Error('bingkai pratinjau tidak ada')
    const f = await el.contentFrame()
    if (!f) throw new Error('bingkai pratinjau tidak bisa dibaca')
    return f
  }
  const bacaLipat = async () => (await bingkai()).evaluate(bacaLipatDiBingkai)

  /* ---------------- 1. show pendek: satu kartu, semua muat depan ---------------- */
  const pendek = await t.pratinjau({ pemain: 'Citra Dewi' })
  t.sama('satu kartu untuk satu pemain', pendek.length, 1)
  t.sama('kartu milik Citra Dewi', pendek[0]?.nama, 'Citra Dewi')
  t.sama('dua baris terbaca gabungan', pendek[0]?.baris.length, 2)
  const L1 = await bacaLipat()
  t.cek('kertasnya A4', L1.css.includes('size: A4 portrait'), L1.css.slice(0, 60))
  t.sama('satu lembaran kartu', L1.kartu.length, 1)
  const k = L1.kartu[0]
  t.sama('penomoran kartu 1/1', k.nomor, '1/1')
  t.sama('muka depan memuat baris 1–2', k.depan, ['1', '2'])
  t.sama('muka belakang tanpa baris', k.belakang, [])
  t.cek('muka belakang menunjuk ke depan', k.penuh.includes('muka depan'), k.penuh)
  t.sama('keterangan lengkap di belakang', k.legenda, 2)
  t.cek('kompas di muka depan', k.kompas)
  t.cek('kaki depan tanpa kata sambungan', k.kakiDepan.includes('Set 1–2') && !k.kakiDepan.includes('sambung'), k.kakiDepan)
  t.cek('kartu 190 × 135 mm (718 × 510 px)', Math.abs(k.w - 718) <= 3 && Math.abs(k.h - 510) <= 3, `${k.w} × ${k.h}`)
  t.sama('muka depan tidak meluap', k.luapDepan, 0)
  t.sama('muka belakang tidak meluap', k.luapBelakang, 0)
  t.sama('tak ada sel terpotong selain nama set', k.terpotong, 0)
  t.sama('judul kolom tak terpotong', k.judulTerpotong, 0)
  t.sama('satu halaman A4', L1.halaman, 1)

  /* ---------------- 2. show panjang: 64 set via Duplikat ---------------- */
  await t.tutupSemua()
  // Pilih Set 1 (16 count) lalu gandakan 62×: cepat, tanpa dialog.
  const pilihSet1 = await t.p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Set 1 — Blok'))
    if (!b) return false
    b.click()
    return true
  })
  if (!pilihSet1) throw new Error('tombol "Set 1 — Blok" tidak ada di daftar set')
  for (let i = 0; i < 62; i++) {
    const ok = await t.klikTeks('Duplikat')
    if (!ok) throw new Error(`klik Duplikat ke-${i + 1} gagal`)
    // Tunggu salinannya benar-benar masuk daftar (tiap set menampilkan "N titik ·").
    await t.p.waitForFunction(
      (n) => [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('titik ·')).length >= n,
      { timeout: 8000 },
      i + 3,
    )
  }
  const semuaSet = await t.setDiDb()
  t.sama('64 set sesudah menggandakan', semuaSet.length, 64)

  const panjang = await t.pratinjau({ pemain: 'Citra Dewi' })
  t.sama('penggabungan: tetap satu kartu per pemain', panjang.length, 1)
  t.sama('penggabungan: 64 baris urut', panjang[0]?.baris.length, 64)
  const L2 = await bacaLipat()
  t.sama('dua lembaran kartu', L2.kartu.length, 2)
  t.sama('penomoran kartu', L2.kartu.map((x) => x.nomor), ['1/2', '2/2'])
  const [k1, k2] = L2.kartu
  t.sama('kartu 1 depan: baris 1–27', k1.depan, nomorUrut(27))
  t.sama('kartu 1 belakang: baris 28–59', k1.belakang, nomorUrut(59).slice(27))
  t.sama('kartu 2 depan: baris 60–64', k2.depan, nomorUrut(64).slice(59))
  t.sama('kartu 2 belakang: tanpa baris', k2.belakang, [])
  t.cek('kartu 1 depan menunjuk ke belakang', k1.kakiDepan.includes('bersambung ke muka belakang'), k1.kakiDepan)
  t.cek('kartu 1 belakang menunjuk ke kartu 2', k1.kakiBelakang.includes('bersambung ke kartu 2'), k1.kakiBelakang)
  t.cek('kartu 1 belakang menyebut sambungan Set 28–59', k1.sambung.includes('Set 28–59'), k1.sambung)
  t.sama('kartu tengah tanpa keterangan', k1.legenda, 0)
  t.sama('keterangan hanya di kartu terakhir', k2.legenda, 2)
  t.cek('kartu 2 depan selesai tanpa sambungan', k2.kakiDepan.includes('Set 60–64') && !k2.kakiDepan.includes('sambung'), k2.kakiDepan)
  t.cek('kartu 2 belakang menyebut Set 60–64', k2.penuh.includes('Set 60–64'), k2.penuh)
  t.sama('tidak ada muka yang meluap', [k1.luapDepan, k1.luapBelakang, k2.luapDepan, k2.luapBelakang], [0, 0, 0, 0])
  t.sama('tak ada sel terpotong selain nama set', [k1.terpotong, k2.terpotong], [0, 0])
  t.sama('judul kolom tak terpotong', [k1.judulTerpotong, k2.judulTerpotong], [0, 0])
  t.sama('dua kartu muat satu halaman A4', L2.halaman, 1)

  /* ---------------- 3. semua pilihan mati ---------------- */
  await t.centang('Sertakan langkah per hitungan', false)
  await t.centang('Sertakan ukuran langkah', false)
  await t.centang('Sertakan kompas', false)
  const mati = await t.pratinjau({ pemain: 'Citra Dewi' })
  t.sama('tanpa pilihan: 64 baris tetap terbaca', mati[0]?.baris.length, 64)
  const L3 = await bacaLipat()
  t.sama('tanpa pilihan: dua kartu', L3.kartu.length, 2)
  t.cek('tanpa pilihan: tanpa kompas & keterangan', L3.kartu.every((x) => !x.kompas && x.legenda === 0))
  t.sama('tanpa pilihan: judul tak terpotong', L3.kartu.map((x) => x.judulTerpotong), [0, 0])
  t.sama('tanpa pilihan: tidak ada muka yang meluap',
    L3.kartu.flatMap((x) => [x.luapDepan, x.luapBelakang]), [0, 0, 0, 0])

  /* ---------------- 4. format Lembar A4 tak tersentuh ---------------- */
  if (!(await t.klikTeks('Lembar A4', { jendela: JENDELA.bukuSaku }))) {
    throw new Error('tombol "Lembar A4" tidak ada di jendela buku saku')
  }
  const a4 = await t.pratinjau({ pemain: 'Citra Dewi' })
  t.sama('A4: 64 baris terbaca gabungan', a4[0]?.baris.length, 64)
  const L4 = await bacaLipat()
  t.sama('A4: satu halaman penuh', L4.halamanA4.length, 1)
  t.sama('A4: 64 baris dalam satu tabel', L4.halamanA4[0]?.baris, 64)
  t.cek('A4: margin lega 14 mm', L4.css.includes('margin: 14mm'), L4.css.slice(0, 80))
})
