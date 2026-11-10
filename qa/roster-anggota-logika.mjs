/**
 * v2.7.1 — Roster pergantian musim: logika murni.
 *
 * Yang dijaga:
 * - CSV: kolom Tag terbaca (pisah koma/titik koma, judul Tag/Tags/Kelompok),
 *   kolom terisi tercatat, pemisah `;` ala Excel Indonesia tidak memecah sel
 *   Tag berkoma, CSV lama (tanpa Tag/Panggilan) tetap terbaca, ekspor ⇄ impor
 * - rencana impor: nama sama → diperbarui / tanpa perubahan; nama mirip →
 *   perlu dicek (bawaan orang baru); nama ganda di berkas ditandai; kode saja
 *   tidak pernah mencocokkan; nama kembar dipersempit kode/section
 * - penerapan: sel kosong tidak menghapus, tag digabung (tidak dilepas), status
 *   hanya berubah bila kolom Status terisi, kode lama tetap, kode baru unik
 * - aksi massal: pasang/lepas tag idempoten, aktif/nonaktif, hanya yang berubah
 * - rekap roster: kelompok pertama menang, nonaktif tanpa kelompok tidak
 *   dihitung, instrumen dirapikan, jumlah per seksi & total konsisten, CSV
 * - kelompok roster: pilihan tersimpan menang (termasuk kosong), tebakan dari tag
 * - lembar cetak A4: hex murni, lampiran nama, nonaktif ditandai
 */
import { bacaBarisCsvAnggota, barisCsvAnggota, pecahCsv, JUDUL_CSV_ANGGOTA } from '/tmp/namaAnggota.mjs'
import {
  tebakPemisahCsv, kelompokRosterAktif, kelompokRosterBawaan, kelompokAnggota, rencanakanImporCsv, terapkanBarisKeAnggota,
  hasilImporCsv, kodeUnik, terapkanAksiMassal, teksAksiMassal, rekapRoster, teksSelRekap, barisCsvRekapRoster,
} from '/tmp/rosterAnggota.mjs'
import { buatLembarRekapRosterHtml } from '/tmp/rosterCetak.mjs'

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

const SECTIONS = [
  { id: 'brass', label: 'Brass' },
  { id: 'percussion', label: 'Battery' },
  { id: 'colorguard', label: 'Color Guard' },
]
const baca = (sel, judul = JUDUL_CSV_ANGGOTA) => bacaBarisCsvAnggota(sel, judul, SECTIONS)
const anggota = (o) => ({
  id: o.id, code: o.code ?? o.id.toUpperCase(), name: o.name, section: o.section ?? 'brass', instrument: o.instrument ?? '',
  role: 'member', joinYear: o.joinYear ?? 2024, active: o.active ?? 1, token: 't', createdAt: 1, ...o,
})

/* ------------------------------------ CSV ----------------------------------- */
console.log('\n— CSV: kolom Tag & kolom terisi —')
cek('judul template punya kolom Tag di akhir', JUDUL_CSV_ANGGOTA.at(-1) === 'Tag' && JUDUL_CSV_ANGGOTA.length === 11)
const b1 = baca(['', 'Rara Anindya', '', 'Brass', 'Trumpet', 'Anggota', '2026', '', 'Aktif', '', 'CAB 42, Latsar'])
cek('tag dipisah koma', JSON.stringify(b1.tags) === '["CAB 42","Latsar"]', JSON.stringify(b1.tags))
cek('kolom terisi: section, instrumen, peran, tahun, status, tag', ['section', 'instrument', 'role', 'joinYear', 'active', 'tags'].every((k) => b1.terisi.includes(k)) && !b1.terisi.includes('code') && !b1.terisi.includes('phone'), b1.terisi.join())
const b2 = baca(['', 'Bima', '', 'Tidak Ada', '', '', '', '', '', ''])
cek('sel kosong/tak dikenal tidak masuk "terisi"', b2.terisi.length === 0, b2.terisi.join())
cek('default anggota baru tetap: aktif, section other, tahun ini', b2.active === 1 && b2.section === 'other' && b2.joinYear === new Date().getFullYear())
const bTag = baca(['Sinta', 'Returner – menunggu; Alumni'], ['Nama', 'Kelompok'])
cek('judul "Kelompok" juga dibaca sebagai Tag, titik koma memisah', JSON.stringify(bTag.tags) === '["Returner – menunggu","Alumni"]', JSON.stringify(bTag.tags))
cek('tag tanpa duplikat & tanpa #', JSON.stringify(baca(['X', '#CAB 42, cab 42'], ['Nama', 'Tags']).tags) === '["CAB 42"]')
const lama = baca(['T2', 'Bunga Lestari', 'Battery', 'Snare', 'Anggota', '2025', '', 'Nonaktif', ''], ['Kode', 'Nama', 'Section', 'Instrumen', 'Peran', 'Tahun Masuk', 'No. HP', 'Status', 'Catatan'])
cek('CSV lama (tanpa Panggilan/Tag) tetap terbaca', lama.section === 'percussion' && lama.active === 0 && !lama.tags && lama.code === 'T2')

