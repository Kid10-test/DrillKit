/**
 * #31 — Mode Podium (logika murni): pemilih Set ↔ Huruf ↔ Birama, rancangan
 * count-in Standby + Mark Time, teks & ukuran plakat 40 m (hex murni),
 * setelan per perangkat, Rep Counter di `latihan.ts`, pemilihan sesi hari
 * ini, dan kupas privasi `logRep` dari berkas yang dibagikan.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/podium-logika.mjs
 */
import {
  PALET_PLAKAT,
  PERSEN_PODIUM,
  SETELAN_PODIUM_BAWAAN,
  KUNCI_PODIUM,
  barisPlakat,
  bacaSetelanPodium,
  bpmHitungMasuk,
  daftarHurufLatihan,
  langkahHitungMasuk,
  rancangHitungMasuk,
  rapikanPersenPodium,
  rapikanSetelanPodium,
  rapikanTeksPlakat,
  setUntukBirama,
  teksPlakatHuruf,
  teksPlakatRentang,
  teksPlakatReset,
  tulisSetelanPodium,
  ukuranHurufPlakat,
} from '/tmp/podium.mjs'
import {
  MAKS_BARIS_LOG_REP,
  labelRentangSet,
  pilihSesiLatihan,
  ringkasLogRep,
  tambahLogRep,
  tanggalLokal,
} from '/tmp/latihan.mjs'
import { kupasDataKhususStaf, paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import { salinSesi } from '/tmp/kalender.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(`${nama}${ket ? ' — ' + ket : ''}`)
    console.log(`  ✗ ${nama}${ket ? ' — ' + ket : ''}`)
  }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/* ------------------------------ Tempo podium ------------------------------ */
console.log('Tempo latihan podium')
cek('pilihan 70–100 berkelipatan 5', sama([...PERSEN_PODIUM], [70, 75, 80, 85, 90, 95, 100]))
cek('rapikan persen: dijepit & dibulatkan', rapikanPersenPodium(62) === 70 && rapikanPersenPodium(83) === 85 && rapikanPersenPodium(130) === 100)
cek('rapikan persen: NaN → 100', rapikanPersenPodium(Number.NaN) === 100)

/* -------------------------------- Count-in -------------------------------- */
console.log('Count-in Standby + Mark Time')
const r44 = rancangHitungMasuk(4, 4)
cek('4 + 4 → dua birama, total 8', r44.bars.length === 2 && r44.total === 8 && sama(r44.tahap, ['standby', 'markTime']))
cek('tiap birama beraksen di ketukan pertama saja', sama(r44.bars[0].cells, [2, 1, 1, 1]) && sama(r44.bars[1].cells, [2, 1, 1, 1]))
cek('subdiv 1 & label birama', r44.bars.every((b) => b.subdiv === 1) && r44.bars[0].label === 'Standby' && r44.bars[1].label === 'Mark Time')
const r08 = rancangHitungMasuk(0, 8)
cek('0 + 8 → hanya Mark Time', r08.bars.length === 1 && r08.tahap[0] === 'markTime' && r08.bars[0].beats === 8)
cek('0 + 0 → tanpa count-in', rancangHitungMasuk(0, 0).total === 0 && rancangHitungMasuk(0, 0).bars.length === 0)
cek('dijepit 2–12 (1 → 2, 16 → 12)', rancangHitungMasuk(1, 16).bars.map((b) => b.beats).join() === '2,12')
cek('nilai rusak → 0', rancangHitungMasuk(Number.NaN, -3).total === 0)
const urutLangkah = []
for (let b = 1; b <= 2; b++) for (let k = 0; k < 4; k++) urutLangkah.push(langkahHitungMasuk(r44, b, k))
cek(
  'langkah: STANDBY 1–4 lalu MARK TIME 1–4',
  urutLangkah.map((l) => `${l.tahap}${l.ke}/${l.dari}`).join(' ') ===
    'standby1/4 standby2/4 standby3/4 standby4/4 markTime1/4 markTime2/4 markTime3/4 markTime4/4',
)
cek('hanya ketukan terakhir bertanda terakhir', urutLangkah.filter((l) => l.terakhir).length === 1 && urutLangkah[7].terakhir)
cek('langkah di luar rancangan → null', langkahHitungMasuk(r44, 3, 0) === null && langkahHitungMasuk(r44, 1, 4) === null)
cek('BPM count-in = tempo ÷ ketuk per count', bpmHitungMasuk(160, 2) === 80 && bpmHitungMasuk(120, 1) === 120)
cek('BPM count-in tidak di bawah 20', bpmHitungMasuk(10, 1) === 20 && bpmHitungMasuk(Number.NaN, 1) === 120)

