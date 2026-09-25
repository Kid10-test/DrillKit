/**
 * Uji murni J1 — transposisi penala (src/lib/tuner.ts).
 *
 * Yang dijaga: nada konser yang didengar mikrofon diterjemahkan ke nada
 * TERTULIS di partitur tiap instrumen, termasuk oktafnya; selisih sen tidak
 * ikut bergeser; setelan lama (tanpa kolom transposisi) tetap berperilaku
 * konser; dan id asing tidak pernah menggeser nada diam-diam.
 *
 * Acuan musikal (bukan hitungan kode): Bb4 konser dimainkan trumpet sebagai
 * C5, sax alto sebagai G5, mellophone sebagai F5; Bb3 konser dimainkan sax
 * tenor sebagai C5 dan sax bariton sebagai G5.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-transposisi.mjs
 */
import {
  DAFTAR_TRANSPOSISI,
  SETELAN_BAKU,
  bacaSetelan,
  cariTransposisi,
  dengungTertulis,
  hzKeNada,
  keTertulis,
  nadaKeHz,
  namaMidi,
} from '/tmp/tuner.mjs'

let lulus = 0
let gagal = 0
function uji(nama, kondisi, detail = '') {
  if (kondisi) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log(`  ✗ ${nama}${detail ? ' → ' + detail : ''}`)
  }
}

/* ----------------------------- namaMidi ----------------------------- */
uji('MIDI 69 = A4', namaMidi(69).label === 'A4', namaMidi(69).label)
uji('MIDI 70 = A#4 / Bb4', namaMidi(70).label === 'A#4 / Bb4', namaMidi(70).label)
uji('MIDI 60 = C4 (oktaf naik di C, bukan di A)', namaMidi(60).label === 'C4', namaMidi(60).label)
uji('MIDI 59 = B3', namaMidi(59).label === 'B3', namaMidi(59).label)
uji('hzKeNada tidak berubah: 440 → A4 0 sen', (() => { const h = hzKeNada(440); return h.label === 'A4' && Math.abs(h.sen) === 0 })())

/* ------------------------- Daftar transposisi ------------------------- */
const ids = DAFTAR_TRANSPOSISI.map((t) => t.id)
uji('id unik', new Set(ids).size === ids.length, ids.join(','))
uji('pilihan pertama = konser, geser 0', DAFTAR_TRANSPOSISI[0].id === 'c' && DAFTAR_TRANSPOSISI[0].geser === 0)
uji('tiap pilihan punya contoh instrumen', DAFTAR_TRANSPOSISI.every((t) => t.contoh.trim().length > 5))
const geser = Object.fromEntries(DAFTAR_TRANSPOSISI.map((t) => [t.id, t.geser]))
uji('Bb = naik M2 (2)', geser.bb === 2)
uji('Bb oktaf bawah = M9 (14)', geser.bb8 === 14)
uji('Eb = naik M6 (9)', geser.eb === 9)
uji('Eb oktaf bawah = oktaf + M6 (21)', geser.eb8 === 21)
uji('F = naik P5 (7)', geser.f === 7)

/* --------------------------- cariTransposisi --------------------------- */
uji('id dikenal', cariTransposisi('eb').id === 'eb')
uji('id asing → konser (tidak menggeser diam-diam)', cariTransposisi('g-bugle').geser === 0)
uji('undefined → konser', cariTransposisi(undefined).id === 'c')