console.log('\n— CSV: pemisah —')
cek('tebak pemisah koma', tebakPemisahCsv('Kode,Nama,Tag') === ',')
cek('tebak pemisah titik koma (Excel Indonesia)', tebakPemisahCsv('Kode;Nama;Tag') === ';')
cek('tebak pemisah tab', tebakPemisahCsv('Kode\tNama\tTag') === '\t')
cek('judul campur → bawaan lama', tebakPemisahCsv('Kode,Nama;Tag') === undefined)
cek('pemisah ; tidak memecah koma di sel Tag', JSON.stringify(pecahCsv('C1;Rara;CAB 42, Latsar', ';')) === '["C1","Rara","CAB 42, Latsar"]')
cek('tanpa pemisah: perilaku lama (koma & titik koma)', pecahCsv('a,b;c').length === 3)
cek('kutip tetap dihormati', JSON.stringify(pecahCsv('"Rara, A",x', ',')) === '["Rara, A","x"]')
const ekspor = barisCsvAnggota(anggota({ id: 'm1', name: 'Rara', tags: ['CAB 42', 'Latsar'] }), (s) => SECTIONS.find((x) => x.id === s)?.label ?? s, () => 'Anggota')
cek('ekspor menulis kolom Tag', ekspor.length === 11 && ekspor[10] === 'CAB 42, Latsar')
const balik = baca(ekspor)
cek('ekspor → impor: tag & section kembali utuh', JSON.stringify(balik.tags) === '["CAB 42","Latsar"]' && balik.section === 'brass')

