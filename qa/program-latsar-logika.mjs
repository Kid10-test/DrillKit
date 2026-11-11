/**
 * #36 — Program Latsar & Pemantau Syarat Pelantikan (logika murni).
 *
 * Skenario utamanya program latihan dasar sungguhan (CAB 42):
 * Selasa/Kamis/Jumat 18.00–20.00 mulai Kamis 12 Nov (Selasa 10 Nov libur
 * sesudah lomba), Minggu 29 Nov tambahan, Hakrab Minggu 22 Nov (tidak
 * dihitung), Pelantikan 5–6 Des, latihan lanjut sampai 18 Des, camp belum
 * bertanggal. Dua belas sesi sebelum pelantikan = sesi wajib.
 *
 * Yang dijaga:
 * - tanggal latihan: pola mingguan, libur, tambahan, tonggak menggantikan latihan
 * - usulan tiga fase (batas Hakrab & Pelantikan), pola A/B/C bergiliran, target preset
 * - rencana: buat / tautkan sesi yang sudah ada / tetap; rencana pelatih & realisasi
 *   tidak ditimpa; mode ganti; tonggak jadi sesi "lainnya"; sesi yang lepas
 * - wajib bawaan = latihan sebelum pelantikan (12), Hakrab tidak
 * - keabsahan izin (sebelum jam mulai + bukti), sakit (≤ 24 jam), tanpa jam lapor, putusan pelatih
 * - syarat v2.8 (rasio): hadir ≥ ⌈7/12·N⌉, alpa ≤ bulat(1/4·N), jatah telat bulat(1/6·N);
 *   status lulus / berjalan / kritis / susulan, batas bergabung, bergabung belakangan
 *   (rincian rasio, jam datang, Form & impor: qa/kehadiran-rasio-logika.mjs)
 * - CSV rekap
 */
import {
  tanggalLatihan, usulFase, cariPolaLatsar, programBaru, periksaProgram, rencanakanProgram, terapkanRencana,
  ringkasRencana, keabsahanIzin, kodeKehadiran, batasRasio, lengkapiAturan, nilaiPeserta, rekapPelantikan, urutkanRekap,
  tambahPeserta, barisCsvPelantikan, sesiWajib, faseUntuk, mulaiSesiMs, tonggakCamp, ATURAN_BAKU,
} from '/tmp/programLatsar.mjs'
import { polaContohLatsar } from '/tmp/ranahSesi.mjs'

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
let seq = 0
const buatId = (a) => `${a}${++seq}`

/* ------------------------------ program CAB 42 ------------------------------ */
console.log('\n— Tanggal latihan —')
const pustaka = polaContohLatsar(
  [
    { id: 'brass', label: 'Brass' },
    { id: 'percussion', label: 'Battery' },
    { id: 'guard', label: 'Color Guard' },
  ],
  buatId,
)
const pola = cariPolaLatsar(pustaka)
cek('cari pola Latsar A/B/C di pustaka', pola.A === pustaka[0].id && pola.B === pustaka[1].id && pola.C === pustaka[2].id)
cek('pustaka kosong → tanpa pola', !cariPolaLatsar([]).A)

