/**
 * #27 — Jembatan langsung MuseScore (`.mscz` / `.mscx` → MusicXML): uji logika murni.
 *
 * Seluruh fikstur di bawah ini **disusun tangan** (clean-room) dari pengamatan
 * format berkas — tidak ada berkas uji MuseScore (GPL-3.0) yang disalin.
 *
 * Yang diuji:
 *   1. MuseScore 4: part transposisi (Trumpet B♭ → `<transpose>`, kunci tertulis,
 *      nada tertulis dari `tpc2`), birama gantung `implicit`, repeat ‖: :‖,
 *      huruf latihan & tempo disalin ke semua part, ♩.=80 di 6/8 (`beat-unit-dot`
 *      + `sound tempo` per-♩), *rit.*, drumset perkusi → `<unpitched>` +
 *      `<instrument>` + kepala not, *sticking* R/L, tuplet bertumpuk MS4.
 *   2. Hasilnya lulus `putusanPartitur` & bisa dibunyikan `partiturBunyi`
 *      (nada konser kembali ke nada asli).
 *   3. MuseScore 3: tie `Tie id`/`endSpanner`, tuplet ber-id, kunci `accidental`.
 *   4. `.mscz` (ZIP stored & deflate, `META-INF/container.xml`, gambar mini)
 *      → hasil identik dengan `.mscx`; deteksi didahulukan dari `.mxl`.
 *   5. Ottava 8va → `<octave-shift>` + geser nada; peringatan lirik & format lama.
 *   6. Gerbang Buka Berkas: jalur sinkron menolak sopan, jalur async menerjemahkan.
 *   7. Berkas rusak/kosong/terpotong → `{ ok: false }` tanpa lemparan.
 *   8. Satu klik "Tarik peta" dari hasil konversi (lihat juga peta-partitur-logika).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/mscz-logika.mjs
 */
import { deflateRawSync } from 'node:zlib'
import { bikinZip, crc32 } from '/tmp/zip.mjs'
import { deteksiPartitur, putusanPartitur, PESAN_MUSESCORE } from '/tmp/partitur.mjs'
import { apakahArsipMuseScore } from '/tmp/mxl.mjs'
import { namaMusicXmlDariMuseScore, uraiMuseScore, konversiMscxKeMusicXml } from '/tmp/mscz.mjs'
import { uraiJadwalNadaMusicXml } from '/tmp/partiturBunyi.mjs'
import { kenaliBerkas, kenaliBerkasAsync } from '/tmp/bukaBerkas.mjs'
import { tarikPetaPartitur } from '/tmp/petaPartitur.mjs'
import { MS3, MS4 } from './fikstur-musescore.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}
const keBita = (t) => new TextEncoder().encode(t)
const keTeks = (b) => new TextDecoder().decode(b)
const part = (xml, id) => xml.split(`<part id="${id}">`)[1]?.split('</part>')[0] ?? ''
const birama = (xmlPart, n) => xmlPart.split(`<measure number="${n}"`)[1]?.split('</measure>')[0] ?? ''