/* ----------------------------------- Rencana ---------------------------------- */
console.log('\n— Rencana impor (cocok nama) —')
const lokal = [
  anggota({ id: 'r1', code: 'BR01', name: 'Dimas Prakoso', instrument: 'Trumpet', active: 0, tags: ['Returner – menunggu'], phone: '0811' }),
  anggota({ id: 'r2', code: 'BT01', name: 'Cika Ayu Lestari', section: 'percussion', instrument: 'Snare', active: 0 }),
  anggota({ id: 'r3', code: 'BR02', name: 'Andi', instrument: 'Mellophone' }),
  anggota({ id: 'r4', code: 'BR03', name: 'Andi', instrument: 'Tuba', section: 'percussion' }),
  anggota({ id: 'r5', code: 'C01', name: 'Joko Santoso' }),
]
const J = ['Kode', 'Nama', 'Section', 'Instrumen', 'Status', 'Tag', 'No. HP']
const daftar = [
  baca(['', 'Dimas Prakoso', 'Brass', '', 'Aktif', 'Returner 2027', ''], J), // 0 perbarui
  baca(['', 'dimas  prakoso', '', '', '', '', ''], J), // 1 sama (nama dinormalkan), ganda di berkas
  baca(['', 'Cika', 'Battery', 'Snare', 'Aktif', 'CAB 42', ''], J), // 2 mirip (Cika ⊂ Cika Ayu Lestari)
  baca(['', 'Andi', 'Battery', '', '', '', ''], J), // 3 nama kembar → dipersempit section → r4 (sama)
  baca(['C01', 'Rara Anindya', 'Brass', 'Trumpet', 'Aktif', 'CAB 42', ''], J), // 4 baru (kode C01 sama dengan Joko, nama beda)
  baca(['', 'Andi', '', '', '', 'CAB 42', ''], J), // 5 nama kembar tak bisa dipersempit → mirip (2 kandidat)
]
const rencana = rencanakanImporCsv(daftar, lokal)
const j = (i) => rencana.baris[i]
cek('nama sama + kolom baru → diperbarui', j(0).jenis === 'perbarui' && j(0).idLokal === 'r1', j(0).jenis)
cek('perubahan dirangkum (status & tag)', j(0).perubahan.includes('diaktifkan') && j(0).perubahan.some((t) => t.startsWith('tag + Returner 2027')), j(0).perubahan.join(' | '))
cek('sel kosong → tanpa perubahan (nama dinormalkan)', j(1).jenis === 'sama' && j(1).idLokal === 'r1', j(1).jenis)
cek('nama ganda di berkas ditandai', j(0).gandaDiBerkas && j(1).gandaDiBerkas && !j(4).gandaDiBerkas)
cek('nama mirip → perlu dicek dengan kandidat', j(2).jenis === 'mirip' && j(2).kandidat[0].id === 'r2', JSON.stringify(j(2)))
cek('nama kembar dipersempit section', j(3).jenis === 'sama' && j(3).idLokal === 'r4', `${j(3).jenis} ${j(3).idLokal}`)
cek('kode saja tidak pernah mencocokkan', j(4).jenis === 'baru')
cek('nama kembar tak terpisahkan → ditanya, 2 kandidat', j(5).jenis === 'mirip' && j(5).kandidat.length === 2)
cek('jumlah per jenis', JSON.stringify(rencana.jumlah) === JSON.stringify({ baru: 1, perbarui: 1, sama: 2, mirip: 2 }), JSON.stringify(rencana.jumlah))

console.log('\n— Penerapan —')
const { hasil: h0 } = terapkanBarisKeAnggota(lokal[0], daftar[0])
cek('tag digabung, tag lama tidak dilepas', JSON.stringify(h0.tags) === '["Returner – menunggu","Returner 2027"]', JSON.stringify(h0.tags))
cek('sel HP kosong tidak menghapus no. HP lama', h0.phone === '0811')
cek('instrumen kosong tidak menghapus instrumen lama', h0.instrument === 'Trumpet')
cek('kode chart lama tidak diubah', h0.code === 'BR01')
const { hasil: hNon } = terapkanBarisKeAnggota(lokal[2], baca(['', 'Andi', '', '', 'Nonaktif', '', ''], J))
cek('kolom Status terisi → status berubah', hNon.active === 0)
let n = 0
const tulis = hasilImporCsv({ rencana, lokal, buatId: () => `baru${++n}`, buatToken: () => 'tk', sekarang: 99 })
cek('hasil: 1 diperbarui, mirip bawaan → orang baru', tulis.diperbarui === 1 && tulis.baru === 3, JSON.stringify({ b: tulis.baru, d: tulis.diperbarui, t: tulis.tetap }))
const rara = tulis.tulis.find((m) => m.name === 'Rara Anindya')
cek('anggota baru: kode berkas yang bentrok diganti kode unik', rara && rara.code !== 'C01' && /^A\d\d$/.test(rara.code), rara?.code)
cek('anggota baru: tag, token, waktu', JSON.stringify(rara.tags) === '["CAB 42"]' && rara.token === 'tk' && rara.createdAt === 99)
const kep = hasilImporCsv({ rencana, lokal, keputusan: { 2: { sama: 'r2' }, 5: { sama: 'r3' } }, buatId: () => 'x', buatToken: () => 't' })
const cika = kep.tulis.find((m) => m.id === 'r2')
cek('keputusan "sama dengan" memperbarui kartu lama', kep.baru === 1 && cika?.active === 1 && JSON.stringify(cika.tags) === '["CAB 42"]', JSON.stringify(cika))
cek('dua baris ke orang yang sama digabung berurutan', kep.tulis.filter((m) => m.id === 'r1').length === 1)
cek('nama lama tetap dipakai (bukan nama berkas)', cika.name === 'Cika Ayu Lestari')
const t = new Set(['A01', 'A02'])
cek('kodeUnik: kode kosong → A## berikutnya yang bebas', kodeUnik('', t) === 'A03' && t.has('A03'))
cek('kodeUnik: kode bebas dipakai apa adanya', kodeUnik('BR9', t) === 'BR9')
cek('kodeUnik: bentrok tidak peka huruf', kodeUnik('br9', t) !== 'br9')

