/**
 * Uji murni C3 — pengingat jadwal latihan (src/lib/pengingat.ts).
 *
 * Yang diuji tanpa peramban: jendela sesi mendesak, jendela notifikasi,
 * teks notifikasi, ingatan harian (tutup & sudah-notif), dan pembangun
 * berkas .ics (escape, lipat baris, dua alarm).
 *
 * Semua waktu dibangun dari komponen lokal (new Date(y, m, d, ...)) supaya
 * hasilnya sama di zona waktu mana pun.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-pengingat.mjs
 */
import {
  bacaNotif,
  bacaTutup,
  bangunICS,
  butuhNotifikasi,
  epochMulai,
  escICS,
  hariStr,
  lipatICS,
  namaBerkasICS,
  sesiMendesak,
  tandaiNotif,
  teksNotifikasi,
  tutupHariIni,
} from '/tmp/pengingat.mjs'

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
// Kamis, 24 Sep 2026 10:00 waktu lokal.
const NOW = new Date(2026, 8, 24, 10, 0, 0).getTime()
const sesi = (id, date, startTime, extra = {}) => ({
  id, title: `Sesi ${id}`, type: 'latihan', date, startTime, endTime: '17:00',
  checklist: [], createdAt: 0, ...extra,
})
const simpanKosong = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, v) } }
}

/* ------------------------- epochMulai ------------------------- */
{
  const s = sesi('a', '2026-09-24', '15:30')
  uji('jam mulai valid → epoch tepat',
    epochMulai(s) === new Date(2026, 8, 24, 15, 30).getTime(), String(epochMulai(s)))
  uji('tanggal rusak → null', epochMulai(sesi('b', '24-09-2026', '15:30')) === null)
  uji('jam rusak → null', epochMulai(sesi('c', '2026-09-24', '3 sore')) === null)
  uji('31 Feb ditolak (tidak meluber)', epochMulai(sesi('d', '2026-02-31', '10:00')) === null)
  uji('jam 24:00 ditolak', epochMulai(sesi('e', '2026-09-24', '24:00')) === null)
  uji('hari ini dalam string', hariStr(NOW) === '2026-09-24', hariStr(NOW))
}

/* ------------------------- sesiMendesak ------------------------- */
{
  const daftar = [
    sesi('kemarin', '2026-09-23', '15:00'),
    sesi('besok', '2026-09-25', '15:00'),
    sesi('lusa', '2026-09-26', '15:00'),
    sesi('hari-ini-sore', '2026-09-24', '15:00'),
    sesi('hari-ini-pagi', '2026-09-24', '08:00'),
    sesi('rusak', 'kapan-kapan', '15:00'),
  ]
  const m = sesiMendesak(daftar, NOW).map((s) => s.id)
  uji('hari ini + besok ikut, kemarin & lusa tidak',
    JSON.stringify(m) === '["hari-ini-pagi","hari-ini-sore","besok"]', JSON.stringify(m))
  uji('sesi pagi yang sudah lewat hari ini tetap ikut (spanduk, bukan alarm)', m.includes('hari-ini-pagi'))
  const nol = sesiMendesak(daftar, NOW, 0).map((s) => s.id)
  uji('dalamHari=0 → hanya hari ini', JSON.stringify(nol) === '["hari-ini-pagi","hari-ini-sore"]', JSON.stringify(nol))
  const jauh = sesiMendesak(daftar, NOW, 7).map((s) => s.id)
  uji('dalamHari=7 → lusa ikut', jauh.includes('lusa'))
  uji('diurutkan tanggal lalu jam', m[0] === 'hari-ini-pagi' && m[1] === 'hari-ini-sore')
  uji('kosong → kosong', sesiMendesak([], NOW).length === 0)
}

/* ------------------------- butuhNotifikasi ------------------------- */
{
  const pada = (jam, mnt) => sesi('x', '2026-09-24', `${String(jam).padStart(2, '0')}:${String(mnt).padStart(2, '0')}`)
  uji('30 mnt lagi → ya', butuhNotifikasi(pada(10, 30), NOW) === true)
  uji('3 jam pas → ya', butuhNotifikasi(pada(13, 0), NOW) === true)
  uji('4 jam lagi → tidak', butuhNotifikasi(pada(14, 0), NOW) === false)
  uji('mulai 10 mnt lalu → ya', butuhNotifikasi(pada(9, 50), NOW) === true)
  uji('mulai 1 jam lalu → tidak', butuhNotifikasi(pada(9, 0), NOW) === false)
  uji('rusak → tidak', butuhNotifikasi(sesi('y', 'rusak', 'rusak'), NOW) === false)
}

/* ------------------------- teksNotifikasi ------------------------- */
{
  const pada = (jam, mnt, extra) => sesi('x', '2026-09-24',
    `${String(jam).padStart(2, '0')}:${String(mnt).padStart(2, '0')}`, { title: 'Latihan', ...extra })
  uji('25 mnt → "25 menit lagi"', teksNotifikasi(pada(10, 25), NOW).judul === 'Latihan 25 menit lagi')
  const j60 = teksNotifikasi(pada(11, 0), NOW).judul
  uji('60 mnt → "1 jam lagi"', j60 === 'Latihan 1 jam lagi', j60)
  const j90 = teksNotifikasi(pada(11, 30), NOW).judul
  uji('90 mnt → "1 jam 30 menit lagi"', j90 === 'Latihan 1 jam 30 menit lagi', j90)
  uji('sudah mulai → "dimulai!"', teksNotifikasi(pada(9, 55), NOW).judul === 'Latihan dimulai!')
  const isi = teksNotifikasi(pada(10, 25, { place: 'Lapangan A' }), NOW).isi
  uji('isi memuat jam + tempat', isi === '10:25–17:00 · Lapangan A', isi)
  const isi2 = teksNotifikasi(pada(10, 25), NOW).isi
  uji('tanpa tempat tetap rapi', isi2 === '10:25–17:00', isi2)
}