/** ZIP deflate minimal (metode 8) untuk meniru `.mscz` sungguhan. */
function zipDeflate(entri) {
  const pot = []
  const pusat = []
  let offset = 0
  for (const e of entri) {
    const nama = keBita(e.nama)
    const mentah = typeof e.isi === 'string' ? keBita(e.isi) : e.isi
    const padat = new Uint8Array(deflateRawSync(mentah))
    const crc = crc32(mentah)
    const lokal = new Uint8Array(30 + nama.length)
    const dl = new DataView(lokal.buffer)
    dl.setUint32(0, 0x04034b50, true)
    dl.setUint16(4, 20, true)
    dl.setUint16(6, 0x0800, true)
    dl.setUint16(8, 8, true)
    dl.setUint32(14, crc, true)
    dl.setUint32(18, padat.length, true)
    dl.setUint32(22, mentah.length, true)
    dl.setUint16(26, nama.length, true)
    lokal.set(nama, 30)
    const cd = new Uint8Array(46 + nama.length)
    const dc = new DataView(cd.buffer)
    dc.setUint32(0, 0x02014b50, true)
    dc.setUint16(4, 20, true)
    dc.setUint16(6, 20, true)
    dc.setUint16(8, 0x0800, true)
    dc.setUint16(10, 8, true)
    dc.setUint32(16, crc, true)
    dc.setUint32(20, padat.length, true)
    dc.setUint32(24, mentah.length, true)
    dc.setUint16(28, nama.length, true)
    dc.setUint32(42, offset, true)
    cd.set(nama, 46)
    pot.push(lokal, padat)
    pusat.push(cd)
    offset += lokal.length + padat.length
  }
  const ukPusat = pusat.reduce((a, b) => a + b.length, 0)
  const eocd = new Uint8Array(22)
  const de = new DataView(eocd.buffer)
  de.setUint32(0, 0x06054b50, true)
  de.setUint16(8, entri.length, true)
  de.setUint16(10, entri.length, true)
  de.setUint32(12, ukPusat, true)
  de.setUint32(16, offset, true)
  const semua = [...pot, ...pusat, eocd]
  const out = new Uint8Array(semua.reduce((a, b) => a + b.length, 0))
  let o = 0
  for (const s of semua) {
    out.set(s, o)
    o += s.length
  }
  return out
}

const containerMscz = (jalur) => `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="${jalur}"/><rootfile full-path="Thumbnails/thumbnail.png"/></rootfiles></container>`
const PNG_MINI = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

/* ------------------------------------------------------------------------ */
console.log('\n1. MuseScore 4 (.mscx) → MusicXML')
const r4 = await uraiMuseScore(keBita(MS4))
cek('uraiMuseScore MS4 ok', r4.ok, r4.alasan)
cek('versi 4.20 · asal mscx', r4.versi === '4.20' && r4.asal === 'mscx')
cek('judul dari workTitle', r4.judul === 'Mars Uji Lapangan')
cek('2 part · 6 birama · tanpa peringatan', r4.jumlahPart === 2 && r4.jumlahBirama === 6 && r4.peringatan.length === 0, JSON.stringify(r4.peringatan))
const x4 = keTeks(r4.bitaXml)
const p1 = part(x4, 'P1')
const p2 = part(x4, 'P2')
cek('akar score-partwise 4.0', x4.includes('<score-partwise version="4.0">'))
cek('nama & singkatan part', x4.includes('<part-name>Trumpet in B♭</part-name>') && x4.includes('<part-abbreviation>Tpt.</part-abbreviation>'))
cek('Trumpet: <transpose> diatonik −1 kromatik −2', p1.includes('<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>'))
cek('Trumpet: kunci konser B♭ (−2) → tertulis C (0)', birama(p1, 1).includes('<key><fifths>0</fifths></key>'))
cek('Trumpet: nada konser B♭4 → tertulis C5 (tpc2)', birama(p1, 1).includes('<step>C</step><octave>5</octave>'))
cek('birama gantung 1/4 → implicit="yes"', p1.includes('<measure number="1" implicit="yes">') && p2.includes('<measure number="1" implicit="yes">'))
cek('repeat maju di b.2 & mundur di b.3', birama(p1, 2).includes('<repeat direction="forward"/>') && birama(p1, 3).includes('<repeat direction="backward"/>'))
cek('huruf latihan A & B disalin ke semua part', birama(p1, 2).includes('<rehearsal>A</rehearsal>') && birama(p2, 2).includes('<rehearsal>A</rehearsal>') && birama(p2, 4).includes('<rehearsal>B</rehearsal>'))
cek('♩=120 → metronom + sound tempo', birama(p1, 1).includes('<beat-unit>quarter</beat-unit><per-minute>120</per-minute>') && birama(p1, 1).includes('<sound tempo="120"/>'))
cek('♩.=80 di 6/8 → beat-unit-dot, sound tempo 120 per ♩', birama(p1, 4).includes('<beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>80</per-minute>') && birama(p1, 4).includes('<sound tempo="120"/>'))
cek('sukat 6/8 di b.4', birama(p1, 4).includes('<time><beats>6</beats><beat-type>8</beat-type></time>'))
cek('rit. (GradualTempoChange) → words', birama(p1, 5).includes('<words>rit.</words>'))
cek('kata tempo "Maestoso" + ♩.=60 (sound 90)', birama(p1, 6).includes('<words>Maestoso</words>') && birama(p1, 6).includes('<sound tempo="90"/>'))
cek('garis akhir light-heavy', birama(p1, 6).includes('<bar-style>light-heavy</bar-style>'))
cek('istirahat sebirama kosong → rest measure', birama(p1, 3).includes('<rest measure="yes"/>'))
cek('Snare: kunci perkusi', birama(p2, 1).includes('<clef><sign>percussion</sign></clef>'))
cek('Snare: daftar instrumen drumset', x4.includes('<instrument-name>Snare</instrument-name>') && x4.includes('<instrument-name>Rim</instrument-name>'))
cek('Snare: not → <unpitched> + <instrument>', birama(p2, 2).includes('<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>') && birama(p2, 2).includes('<instrument id="P2-I39"/>'))
cek('Rim: kepala not silang → notehead x', birama(p2, 2).includes('<instrument id="P2-I38"/>') && birama(p2, 2).includes('<notehead>x</notehead>'))
cek('sticking R & L → words di bawah', birama(p2, 2).includes('<words>R</words>') && birama(p2, 2).includes('<words>L</words>'))
cek('triol MS4 → time-modification 3:2 + kurung', (birama(p2, 2).match(/<actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes>/g) ?? []).length === 3 && birama(p2, 2).includes('<tuplet type="start" bracket="yes"/>') && birama(p2, 2).includes('<tuplet type="stop"/>'))
cek('durasi triol 160 + 3×160 + 2×480 + 480 = 1920', birama(p2, 2).includes('<duration>160</duration>'))
cek('konversiMscxKeMusicXml (teks) setara uraiMuseScore', (() => {
  const k = konversiMscxKeMusicXml(MS4)
  return k.ok && k.xml === x4
})())