/* ---------------------------------- Massal ---------------------------------- */
console.log('\n— Aksi massal —')
const tim = [
  anggota({ id: 'a', name: 'A', tags: ['Returner – menunggu'], active: 0 }),
  anggota({ id: 'b', name: 'B', tags: ['returner 2027'] }),
  anggota({ id: 'c', name: 'C' }),
]
const pasang = terapkanAksiMassal(tim, ['a', 'b'], { jenis: 'tambahTag', tag: '#Returner 2027' })
cek('pasang tag: hanya yang belum punya (tidak peka huruf)', pasang.length === 1 && pasang[0].id === 'a' && pasang[0].tags.includes('Returner 2027'))
const lepas = terapkanAksiMassal(tim, ['a', 'b', 'c'], { jenis: 'lepasTag', tag: 'Returner – menunggu' })
cek('lepas tag: hanya yang punya; tag kosong → undefined', lepas.length === 1 && lepas[0].id === 'a' && lepas[0].tags === undefined)
const akt = terapkanAksiMassal(tim, ['a', 'b'], { jenis: 'status', aktif: true })
cek('aktifkan: hanya yang nonaktif', akt.length === 1 && akt[0].id === 'a' && akt[0].active === 1)
cek('yang tidak dipilih tidak tersentuh', terapkanAksiMassal(tim, [], { jenis: 'status', aktif: false }).length === 0)
cek('tag kosong diabaikan', terapkanAksiMassal(tim, ['c'], { jenis: 'tambahTag', tag: '  ' }).length === 0)
cek('teks toast', teksAksiMassal({ jenis: 'tambahTag', tag: 'CAB 42' }, 3) === 'Tag #CAB 42 dipasang ke 3 anggota' && teksAksiMassal({ jenis: 'status', aktif: false }, 0) === 'Tidak ada yang berubah')