const p = programBaru(buatId, '2026-11-12', 1000)
Object.assign(p, {
  nama: 'Latsar CAB 42',
  mulai: '2026-11-12',
  selesai: '2026-12-18',
  hari: [1, 3, 4],
  tambahan: ['2026-11-29'],
  libur: [],
  tempat: 'Lapangan',
  tonggak: [
    { id: 't1', nama: 'Hakrab', jenis: 'acara', dari: '2026-11-22', jamMulai: '08:00', jamSelesai: '16:00' },
    { id: 't2', nama: 'Pelantikan', jenis: 'pelantikan', dari: '2026-12-05', sampai: '2026-12-06', jamMulai: '07:00', jamSelesai: '17:00' },
    { id: 't3', nama: 'Camp', jenis: 'camp' },
  ],
  aturan: { ...ATURAN_BAKU, batasGabung: '2026-11-24' },
})
cek('aturan baku rasio 7/12 · 1/4 · 1/6 · sakit 24 jam', ATURAN_BAKU.rasioHadir.join('/') === '7/12' && ATURAN_BAKU.rasioAlpa.join('/') === '1/4' && ATURAN_BAKU.rasioTelat.join('/') === '1/6' && ATURAN_BAKU.sakitMaksJam === 24)
const tgl = tanggalLatihan(p)
const HARAP = ['2026-11-12', '2026-11-13', '2026-11-17', '2026-11-19', '2026-11-20', '2026-11-24', '2026-11-26', '2026-11-27', '2026-11-29', '2026-12-01', '2026-12-03', '2026-12-04', '2026-12-08', '2026-12-10', '2026-12-11', '2026-12-15', '2026-12-17', '2026-12-18']
cek('18 tanggal latihan persis kalender CAB 42', JSON.stringify(tgl) === JSON.stringify(HARAP), tgl.join(','))
cek('Selasa 10 Nov tidak ikut (sebelum mulai)', !tgl.includes('2026-11-10'))
cek('libur meniadakan tanggal', !tanggalLatihan({ ...p, libur: ['2026-11-17'] }).includes('2026-11-17'))
cek('tonggak libur meniadakan rentang', tanggalLatihan({ ...p, tonggak: [...p.tonggak, { id: 'x', nama: 'UAS', jenis: 'libur', dari: '2026-12-08', sampai: '2026-12-11' }] }).filter((t) => t >= '2026-12-08' && t <= '2026-12-11').length === 0)
cek('tonggak tes tidak meniadakan latihan', tanggalLatihan({ ...p, tonggak: [{ id: 'x', nama: 'Tes', jenis: 'tes', dari: '2026-12-15' }] }).includes('2026-12-15'))
cek('acara di hari latihan menggantikan latihan', !tanggalLatihan({ ...p, tonggak: [{ id: 'x', nama: 'Konser', jenis: 'acara', dari: '2026-11-19' }] }).includes('2026-11-19'))
cek('camp tanpa tanggal tercatat', tonggakCamp(p)?.nama === 'Camp' && !tonggakCamp(p).dari)
cek('mulai sesi 18:00 waktu setempat', new Date(mulaiSesiMs({ date: '2026-11-12', startTime: '18:00' })).getHours() === 18)

console.log('\n— Usulan fase —')
p.fase = usulFase(p, pola, buatId)
cek('tiga fase', p.fase.length === 3)
cek('Fase 1: 12–21 Nov (sampai sebelum Hakrab)', p.fase[0].dari === '2026-11-12' && p.fase[0].sampai === '2026-11-21', `${p.fase[0].dari}..${p.fase[0].sampai}`)
cek('Fase 2: 22 Nov–4 Des (sampai sebelum Pelantikan)', p.fase[1].dari === '2026-11-22' && p.fase[1].sampai === '2026-12-04', `${p.fase[1].dari}..${p.fase[1].sampai}`)
cek('Fase 3: 7–18 Des (sesudah Pelantikan)', p.fase[2].dari === '2026-12-07' && p.fase[2].sampai === '2026-12-18', `${p.fase[2].dari}..${p.fase[2].sampai}`)
cek('nama fase', p.fase.map((f) => f.nama.split(' — ')[1]).join('|') === 'Dasar bersama|Teknik seksi|Menjelang tampil')
cek('target preset per fase', p.fase[0].target?.nama === 'Dasar bersama' && p.fase[2].target?.nama === 'Menjelang tampil')
cek('Fase 1 pola: Sel A, Kam B, Jum A, Min (tambahan) A', p.fase[0].polaPerHari['1'] === pola.A && p.fase[0].polaPerHari['3'] === pola.B && p.fase[0].polaPerHari['4'] === pola.A && p.fase[0].polaPerHari['6'] === pola.A, JSON.stringify(p.fase[0].polaPerHari))
cek('Fase 2 pola: Sel B, Kam C', p.fase[1].polaPerHari['1'] === pola.B && p.fase[1].polaPerHari['3'] === pola.C)
cek('fase untuk 29 Nov = Fase 2', faseUntuk(p, '2026-11-29')?.nama.startsWith('Fase 2'))
cek('tanpa acara & pelantikan: sepertiga awal', (() => {
  const f = usulFase({ mulai: '2026-01-01', selesai: '2026-01-30', hari: [0], tambahan: [], tonggak: [] }, pola, buatId)
  return f.length === 3 && f[0].sampai === '2026-01-10' && f[2].sampai === '2026-01-30'
})())
cek('periksa: program CAB 42 bersih', periksaProgram(p).length === 0, periksaProgram(p).join(' | '))
cek('periksa: fase tumpang tindih', periksaProgram({ ...p, fase: [p.fase[0], { ...p.fase[1], dari: '2026-11-20' }] }).some((x) => x.includes('tumpang tindih')))
cek('periksa: jam terbalik & tanpa hari', periksaProgram({ ...p, jamSelesai: '17:00', hari: [], tambahan: [] }).length === 2)