/* ------------------------- ingatan harian ------------------------- */
{
  const simpan = simpanKosong()
  uji('belum ditutup → null', bacaTutup(simpan, 's1') === null)
  tutupHariIni(simpan, 's1', '2026-09-24')
  uji('sesudah tutup → harinya terbaca', bacaTutup(simpan, 's1') === '2026-09-24')
  uji('sesi lain tak ikut tertutup', bacaTutup(simpan, 's2') === null)
  uji('tutup & notif kuncinya terpisah', bacaNotif(simpan, 's1') === null)
  tandaiNotif(simpan, 's1', '2026-09-24')
  uji('notif tercatat sendiri', bacaNotif(simpan, 's1') === '2026-09-24' && bacaTutup(simpan, 's1') === '2026-09-24')
  uji('penyimpanan null aman', (() => {
    tutupHariIni(null, 's1', '2026-09-24')
    tandaiNotif(null, 's1', '2026-09-24')
    return bacaTutup(null, 's1') === null && bacaNotif(null, 's1') === null
  })())
  const rusak = simpanKosong()
  rusak.setItem('drillkit.tutupIngatkan.v1', '{bukan-json')
  uji('JSON rusak dibaca sebagai kosong', bacaTutup(rusak, 's1') === null)
}

/* ------------------------- .ics ------------------------- */
{
  const s = sesi('abc', '2026-09-25', '15:30', {
    title: 'Latihan, gabungan; besar', endTime: '18:00', place: 'Lapangan A, barat', notes: 'Bawa air\n& semangat',
  })
  const ics = bangunICS(s, { stampMs: NOW })
  uji('struktur kalender lengkap',
    ics.includes('BEGIN:VCALENDAR') && ics.includes('BEGIN:VEVENT') && ics.includes('END:VEVENT') && ics.includes('END:VCALENDAR'))
  uji('DTSTART mengambang (tanpa Z)', ics.includes('DTSTART:20260925T153000\r\n'), ics.match(/DTSTART.*/)?.[0] ?? '')
  uji('DTEND tepat', ics.includes('DTEND:20260925T180000'))
  uji('SUMMARY diloloskan', ics.includes('SUMMARY:Latihan\\, gabungan\\; besar'))
  uji('LOCATION diloloskan', ics.includes('LOCATION:Lapangan A\\, barat'))
  uji('baris baru jadi \\n', ics.includes('DESCRIPTION:Bawa air\\n& semangat'))
  uji('alarm H-1', ics.includes('TRIGGER:-P1D'))
  uji('alarm H-0 sejam', ics.includes('TRIGGER:-PT60M'))
  uji('UID stabil dari id', ics.includes('UID:abc@drillkit'))
  const polos = bangunICS(sesi('p', '2026-09-25', '15:30', { title: 'X', endTime: '16:00' }), { stampMs: NOW })
  uji('tanpa tempat & catatan → tanpa barisnya (DESCRIPTION hanya milik 2 alarm)',
    !polos.includes('LOCATION:') && (polos.match(/DESCRIPTION:/g) ?? []).length === 2)
  uji('tanggal rusak melempar', (() => {
    try {
      bangunICS(sesi('q', 'rusak', '15:30'))
      return false
    } catch {
      return true
    }
  })())
  uji('esc backslash dulu', escICS('a\\b,c;d') === 'a\\\\b\\,c\\;d', escICS('a\\b,c;d'))
  // Lipat: DESCRIPTION + 40× 'é' (2 byte) = 92 byte → harus dilipat byte-aman.
  const panjang = 'DESCRIPTION:' + 'é'.repeat(40)
  const lipat = lipatICS(panjang)
  const byte = (x) => new TextEncoder().encode(x).length
  const fisik = lipat.split('\r\n')
  uji('lipatan ≤ 75 byte per baris', fisik.every((b) => byte(b) <= 75), fisik.map(byte).join(','))
  uji('lanjutan diawali spasi', fisik.length === 2 && fisik[1].startsWith(' '))
  uji('lipatan bisa dibuka kembali utuh', lipat.replace(/\r\n /g, '') === panjang)
  uji('baris pendek tidak dilipat', lipatICS('UID:abc@drillkit') === 'UID:abc@drillkit')
}

/* ------------------------- nama berkas ------------------------- */
{
  const s = sesi('a', '2026-09-25', '15:30', { title: 'Latihan Gabungan Besar!' })
  uji('slug + tanggal', namaBerkasICS(s) === 'latihan-gabungan-besar-2026-09-25.ics', namaBerkasICS(s))
  const kosong = sesi('b', '2026-09-25', '15:30', { title: '!!!' })
  uji('judul simbol → jadwal', namaBerkasICS(kosong) === 'jadwal-2026-09-25.ics', namaBerkasICS(kosong))
  const pjg = sesi('c', '2026-09-25', '15:30', { title: 'a'.repeat(50) })
  uji('slug dipotong 30', namaBerkasICS(pjg) === `${'a'.repeat(30)}-2026-09-25.ics`)
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
