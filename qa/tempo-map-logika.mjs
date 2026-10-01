/**
 * Shared tempo-map evaluator tests: beat/subdivision positions, explicit ramp
 * counts, exact song seconds, MP3 bar offsets, and drill click/duration mapping.
 */
import { createTempoTimeline } from '/tmp/tempoTimeline.mjs'
import { waktuBiramaKeDetikAudio } from '/tmp/rekaman.mjs'
import { petakanSetKeMusik } from '/tmp/gabung.mjs'

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal += 1
    console.log('  ✗ ' + nama + (detail ? ` → ${detail}` : ''))
  }
}
function dekat(nama, actual, expected, tolerance = 1e-6) {
  uji(nama, Math.abs(actual - expected) <= tolerance, `dapat ${actual}, harap ≈${expected}`)
}
function sama(nama, actual, expected) {
  uji(nama, JSON.stringify(actual) === JSON.stringify(expected), `dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)}`)
}

const Q = { nilai: 4, titik: false }
const E = { nilai: 8, titik: false }
const M44 = { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }
const M68E = { pembilang: 6, penyebut: 8, kelompok: [3, 3], acuan: E }

console.log('\n— Ramp eksplisit di delapan ketuk —')
{
  const timeline = createTempoTimeline({
    bpm: 160,
    meter: M44,
    segments: [{
      measure: 1,
      beat: 1,
      subdivision: 1,
      subdivisionsPerBeat: 1,
      bpm: 180,
      rampFromBpm: 160,
      rampCounts: 8,
      rampUnit: 'beat',
    }],
  })
  const values = Array.from({ length: 8 }, (_, i) => timeline.tempoAtPosition({ measure: 1, beat: i + 1 }))
  sama('160 → 180: count 1 sudah berubah sampai count 8', values, [162.5, 165, 167.5, 170, 172.5, 175, 177.5, 180])
  const expectedSeconds = values.reduce((total, bpm) => total + 60 / bpm, 0)
  dekat('durasi 8 ketuk mengintegrasikan BPM yang sama', timeline.secondsAtPosition({ measure: 3, beat: 1 }), expectedSeconds)
  dekat('sesudah ramp, tempo bertahan pada target', timeline.tempoAtPosition({ measure: 3, beat: 2 }), 180)
}

console.log('\n— Ramp ritardando eksplisit enam ketuk —')
{
  const timeline = createTempoTimeline({
    bpm: 172,
    meter: M68E,
    segments: [{
      measure: 1,
      beat: 1,
      bpm: 140,
      rampFromBpm: 172,
      rampCounts: 6,
      rampUnit: 'beat',
    }],
  })
  const values = Array.from({ length: 6 }, (_, i) => timeline.tempoAtPosition({ measure: 1, beat: i + 1 }))
  const expected = [
    172 + (140 - 172) / 6,
    172 + (140 - 172) * 2 / 6,
    172 + (140 - 172) * 3 / 6,
    172 + (140 - 172) * 4 / 6,
    172 + (140 - 172) * 5 / 6,
    140,
  ]
  uji('ramp 172 → 140 berdurasi tepat enam hitungan', values.every((v, i) => Math.abs(v - expected[i]) < 1e-9))
  dekat('target 140 tepat di hitungan 6', values[5], 140)
  dekat('target bertahan sesudah hitungan 6', timeline.tempoAtPosition({ measure: 2, beat: 1 }), 140)
}

