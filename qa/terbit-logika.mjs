/**
 * Terbitkan ke anggota — bagian pertama (tanpa kunci pribadi).
 *
 * Yang dijaga:
 * - token ditolak / kedaluwarsa punya pesan yang jelas
 * - repo privat ditolak, karena anggota tidak bisa mengambilnya
 * - terbitan pertama tidak mengirim sha; pembaruan mengirim sha berkas lama
 * - bentrok 409 dicoba sekali lagi
 * - isi yang terbit sama dengan berkas grup: tanpa absensi, telepon, token
 * - token GitHub tidak ikut di berkas, dan kuncinya tidak ada di backup
 * - anggota A tidak menerima data B (berkas grup kosong dari data pribadi)
 * - setelan latihan yang anggota ubah sendiri tidak ditimpa
 * - materi lebih baru dikenali; yang sama tidak memunculkan pemberitahuan
 */
import fs from 'node:fs'
import path from 'node:path'
import { AKAR } from './lokasi.mjs'
import {
  PESAN_LURING,
  PESAN_TOKEN_DITOLAK,
  bacaAlamatRepo,
  bacaIsiBerkas,
  bacaRiwayat,
  bacaSandi,
  badanTulis,
  cuplikanVercel,
  gabungLagu,
  gabungPembaruan,
  kembalikan,
  materiLebihBaru,
  pesanGalat,
  rapikanAtur,
  ringkasTerbit,
  sandiTeks,
  siapTerbit,
  tanggalIndonesia,
  terbitkan,
  ujiSambungan,
} from '/tmp/terbit.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const atur = { pemilik: 'pelatih', repo: 'drillkit-materi', token: 'github_pat_rahasia', cabang: 'main' }

function kirimPalsu(peta) {
  const panggilan = []
  return {
    panggilan,
    kirim: async (p) => {
      panggilan.push(p)
      const kunci = [...peta.keys()].find((k) => p.url.includes(k) && (p.method === 'GET' || k.startsWith('PUT')))
      if (p.method === 'PUT') {
        const put = peta.get('PUT')
        if (put) return put(p, panggilan)
      }
      for (const [k, v] of peta) {
        if (k === 'PUT') continue
        if (p.url.includes(k)) return typeof v === 'function' ? v(p) : v
      }
      return { status: 500, json: { message: 'tidak ada stub' }, teks: '' }
    },
  }
}

// --------------------------------------------------------------- pesan galat
cek('401 menyebut ditolak', pesanGalat(401, { message: 'Bad credentials' }, 'repo').includes('ditolak'))
cek('401 menyebut kedaluwarsa', PESAN_TOKEN_DITOLAK.includes('kedaluwarsa') && pesanGalat(401, null, 'tulis') === PESAN_TOKEN_DITOLAK)
cek('403 Contents jelas', /Contents/.test(pesanGalat(403, { message: 'Resource not accessible' }, 'tulis')))
cek('404 repo jelas', /tidak ditemukan/i.test(pesanGalat(404, null, 'repo')))
cek('422 ukuran jelas', /besar/.test(pesanGalat(422, null, 'tulis')))
cek('luring disebut manual', PESAN_LURING.includes('manual') && PESAN_LURING.includes('ditolak'))

// ---------------------------------------------------------------- alamat repo
{
  const u = bacaAlamatRepo('https://github.com/Pelatih-Tim/drillkit-materi.git')
  cek('URL GitHub dipecah', u?.pemilik === 'Pelatih-Tim' && u?.repo === 'drillkit-materi', JSON.stringify(u))
  cek('pemilik/repo pendek', bacaAlamatRepo('aku/drillkit-materi')?.repo === 'drillkit-materi')
  cek('teks acak ditolak', bacaAlamatRepo('bukan alamat') == null)
  cek('atur kosong ditolak', 'salah' in rapikanAtur({ pemilik: '', repo: '', token: '' }))
  cek('token berspasi ditolak', 'salah' in rapikanAtur({ ...atur, token: 'github pat rusak' }))
}