/* --------------------------------- rencana --------------------------------- */
console.log('\n— Rencana penerapan —')
// Sebagian sesi sudah dibuat pelatih lebih dulu di Jadwal.
const lama = [
  { id: 'L12', title: 'Latihan perdana CAB 42', type: 'latihan', date: '2026-11-12', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 1 },
  { id: 'L13', title: 'Latsar', type: 'latihan', date: '2026-11-13', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 1, rencanaLatihan: [{ id: 'x1', judul: 'Rencana pelatih', jenis: 'lain', menit: 120 }] },
  { id: 'L17', title: 'Latsar', type: 'latihan', date: '2026-11-17', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 1, mulaiNyata: 5 },
  { id: 'H22', title: 'Hakrab CAB 42', type: 'lainnya', date: '2026-11-22', startTime: '08:00', endTime: '16:00', checklist: [], createdAt: 1 },
  { id: 'R19', title: 'Rapat pengurus', type: 'rapat', date: '2026-11-19', startTime: '20:00', endTime: '21:00', checklist: [], createdAt: 1 },
]
const r = rencanakanProgram(p, lama, pustaka, { buatId, mode: 'kosong', sekarang: 7 })
const latihan = r.item.filter((x) => x.jenis === 'latihan')
cek('18 latihan + Hakrab + 2 hari Pelantikan', latihan.length === 18 && r.item.length === 21, String(r.item.length))
cek('camp tanpa tanggal tidak jadi sesi', !r.item.some((x) => x.jenis === 'camp'))
const i12 = r.item.find((x) => x.tanggal === '2026-11-12')
cek('12 Nov: sesi lama ditautkan, judul tetap', i12.aksi === 'tautkan' && i12.sesi.id === 'L12' && i12.sesi.title === 'Latihan perdana CAB 42')
cek('12 Nov: rencana kosong diisi Pola B (Kamis Fase 1)', i12.isiRencana && i12.sesi.rencanaLatihan.length === 6 && i12.pola.id === pola.B)
const i13 = r.item.find((x) => x.tanggal === '2026-11-13')
cek('13 Nov: rencana pelatih dibiarkan (mode kosong)', !i13.isiRencana && i13.sesi.rencanaLatihan[0].judul === 'Rencana pelatih' && i13.catatan.includes('dibiarkan'))
const i17 = r.item.find((x) => x.tanggal === '2026-11-17')
cek('17 Nov: sudah berjalan → tidak diubah', !i17.isiRencana && i17.catatan.includes('berjalan'))
const i19 = r.item.find((x) => x.tanggal === '2026-11-19')
cek('19 Nov: rapat bukan latihan → sesi latihan baru dibuat', i19.aksi === 'buat' && i19.sesi.type === 'latihan' && i19.sesi.id !== 'R19')
cek('sesi baru: judul program, jam, tempat, catatan fase', i19.sesi.title === 'Latsar CAB 42' && i19.sesi.startTime === '18:00' && i19.sesi.endTime === '20:00' && i19.sesi.place === 'Lapangan' && i19.sesi.notes.startsWith('Fase 1'))
const hakrab = r.item.find((x) => x.tanggal === '2026-11-22')
cek('Hakrab: sesi lama ditautkan menurut nama, tidak wajib', hakrab.aksi === 'tautkan' && hakrab.sesi.id === 'H22' && !hakrab.wajib)
const pel = r.item.filter((x) => x.jenis === 'pelantikan')
cek('Pelantikan: 2 sesi "lainnya" 07–17, tidak wajib', pel.length === 2 && pel.every((x) => x.sesi.type === 'lainnya' && x.sesi.startTime === '07:00' && !x.wajib))
cek('wajib bawaan = 12 latihan sebelum Pelantikan', r.item.filter((x) => x.wajib).length === 12 && r.item.filter((x) => x.wajib).every((x) => x.jenis === 'latihan' && x.tanggal < '2026-12-05'))
const rk = ringkasRencana(r, {})
cek('ringkasan: 17 buat, 4 tautkan', rk.buat === 17 && rk.tautkan === 4 && rk.wajib === 12, JSON.stringify(rk))
cek('id blok tiap sesi unik', (() => {
  const ids = r.item.flatMap((x) => x.sesi.rencanaLatihan ?? []).map((b) => b.id)
  return ids.length > 0 && new Set(ids).size === ids.length
})())
cek('blok paralel ikut tersalin', r.item.find((x) => x.tanggal === '2026-11-26').sesi.rencanaLatihan.some((b) => b.cabang?.length === 3))