/* ------------------------- Huruf latihan & birama ------------------------- */
console.log('Pemilih Set ↔ Huruf ↔ Birama')
const tm = [
  { id: 's3', label: 'C', measure: 33, bpm: 120, beats: 4 },
  { id: 's1', label: '', measure: 1, bpm: 120, beats: 4 },
  { id: 's2', label: ' B ', measure: 17, bpm: 132, beats: 4 },
  { id: 's2b', label: 'B', measure: 17, bpm: 132, beats: 4 },
  { id: 'x', label: 'Rusak', measure: 0, bpm: 120, beats: 4 },
  { id: 's0', label: 'Intro', measure: 1, bpm: 120, beats: 4 },
]
const huruf = daftarHurufLatihan(tm)
cek(
  'huruf diurutkan per birama, label kosong/rusak & kembar dibuang',
  sama(huruf, [
    { label: 'Intro', birama: 1 },
    { label: 'B', birama: 17 },
    { label: 'C', birama: 33 },
  ]),
  JSON.stringify(huruf),
)
cek('tempo map kosong/null → []', daftarHurufLatihan(null).length === 0 && daftarHurufLatihan([]).length === 0)
const peta = [
  { biramaDari: 1, biramaSampai: 8 },
  { biramaDari: 9, biramaSampai: 16 },
  { biramaDari: 17, biramaSampai: 24 },
  { biramaDari: 27, biramaSampai: 40 },
]
cek('birama di dalam set', setUntukBirama(peta, 12) === 1 && setUntukBirama(peta, 17) === 2 && setUntukBirama(peta, 33) === 3)
cek('birama sebelum set pertama → set pertama', setUntukBirama(peta, 0) === 0 && setUntukBirama(peta, -5) === 0)
cek('birama di celah → set sesudahnya', setUntukBirama(peta, 25) === 3)
cek('birama sesudah set terakhir → set terakhir', setUntukBirama(peta, 99) === 3)
cek('peta kosong → -1', setUntukBirama([], 3) === -1)