// --------------------------------------------------------------- sambungan
{
  const { kirim } = kirimPalsu(new Map([
    ['/repos/pelatih/drillkit-materi/contents', { status: 404, json: { message: 'Not Found' }, teks: '' }],
    ['/repos/pelatih/drillkit-materi', { status: 200, json: { private: false }, teks: '' }],
  ]))
  const baik = await ujiSambungan(atur, kirim)
  cek('repo publik tanpa berkas: baik', baik.baik && baik.adaBerkas === false, baik.pesan)

  const privat = await ujiSambungan(atur, async () => ({ status: 200, json: { private: true }, teks: '' }))
  cek('repo privat ditolak', !privat.baik && /privat/.test(privat.pesan), privat.pesan)

  const tolak = await ujiSambungan(atur, async () => ({ status: 401, json: { message: 'Bad credentials' }, teks: '' }))
  cek('token ditolak saat uji', !tolak.baik && tolak.pesan.includes('kedaluwarsa'))
}

// -------------------------------------------------------------- tulis berkas
{
  let putKe = 0
  const { panggilan, kirim } = kirimPalsu(new Map([
    ['/contents/paket.json', { status: 404, json: { message: 'Not Found' }, teks: '' }],
    ['PUT', () => {
      putKe += 1
      return { status: 201, json: { sha: 'sha-baru' }, teks: '' }
    }],
  ]))
  const hasil = await terbitkan(atur, '{"format":"drillkit-share"}', kirim)
  cek('terbitan pertama berhasil', hasil.ok && hasil.sha === 'sha-baru', hasil.pesan)
  const put = panggilan.find((p) => p.method === 'PUT')
  const badan = JSON.parse(put.body)
  cek('terbitan pertama tanpa sha', badan.sha == null, JSON.stringify(badan))
  cek('cabang ikut', badan.branch === 'main')
  cek('isi tersandi utuh', bacaSandi(badan.content) === '{"format":"drillkit-share"}')
  cek('pesan komit berbahasa', /Terbitkan materi DrillKit/.test(badan.message))
}

{
  const { panggilan, kirim } = kirimPalsu(new Map([
    ['/contents/paket.json', { status: 200, json: { sha: 'sha-lama', content: sandiTeks('{}'), encoding: 'base64' }, teks: '' }],
    ['PUT', () => ({ status: 200, json: { sha: 'sha-2' }, teks: '' })],
  ]))
  await terbitkan(atur, '{"a":1}', kirim)
  const badan = JSON.parse(panggilan.find((p) => p.method === 'PUT').body)
  cek('pembaruan mengirim sha lama', badan.sha === 'sha-lama', badan.sha)
}

{
  let putKe = 0
  const kirim = async (p) => {
    if (p.method === 'PUT') {
      putKe += 1
      if (putKe === 1) return { status: 409, json: { message: 'sha mismatch' }, teks: '' }
      const badan = JSON.parse(p.body)
      return badan.sha === 'sha-baru'
        ? { status: 200, json: { sha: 'sha-akhir' }, teks: '' }
        : { status: 409, json: {}, teks: '' }
    }
    if (p.url.includes('/contents/')) {
      return { status: 200, json: { sha: putKe === 0 ? 'sha-lama' : 'sha-baru', content: sandiTeks('{}'), encoding: 'base64' }, teks: '' }
    }
    return { status: 500, json: {}, teks: '' }
  }
  const hasil = await terbitkan(atur, 'isi', kirim)
  cek('409 dicoba lagi lalu berhasil', hasil.ok && hasil.sha === 'sha-akhir', hasil.pesan)
  cek('409 tidak berulang tanpa henti', putKe === 2, String(putKe))
}