const terap = terapkanRencana(p, r, { [i12.sesi.id]: false }, 9)
cek('terapkan: tulis 17 baru + 1 rencana terisi', terap.tulis.length === 18, String(terap.tulis.length))
cek('terapkan: program mencatat 21 sesi & 11 wajib (12 Nov dimatikan)', terap.program.sesiIds.length === 21 && terap.program.wajibIds.length === 11 && !terap.program.wajibIds.includes('L12'))
cek('terapkan tidak mengubah program asal', p.sesiIds.length === 0)

// Terap ulang: semua sesi sudah ada → tetap; satu tanggal dibuang → lepas.
const semua2 = [...lama.filter((s) => !terap.tulis.some((t) => t.id === s.id)), ...terap.tulis]
const p2 = { ...terap.program, libur: ['2026-12-18'] }
const r2 = rencanakanProgram(p2, semua2, pustaka, { buatId, mode: 'kosong' })
cek('terap ulang: tanpa sesi baru', ringkasRencana(r2, {}).buat === 0, JSON.stringify(ringkasRencana(r2, {})))
cek('terap ulang: semuanya "tetap"', r2.item.every((x) => x.aksi === 'tetap'))
cek('terap ulang: wajib mengikuti keputusan sebelumnya', r2.item.filter((x) => x.wajib).length === 11)
cek('tanggal dibuang → sesi dilepas, tidak dihapus', r2.lepas.length === 1 && r2.lepas[0].date === '2026-12-18')
const r3 = rencanakanProgram(terap.program, semua2, pustaka, { buatId, mode: 'ganti' })
cek('mode ganti: rencana pelatih 13 Nov diganti pola', r3.item.find((x) => x.tanggal === '2026-11-13').isiRencana)
cek('mode ganti: sesi berjalan tetap aman', !r3.item.find((x) => x.tanggal === '2026-11-17').isiRencana)

/* -------------------------------- keabsahan -------------------------------- */
console.log('\n— Keabsahan izin & sakit —')
const S = { date: '2026-11-19', startTime: '18:00' }
const jam = (h, m = 0, d = 19) => new Date(2026, 10, d, h, m).getTime()
const A = lengkapiAturan({ sakitMaksJam: 24 })
const B = { bukti: 'ada' }
cek('izin 17:59 + bukti → sah', keabsahanIzin({ status: 'izin', dilaporAt: jam(17, 59), ...B }, S, A) === 'sah')
cek('izin 18:00 tepat → terlambat', keabsahanIzin({ status: 'izin', dilaporAt: jam(18), ...B }, S, A) === 'telat')
cek('izin tanpa jam lapor → tanpa-cap', keabsahanIzin({ status: 'izin' }, S, A) === 'tanpa-cap')
cek('izin tepat waktu tanpa bukti → tanpa-bukti', keabsahanIzin({ status: 'izin', dilaporAt: jam(10) }, S, A) === 'tanpa-bukti')
cek('sakit dilapor 20 jam kemudian → sah', keabsahanIzin({ status: 'sakit', dilaporAt: jam(14, 0, 20), ...B }, S, A) === 'sah')
cek('sakit 24 jam tepat → sah', keabsahanIzin({ status: 'sakit', dilaporAt: jam(18, 0, 20), ...B }, S, A) === 'sah')
cek('sakit 25 jam → terlambat', keabsahanIzin({ status: 'sakit', dilaporAt: jam(19, 0, 20), ...B }, S, A) === 'telat')
cek('putusan pelatih "sah" mengalahkan jam & bukti', keabsahanIzin({ status: 'izin', dilaporAt: jam(19), putusanIzin: 'sah' }, S, A) === 'sah')
cek('putusan "tidak sah" → ditolak', keabsahanIzin({ status: 'izin', dilaporAt: jam(9), putusanIzin: 'tidak-sah', ...B }, S, A) === 'ditolak')
cek('hadir/alpha bukan urusan keabsahan', keabsahanIzin({ status: 'hadir' }, S, A) === null && keabsahanIzin({ status: 'alpha' }, S, A) === null)
const atr = lengkapiAturan(ATURAN_BAKU)
cek('kode: belum diisi (lewat) vs mendatang', kodeKehadiran(undefined, { ...S, id: 'x' }, atr, '2026-11-20') === 'kosong' && kodeKehadiran(undefined, { ...S, id: 'x' }, atr, '2026-11-19') === 'mendatang')
cek('kode izin sah / sakit terlambat', kodeKehadiran({ status: 'izin', dilaporAt: jam(10), ...B }, S, atr, '2026-11-20') === 'izin-sah' && kodeKehadiran({ status: 'sakit', dilaporAt: jam(20, 0, 21), ...B }, S, atr, '2026-11-22') === 'sakit-telat')