console.log('\n2. Hasil lulus gerbang partitur & bisa dibunyikan')
const put = putusanPartitur(r4.bitaXml)
cek('putusanPartitur boleh · musicxml', put.boleh && put.tipe === 'musicxml')
cek('ringkasan: 6 birama, 2 part, perubahan sukat 6/8 di b.4', put.ringkas?.jumlahBirama === 6 && put.ringkas?.jumlahPart === 2 && put.ringkas?.perubahanSukat?.some((s) => s.birama === 4 && s.beats === 6 && s.beatType === 8))
const jadwal = uraiJadwalNadaMusicXml(x4)
const nadaP1 = jadwal.nada.filter((n) => n.idPart === 'P1' && n.jenis === 'nada')
cek('partiturBunyi: Trumpet kembali ke nada konser B♭4 (70), C5, D5', nadaP1[0]?.midiKonser === 70 && nadaP1[1]?.midiKonser === 72 && nadaP1[2]?.midiKonser === 74, JSON.stringify(nadaP1.slice(0, 3).map((n) => n.midiKonser)))
const mulaiSnare = jadwal.nada.filter((n) => n.idPart === 'P2' && n.birama === 2).map((n) => Math.round(n.mulaiPerempat * 1000) / 1000)
cek('partiturBunyi: triol snare di ketuk 3 → 0, 1, 2, 2.333, 2.667, 3', JSON.stringify(mulaiSnare) === JSON.stringify([0, 1, 2, 2.333, 2.667, 3]), JSON.stringify(mulaiSnare))

console.log('\n3. MuseScore 3 (.mscx)')
const r3 = await uraiMuseScore(keBita(MS3))
cek('uraiMuseScore MS3 ok · versi 3.02', r3.ok && r3.versi === '3.02', r3.alasan)
const x3 = r3.ok ? keTeks(r3.bitaXml) : ''
cek('kunci accidental 1 → fifths 1', x3.includes('<key><fifths>1</fifths></key>'))
cek('kata "Andante" + ♩=90', x3.includes('<words>Andante</words>') && x3.includes('<per-minute>90</per-minute>'))
cek('tie MS3 (Tie id / endSpanner) → tie start/stop', x3.includes('<tie type="start"/>') && x3.includes('<tie type="stop"/>') && x3.includes('<tied type="start"/>'))
cek('tuplet MS3 ber-id → 3:2 durasi 320', (x3.match(/<duration>320<\/duration>/g) ?? []).length === 3 && x3.includes('<tuplet type="start" bracket="yes"/>'))
cek('ejaan tpc 20 → F♯5', x3.includes('<step>F</step><alter>1</alter><octave>5</octave>'))

