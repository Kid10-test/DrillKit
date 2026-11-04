/**
 * #27 — "Tarik peta tempo dari partitur" (`petaPartitur.ts`): uji logika murni.
 *
 * MusicXML sintetis disusun di berkas ini. Yang diuji:
 *   1. Huruf latihan → label segmen; sukat 4/4 → 7/8 → 4/4; birama gantung ⅛
 *      → sukat pendek 1/8 sendiri (sukat lagu tetap 4/4).
 *   2. Tanda metronom ♩=100 / ♩.=80 di 6/8 (satuan BPM ikut tanda bila cocok),
 *      `<sound tempo>` tanpa metronom, tempo di tengah birama → `beat`.
 *   3. *rit.* → luncur (`rampFromBpm` → `bpm`, `rampCounts` ketuk tertulis)
 *      ke tanda tempo berikutnya; *a tempo* & *Tempo I* kembali; *accel.* tanpa
 *      tujuan → peringatan; D.S. al Coda → peringatan, tidak dibentangkan.
 *   4. ‖: :‖ + volta 1/2 (catatan saja) vs "Bentangkan ulangan" (urutan main
 *      1,2,3,2,4…; volta 1 dilewati di putaran kedua; label "A (ulang)").
 *   5. `times="3"` + volta "1, 2" / "3".
 *   6. score-timewise; tanda tempo hanya di part kedua.
 *   7. Hasilnya dipakai `TempoTimeline` apa adanya (detik per birama cocok).
 *   8. Masukan rusak → `{ ok: false }` tanpa lemparan; tanpa tempo → BPM cadangan.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/peta-partitur-logika.mjs
 */
import { tarikPetaPartitur } from '/tmp/petaPartitur.mjs'
import { createTempoTimeline } from '/tmp/tempoTimeline.mjs'

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
const dekat = (a, b, tol = 1e-3) => Math.abs(a - b) < tol

/* ----------------------------- Pembangun skor ----------------------------- */
const not = (dur, tipe = 'quarter') => `<note><pitch><step>C</step><octave>5</octave></pitch><duration>${dur}</duration><type>${tipe}</type></note>`
const arah = (isi, extra = '') => `<direction placement="above"><direction-type>${isi}</direction-type>${extra}</direction>`
const kata = (t) => arah(`<words>${t}</words>`)
const huruf = (t) => arah(`<rehearsal>${t}</rehearsal>`)
const met = (unit, pm, titik = false, q = null) =>
  arah(`<metronome><beat-unit>${unit}</beat-unit>${titik ? '<beat-unit-dot/>' : ''}<per-minute>${pm}</per-minute></metronome>`, q ? `<sound tempo="${q}"/>` : '')
const sukat = (b, t) => `<attributes><time><beats>${b}</beats><beat-type>${t}</beat-type></time></attributes>`
const ulangMaju = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
const voltaMulai = (n) => `<barline location="left"><ending number="${n}" type="start"/></barline>`
const voltaUlang = (n, kali) =>
  `<barline location="right"><bar-style>light-heavy</bar-style><ending number="${n}" type="stop"/><repeat direction="backward"${kali ? ` times="${kali}"` : ''}/></barline>`