/* --------------------------------- syarat --------------------------------- */
console.log('\n— Syarat pelantikan (rasio) —')
cek('N=12 → hadir 7 · alpa 3 · telat 2', JSON.stringify(batasRasio(12, atr)) === JSON.stringify({ hadir: 7, alpa: 3, telat: 2 }))
cek('N=7 (oprec susulan) → 5 · 2 · 1', JSON.stringify(batasRasio(7, atr)) === JSON.stringify({ hadir: 5, alpa: 2, telat: 1 }))

const prog = { ...terap.program, wajibIds: terap.program.sesiIds.filter((id) => r.item.find((x) => x.sesi.id === id)?.wajib) }
const sesiSemua = r.item.map((x) => x.sesi)
const wajib = sesiWajib(prog, sesiSemua)
cek('sesi wajib urut: 12, mulai 12 Nov, akhir 4 Des', wajib.length === 12 && wajib[0].date === '2026-11-12' && wajib[11].date === '2026-12-04')
const W = wajib.map((s) => s.id)
const rec = (memberId, i, status, extra = {}) => ({ id: `${memberId}${i}`, sessionId: W[i], memberId, status, ...extra })
const lapor = (i, h, m = 0) => new Date(...wajib[i].date.split('-').map((x, k) => (k === 1 ? Number(x) - 1 : Number(x))), h, m).getTime()
const catatan = []
// Andi: hadir 8 sesi pertama → sudah memenuhi 7.
for (let i = 0; i < 8; i++) catatan.push(rec('andi', i, 'hadir'))
// Budi: hadir 5, alpha 3 → alpa 3 = batas → jatah alpa habis → kritis.
for (let i = 0; i < 8; i++) catatan.push(rec('budi', i, i < 5 ? 'hadir' : 'alpha'))
// Citra: 2 izin sah (lapor siang + bukti) + 6 hadir → izin tidak memakai jatah alpa.
for (let i = 0; i < 8; i++) catatan.push(i < 2 ? rec('citra', i, 'izin', { dilaporAt: lapor(i, 12), bukti: 'ada', kategoriIzin: 'kuliah' }) : rec('citra', i, 'hadir'))
// Dodi: 4 alpha → melebihi batas 3 → susulan walau hadirnya masih bisa cukup.
for (let i = 0; i < 8; i++) catatan.push(rec('dodi', i, i < 4 ? 'alpha' : 'hadir'))
// Euis: 2 izin telat (lapor 19:00) + 1 izin tanpa jam → 3 alpa → kritis.
for (let i = 0; i < 8; i++)
  catatan.push(i < 2 ? rec('euis', i, 'izin', { dilaporAt: lapor(i, 19), bukti: 'ada' }) : i === 2 ? rec('euis', i, 'izin') : rec('euis', i, 'hadir'))