/* ---------------------------------- Rekap ----------------------------------- */
console.log('\n— Rekap roster —')
const K = ['CAB 42', 'Returner 2027', 'Returner – menunggu']
const roster = [
  anggota({ id: '1', name: 'Rara', instrument: 'Trumpet', tags: ['CAB 42'] }),
  anggota({ id: '2', name: 'Bima', instrument: 'trumpet ', tags: ['CAB 42', 'Returner 2027'] }),
  anggota({ id: '3', name: 'Dimas', instrument: 'Trumpet', tags: ['Returner – menunggu'], active: 0 }),
  anggota({ id: '4', name: 'Eka', instrument: 'Tuba', tags: ['Returner 2027'] }),
  anggota({ id: '5', name: 'Fajar', instrument: '', section: 'percussion' }),
  anggota({ id: '6', name: 'Gita', instrument: 'Snare', section: 'percussion', active: 0 }),
  anggota({ id: '7', name: 'Hana', instrument: 'Flag', section: 'lain' , tags: ['CAB 42'] }),
]
const r = rekapRoster(roster, K, SECTIONS)
const brass = r.seksi.find((s) => s.section === 'brass')
const tp = brass.baris.find((b) => b.instrumen === 'Trumpet')
cek('instrumen dirapikan (trumpet␠ = Trumpet)', brass.baris.length === 2 && !!tp, brass.baris.map((b) => b.instrumen).join())
cek('kelompok pertama menang (CAB 42 + Returner → CAB 42)', tp.sel[0].aktif === 2 && tp.sel[1].aktif === 0)
cek('nonaktif di kelompok dihitung terpisah', tp.sel[2].nonaktif === 1 && tp.sel[2].aktif === 0 && tp.totalAktif === 2)
cek('aktif tanpa kelompok → Lainnya; instrumen kosong → "—"', r.seksi.find((s) => s.section === 'percussion').baris[0].instrumen === '—' && r.seksi.find((s) => s.section === 'percussion').jumlah.lainnya === 1)
cek('nonaktif tanpa kelompok tidak dihitung', !r.seksi.find((s) => s.section === 'percussion').baris.some((b) => b.instrumen === 'Snare'))
cek('section tak dikenal tetap muncul di akhir', r.seksi.at(-1).section === 'lain' && r.seksi.at(-1).label === 'lain')
cek('section kosong tidak muncul', !r.seksi.some((s) => s.section === 'colorguard'))
cek('total konsisten', r.total.totalAktif === 5 && r.total.sel[0].aktif === 3 && r.total.sel[1].aktif === 1 && r.total.sel[2].nonaktif === 1 && r.total.lainnya === 1, JSON.stringify(r.total))
cek('jumlah seksi = jumlah baris', brass.jumlah.totalAktif === brass.baris.reduce((a, b) => a + b.totalAktif, 0))
cek('daftar nama per kelompok (aktif dulu)', r.nama[0].anggota.map((a) => a.name).join() === 'Bima,Rara,Hana' && r.nama[2].anggota[0].aktif === false, r.nama[0].anggota.map((a) => a.name).join())
cek('kelompokAnggota: urutan prioritas', kelompokAnggota(roster[1], K) === 0 && kelompokAnggota(roster[4], K) === -1)
cek('teks sel: angka, +nonaktif, strip', teksSelRekap({ aktif: 3, nonaktif: 0 }) === '3' && teksSelRekap({ aktif: 2, nonaktif: 1 }) === '2 +1' && teksSelRekap({ aktif: 0, nonaktif: 4 }) === '+4' && teksSelRekap({ aktif: 0, nonaktif: 0 }) === '–')
const csv = barisCsvRekapRoster(r)
cek('CSV rekap: judul aktif/nonaktif per kelompok', csv[0].length === 2 + K.length * 2 + 2 && csv[0][2] === 'CAB 42 (aktif)')
cek('CSV rekap: baris terakhir = Semua', csv.at(-1)[0] === 'Semua' && csv.at(-1).at(-1) === 5)
cek('rekap tanpa kelompok: semua aktif di Lainnya', rekapRoster(roster, [], SECTIONS).total.lainnya === 5)

console.log('\n— Kelompok roster —')
cek('bawaan pergantian musim', kelompokRosterBawaan(2026).join('|') === 'CAB|Returner 2027|Returner – menunggu|Alumni')
cek('tersimpan menang', kelompokRosterAktif(['B', 'A', 'b'], roster).join() === 'B,A')
cek('tersimpan kosong = sengaja kosong', kelompokRosterAktif([], roster).length === 0)
const tebak = kelompokRosterAktif(undefined, [...roster, anggota({ id: 'z', name: 'Z', tags: ['Solois', 'CAB 42'] })])
cek('tebakan: tag mirip kelompok, terbanyak dulu, tag formasi diabaikan', tebak[0] === 'CAB 42' && !tebak.includes('Solois') && tebak.includes('Returner 2027'), tebak.join())

console.log('\n— Lembar cetak A4 —')
const html = buatLembarRekapRosterHtml({ namaTim: 'Tim <Uji>', tanggal: '2026-11-10', rekap: r, sertakanNama: true })
cek('judul & nama tim di-escape', html.includes('Rekap Roster Anggota') && html.includes('Tim &lt;Uji&gt;'))
cek('A4 tegak', html.includes('size: A4 portrait'))
cek('warna hex murni (tanpa oklch/rgba/var)', !/oklch|rgba?\(|var\(--/.test(html))
cek('lampiran nama per kelompok & tanda nonaktif', html.includes('Daftar nama per kelompok') && html.includes('Dimas') && html.includes('class="tanda">nonaktif'))
cek('tanpa lampiran bila tidak diminta', !buatLembarRekapRosterHtml({ namaTim: 'T', tanggal: 'x', rekap: r }).includes('Daftar nama per kelompok'))
cek('sel "+n" di tabel', html.includes('<td>+1</td>'))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
