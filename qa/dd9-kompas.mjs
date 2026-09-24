/**
 * Buku saku DD10 — kompas, panah, dan koordinat, dengan sistem patok MATI
 * (bawaan) dan MENYALA. (Nama berkasnya dd9-kompas, tetapi yang diuji adalah
 * "Hasil DD10" di IDE-PENGEMBANGAN.)
 *
 * Yang diuji, dari kertas yang benar-benar dicetak:
 *   1. patok mati: kompas BELAKANG · PENONTON · S1 · S2 tercetak di tiap kartu;
 *      keterangannya hanya "panah = arah jalan" — penjelasan A/−/+ disembunyikan;
 *      koordinat memakai garis yard (mis. "S2 · YL40 · FH +2.75");
 *   2. saklar "Pakai sistem patok" di ⚙ benar-benar tersimpan (basis data);
 *   3. patok menyala: keterangan A/−/+ dan C′ tercetak; contoh dari
 *      IDE-PENGEMBANGAN tepat: Gita `C' · T5 +2.75` → `B' +2.25 · T6 +0.75`, `↖`;
 *   4. koma atas (′) menandai sisi S2 — DICOCOKKAN SILANG dengan sisi S1/S2
 *      pada koordinat garis yard untuk pemain & set yang sama. Dua sistem
 *      koordinat yang dihitung terpisah harus sepakat di sisi mana pemain berdiri;
 *   5. panah itu mutlak (mata angin): sama persis dengan atau tanpa patok, dan
 *      jumlah kolom tidak bertambah — panahnya menumpang di kolom jarak;
 *   6. centang "Sertakan kompas & panah arah" dimatikan → kompas & panah hilang,
 *      jumlah kolom tetap;
 *   7. patok dimatikan lagi → koordinat kembali persis seperti semula.
 *
 * 2a — dihidupkan kembali (sebelumnya pengintai tanpa asersi, dan tertutup
 * layar sambutan). Tangkapan layar kini opsional: `SHOTS=/folder`.
 *
 * Pakai: BASE=http://localhost:4173 node dd9-kompas.mjs
 */
import { gerakPertama, jalankan, kartuMilik } from './alat-buku-saku.mjs'

const PATOK = 'Pakai sistem patok'
const ARAH = 'Sertakan kompas & panah arah'
const MATA_ANGIN = ['BELAKANG', 'PENONTON', 'S1', 'S2']
/** Koordinat garis yard: sisi · garis yard (± langkah) · acuan melintang (± langkah). */
const POLA_YARD = /^S[12] · YL\d+(?: [+-]\d+(?:\.\d+)?)? · (?:FH|BH|FSL|BSL)(?: [+-]\d+(?:\.\d+)?)?$/

/** Koordinat set ke-`i` untuk semua pemain: nama → teks. */
const koordinat = (kartu, i) => new Map(kartu.map((k) => [k.nama, k.baris[i]?.[k.kepala.indexOf('Koordinat')]?.teks ?? null]))
/** Apakah label huruf patok bertanda koma atas (sisi negatif A)? `C'`, `B' +1.5`, `A#'`. */
const bertandaSisi = (teks) => /^[A-Z]+#?'/.test(String(teks).split(' · ')[0])