/* --------------------- keTertulis: nada stem band --------------------- */
const bb4 = hzKeNada(nadaKeHz('A#', 4)) // Bb4 konser, 466,16 Hz
const bb3 = hzKeNada(nadaKeHz('A#', 3)) // Bb3 konser, 233,08 Hz
const f4 = hzKeNada(nadaKeHz('F', 4))
uji('trumpet: Bb4 konser → C5', keTertulis(bb4, 2).label === 'C5', keTertulis(bb4, 2).label)
uji('sax tenor: Bb3 konser → C5', keTertulis(bb3, 14).label === 'C5', keTertulis(bb3, 14).label)
uji('sax alto: Bb4 konser → G5', keTertulis(bb4, 9).label === 'G5', keTertulis(bb4, 9).label)
uji('sax bariton: Bb3 konser → G5', keTertulis(bb3, 21).label === 'G5', keTertulis(bb3, 21).label)
uji('mellophone: Bb4 konser → F5', keTertulis(bb4, 7).label === 'F5', keTertulis(bb4, 7).label)
uji('mellophone: F4 konser → C5', keTertulis(f4, 7).label === 'C5', keTertulis(f4, 7).label)
uji('konser: tidak berubah', keTertulis(bb4, 0).label === bb4.label)
uji('A4 konser di trumpet → B4', keTertulis(hzKeNada(440), 2).label === 'B4')
uji('C4 konser di trumpet → D4 (lewat batas oktaf benar)', keTertulis(hzKeNada(nadaKeHz('C', 4)), 2).label === 'D4')
uji('B3 konser di trumpet → C#4 / Db4 (oktaf naik)', keTertulis(hzKeNada(nadaKeHz('B', 3)), 2).label === 'C#4 / Db4',
  keTertulis(hzKeNada(nadaKeHz('B', 3)), 2).label)

/* ----------- Nada yang meleset: nama tertulis ikut nada terdekat ----------- */
{
  const fals = hzKeNada(466.16 * Math.pow(2, -20 / 1200)) // Bb4 −20 sen
  uji('Bb4 −20 sen tetap Bb4 konser', fals.label === 'A#4 / Bb4' && fals.sen === -20, `${fals.label} ${fals.sen}`)
  uji('… tertulis C5 untuk trumpet (sen tak ikut bergeser)', keTertulis(fals, 2).label === 'C5')
  const tinggi = hzKeNada(466.16 * Math.pow(2, 45 / 1200))
  uji('Bb4 +45 sen masih dinamai dari nada terdekat', keTertulis(tinggi, 2).label === 'C5', keTertulis(tinggi, 2).label)
}

/* ------------------------- Acuan A4 selain 440 ------------------------- */
{
  const h = hzKeNada(nadaKeHz('A#', 4, 442), 442)
  uji('acuan 442: Bb4 → C5 trumpet', keTertulis(h, 2, 442).label === 'C5' && Math.abs(h.sen) === 0)
}

/* --------------------------- dengungTertulis --------------------------- */
uji('dengung Bb3 konser → C4 trumpet', dengungTertulis('A#', 3, 2) === 'C4')
uji('dengung Bb3 konser → C5 sax tenor', dengungTertulis('A#', 3, 14) === 'C5')
uji('dengung Bb3 konser → G4 sax alto', dengungTertulis('A#', 3, 9) === 'G4')
uji('dengung Bb3 konser → F4 mellophone', dengungTertulis('A#', 3, 7) === 'F4')
uji('dengung ejaan flat diterima (Bb)', dengungTertulis('Bb', 3, 2) === 'C4')

/* ------------------------------ Setelan ------------------------------ */
{
  const simpan = new Map()
  globalThis.localStorage = {
    getItem: (k) => (simpan.has(k) ? simpan.get(k) : null),
    setItem: (k, v) => simpan.set(k, String(v)),
  }
  uji('bawaan: konser', SETELAN_BAKU.transposisi === 'c' && bacaSetelan().transposisi === 'c')
  // Setelan versi E4 (sebelum J1): tidak punya kolom transposisi.
  simpan.set('drillkit.penala', JSON.stringify({ a4: 442, nada: 'F', oktaf: 3, bentuk: 'sine', volume: 0.5, kelima: 0 }))
  const lama = bacaSetelan()
  uji('setelan lama tetap terbaca (a4/nada utuh)', lama.a4 === 442 && lama.nada === 'F')
  uji('setelan lama → konser (perilaku lama)', lama.transposisi === 'c')
  simpan.set('drillkit.penala', JSON.stringify({ ...lama, transposisi: 'eb' }))
  uji('transposisi tersimpan terbaca kembali', bacaSetelan().transposisi === 'eb')
  simpan.set('drillkit.penala', JSON.stringify({ ...lama, transposisi: 'xx' }))
  uji('transposisi asing di penyimpanan → konser', bacaSetelan().transposisi === 'c')
  simpan.set('drillkit.penala', JSON.stringify({ ...lama, transposisi: 7 }))
  uji('transposisi bukan teks → konser', bacaSetelan().transposisi === 'c')
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