// Fajar: izin sah di 6 sesi → paling banyak hadir 6 < 7 → susulan.
for (let i = 0; i < 8; i++) catatan.push(i < 6 ? rec('fajar', i, 'izin', { dilaporAt: lapor(i, 8), bukti: 'ada' }) : rec('fajar', i, 'hadir'))
// Gita: tidak ada catatan untuk 8 sesi yang lewat → belum diisi (bukan alpa), maks 4 < 7.
// Joko: telat — 2 berjatah, jatah habis, lewat 19.00, tanpa alasan.
const telat = (i, h, m, alasan) => rec('joko', i, 'hadir', { datangAt: lapor(i, h, m), ...(alasan ? { alasanTelat: alasan, bukti: 'ada' } : {}) })
catatan.push(
  telat(0, 18, 45, 'praktikum'),
  telat(1, 18, 50, 'praktikum'),
  telat(2, 18, 40, 'asistensi'),
  telat(3, 19, 15, 'praktikum'),
  telat(4, 18, 20),
  telat(5, 18, 45),
  rec('joko', 6, 'hadir'),
  rec('joko', 7, 'hadir'),
)
const peserta = [
  { memberId: 'andi', bergabung: '2026-11-12' },
  { memberId: 'budi', bergabung: '2026-11-12' },
  { memberId: 'citra', bergabung: '2026-11-12' },
  { memberId: 'dodi', bergabung: '2026-11-12' },
  { memberId: 'euis', bergabung: '2026-11-12' },
  { memberId: 'fajar', bergabung: '2026-11-12' },
  { memberId: 'gita', bergabung: '2026-11-12' },
  { memberId: 'hana', bergabung: '2026-11-24' },
  { memberId: 'iwan', bergabung: '2026-11-26' },
  { memberId: 'joko', bergabung: '2026-11-12' },
]
const progP = { ...prog, peserta }
const HARI = '2026-11-28' // 8 sesi wajib sudah lewat (12–27 Nov), sisa 4 (29 Nov, 1, 3, 4 Des)
const anggota = peserta.map((x) => ({ id: x.memberId, name: x.memberId[0].toUpperCase() + x.memberId.slice(1), code: x.memberId.slice(0, 2).toUpperCase(), section: 'brass' }))
const rek = rekapPelantikan(progP, anggota, sesiSemua, catatan, HARI)
const n = (id) => rek.baris.find((b) => b.memberId === id)
cek('Andi: hadir 8 ≥ 7 → Memenuhi, jaga alpa', n('andi').status === 'lulus' && n('andi').butuh === 7 && n('andi').alasan.includes('sisa 3×'), n('andi').alasan)
cek('Budi: alpa 3 = batas → Kritis (jatah alpa habis)', n('budi').status === 'kritis' && n('budi').alpa === 3 && n('budi').sisaAlpa === 0 && n('budi').alasan.includes('Jatah alpa habis'), n('budi').alasan)
cek('Citra: 2 izin sah tidak memakai jatah alpa → Berjalan, boleh tidak hadir 3×', n('citra').status === 'berjalan' && n('citra').izinSah === 2 && n('citra').alpa === 0 && n('citra').butuh === 7 && n('citra').jatah === 3, JSON.stringify(n('citra')))
cek('Dodi: alpa 4 > 3 → Susulan', n('dodi').status === 'susulan' && n('dodi').alasan.startsWith('Alpa 4×'), n('dodi').alasan)
cek('Euis: izin terlambat & tanpa jam = alpa 3', n('euis').tidakSah === 3 && n('euis').izinSah === 0 && n('euis').alpa === 3)
cek('Euis: jatah alpa habis → Kritis', n('euis').status === 'kritis')
cek('Fajar: 6 izin sah → paling banyak hadir 6 < 7 → Susulan', n('fajar').status === 'susulan' && n('fajar').maksHadir === 6 && n('fajar').alpa === 0, n('fajar').alasan)
cek('Gita: 8 belum diisi → bukan alpa, tapi maks 4 < 7 → Susulan', n('gita').kosong === 8 && n('gita').alpa === 0 && n('gita').status === 'susulan')
cek('Hana: bergabung 24 Nov (batas) → N = 7 sejak 24 Nov', !n('hana').terlambatGabung && n('hana').wajib === 7 && n('hana').rincian.slice(0, 5).every((k) => k === null))
cek('Hana: N=7 → butuh 5, alpa maks 2, jatah telat 1', n('hana').butuh === 5 && n('hana').maksAlpa === 2 && n('hana').maksTelat === 1)
cek('Iwan: bergabung 26 Nov > batas 24 Nov → Susulan', n('iwan').terlambatGabung && n('iwan').status === 'susulan' && n('iwan').alasan.includes('24 Nov'), n('iwan').alasan)
cek('Hana: 3 sesi sejak bergabung belum diisi → maks 4 < 5 → Susulan', n('hana').kosong === 3 && n('hana').status === 'susulan')
cek(
  'Joko: rincian telat — 2 berjatah, jatah habis, lewat batas, tepat, tanpa alasan',
  n('joko').rincian.slice(0, 8).join() === 'telat-jatah,telat-jatah,telat,telat,hadir,telat,hadir,hadir',
  n('joko').rincian.join(),
)
cek('Joko: hadir 5 (2 berjatah), alpa 3 → Kritis', n('joko').hadir === 5 && n('joko').telatJatah === 2 && n('joko').telat === 3 && n('joko').status === 'kritis')
cek('rekap: jumlah per status', rek.jumlah.lulus === 1 && rek.jumlah.berjalan === 1 && rek.jumlah.kritis === 3 && rek.jumlah.susulan === 5, JSON.stringify(rek.jumlah))
cek('rekap: hitung izin tanpa jam lapor & sel kosong (Gita 8 + Hana 3 + Iwan 2)', rek.tanpaCap === 1 && rek.kosong === 13, String(rek.kosong))
cek('rincian: kode per sesi wajib', n('citra').rincian.slice(0, 3).join() === 'izin-sah,izin-sah,hadir' && n('citra').rincian[8] === 'mendatang')
cek('persen hadir dari sesi yang sudah lewat', n('andi').persenHadir === 100 && n('dodi').persenHadir === 50)
const urut = urutkanRekap(rek.baris)
cek('urutan: susulan dulu, lulus terakhir', urut[0].status === 'susulan' && urut.at(-1).status === 'lulus')
// Sesudah semua sesi wajib lewat: Citra hadir 4 lagi → lulus; Budi 4 sisa kosong → susulan.
const catatan2 = [...catatan, ...[8, 9, 10, 11].map((i) => rec('citra', i, 'hadir'))]
const rekAkhir = rekapPelantikan(progP, anggota, sesiSemua, catatan2, '2026-12-05')
cek('akhir: Citra lulus, Budi (4 sisa kosong) susulan', rekAkhir.baris.find((b) => b.memberId === 'citra').status === 'lulus' && rekAkhir.baris.find((b) => b.memberId === 'budi').status === 'susulan')
cek('anggota terhapus tetap terhitung (anggota null)', rekapPelantikan({ ...progP, peserta: [{ memberId: 'zzz', bergabung: '2026-11-12' }] }, anggota, sesiSemua, [], HARI).baris[0].anggota === null)
cek('peserta bergabung sesudah semua sesi wajib (tanpa batas) → belum mulai', nilaiPeserta({ ...progP, aturan: { ...atr, batasGabung: undefined } }, { memberId: 'x', bergabung: '2026-12-10' }, wajib, new Map(), HARI).status === 'belum-mulai')
cek('aturan lama #36 (persenMin/hadirMin) dibaca sebagai rasio bawaan', nilaiPeserta({ ...progP, aturan: { persenMin: 70, hadirMin: 7, sakitMaksJam: 24 } }, peserta[0], wajib, new Map(), HARI).butuh === 7)