/* ------------------------------ Plakat 40 m ------------------------------ */
console.log('Papan aba-aba 40 m')
cek('rentang: "SET 12 – 16 · TEMPO 85%"', teksPlakatRentang(12, 16, 85) === 'SET 12 – 16 · TEMPO 85%')
cek('rentang terbalik dirapikan', teksPlakatRentang(16, 12, 85) === 'SET 12 – 16 · TEMPO 85%')
cek('satu set: "SET 4 · TEMPO 100%"', teksPlakatRentang(4, 4, 100) === 'SET 4 · TEMPO 100%')
cek('reset: "RESET KE SET 1 · FULL RUN"', teksPlakatReset() === 'RESET KE SET 1 · FULL RUN' && teksPlakatReset(3) === 'RESET KE SET 3 · FULL RUN')
cek('huruf: "DARI HURUF C · TEMPO 85%"', teksPlakatHuruf('c', 85) === 'DARI HURUF C · TEMPO 85%')
cek('teks kustom: kapital, spasi tunggal', rapikanTeksPlakat('  barisan   rapat ·  tahan ') === 'BARISAN RAPAT · TAHAN')
cek('teks kustom dipotong ≤ 48 huruf', rapikanTeksPlakat('x'.repeat(80)).length === 48)
cek('baris dipecah di " · "', sama(barisPlakat('SET 12 – 16 · TEMPO 85%'), ['SET 12 – 16', 'TEMPO 85%']))
cek('baris kosong dibuang', sama(barisPlakat(' · A ·· B · '), ['A', 'B']))
const palet = Object.values(PALET_PLAKAT)
cek('semua warna plakat hex murni #rrggbb', palet.every((w) => /^#[0-9a-f]{6}$/i.test(w.latar) && /^#[0-9a-f]{6}$/i.test(w.teks)))
const luma = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const kontras = (a, b) => (Math.max(luma(a), luma(b)) + 0.05) / (Math.min(luma(a), luma(b)) + 0.05)
cek('kontras ekstrem ≥ 19:1 untuk tiap palet', palet.every((w) => kontras(w.latar, w.teks) >= 19), palet.map((w) => kontras(w.latar, w.teks).toFixed(1)).join())
const uk = ukuranHurufPlakat(['SET 12 – 16', 'TEMPO 85%'])
const m = /^min\(([\d.]+)vw, ([\d.]+)vh\)$/.exec(uk)
cek('ukuran huruf: format min(vw, vh)', !!m, uk)
cek('baris terpanjang muat ±92% lebar (11 huruf × 0,8 em)', m && Number(m[1]) * 0.8 * 11 <= 92.01)
cek('tinggi semua baris muat ±82% layar', m && Number(m[2]) * 2 * 1.12 <= 82.01)
cek('teks pendek tidak melebihi 30vw', /^min\(30vw/.test(ukuranHurufPlakat(['OK'])))

/* -------------------------------- Setelan -------------------------------- */
console.log('Setelan podium per perangkat')
cek('bawaan 4 + 4, Dr. Beat, kuning', sama(SETELAN_PODIUM_BAWAAN, { standby: 4, markTime: 4, profil: 'drbeat', palet: 'kuning' }))
cek('rapikan menolak nilai asing', sama(rapikanSetelanPodium({ standby: 5, markTime: 8, profil: 'bel', palet: 'merah' }), { standby: 4, markTime: 8, profil: 'drbeat', palet: 'kuning' }))
const simpan = new Map()
const penyimpan = { getItem: (k) => simpan.get(k) ?? null, setItem: (k, v) => simpan.set(k, v) }
tulisSetelanPodium({ standby: 8, markTime: 0, profil: 'cowbell', palet: 'terbalik' }, penyimpan)
cek('tulis → baca pulang-pergi', sama(bacaSetelanPodium(penyimpan), { standby: 8, markTime: 0, profil: 'cowbell', palet: 'terbalik' }))
simpan.set(KUNCI_PODIUM, '{rusak')
cek('JSON rusak → bawaan', sama(bacaSetelanPodium(penyimpan), SETELAN_PODIUM_BAWAAN))
cek('tanpa penyimpan → bawaan', sama(bacaSetelanPodium(null), SETELAN_PODIUM_BAWAAN))

/* ------------------------------ Rep Counter ------------------------------ */
console.log('Rep Counter (latihan.ts)')
cek('label rentang', labelRentangSet(12, 16) === 'Set 12–16' && labelRentangSet(3, 3) === 'Set 3')
let log = tambahLogRep(undefined, { drillId: 'd1', namaDrill: 'Opener', dari: 12, sampai: 16 }, 1000)
log = tambahLogRep(log, { drillId: 'd1', namaDrill: 'Opener', dari: 12, sampai: 16 }, 2000)
log = tambahLogRep(log, { drillId: 'd1', namaDrill: 'Opener', dari: 16, sampai: 12 }, 3000)
cek('rentang sama (juga terbalik) menambah kali', log.length === 1 && log[0].kali === 3 && log[0].terakhir === 3000)
const sebelum = log
log = tambahLogRep(log, { drillId: 'd1', dari: 5, sampai: 5 }, 4000)
cek('satu set (tanpa perpindahan) diabaikan', log.length === 1)
cek('murni: tidak mengubah larik lama', sebelum !== log && sebelum[0].kali === 3)
log = tambahLogRep(log, { drillId: 'd2', namaDrill: 'Closer', dari: 1.7, sampai: 4.2 }, 5000)
log = tambahLogRep(log, { drillId: 'd1', namaDrill: 'Opener', dari: 1, sampai: 4 }, 6000)
cek('drill lain & rentang lain = baris baru, dibulatkan ke bawah', log.length === 3 && log.some((r) => r.drillId === 'd2' && r.dari === 1 && r.sampai === 4))
cek('drillId kosong / NaN diabaikan', tambahLogRep(log, { drillId: '', dari: 1, sampai: 2 }, 1).length === 3 && tambahLogRep(log, { drillId: 'd1', dari: Number.NaN, sampai: 2 }, 1).length === 3)
const rk = ringkasLogRep([...log, { drillId: 'dx', dari: 3, sampai: 2, kali: 4, terakhir: 1 }, { drillId: 'dy', dari: 1, sampai: 2, kali: 0, terakhir: 1 }])
cek('ringkasan: baris rusak dibuang, total benar', rk.baris.length === 3 && rk.total === 5, JSON.stringify(rk))
cek('ringkasan: urut per drill lalu set awal', rk.baris.map((r) => `${r.namaDrill}:${r.label}`).join() === 'Closer:Set 1–4,Opener:Set 1–4,Opener:Set 12–16')
let penuh = []
for (let i = 1; i <= MAKS_BARIS_LOG_REP + 5; i++) penuh = tambahLogRep(penuh, { drillId: 'd', dari: i, sampai: i + 1 }, i)
cek(`log dibatasi ${MAKS_BARIS_LOG_REP} baris`, penuh.length === MAKS_BARIS_LOG_REP)
cek('baris lama tetap bisa bertambah walau penuh', tambahLogRep(penuh, { drillId: 'd', dari: 1, sampai: 2 }, 9).find((r) => r.dari === 1).kali === 2)

/* -------------------------- Pilih sesi hari ini -------------------------- */
console.log('Sesi hari ini untuk Rep Counter')
const kini = new Date(2026, 10, 7, 16, 10)
cek('tanggal lokal', tanggalLokal(kini) === '2026-11-07')
const s = (id, extra) => ({ id, title: id, type: 'latihan', date: '2026-11-07', startTime: '08:00', endTime: '10:00', checklist: [], createdAt: 1, ...extra })
cek('tanpa sesi hari ini → null', pilihSesiLatihan([s('kemarin', { date: '2026-11-06' })], kini) === null && pilihSesiLatihan(undefined, kini) === null)
cek('yang jamnya berlangsung', pilihSesiLatihan([s('pagi'), s('sore', { startTime: '15:30', endTime: '18:00' })], kini).id === 'sore')
cek(
  'yang sedang berjalan menang atas jam',
  pilihSesiLatihan([s('sore', { startTime: '15:30', endTime: '18:00' }), s('molor', { mulaiNyata: 1 })], kini).id === 'molor',
)
cek('yang sudah ditutup tidak dianggap berjalan', pilihSesiLatihan([s('pagi', { mulaiNyata: 1, selesaiNyata: 2 }), s('sore', { startTime: '15:30', endTime: '18:00' })], kini).id === 'sore')
cek(
  'di luar jam: jenis latihan didahulukan dari rapat',
  pilihSesiLatihan([s('rapat', { type: 'rapat', startTime: '07:00' }), s('gab', { type: 'gabungan', startTime: '19:00', endTime: '21:00' })], kini).id === 'gab',
)
cek('hanya rapat → tetap dipakai', pilihSesiLatihan([s('rapat', { type: 'rapat' })], kini).id === 'rapat')

/* --------------------------- Privasi & salin sesi --------------------------- */
console.log('Privasi logRep (catatan staf)')
const sesiLog = s('sesi1', { logRep: [{ drillId: 'd1', dari: 1, sampai: 2, kali: 3, terakhir: 1 }], realisasiLatihan: [] })
const bundel = {
  version: 1,
  exportedAt: 1,
  mode: 'coach',
  team: { teamName: 'Tim' },
  members: [{ id: 'm1', name: 'A', code: 'A1', section: 'brass', role: 'member', joinYear: 2026, active: 1, token: 'x' }],
  sessions: [sesiLog, s('sesi2')],
  attendance: [],
  memberNotes: [],
  drills: [],
  sets: [],
  songs: [],
}
const kupas = kupasDataKhususStaf(bundel)
cek('kupasDataKhususStaf membuang logRep', kupas.sessions.every((x) => !('logRep' in x)))
cek('kolom sesi lain tetap utuh', kupas.sessions[0].title === 'sesi1' && Array.isArray(kupas.sessions[0].realisasiLatihan))
cek('objek asli tidak diubah', bundel.sessions[0].logRep.length === 1)
cek('paket grup tanpa logRep', !JSON.stringify(paketGrup(bundel)).includes('logRep'))
cek('paket anggota tanpa logRep', !JSON.stringify(paketAnggota(bundel, 'm1')).includes('logRep'))
const tanpaLog = { ...bundel, sessions: [s('x')] }
cek('tanpa logRep → larik sesi tidak disalin ulang', kupasDataKhususStaf(tanpaLog).sessions === tanpaLog.sessions)
const salin = salinSesi(sesiLog, '2026-11-14', () => 'baru', 9)
cek('salin sesi (seri/duplikat) tidak membawa logRep', !('logRep' in salin) && salin.id === 'baru')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