const voltaAkhir = (n, jenis = 'stop') => `<barline location="right"><ending number="${n}" type="${jenis}"/></barline>`
function skor(birama, { div = 2, parts = 1 } = {}) {
  const daftar = Array.from({ length: parts }, (_, i) => `<score-part id="P${i + 1}"><part-name>P${i + 1}</part-name></score-part>`).join('')
  const isiPart = (pi) =>
    birama
      .map(
        (m, i) =>
          `<measure number="${i + 1}"${m.implicit ? ' implicit="yes"' : ''}>${i === 0 ? `<attributes><divisions>${div}</divisions></attributes>` : ''}${(pi === 0 ? m.isi : (m[`isi${pi + 1}`] ?? m.isiLain)) ?? ''}</measure>`,
      )
      .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list>${daftar}</part-list>${Array.from({ length: parts }, (_, pi) => `<part id="P${pi + 1}">${isiPart(pi)}</part>`).join('')}</score-partwise>`
}
const BULAT = not(8, 'whole') // divisions 2 → 4 ketuk ♩

const UTAMA = skor([
  { implicit: true, isi: sukat(4, 4) + met('quarter', 100, false, 100) + not(1, 'eighth') },
  { isi: ulangMaju + huruf('A') + BULAT },
  { isi: voltaMulai('1') + BULAT + voltaUlang('1') },
  { isi: voltaMulai('2') + BULAT + voltaAkhir('2', 'discontinue') },
  { isi: sukat(7, 8) + huruf('B') + not(7) },
  { isi: sukat(4, 4) + kata('rit.') + BULAT },
  { isi: BULAT },
  { isi: met('quarter', 80, false, 80) + BULAT },
  { isi: kata('a tempo') + BULAT },
  { isi: huruf('C') + not(4, 'half') + met('quarter', 132, false, 132) + not(4, 'half') },
  { isi: kata('Tempo I') + BULAT },
  { isi: kata('accel.') + BULAT },
  { isi: kata('D.S. al Coda') + BULAT },
])

const labelSeg = (r) => r.segmen.map((s) => s.label).join('|')
const cari = (r, label) => r.segmen.find((s) => s.label === label)
const sukatTeks = (s) => `${s?.birama?.pembilang}/${s?.birama?.penyebut}`

/* ------------------------------------------------------------------------ */
console.log('\n1–3. Skor utama (tanpa bentang)')
const r = tarikPetaPartitur(UTAMA)
cek('ok', r.ok, r.alasan)
cek('13 birama, tidak dibentangkan', r.jumlahBiramaPartitur === 13 && r.panjangBirama === 13 && !r.dibentangkan)
cek('urutan segmen', labelSeg(r) === 'Awal|A|Volta 1|Volta 2|B|rit.|a tempo|C|Tempo 132|Tempo I|accel.', labelSeg(r))
cek('sukat lagu 4/4 & BPM 100 dari birama utuh pertama', sukatTeks({ birama: r.tandaBiramaAwal }) === '4/4' && r.bpmAwal === 100)
const awal = r.segmen[0]
cek('pickup ⅛ → sukat 1/8, ♪=200, catatan pickup', sukatTeks(awal) === '1/8' && awal.bpm === 200 && /pickup/.test(awal.note ?? ''), JSON.stringify(awal))
const segA = cari(r, 'A')
cek('A: b.2 · 4/4 · 100 · catatan ulang ×2 sampai birama 3', segA?.measure === 2 && sukatTeks(segA) === '4/4' && segA.bpm === 100 && /ulang ×2 sampai birama 3/.test(segA.note ?? ''))
cek('Volta 1 di b.3, Volta 2 di b.4', cari(r, 'Volta 1')?.measure === 3 && cari(r, 'Volta 2')?.measure === 4)
const segB = cari(r, 'B')
cek('B: 7/8 · ♪=200 (satuan ♩ tidak cocok dengan 7/8)', segB?.measure === 5 && sukatTeks(segB) === '7/8' && segB.birama.acuan.nilai === 8 && segB.bpm === 200)
const rit = cari(r, 'rit.')
cek('rit.: b.6 · luncur 100 → 80 dalam 8 ketuk', rit?.measure === 6 && rit.rampFromBpm === 100 && rit.bpm === 80 && rit.rampCounts === 8 && rit.rampUnit === 'beat', JSON.stringify(rit))
cek('tanda ♩=80 tujuan luncuran tidak jadi segmen ganda', !r.segmen.some((s) => s.measure === 8))
cek('a tempo: b.9 kembali 100', cari(r, 'a tempo')?.measure === 9 && cari(r, 'a tempo')?.bpm === 100)
const t132 = cari(r, 'Tempo 132')
cek('♩=132 di tengah b.10 → beat 3', t132?.measure === 10 && t132.beat === 3 && t132.bpm === 132, JSON.stringify(t132))
cek('C di b.10 ketuk 1 masih 100', cari(r, 'C')?.measure === 10 && !cari(r, 'C')?.beat && cari(r, 'C')?.bpm === 100)
cek('Tempo I: b.11 kembali 100', cari(r, 'Tempo I')?.measure === 11 && cari(r, 'Tempo I')?.bpm === 100)
const acc = cari(r, 'accel.')
cek('accel. tanpa tujuan: segmen bercatatan, tanpa ramp', acc?.measure === 12 && !acc.rampCounts && /belum diketahui/.test(acc.note ?? ''))
cek('peringatan accel. & D.S.', r.peringatan.some((p) => /accel\./.test(p)) && r.peringatan.some((p) => /D\.S\./.test(p)), JSON.stringify(r.peringatan))
cek('huruf latihan A(2) B(5) C(10)', JSON.stringify(r.hurufLatihan) === JSON.stringify([{ birama: 2, teks: 'A' }, { birama: 5, teks: 'B' }, { birama: 10, teks: 'C' }]))
cek('ulangan terbaca: 2–3 ×2, volta 1 (3) & 2 (4)', JSON.stringify(r.ulangan) === JSON.stringify([{ dari: 2, sampai: 3, kali: 2, volta: [{ nomor: '1', dari: 3, sampai: 3 }, { nomor: '2', dari: 4, sampai: 4 }] }]))
cek('semua segmen: beats = birama.pembilang, tanpa id', r.segmen.every((s) => s.beats === s.birama.pembilang && !('id' in s)))

console.log('\n4. Bentangkan ulangan')
const rb = tarikPetaPartitur(UTAMA, { bentangkanUlang: true })
cek('dibentangkan: 14 birama main', rb.ok && rb.dibentangkan && rb.panjangBirama === 14)
cek('urutan main 1,2,3,2,4,5…13 (volta 1 dilewati di putaran 2)', rb.urutanMain.join(',') === '1,2,3,2,4,5,6,7,8,9,10,11,12,13', rb.urutanMain.join(','))
cek('label', labelSeg(rb) === 'Awal|A|Volta 1|A (ulang)|Volta 2|B|rit.|a tempo|C|Tempo 132|Tempo I|accel.', labelSeg(rb))
cek('A (ulang) di b.4 bercatatan "partitur b. 2"', cari(rb, 'A (ulang)')?.measure === 4 && /partitur b\. 2/.test(cari(rb, 'A (ulang)')?.note ?? ''))
cek('Volta 2 pindah ke b.5 (partitur b. 4)', cari(rb, 'Volta 2')?.measure === 5 && /partitur b\. 4/.test(cari(rb, 'Volta 2')?.note ?? ''))
cek('rit. kini b.7, tetap 8 ketuk', cari(rb, 'rit.')?.measure === 7 && cari(rb, 'rit.')?.rampCounts === 8)
cek('huruf latihan berulang tercatat', rb.hurufLatihan.some((h) => h.birama === 4 && h.teks === 'A'))

console.log('\n5. times="3" + volta "1, 2" / "3"')
const TIGA = skor([
  { isi: sukat(3, 4) + met('quarter', 90, false, 90) + ulangMaju + huruf('Intro') + not(6, 'half') },
  { isi: voltaMulai('1, 2') + not(6, 'half') + voltaUlang('1, 2', 3) },
  { isi: voltaMulai('3') + not(6, 'half') + voltaAkhir('3') },
  { isi: not(6, 'half') },
])
const r3 = tarikPetaPartitur(TIGA, { bentangkanUlang: true })
cek('urutan 1,2,1,2,1,3,4', r3.ok && r3.urutanMain.join(',') === '1,2,1,2,1,3,4', r3.urutanMain?.join(','))
cek('ulangan ×3', r3.ok && r3.ulangan[0]?.kali === 3)
cek('label Intro, Intro (ulang) ×2, Volta 3', r3.ok && r3.segmen.filter((s) => s.label === 'Intro (ulang)').length === 2 && cari(r3, 'Volta 3')?.measure === 6, labelSeg(r3))
const r3b = tarikPetaPartitur(TIGA)
cek('tanpa bentang: catatan "ulang ×3"', r3b.ok && /ulang ×3/.test(r3b.segmen[0].note ?? ''))

console.log('\n6. Timewise & tempo hanya di part kedua · ♩.=80 di 6/8 · sound tempo saja')
const TIMEWISE = `<?xml version="1.0"?><score-timewise version="4.0"><part-list><score-part id="P1"><part-name>A</part-name></score-part><score-part id="P2"><part-name>B</part-name></score-part></part-list>
<measure number="1"><part id="P1"><attributes><divisions>1</divisions><time><beats>6</beats><beat-type>8</beat-type></time></attributes>${not(3)}</part><part id="P2"><attributes><divisions>1</divisions><time><beats>6</beats><beat-type>8</beat-type></time></attributes>${met('quarter', 80, true, 120)}${not(3)}</part></measure>
<measure number="2"><part id="P1">${huruf('Tengah')}${not(3)}</part><part id="P2">${not(3)}</part></measure>
<measure number="3"><part id="P1"><attributes><time><beats>2</beats><beat-type>4</beat-type></time></attributes>${arah('<words>Lebih cepat</words>', '<sound tempo="150"/>')}${not(2)}</part><part id="P2"><attributes><time><beats>2</beats><beat-type>4</beat-type></time></attributes>${not(2)}</part></measure>
</score-timewise>`
const rt = tarikPetaPartitur(TIMEWISE)
cek('timewise ok · 3 birama', rt.ok && rt.jumlahBiramaPartitur === 3, rt.alasan)
cek('6/8 ♩.=80 dari part kedua → acuan bertitik, BPM 80', rt.ok && rt.bpmAwal === 80 && rt.tandaBiramaAwal.acuan.titik === true && rt.tandaBiramaAwal.acuan.nilai === 4)
cek('huruf latihan "Tengah" di b.2', rt.ok && cari(rt, 'Tengah')?.measure === 2)
const seg3 = rt.ok ? rt.segmen.find((s) => s.measure === 3) : null
cek('b.3: 2/4 · sound tempo 150 → ♩=150', sukatTeks(seg3) === '2/4' && seg3?.bpm === 150 && seg3?.birama?.acuan?.titik === false, JSON.stringify(seg3))

console.log('\n7. Dipakai TempoTimeline apa adanya')
const tl = createTempoTimeline({ bpm: r.bpmAwal, meter: r.tandaBiramaAwal, segments: r.segmen })
cek('b.1 pickup ⅛ @♪200 = 0,3 dtk', dekat(tl.barDurationSeconds(1), 0.3), String(tl.barDurationSeconds(1)))
cek('b.2 4/4 @♩100 = 2,4 dtk', dekat(tl.barDurationSeconds(2), 2.4))
cek('b.5 7/8 @♪200 = 2,1 dtk', dekat(tl.barDurationSeconds(5), 2.1), String(tl.barDurationSeconds(5)))
const d6 = tl.barDurationSeconds(6)
const d7 = tl.barDurationSeconds(7)
cek('b.6–7 melambat bertahap (2,4 < b.6 < b.7 < 3,0)', d6 > 2.4 && d7 > d6 && d7 < 3.0 + 1e-6, `${d6} ${d7}`)
cek('b.8 sampai ♩80 = 3,0 dtk', dekat(tl.barDurationSeconds(8), 3.0), String(tl.barDurationSeconds(8)))
cek('b.9 a tempo ♩100 = 2,4 dtk', dekat(tl.barDurationSeconds(9), 2.4))
cek('b.10 separuh ♩100 + separuh ♩132', dekat(tl.barDurationSeconds(10), 1.2 + 120 / 132), String(tl.barDurationSeconds(10)))
const tlb = createTempoTimeline({ bpm: rb.bpmAwal, meter: rb.tandaBiramaAwal, segments: rb.segmen })
cek('versi bentang: b.4 (A ulang) = 2,4 dtk, b.6 (7/8) = 2,1 dtk', dekat(tlb.barDurationSeconds(4), 2.4) && dekat(tlb.barDurationSeconds(6), 2.1))

console.log('\n8. Masukan rusak & tanpa tempo')
let melempar = false
for (const [nama, x] of [
  ['kosong', ''],
  ['bukan XML', 'halo dunia'],
  ['XML terpotong', '<score-partwise><part id="P1"><measure number="1">'],
  ['akar asing', '<html><body/></html>'],
  ['tanpa birama', '<score-partwise version="4.0"><part-list/><part id="P1"/></score-partwise>'],
]) {
  try {
    const h = tarikPetaPartitur(x)
    cek(`${nama} → ok:false beralasan`, h.ok === false && typeof h.alasan === 'string' && h.alasan.length > 0, JSON.stringify(h).slice(0, 140))
  } catch (e) {
    melempar = true
    cek(`${nama} → tidak melempar`, false, String(e))
  }
}
cek('tak satu pun melempar', !melempar)
const TANPA = skor([{ isi: sukat(3, 4) + not(6, 'half') }, { isi: huruf('A') + not(6, 'half') }])
const rk = tarikPetaPartitur(TANPA, { bpmCadangan: 96 })
cek('tanpa tanda tempo → BPM cadangan 96', rk.ok && rk.bpmAwal === 96 && rk.segmen.every((s) => s.bpm === 96), JSON.stringify(rk.segmen?.map((s) => s.bpm)))
cek('tanpa tanda tempo → disebut di peringatan', rk.ok && rk.peringatan.some((p) => /tempo/i.test(p)), JSON.stringify(rk.peringatan))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('Gagal:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
