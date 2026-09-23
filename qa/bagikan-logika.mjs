/**
 * Uji penyusunan paket berbagi (grup vs per anggota) dan penulis ZIP.
 *
 * Asersi yang paling penting ada pada `paketAnggota`: **nol** data anggota
 * lain. Ini bukan sekadar "datanya disaring" — sebelum perbaikan, satu
 * berkas yang dibagikan ke 18 anggota memuat 36 catatan absensi, di mana
 * hanya 2 yang milik penerimanya. Tampilan memang disaring; berkasnya tidak.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { crc32, bikinZip } from '/tmp/zip.mjs'
import { bersihkanAnggota, namaBerkasAnggota, paketAnggota, paketGrup } from '/tmp/bagikan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

// ------------------------------------------------------------------- CRC32
{
  const enc = new TextEncoder()
  cek('crc32("") = 0', crc32(enc.encode('')) === 0)
  cek('crc32("a") = 0xE8B7BE43', crc32(enc.encode('a')) === 0xe8b7be43,
    crc32(enc.encode('a')).toString(16))
  // Nilai uji baku untuk CRC32: "123456789" -> 0xCBF43926
  cek('crc32("123456789") = 0xCBF43926', crc32(enc.encode('123456789')) === 0xcbf43926,
    crc32(enc.encode('123456789')).toString(16))
  cek('crc32 peka terhadap perubahan satu bita',
    crc32(enc.encode('abc')) !== crc32(enc.encode('abd')))
}

// ------------------------------------------------------- contoh paket bersama
const anggota = (id, nama, kode) => ({
  id, code: kode, name: nama, section: 'Brass', instrument: 'Trumpet',
  role: 'anggota', joinYear: 2026, active: 1,
  token: `token-${id}`, phone: '0812-3456-7890', notes: `Catatan rahasia tentang ${nama}`,
  createdAt: 1,
})
const A = anggota('m1', 'Andra Pratama', 'A07')
const B = anggota('m2', 'Bunga Lestari', 'B12')
const C = anggota('m3', 'Citra Dewi', 'C03')

const absen = (id, memberId, status = 'hadir') => ({
  id, sessionId: 's1', memberId, status, at: 1, source: 'manual',
})
const catat = (id, memberId, teks) => ({ id, memberId, at: 1, text: teks, by: 'Pelatih' })

const bundle = {
  format: 'drillkit-share',
  version: 1,
  exportedAt: 1,
  team: { teamName: 'Garuda', coachName: 'Pelatih', city: 'Yogyakarta', logo: null, defaultField: 'DCI', memberMode: 1 },
  members: [A, B, C],
  sessions: [{ id: 's1', title: 'Latihan', type: 'latihan', date: '2026-09-20', startTime: '08:00', endTime: '10:00', checklist: [], createdAt: 1 }],
  drills: [{ id: 'd1', name: 'Demo', tempo: 120 }],
  sets: [],
  songs: [],
  attendance: [absen('a1', 'm1'), absen('a2', 'm1'), absen('a3', 'm2'), absen('a4', 'm3'), absen('a5', 'm3', 'izin')],
  memberNotes: [catat('n1', 'm1', 'Catatan Andra'), catat('n2', 'm2', 'Catatan Bunga'), catat('n3', 'm3', 'Catatan Citra')],
  mode: 'member',
}

// ------------------------------------------------------ bersihkanAnggota
{
  const b = bersihkanAnggota(A)
  cek('token dibuang', !b.token, JSON.stringify(b.token))
  cek('telepon dibuang', b.phone === undefined)
  cek('catatan pribadi pelatih dibuang', b.notes === undefined)
  cek('nama tetap ada', b.name === 'Andra Pratama')
  cek('kode tetap ada', b.code === 'A07')
  cek('section tetap ada (dibutuhkan formasi)', b.section === 'Brass')
  cek('instrumen tetap ada', b.instrument === 'Trumpet')
  // Jangan sampai mengubah rekaman aslinya.
  cek('rekaman asli tidak berubah', A.token === 'token-m1' && A.phone === '0812-3456-7890')
}

// --------------------------------------------------------------- paketGrup
{
  const g = paketGrup(bundle)
  cek('grup: tanpa absensi sama sekali', g.attendance.length === 0, String(g.attendance.length))
  cek('grup: tanpa catatan evaluasi', (g.memberNotes ?? []).length === 0)
  cek('grup: daftar anggota tetap ada', g.members.length === 3)
  cek('grup: telepon anggota tidak ikut', g.members.every((m) => m.phone === undefined))
  cek('grup: token anggota dikosongkan', g.members.every((m) => !m.token))
  cek('grup: jadwal tetap ikut', g.sessions.length === 1)
  cek('grup: drill tetap ikut', g.drills.length === 1)
  cek('grup: modenya anggota', g.mode === 'member')
}

// ------------------------------------------------------------ paketAnggota
{
  const p = paketAnggota(bundle, 'm1')
  // Inilah asersi yang menentukan: NOL data anggota lain.
  cek('per anggota: hanya absensinya sendiri', p.attendance.length === 2, String(p.attendance.length))
  cek('per anggota: NOL absensi anggota lain',
    p.attendance.every((a) => a.memberId === 'm1'),
    JSON.stringify(p.attendance.map((a) => a.memberId)))
  cek('per anggota: hanya catatannya sendiri', p.memberNotes.length === 1)
  cek('per anggota: NOL catatan anggota lain',
    p.memberNotes.every((n) => n.memberId === 'm1'),
    JSON.stringify(p.memberNotes.map((n) => n.memberId)))
  cek('per anggota: daftar anggota tetap utuh', p.members.length === 3)
  cek('per anggota: telepon anggota lain pun dibuang',
    p.members.every((m) => m.phone === undefined))
  cek('per anggota: data bersama tetap ikut', p.sessions.length === 1 && p.drills.length === 1)

  // Berkas ini DIBUAT untuk satu orang, jadi ia harus mengatakannya —
  // tanpa ini anggota disuruh memilih namanya dari seluruh daftar.
  cek('per anggota: menyebut untuk siapa berkasnya',
    p.forMember === 'm1', String(p.forMember))

  // Yang paling berbahaya: id yang tidak dikenal tidak boleh mengembalikan
  // SEMUA data — ia harus mengembalikan kosong.
  const x = paketAnggota(bundle, 'siapa-ini')
  cek('id tak dikenal: absensi kosong, bukan semua',
    x.attendance.length === 0, String(x.attendance.length))
  cek('id tak dikenal: catatan kosong, bukan semua', x.memberNotes.length === 0)
  const y = paketAnggota(bundle, '')
  cek('id kosong: absensi kosong', y.attendance.length === 0)
  // Menyebut seseorang sebagai penerima padahal datanya tidak disertakan
  // berarti mengidentifikasi orang yang salah.
  cek('id tak dikenal: TIDAK menyebut penerima', x.forMember === undefined, String(x.forMember))
  cek('id kosong: TIDAK menyebut penerima', y.forMember === undefined, String(y.forMember))
}
{
  // Berkas grup dibagikan ke semua orang — bukan untuk siapa pun secara
  // khusus. Yang rawan: `...b` membawa penanda penerima dari paket per
  // anggota, sehingga SEMUA orang diidentifikasi sebagai orang yang sama.
  const turunan = paketGrup(paketAnggota(bundle, 'm1'))
  cek('grup: tidak menyebut penerima', paketGrup(bundle).forMember === undefined,
    String(paketGrup(bundle).forMember))
  cek('grup dari paket anggota: penanda penerimanya DIBUANG',
    turunan.forMember === undefined, String(turunan.forMember))
  cek('grup dari paket anggota: tetap nol absensi', turunan.attendance.length === 0)
}
{
  // Anggota tanpa absensi sama sekali: berkasnya tetap jadi, hanya kosong.
  const tanpa = { ...bundle, attendance: bundle.attendance.filter((a) => a.memberId !== 'm2') }
  const p = paketAnggota(tanpa, 'm2')
  cek('anggota tanpa absensi: berkasnya kosong, tidak error', p.attendance.length === 0)
  cek('anggota tanpa absensi: catatannya tetap ikut', p.memberNotes.length === 1)
}
{
  // Nilai evaluasi terstruktur H2 tidak pernah ikut.
  cek('H2 tidak ikut di paket grup', paketGrup(bundle).evaluasi === undefined)
  cek('H2 tidak ikut di paket anggota', paketAnggota(bundle, 'm1').evaluasi === undefined)
}

// ------------------------------------------------------- namaBerkasAnggota
{
  cek('nama berkas memuat nama & kode',
    namaBerkasAnggota(A) === 'DrillKit-Andra-Pratama-A07.json', namaBerkasAnggota(A))
  cek('nama berkas berakhiran .json', namaBerkasAnggota(B).endsWith('.json'))
  // Aksen dibuang supaya aman di semua sistem berkas.
  const beraksen = { ...A, name: 'José Ángel', code: 'J1' }
  cek('aksen dibuang dari nama berkas',
    namaBerkasAnggota(beraksen) === 'DrillKit-Jose-Angel-J1.json', namaBerkasAnggota(beraksen))
  // Karakter yang dilarang di nama berkas.
  const ngawur = { ...A, name: 'Andra/Putra: 100%?', code: 'A/7' }
  cek('karakter terlarang dibuang',
    /^DrillKit-Andra-Putra-100-A-7\.json$/.test(namaBerkasAnggota(ngawur)),
    namaBerkasAnggota(ngawur))
  // Nama yang sama harus tetap beda berkas karena kodenya beda.
  const kembar1 = { ...A, id: 'k1', name: 'Sari', code: 'S1' }
  const kembar2 = { ...A, id: 'k2', name: 'Sari', code: 'S2' }
  cek('nama kembar tetap beda berkas',
    namaBerkasAnggota(kembar1) !== namaBerkasAnggota(kembar2))
  // Nama kosong tidak boleh menghasilkan nama berkas yang rusak.
  const kosong = { ...A, name: '', code: '' }
  cek('nama kosong tidak menghasilkan berkas rusak',
    namaBerkasAnggota(kosong).startsWith('DrillKit-') && namaBerkasAnggota(kosong).endsWith('.json'),
    namaBerkasAnggota(kosong))
}

// -------------------------------------------------------------- bikinZip
{
  const entri = [
    { nama: 'satu.json', isi: '{"a":1}' },
    { nama: 'dua.json', isi: '{"b":2}' },
    { nama: 'Berkas-Andra-A07.json', isi: '{"c":3}' },
  ]
  const z = bikinZip(entri)
  cek('zip tidak kosong', z.length > 0, String(z.length))
  cek('zip diawali tanda tangan tajuk lokal',
    z[0] === 0x50 && z[1] === 0x4b && z[2] === 0x03 && z[3] === 0x04)
  cek('zip diakhiri tanda tangan akhir direktori',
    z[z.length - 22] === 0x50 && z[z.length - 21] === 0x4b && z[z.length - 20] === 0x05 && z[z.length - 19] === 0x06)
  cek('ukuran sesuai perhitungan', z.length === new Uint8Array(z).length)

  // Tulis ke berkas lalu BUKA dengan Python zipfile — bukan sekadar mengaku.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'))
  const berkas = path.join(dir, 'uji.zip')
  fs.writeFileSync(berkas, Buffer.from(z))
  const hasil = (await import('node:child_process')).execFileSync('python3', [
    '-c',
    `import zipfile,sys
z = zipfile.ZipFile(${JSON.stringify(berkas)})
buruk = z.testzip()
print('RUSAK' if buruk else 'BAIK')
for n in z.namelist(): print('NAMA', n)
for n in z.namelist(): print('ISI', n, z.read(n).decode('utf-8'))
`,
  ]).toString()
  const baris = hasil.trim().split('\n')
  cek('zip terbuka & lulus uji integritas Python', baris[0] === 'BAIK', baris[0])
  const nama = baris.filter((b) => b.startsWith('NAMA')).map((b) => b.slice(5))
  cek('ketiga nama ada di dalam zip', nama.length === 3, JSON.stringify(nama))
  const isi = Object.fromEntries(
    baris.filter((b) => b.startsWith('ISI')).map((b) => {
      const [, n, ...rest] = b.split(' ')
      return [n, rest.join(' ')]
    }),
  )
  cek('isi berkas pertama utuh', isi['satu.json'] === '{"a":1}', isi['satu.json'])
  cek('isi berkas kedua utuh', isi['dua.json'] === '{"b":2}', isi['dua.json'])
  cek('isi berkas ketiga utuh', isi['Berkas-Andra-A07.json'] === '{"c":3}')
  fs.rmSync(dir, { recursive: true, force: true })
}
{
  // ZIP kosong harus tetap sah, bukan mencetak berkas rusak.
  const z = bikinZip([])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zipkosong-'))
  const berkas = path.join(dir, 'k.zip')
  fs.writeFileSync(berkas, Buffer.from(z))
  const hasil = (await import('node:child_process')).execFileSync('python3', [
    '-c',
    `import zipfile
z = zipfile.ZipFile(${JSON.stringify(berkas)})
print('JUMLAH', len(z.namelist()))`,
  ]).toString().trim()
  cek('zip kosong tetap sah', hasil === 'JUMLAH 0', hasil)
  fs.rmSync(dir, { recursive: true, force: true })
}
{
  // Isi UTF-8 (huruf Indonesia & aksen) harus utuh keluar-masuk.
  const z = bikinZip([{ nama: 'José-Andra.json', isi: '{"nama":"Andra Pratama","catatan":"bagus sekali"}' }])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziputf-'))
  const berkas = path.join(dir, 'u.zip')
  fs.writeFileSync(berkas, Buffer.from(z))
  const hasil = (await import('node:child_process')).execFileSync('python3', [
    '-c',
    `import zipfile
z = zipfile.ZipFile(${JSON.stringify(berkas)})
print('NAMA', z.namelist()[0])
print('ISI', z.read(z.namelist()[0]).decode('utf-8'))`,
  ]).toString().trim().split('\n')
  cek('nama berkas beraksen utuh', hasil[0] === 'NAMA José-Andra.json', hasil[0])
  cek('isi UTF-8 utuh', hasil[1].includes('bagus sekali'), hasil[1])
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