// --------------------------------------------------------- isi = berkas grup
{
  const andra = { id: 'm_andra', code: 'A07', name: 'Andra Pratama', panggilan: 'Dede', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2024, active: 1, token: 'qr-rahasia', phone: '0812', notes: 'catatan pelatih', createdAt: 1 }
  const bunga = { id: 'm_bunga', code: 'B02', name: 'Bunga', section: 'woodwind', instrument: 'Flute', role: 'member', joinYear: 2024, active: 1, token: 'qr-bunga', phone: '0899', notes: 'rahasia bunga', createdAt: 1 }
  const bundle = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 10,
    team: { teamName: 'Tim Uji' },
    members: [andra, bunga],
    sessions: [{ id: 's1', title: 'Latihan', date: '2026-10-01' }],
    drills: [{ id: 'd1', name: 'Buka' }],
    sets: [],
    songs: [{ id: 'lagu1', title: 'Lagu', bpm: 120, beats: 4, tempoMap: [], createdAt: 1 }],
    attendance: [
      { id: 'abA', sessionId: 's1', memberId: 'm_andra', status: 'hadir' },
      { id: 'abB', sessionId: 's1', memberId: 'm_bunga', status: 'alpha' },
    ],
    memberNotes: [{ id: 'nB', memberId: 'm_bunga', at: 1, text: 'khusus bunga' }],
    mode: 'coach',
  }
  const teks = siapTerbit(bundle)
  const terbit = JSON.parse(teks)
  cek('terbitan tanpa absensi', terbit.attendance.length === 0)
  cek('terbitan tanpa catatan', (terbit.memberNotes ?? []).length === 0)
  cek('token QR tidak ikut', !teks.includes('qr-rahasia') && !teks.includes('qr-bunga'))
  cek('telepon tidak ikut', !teks.includes('0812') && !teks.includes('0899'))
  cek('catatan pelatih tidak ikut', !teks.includes('khusus bunga') && !teks.includes('catatan pelatih'))
  cek('token GitHub tidak ikut', !teks.includes(atur.token))
  cek('anggota A tidak menerima data B', !teks.includes('alpha') && !teks.includes('khusus bunga'))
  cek('jadwal dan show ikut', terbit.sessions.length === 1 && terbit.drills.length === 1)
  cek('bukan untuk satu orang', terbit.forMember == null)
  const ringkas = ringkasTerbit(bundle)
  cek('pratinjau menghitung jadwal show lagu', ringkas.jadwal === 1 && ringkas.show === 1 && ringkas.lagu === 1)
  cek('belum ada yang terkunci', ringkas.terkunci === 0 && ringkas.tanpaKunci.length === 2)
}

// ---------------------------------------------------- pembaruan tidak menimpa
{
  const lama = {
    format: 'drillkit-share', version: 1, exportedAt: 1, team: null, members: [],
    sessions: [], drills: [], sets: [],
    songs: [{ id: 'lagu1', title: 'Lama', bpm: 100, beats: 4, tempoMap: [], createdAt: 1, ulangBagian: { dari: 1, sampai: 4, aktif: 0 } }],
    attendance: [{ id: 'ab', sessionId: 's1', memberId: 'm_andra', status: 'hadir' }],
    memberNotes: [{ id: 'n', memberId: 'm_andra', at: 1, text: 'catatan andra' }],
    forMember: 'm_andra',
    namaPenerima: 'Andra Pratama (Dede)',
  }
  const baru = {
    ...lama,
    exportedAt: 50,
    team: { teamName: 'Tim Baru' },
    sessions: [{ id: 's2' }],
    songs: [{ id: 'lagu1', title: 'Baru', bpm: 140, beats: 4, tempoMap: [], createdAt: 1, ulangBagian: { dari: 1, sampai: 8, aktif: 1 } }],
    attendance: [],
    memberNotes: [],
    forMember: undefined,
  }
  const lokal = [{ id: 'lagu1', title: 'Lama', bpm: 100, beats: 4, tempoMap: [], createdAt: 1, ulangBagian: { dari: 2, sampai: 6, aktif: 1 } }]
  const gabung = gabungPembaruan(baru, lama, lokal)
  cek('absensi anggota tetap', gabung.attendance.length === 1 && gabung.attendance[0].status === 'hadir')
  cek('catatan anggota tetap', gabung.memberNotes[0].text === 'catatan andra')
  cek('penanda pemilik tetap', gabung.forMember === 'm_andra' && gabung.namaPenerima === 'Andra Pratama (Dede)')
  cek('judul lagu dari pelatih menang', gabung.songs[0].title === 'Baru' && gabung.songs[0].bpm === 140)
  cek('setelan latihan yang diubah tidak ditimpa', gabung.songs[0].ulangBagian.dari === 2, JSON.stringify(gabung.songs[0].ulangBagian))
  const utuh = gabungLagu(baru.songs, lama.songs, lama.songs)
  cek('setelan yang tidak diubah ikut pelatih', utuh[0].ulangBagian.sampai === 8)
}