console.log('\n4. Arsip .mscz')
const zStored = bikinZip([
  { nama: 'META-INF/container.xml', isi: containerMscz('Mars Uji.mscx') },
  { nama: 'Thumbnails/thumbnail.png', isi: PNG_MINI },
  { nama: 'Mars Uji.mscx', isi: MS4 },
])
const zDeflate = zipDeflate([
  { nama: 'META-INF/container.xml', isi: containerMscz('Mars Uji.mscx') },
  { nama: 'audiosettings.json', isi: '{}' },
  { nama: 'Mars Uji.mscx', isi: MS4 },
  { nama: 'Thumbnails/thumbnail.png', isi: PNG_MINI },
])
const zTanpaContainer = zipDeflate([{ nama: 'lagu.mscx', isi: MS3 }])
cek('apakahArsipMuseScore: stored & deflate ya', apakahArsipMuseScore(zStored) && apakahArsipMuseScore(zDeflate))
cek('deteksiPartitur: .mscz → tipe musescore (didahulukan dari .mxl)', deteksiPartitur(zStored).tipe === 'musescore' && deteksiPartitur(zDeflate).tipe === 'musescore')
cek('deteksiPartitur: .mscx teks → tipe musescore', deteksiPartitur(keBita(MS4)).tipe === 'musescore')
cek('putusanPartitur langsung menolak sopan (perlu diterjemahkan dulu)', !putusanPartitur(zStored).boleh && putusanPartitur(zStored).tipe === 'musescore')
for (const [nama, z] of [['stored', zStored], ['deflate', zDeflate]]) {
  const rz = await uraiMuseScore(z)
  cek(`.mscz ${nama}: ok · asal mscz · jalur utama`, rz.ok && rz.asal === 'mscz' && rz.jalurUtama === 'Mars Uji.mscx', rz.alasan)
  cek(`.mscz ${nama}: MusicXML identik dengan .mscx`, rz.ok && keTeks(rz.bitaXml) === x4)
}
const rTanpa = await uraiMuseScore(zTanpaContainer)
cek('.mscz tanpa container.xml → cari .mscx sendiri', rTanpa.ok && rTanpa.versi === '3.02', rTanpa.alasan)
cek('nama simpan: lagu.mscz → lagu.musicxml', namaMusicXmlDariMuseScore('Mars Uji.mscz') === 'Mars Uji.musicxml' && namaMusicXmlDariMuseScore('a.MSCX') === 'a.musicxml')

console.log('\n5. Ottava & peringatan')
const MS4_OTTAVA = MS4.replace(
  '<Chord><durationType>half</durationType><Note><pitch>72</pitch>',
  '<Spanner type="Ottava"><Ottava><subtype>8va</subtype></Ottava><next><location><fractions>1/2</fractions></location></next></Spanner><Chord><durationType>half</durationType><Note><pitch>72</pitch>',
).replace(
  '<Chord><durationType>half</durationType><Note><pitch>74</pitch>',
  '<Spanner type="Ottava"><prev><location><fractions>-1/2</fractions></location></prev></Spanner><Chord><durationType>half</durationType><Note><pitch>74</pitch>',
)
const ro = await uraiMuseScore(keBita(MS4_OTTAVA))
const b2o = ro.ok ? birama(part(keTeks(ro.bitaXml), 'P1'), 2) : ''
cek('8va → octave-shift down 8 … stop', b2o.includes('<octave-shift type="down" size="8"/>') && b2o.includes('<octave-shift type="stop" size="8"/>'))
cek('8va: nada di dalam rentang naik satu oktaf (D6), sesudahnya tidak (E5)', b2o.includes('<step>D</step><octave>6</octave>') && b2o.includes('<step>E</step><octave>5</octave>'))
const rl = await uraiMuseScore(keBita(MS4.replace('<Note><pitch>70</pitch>', '<Lyrics><text>la</text></Lyrics><Note><pitch>70</pitch>')))
cek('lirik dilewati → disebut di peringatan', rl.ok && rl.peringatan.some((p) => /lirik/i.test(p)))
const rLama = await uraiMuseScore(keBita(MS4.replace('version="4.20"', 'version="2.06"')))
cek('format lama (2.06) → dicoba + peringatan', rLama.ok && rLama.peringatan.some((p) => /format lama/i.test(p)))