console.log('\n— Posisi subdivisi & ramp triplet —')
{
  const point = createTempoTimeline({
    bpm: 120,
    meter: M44,
    segments: [{ measure: 1, beat: 2, subdivision: 2, subdivisionsPerBeat: 3, bpm: 90 }],
  })
  const q = point.quarterAtPosition({ measure: 1, beat: 2, subdivision: 2, subdivisionsPerBeat: 3 })
  dekat('posisi ketuk 2 subdivisi 2/3 = 4/3 quarter-note', q, 4 / 3)
  dekat('tempo lama tepat sebelum subdivisi', point.tempoAtQuarter(q - 1e-5), 120)
  dekat('tempo baru mulai tepat pada subdivisi', point.tempoAtQuarter(q), 90)
  dekat('detik pada posisi tempo baru berasal dari evaluator', point.secondsAtQuarter(q), 2 / 3)

  const tripletRamp = createTempoTimeline({
    bpm: 160,
    meter: M44,
    segments: [{
      measure: 1,
      beat: 1,
      bpm: 180,
      rampFromBpm: 160,
      rampCounts: 3,
      rampUnit: 'subdivision',
      rampSubdivisions: 3,
    }],
  })
  dekat('subdivisi triplet 1 sudah berubah', tripletRamp.tempoAtQuarter(0), 160 + 20 / 3)
  dekat('subdivisi triplet 2 dihitung pada 1/3 beat', tripletRamp.tempoAtQuarter(1 / 3), 160 + 40 / 3)
  dekat('subdivisi triplet 3 mencapai target', tripletRamp.tempoAtQuarter(2 / 3), 180)
}

console.log('\n— Kompatibilitas ramp lama & meter berubah —')
{
  const legacy = createTempoTimeline({
    bpm: 120,
    meter: M44,
    segments: [
      { measure: 1, bpm: 160, berangsur: 1 },
      { measure: 3, bpm: 180 },
    ],
  })
  dekat('ramp lama tetap mulai dari BPM bar 1', legacy.tempoAtPosition({ measure: 1 }), 160)
  dekat('ramp lama tetap interpolasi per bar', legacy.tempoAtPosition({ measure: 2 }), 170)
  dekat('ramp lama tetap tiba di bar tujuan', legacy.tempoAtPosition({ measure: 3 }), 180)

  const meterChange = createTempoTimeline({
    bpm: 120,
    meter: M44,
    segments: [{ measure: 2, bpm: 180, birama: M68E }],
  })
  dekat('waktu melintasi 4/4 lalu 6/8 dihitung dengan meter dan BPM acuan',
    meterChange.secondsAtPosition({ measure: 3 }),
    2 + 6 * 60 / 180,
  )
}

console.log('\n— Evaluator yang sama dipakai rekaman & drill —')
{
  const map = [{ measure: 1, beat: 3, bpm: 60 }]
  const record = {
    titikMulaiDetik: 1.25,
    koreksiSegmen: undefined,
  }
  const secondsAtBar2 = waktuBiramaKeDetikAudio(2, record, map, M44, 120)
  dekat('offset audio birama 2 mengintegrasikan perubahan di ketuk 3', secondsAtBar2, 1.25 + 0.5 + 0.5 + 1 + 1)

  const rampSong = {
    bpm: 120,
    tandaBirama: M44,
    tempoMap: [{ measure: 1, beat: 1, bpm: 180, rampFromBpm: 120, rampCounts: 4, rampUnit: 'beat' }],
  }
  const mapped = petakanSetKeMusik([{ counts: 4 }, { counts: 2 }], 1, rampSong)
  const expectedRampValues = [135, 150, 165, 180]
  const expectedDuration = expectedRampValues.reduce((sum, bpm) => sum + 60 / bpm, 0)
  uji('durasi set drill menjumlah waktu tiap hitungan ramp', Math.abs(mapped[0].detik - expectedDuration) < 1e-6)
  sama('klik drill menyimpan satu offset per count', mapped[0].offsetKlikLatihan.length, 4)
  dekat('offset count 2 memakai durasi count 1', mapped[0].offsetKlikLatihan[1], 60 / 135)
  dekat('set berikutnya mulai pada waktu partitur terintegrasi', mapped[1].detikMulai, expectedDuration)
  dekat('tempo count ke-4 mencapai BPM target', mapped[0].bpmPerHitungan[3], 180)

  const practice = { mode: 'persen', persen: 80, geser: 0 }
  const mappedPractice = petakanSetKeMusik([{ counts: 2 }], 1, rampSong, practice)
  sama('drill menyimpan BPM partitur dan BPM latihan terpisah', [
    mappedPractice[0].bpmPerHitungan,
    mappedPractice[0].bpmLatihanPerHitungan,
  ], [[135, 150], [108, 120]])
  dekat('offset klik drill memakai durasi setelah tempo latihan', mappedPractice[0].offsetKlikLatihan[1], 60 / 108)
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exitCode = 1