await jalankan('DD10 — kompas, panah & koordinat buku saku', async (t) => {
  const { cek, sama, catat } = t
  await t.siapkan()

  /* ----------------------------- 1. patok mati ----------------------------- */
  sama('1: drill contoh mulai tanpa sistem patok', (await t.drillDiDb())?.field?.patok?.aktif ?? 0, 0)
  const bola = await t.pratinjau({ pemain: null })
  sama('1: satu kartu per pemain (18)', bola.length, 18)
  cek('1: kompas tercetak di SEMUA kartu', bola.every((k) => k.kompas))
  sama('1: mata angin kompas: BELAKANG · PENONTON · S1 · S2', bola[0].kompas?.label, MATA_ANGIN)
  cek('1: keterangan kompas "panah = arah jalan"', /panah = arah jalan/.test(bola[0].kompas?.teks ?? ''), bola[0].kompas?.teks)
  cek(
    '1: penjelasan A / − / + disembunyikan bila tidak memakai patok',
    !/tengah lapangan|mendekati A|menjauhi A/.test(bola[0].kompas?.teks ?? ''),
    bola[0].kompas?.teks,
  )
  const bola0 = koordinat(bola, 0)
  const bola1 = koordinat(bola, 1)
  const salahPola = [...bola0, ...bola1].filter(([, k]) => !POLA_YARD.test(k ?? ''))
  cek(
    '1: semua koordinat berbentuk garis yard (S1/S2 · YL · FH/BH/…)',
    salahPola.length === 0,
    salahPola.slice(0, 3).map(([n, k]) => `${n}: ${k}`).join('; '),
  )
  sama('1: Gita di Set 1 — "S2 · YL40 · FH +2.75"', bola0.get('Gita Permata'), 'S2 · YL40 · FH +2.75')
  await t.simpanGambar('dd9-bola.png')

  /* -------------------- 2. saklar patok tersimpan ------------------------- */
  const nyala = await t.ubahSetelanDrill(() => t.saklar(PATOK, true))
  sama(`2: saklar "${PATOK}" menyala di ⚙`, nyala, true)
  sama('2: patok tersimpan aktif di basis data', (await t.drillDiDb())?.field?.patok?.aktif, 1)

  /* ----------------------- 3. patok menyala ---------------------------- */
  const patok = await t.pratinjau()
  sama('3: satu kartu per pemain (18)', patok.length, 18)
  sama('3: mata angin kompas tetap sama', patok[0].kompas?.label, MATA_ANGIN)
  const ket = patok[0].kompas?.teks ?? ''
  cek('3: keterangan "A = tengah lapangan"', ket.includes('A = tengah lapangan'), ket)
  cek('3: keterangan "− mendekati A · + menjauhi A"', ket.includes('− mendekati A') && ket.includes('+ menjauhi A'), ket)
  cek("3: keterangan \"C' = C di seberang A (sisi S2)\"", ket.includes("C' = C di seberang A (sisi S2)"), ket)
  cek('3: keterangan "panah = arah jalan"', ket.includes('panah = arah jalan'), ket)

  const gita = kartuMilik(patok, 'Gita Permata')
  const gp = gerakPertama(gita)
  sama("3: Gita Set 1 — \"C' · T5 +2.75\" (contoh IDE-PENGEMBANGAN)", gp.koordinat, "C' · T5 +2.75")
  sama(
    "3: Gita Set 2 — \"B' +2.25 · T6 +0.75\"",
    gita?.baris[1]?.[gita.kepala.indexOf('Koordinat')]?.teks,
    "B' +2.25 · T6 +0.75",
  )
  sama('3: Gita — satu panah, ↖', gp.panah, ['↖'])
  await t.simpanGambar('dd9-patok.png')

  /* ------------- 4. koma atas = sisi S2 (dicocokkan silang) --------------- */
  const patok0 = koordinat(patok, 0)
  const patok1 = koordinat(patok, 1)
  const tidakSepakat = []
  for (const [yard, pt] of [
    [bola0, patok0],
    [bola1, patok1],
  ]) {
    for (const [nama, k] of yard) {
      const sisiS2 = String(k).startsWith('S2')
      if (sisiS2 !== bertandaSisi(pt.get(nama))) tidakSepakat.push(`${nama}: ${k} ↔ ${pt.get(nama)}`)
    }
  }
  cek(
    "4: koma atas (′) muncul TEPAT pada pemain di sisi S2 — sepakat dengan garis yard (36 koordinat)",
    tidakSepakat.length === 0,
    tidakSepakat.slice(0, 4).join('; '),
  )
  const jmlS2 = [...bola0.values(), ...bola1.values()].filter((k) => String(k).startsWith('S2')).length
  cek('4: data contoh memang punya pemain di dua sisi', jmlS2 > 0 && jmlS2 < 36, `${jmlS2} dari 36 di S2`)

  /* ------------------ 5. panah mutlak, kolom tidak bertambah -------------- */
  const panahBeda = bola
    .map((k) => ({ nama: k.nama, a: gerakPertama(k).panah.join(''), b: gerakPertama(kartuMilik(patok, k.nama)).panah.join('') }))
    .filter((x) => x.a !== x.b)
  cek(
    '5: panah tiap pemain sama persis dengan atau tanpa patok (mata angin, bukan patok)',
    panahBeda.length === 0,
    panahBeda.map((x) => `${x.nama}: ${x.a} vs ${x.b}`).join('; '),
  )
  cek(
    '5: tiap perpindahan tepat satu panah',
    patok.every((k) => gerakPertama(k).panah.length === 1),
  )
  sama('5: kolom kartu sama dengan atau tanpa patok', patok[0].kepala, bola[0].kepala)
  catat(`kolom: ${patok[0].kepala.join(' | ')}`)

  /* ------------- 6. kompas & panah bisa dimatikan tanpa menggeser kolom ------- */
  sama(`6: centang "${ARAH}" bisa dimatikan`, await t.centang(ARAH, false), false)
  const polos = await t.pratinjau()
  cek('6: kompas hilang dari semua kartu', polos.every((k) => !k.kompas))
  cek('6: panah hilang dari semua baris', polos.every((k) => gerakPertama(k).panah.length === 0))
  cek(
    '6: judul kolom jadi "→ langkah", jumlah kolom tetap',
    polos[0].kepala.includes('→ langkah') && polos[0].kepala.length === patok[0].kepala.length,
    polos[0].kepala.join(' | '),
  )
  sama('6: koordinat tidak terpengaruh', koordinat(polos, 0).get('Gita Permata'), "C' · T5 +2.75")
  await t.tutupPratinjau()
  sama(`6: centang "${ARAH}" dinyalakan kembali`, await t.centang(ARAH, true), true)
  await t.tutupSemua()

  /* ---------------------- 7. patok dimatikan lagi ------------------------ */
  const mati = await t.ubahSetelanDrill(() => t.saklar(PATOK, false))
  sama(`7: saklar "${PATOK}" mati`, mati, false)
  sama('7: patok tersimpan nonaktif di basis data', (await t.drillDiDb())?.field?.patok?.aktif, 0)
  const lagi = await t.pratinjau()
  const berubah = lagi.filter((k) => koordinat(lagi, 0).get(k.nama) !== bola0.get(k.nama))
  cek(
    '7: koordinat kembali persis seperti sebelum patok dinyalakan',
    berubah.length === 0,
    berubah.slice(0, 3).map((k) => k.nama).join(', '),
  )
  cek('7: keterangan A / − / + kembali disembunyikan', !/mendekati A/.test(lagi[0].kompas?.teks ?? ''))
  await t.tutupSemua()
})
