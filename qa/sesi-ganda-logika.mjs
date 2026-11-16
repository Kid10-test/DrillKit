/**
 * v2.10.1 — sesi ganda: deteksi, penggabungan (absensi pindah, status terkuat
 * menang, isian kosong diambil dari kembaran, tautan program dialihkan) dan
 * Program yang menautkan sesi berabsensi lebih dulu.
 *
 * Skenario dari backup 13 Nov: tiap tanggal latihan punya sesi 17.30–20.15
 * buatan tangan (tempat absensi dicatat) dan sesi 18.00–20.00 dari jadwal
 * berulang (yang ditautkan Program).
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/sesi-ganda-logika.mjs
 */
import { bertumpuk, cariSesiGanda, urutUsulan, rencanaGabung, alihkanIdProgram, alihkanIdMusim } from '/tmp/gabungSesi.mjs'
import { rencanakanProgram, programBaru } from '/tmp/programLatsar.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama)
    console.log('  ✗ ' + nama + (ket ? ' — ' + ket : ''))
  }
}

const S = (id, date, startTime, endTime, o = {}) => ({ id, title: 'Latsar', type: 'latihan', date, startTime, endTime, checklist: [], createdAt: 1, ...o })
const A = (id, sessionId, memberId, status, o = {}) => ({ id, sessionId, memberId, status, ...o })

console.log('== bertumpuk ==')
cek('17.30–20.15 & 18.00–20.00 bertumpuk', bertumpuk({ startTime: '17:30', endTime: '20:15' }, { startTime: '18:00', endTime: '20:00' }))
cek('15.00–17.00 & 18.00–20.00 tidak', !bertumpuk({ startTime: '15:00', endTime: '17:00' }, { startTime: '18:00', endTime: '20:00' }))
cek('bersambung (18–20 & 20–21) tidak', !bertumpuk({ startTime: '18:00', endTime: '20:00' }, { startTime: '20:00', endTime: '21:00' }))
cek('tanpa jam selesai = 2 jam', bertumpuk({ startTime: '18:00', endTime: '' }, { startTime: '19:30', endTime: '20:00' }))

console.log('== deteksi ==')
const sesi = [
  S('m19', '2026-11-19', '17:30', '20:15', { title: 'Latsar P4' }),
  S('s19', '2026-11-19', '18:00', '20:00', { seriId: 'seri1', rencanaLatihan: [{ id: 'b1', judul: 'Pola B', jenis: 'lain', menit: 120 }] }),
  S('m20', '2026-11-20', '17:30', '20:15'),
  S('s20', '2026-11-20', '18:00', '20:00', { seriId: 'seri1' }),
  S('pagi', '2026-11-21', '08:00', '10:00'),
  S('sore', '2026-11-21', '18:00', '20:00'),
  S('secB', '2026-11-22', '15:00', '17:00', { type: 'section', title: 'Sectional Battery' }),
  S('secW', '2026-11-22', '15:00', '17:00', { type: 'section', title: 'Sectional Brass' }),
  S('rapat', '2026-11-19', '19:00', '20:00', { type: 'rapat' }),
]
const absensi = [
  A('a1', 'm19', 'x1', 'hadir'),
  A('a2', 'm19', 'x2', 'izin', { dilaporAt: 5 }),
  A('a3', 'm19', 'x3', 'alpha'),
  A('a4', 's19', 'x3', 'hadir', { datangAt: 99 }),
  A('a5', 's19', 'x4', 'sakit'),
  A('a6', 's19', 'x1', 'alpha'),
]
const milik = new Set(['s19', 's20'])
const kel = cariSesiGanda(sesi, absensi, milik)
cek('dua tanggal ganda (19 & 20 Nov)', kel.length === 2 && kel[0].tanggal === '2026-11-19' && kel[1].tanggal === '2026-11-20', kel.map((k) => k.tanggal).join())
cek('rapat tidak ikut kelompok', !kel[0].sesi.some((s) => s.id === 'rapat'))
cek('pagi & sore di hari yang sama tidak dianggap ganda', !kel.some((k) => k.tanggal === '2026-11-21'))
cek('sectional seksi berbeda tidak dianggap ganda', !kel.some((k) => k.tanggal === '2026-11-22'))
cek('sectional seksi sama dianggap ganda', cariSesiGanda([S('a', '2026-11-22', '15:00', '17:00', { type: 'section', title: 'Sectional Battery' }), S('b', '2026-11-22', '15:30', '17:00', { type: 'section', title: 'sectional battery ' })], []).length === 1)
cek('absensi seri: 3 & 3 → milik program (s19) menang seri', kel[0].sesi[0].id === 's19' && kel[0].absensi.m19 === 3 && kel[0].absensi.s19 === 3)
cek('absensi terbanyak menang atas milik program', cariSesiGanda(sesi, [...absensi, A('a9', 'm19', 'x9', 'hadir')], milik)[0].sesi[0].id === 'm19')
cek('usulan 20 Nov tanpa absensi = milik program (s20)', kel[1].sesi[0].id === 's20')
cek('urut usulan: seri kalah dari berencana bila sama', urutUsulan([S('p', 'd', '18:00', '20:00'), S('q', 'd', '18:00', '20:00', { rencanaLatihan: [{}] })], {})[0].id === 'q')