console.log('\n— Peserta & CSV —')
const tp = tambahPeserta(progP, ['andi', 'baru1', 'baru2'])
cek('tambah peserta: unik, bergabung = mulai program', tp.length === 12 && tp.at(-1).bergabung === '2026-11-12' && tp.filter((x) => x.memberId === 'andi').length === 1)
cek('tambah peserta dengan tanggal bergabung', tambahPeserta(progP, ['baru3'], '2026-11-20').at(-1).bergabung === '2026-11-20')
const csv = barisCsvPelantikan(rek, (s) => (s === 'brass' ? 'Brass' : s))
cek('CSV: kepala + 10 baris', csv.length === 11 && csv[0][1] === 'Nama' && csv[0].length === 21 + 12)
cek('CSV: kolom tanggal sesi wajib', csv[0][21] === '2026-11-12' && csv[0].at(-1) === '2026-12-04')
cek('CSV: kode sel & tanda sebelum bergabung', csv.find((x) => x[1] === 'Hana')[21] === '—' && csv.find((x) => x[1] === 'Citra')[21] === 'I')
cek('CSV: kolom alpa & batasnya', csv[0][10] === 'Alpa' && csv.find((x) => x[1] === 'Dodi')[10] === 4 && csv.find((x) => x[1] === 'Dodi')[11] === 3)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