console.log('\n6. Gerbang Buka Berkas')
const sinkron = kenaliBerkas('Mars Uji.mscz', zStored)
cek('kenaliBerkas (sinkron) → tak-dikenal + PESAN_MUSESCORE', sinkron.jenis === 'tak-dikenal' && sinkron.catatan === PESAN_MUSESCORE)
const asinkron = await kenaliBerkasAsync('Mars Uji.mscz', zDeflate)
cek('kenaliBerkasAsync → partitur musicxml', asinkron.jenis === 'partitur' && asinkron.partiturTipe === 'musicxml', JSON.stringify(asinkron).slice(0, 200))
cek('kenaliBerkasAsync: catatan menyebut MuseScore 4.20', /MuseScore 4\.20/.test(asinkron.catatan ?? ''))
const asinkronRusak = await kenaliBerkasAsync('rusak.mscx', keBita('<museScore version="4.20"><Score>'))
cek('kenaliBerkasAsync: .mscx terpotong → tak-dikenal beralasan', asinkronRusak.jenis === 'tak-dikenal' && /MuseScore/.test(asinkronRusak.catatan ?? ''))

console.log('\n7. Berkas rusak tidak pernah melempar')
let melempar = false
const kasus = [
  ['kosong', new Uint8Array(0)],
  ['terpotong', keBita('<museScore version="4.20"><Score>')],
  ['tanpa Score', keBita('<museScore version="4.20"></museScore>')],
  ['bukan XML', keBita('halo')],
  ['ZIP .mscz tanpa .mscx', bikinZip([{ nama: 'META-INF/container.xml', isi: containerMscz('hilang.mscx') }, { nama: 'x.mscx.bak', isi: 'x' }])],
  ['ZIP terpotong', zDeflate.slice(0, Math.floor(zDeflate.length / 2))],
  ['Score tanpa Staff', keBita('<museScore version="4.20"><Score><Division>480</Division></Score></museScore>')],
]
for (const [nama, b] of kasus) {
  try {
    const x = await uraiMuseScore(b)
    cek(`${nama} → ok:false beralasan`, x.ok === false && typeof x.alasan === 'string' && x.alasan.length > 0, JSON.stringify(x).slice(0, 160))
  } catch (e) {
    melempar = true
    cek(`${nama} → tidak melempar`, false, String(e))
  }
}
cek('tak satu pun melempar', !melempar)

console.log('\n8. Tarik peta dari hasil konversi')
const peta = tarikPetaPartitur(x4)
cek('tarikPetaPartitur ok', peta.ok, peta.alasan)
if (peta.ok) {
  cek('sukat lagu 4/4 (bukan pickup 1/4) · BPM 120', peta.tandaBiramaAwal.pembilang === 4 && peta.tandaBiramaAwal.penyebut === 4 && peta.bpmAwal === 120)
  cek('segmen: Awal(pickup) · A · B · rit.', peta.segmen.map((s) => s.label).join('|') === 'Awal|A|B|rit.', peta.segmen.map((s) => s.label).join('|'))
  const b = peta.segmen.find((s) => s.label === 'B')
  cek('B: 6/8 acuan ♩. = 80', b?.birama?.acuan?.nilai === 4 && b?.birama?.acuan?.titik === true && b?.bpm === 80)
  const rit = peta.segmen.find((s) => s.label === 'rit.')
  cek('rit.: luncur 80 → 60 dalam 6 ketuk', rit?.rampFromBpm === 80 && rit?.bpm === 60 && rit?.rampCounts === 6 && rit?.rampUnit === 'beat')
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('Gagal:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