console.log('== rencana gabung ==')
const g = rencanaGabung(sesi[0], [sesi[1]], absensi)
cek('hapus kembaran', g.hapus.length === 1 && g.hapus[0] === 's19')
cek('x4 (hanya di kembaran) dipindah', g.tulis.some((r) => r.memberId === 'x4' && r.sessionId === 'm19' && r.id === 'a5') && g.dipindah === 1)
cek('x3: alpa di utama, hadir di kembaran → hadir menang, id utama dipertahankan', (() => {
  const r = g.tulis.find((x) => x.memberId === 'x3')
  return r && r.status === 'hadir' && r.id === 'a3' && r.datangAt === 99 && r.sessionId === 'm19'
})())
cek('x1: hadir di utama, alpa di kembaran → utama tetap, kembaran dibuang', !g.tulis.some((r) => r.memberId === 'x1') && g.buang.includes('a6'))
cek('catatan kembaran x3 dibuang', g.buang.includes('a4'))
cek('dua bentrokan dilaporkan', g.bentrok === 2, String(g.bentrok))
cek('rencana kosong di utama diambil dari kembaran', g.utama.rencanaLatihan?.[0]?.judul === 'Pola B')
cek('jam, judul, seri utama tidak berubah', g.utama.startTime === '17:30' && g.utama.title === 'Latsar P4' && !g.utama.seriId)
cek('tidak mengubah masukan', sesi[0].rencanaLatihan === undefined && absensi[2].status === 'alpha')
const g2 = rencanaGabung(
  S('u', 'd', '18:00', '20:00', { formPresensi: { x1: 50, x2: 10 }, checklist: [{ id: 'c1', text: 'Bawa pad', done: 0 }], notes: 'A' }),
  [S('v', 'd', '18:00', '20:00', { formPresensi: { x1: 20, x3: 30 }, checklist: [{ id: 'c2', text: 'bawa pad', done: 1 }, { id: 'c3', text: 'Metronom', done: 0 }], notes: 'B', rundownDrive: { id: 'f', nama: 'R', mimeType: 'x', diubah: '', diambil: 1 } })],
  [],
)
cek('formPresensi digabung, cap waktu terawal', g2.utama.formPresensi.x1 === 20 && g2.utama.formPresensi.x2 === 10 && g2.utama.formPresensi.x3 === 30)
cek('checklist digabung tanpa duplikat teks', g2.utama.checklist.length === 2 && g2.utama.checklist[1].text === 'Metronom')
cek('catatan digabung', g2.utama.notes === 'A\nB')
cek('tautan rundown Drive ikut', g2.utama.rundownDrive?.id === 'f')
cek('gabung ke diri sendiri tidak menghapus apa pun', rencanaGabung(sesi[0], [sesi[0]], absensi).hapus.length === 0)

console.log('== alihkan tautan ==')
const prog = [{ id: 'p', sesiIds: ['s19', 'm19', 's20'], wajibIds: ['s19', 's20'] }, { id: 'q', sesiIds: ['zz'], wajibIds: [] }]
const ap = alihkanIdProgram(prog, new Set(['s19']), 'm19')
cek('program: s19 → m19 tanpa duplikat', ap.berubah && ap.daftar[0].sesiIds.join() === 'm19,s20' && ap.daftar[0].wajibIds.join() === 'm19,s20')
cek('program lain tidak disentuh', ap.daftar[1] === prog[1])
cek('tanpa perubahan → berubah=false', !alihkanIdProgram(prog, new Set(['nope']), 'm19').berubah)
const am = alihkanIdMusim([{ id: 'mu', sessionId: 's19' }, { id: 'mv' }], new Set(['s19']), 'm19')
cek('musim TC dialihkan', am.berubah && am.daftar[0].sessionId === 'm19' && am.daftar[1].sessionId === undefined)

console.log('== Program: utamakan sesi berabsensi ==')
let seq = 0
const buatId = (a) => `${a}${++seq}`
const p = programBaru(buatId, '2026-11-19', 1000)
Object.assign(p, { nama: 'Latsar', mulai: '2026-11-19', selesai: '2026-11-20', hari: [3, 4], jamMulai: '18:00', jamSelesai: '20:00', tonggak: [], tambahan: [], libur: [], sesiIds: ['s19', 's20'], wajibIds: ['s19', 's20'] })
const sesiP = sesi.filter((s) => ['m19', 's19', 'm20', 's20'].includes(s.id))
const tanpa = rencanakanProgram(p, sesiP, [], { buatId, mode: 'kosong' })
const i19a = tanpa.item.find((x) => x.tanggal === '2026-11-19')
cek('tanpa info absensi: milik program (s19) seperti dulu', i19a?.sesi.id === 's19', i19a?.sesi.id)
cek('tanggal ganda ditandai', i19a?.ganda?.length === 1 && i19a.catatan.includes('tanggal ganda'), i19a?.catatan)
const dengan = rencanakanProgram(p, sesiP, [], { buatId, mode: 'kosong', adaAbsensi: new Set(['m19']) })
const i19b = dengan.item.find((x) => x.tanggal === '2026-11-19')
const i20b = dengan.item.find((x) => x.tanggal === '2026-11-20')
cek('dengan absensi: sesi berabsensi (m19) ditautkan', i19b?.sesi.id === 'm19' && i19b.aksi === 'tautkan', i19b?.sesi.id)
cek('kembarannya disebut di ganda', i19b?.ganda?.[0]?.id === 's19')
cek('tanggal tanpa absensi tetap milik program (s20)', i20b?.sesi.id === 's20')
const tunggal = rencanakanProgram(p, [S('t19', '2026-11-19', '18:00', '20:00')], [], { buatId, mode: 'kosong' })
cek('tanggal tunggal: tanpa catatan ganda', !tunggal.item.find((x) => x.tanggal === '2026-11-19')?.ganda)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
