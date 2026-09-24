/**
 * DD8 — kolom "langkah per hitungan" (Lk/cnt) di buku saku.
 *
 * Yang diuji, dari kertas yang benar-benar dicetak (bingkai pratinjau):
 *   1. kotak centang "Sertakan langkah per hitungan" ada dan menyala bawaan;
 *   2. kolom Lk/cnt tercetak di kartu SETIAP pemain, dengan legendanya;
 *   3. angkanya benar: Eka 29 langkah dalam 16 count = 1,82 (IDE-PENGEMBANGAN
 *      "Hasil DD8"), dan di SEMUA kartu Lk/cnt sejalan dengan Langkah ÷ Cnt;
 *   4. warna hanya untuk yang berat/mustahil, dan warnanya sama dengan
 *      legenda di bawah tabel — gerakan nyaman tetap hitam (hemat tinta);
 *   5. mematikan centang menghilangkan kolom DAN legendanya, tanpa
 *      mengganggu kolom lainnya.
 *
 * 2a — dihidupkan kembali. Rangkaian ini dulu skrip pengintai tanpa asersi:
 * sejak layar sambutan ada, ia mencetak `"buka": false` dengan kode keluar 0,
 * dan `regresi.sh` melaporkannya `"error": [] | tanda ✗: 0` — tampak bersih.
 * Setelah sambutan dilewati pun pemeriksaannya sendiri sudah rusak (diperiksa
 * dengan menjalankan versi lamanya, 23 Sep 2026):
 *   - sejak DD10 kolom langkah berisi panah (`17 →`), jadi `Number()`-nya NaN
 *     dan SETIAP baris dinyatakan "tidak cocok";
 *   - warnanya dibaca dari sel terakhir, yang sejak DD10b adalah kolom
 *     Ukuran langkah, bukan Lk/cnt;
 *   - yang diperiksa hanya kartu pertama — pemain yang berbeda di setiap
 *     perangkat baru (lihat `kartuMilik`).
 * Lihat `alat-buku-saku.mjs`.
 *
 * Pakai: BASE=http://localhost:4173 node dd8.mjs
 */
import {
  gerakPertama,
  jalankan,
  kartuMilik,
  lkCntSejalan,
  tempoKartu,
  warnaLegenda,
  warnaSel,
} from './alat-buku-saku.mjs'

const CENTANG = 'Sertakan langkah per hitungan'

await jalankan('DD8 — Lk/cnt di buku saku', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /* ------------------------------ 1. centang ------------------------------ */
  await t.bukaBukuSaku()
  sama(`1: centang "${CENTANG}" ada dan menyala bawaan`, await t.statusCentang(CENTANG), true)

  /* ----------------------- 2. kolom & legenda tercetak ---------------------- */
  const kartu = await t.pratinjau({ pemain: null })
  sama('2: satu kartu per pemain (18)', kartu.length, 18)
  cek(
    '2: kolom Lk/cnt ada di SEMUA kartu',
    kartu.every((k) => k.kepala.includes('Lk/cnt')),
    kartu.filter((k) => !k.kepala.includes('Lk/cnt')).map((k) => k.nama).join(', '),
  )
  cek(
    '2: legenda Lk/cnt tercetak di bawah tabel',
    kartu.every((k) => k.legenda.some((l) => l.startsWith('Lk/cnt = langkah per hitungan'))),
  )
  const tk = tempoKartu(kartu[0])
  sama('2: kepala kartu menyebut tempo drill (120 BPM · 1 ketuk/count)', tk, { tempo: 120, ketuk: 1 })

  /* --------------------------- 3. angkanya benar --------------------------- */
  const eka = kartuMilik(kartu, 'Eka Wulandari')
  cek('3: kartu Eka Wulandari ada', !!eka)
  const g = gerakPertama(eka)
  sama('3: Eka — Set 1 → Set 2 dalam 16 count', g.cnt, 16)
  sama('3: Eka — 29 langkah (IDE-PENGEMBANGAN: "29 langkah")', g.langkah, 29)
  sama('3: Eka — Lk/cnt 1.82 (IDE-PENGEMBANGAN: "1,82")', g.lpc, 1.82)

  const tidakSejalan = kartu
    .map((k) => ({ nama: k.nama, ...gerakPertama(k) }))
    .filter((x) => !lkCntSejalan(x.langkah, x.cnt, x.lpc))
  cek(
    '3: di semua kartu Lk/cnt sejalan dengan Langkah ÷ Cnt (batas pembulatan ½ ÷ Cnt)',
    tidakSejalan.length === 0,
    tidakSejalan.map((x) => `${x.nama}: ${x.langkah}/${x.cnt} vs ${x.lpc}`).join('; '),
  )
  cek(
    '3: set terakhir tidak punya perpindahan — Lk/cnt "-"',
    kartu.every((k) => {
      const i = k.kepala.indexOf('Lk/cnt')
      return k.baris[1]?.[i]?.teks === '-'
    }),
  )

  /* -------------------- 4. warna: hemat tinta, sesuai legenda --------------- */
  const leg = warnaLegenda(eka)
  cek('4: legenda punya warna "berat" dan "mustahil"', !!leg.berat && !!leg.mustahil, JSON.stringify(leg))
  // Pada 120 BPM: 1,82 lk/cnt = 218 lk/mnt (> 180, mustahil).
  sama('4: Eka (218 lk/mnt) diwarnai "mustahil", sama dengan legenda', warnaSel(g.lpcHtml), leg.mustahil)
  // 1,32 lk/cnt = 158 lk/mnt (150–180, berat).
  const citra = gerakPertama(kartuMilik(kartu, 'Citra Dewi'))
  sama('4: Citra (158 lk/mnt) diwarnai "berat", sama dengan legenda', warnaSel(citra.lpcHtml), leg.berat)
  // 0,81 lk/cnt = 97 lk/mnt — nyaman, tidak berwarna.
  const andra = gerakPertama(kartuMilik(kartu, 'Andra Pratama'))
  sama('4: Andra (97 lk/mnt, nyaman) hitam biasa — tanpa warna', warnaSel(andra.lpcHtml), null)
  catat(`Eka ${g.lpc} · Citra ${citra.lpc} · Andra ${andra.lpc}`)
  await t.simpanGambar('dd8-dengan-lpc.png')
  await t.tutupPratinjau()

  /* --------------------- 5. centang dimatikan → hilang --------------------- */
  sama('5: centang bisa dimatikan', await t.centang(CENTANG, false), false)
  const tanpa = await t.pratinjau()
  cek('5: kolom Lk/cnt hilang dari semua kartu', tanpa.every((k) => !k.kepala.includes('Lk/cnt')))
  cek(
    '5: legenda Lk/cnt ikut hilang',
    tanpa.every((k) => !k.legenda.some((l) => l.startsWith('Lk/cnt'))),
  )
  sama(
    '5: kolom lain tetap: # · Set · Cnt · Koordinat · Langkah & arah · Ukuran langkah',
    tanpa[0]?.kepala,
    ['#', 'Set', 'Cnt', 'Koordinat', 'Langkah & arah', 'Ukuran langkah'],
  )
  sama('5: angka langkah Eka tidak berubah (29)', gerakPertama(kartuMilik(tanpa, 'Eka Wulandari')).langkah, 29)
  await t.tutupPratinjau()

  sama('5: centang dinyalakan kembali → kolomnya kembali', await t.centang(CENTANG, true), true)
  const lagi = await t.pratinjau()
  cek('5: Lk/cnt tercetak lagi', lagi.every((k) => k.kepala.includes('Lk/cnt')))
  await t.tutupSemua()
})