// -------------------------------------------------------------- pemberitahuan
cek('materi lebih baru', materiLebihBaru(10, 20))
cek('materi sama tidak baru', !materiLebihBaru(20, 20))
cek('tanpa paket lokal dianggap baru', materiLebihBaru(undefined, 20))
cek('jarak rusak tidak baru', !materiLebihBaru(10, undefined))
cek('tanggal berbahasa', tanggalIndonesia(Date.UTC(2026, 8, 26, 12)) .includes('2026'))

// ------------------------------------------------------------------- riwayat
{
  const riwayat = bacaRiwayat([
    { sha: 'abc', commit: { message: 'Terbitkan materi\nbaris dua', author: { date: '2026-09-26T00:00:00Z' } } },
    { sha: 1 },
    null,
  ])
  cek('riwayat mengambil baris pertama', riwayat.length === 1 && riwayat[0].pesan === 'Terbitkan materi' && riwayat[0].sha === 'abc')
  cek('riwayat bukan larik ditolak', bacaRiwayat({ message: 'bukan' }).length === 0)
}

{
  const isiLama = '{"format":"drillkit-share","judul":"lama"}'
  const { panggilan, kirim } = kirimPalsu(new Map([
    ['ref=', { status: 200, json: { content: sandiTeks(isiLama).slice(0, 8) + '\n' + sandiTeks(isiLama).slice(8), encoding: 'base64', sha: 'lama' }, teks: '' }],
    ['/contents/paket.json', { status: 200, json: { sha: 'kini', content: sandiTeks('{}'), encoding: 'base64' }, teks: '' }],
    ['PUT', (p) => {
      const badan = JSON.parse(p.body)
      return bacaSandi(badan.content) === isiLama && badan.sha === 'kini'
        ? { status: 200, json: { sha: 'pulih' }, teks: '' }
        : { status: 422, json: { message: JSON.parse(p.body).sha }, teks: '' }
    }],
  ]))
  const hasil = await kembalikan(atur, 'abc123', kirim)
  cek('kembalikan memakai isi lama dan sha kini', hasil.ok, hasil.pesan)
  cek('kembalikan tidak menghapus riwayat', /Kembalikan materi/.test(JSON.parse(panggilan.find((p) => p.method === 'PUT').body).message))
}

// --------------------------------------------------------------- cuplikan
{
  const cup = cuplikanVercel(atur)
  cek('rewrite mengarah ke mentah', cup.includes('raw.githubusercontent.com/pelatih/drillkit-materi/main/paket.json'))
  cek('alamat anggota tetap /paket.json', cup.includes('"/paket.json"'))
  const kembali = bacaIsiBerkas({ content: sandiTeks('Andra — évènement'), encoding: 'base64' })
  cek('aksara Indonesia utuh', kembali === 'Andra — évènement', kembali)
  cek('badan tulis memuat sha bila ada', JSON.parse(badanTulis({ pesan: 'x', isi: 'y', sha: 's', cabang: 'main' })).sha === 's')
  cek('badan tulis tanpa sha bila baru', !('sha' in JSON.parse(badanTulis({ pesan: 'x', isi: 'y', cabang: 'main' }))))
}

// ------------------------------------------------ token tidak masuk backup
{
  const backup = fs.readFileSync(path.join(AKAR, 'src/lib/backup.ts'), 'utf8')
  const bagikan = fs.readFileSync(path.join(AKAR, 'src/lib/bagikan.ts'), 'utf8')
  const kartu = fs.readFileSync(path.join(AKAR, 'src/components/KartuTerbit.tsx'), 'utf8')
  cek('backup tidak mengenal kunci token', !backup.includes('drillkit.terbit'))
  cek('paket tidak mengenal kunci token', !bagikan.includes('drillkit.terbit'))
  cek('kartu tidak menulis basis data', !kartu.includes('db.'))
  cek('kartu tidak menyimpan token sendiri', !/localStorage\./.test(kartu))
  cek('penyimpanan token hanya lewat modul terbit', kartu.includes('simpanAtur'))
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
