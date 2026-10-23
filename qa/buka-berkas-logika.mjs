/**
 * Uji logika murni #7 — satu pintu "Buka berkas DrillKit".
 *
 * Tiga hal yang paling mudah salah dan karena itu paling banyak diuji:
 *
 * 1. **Deteksi dari isi, bukan nama.** Nama berkas tidak bisa dipercaya
 *    (diunduh ulang, diganti WA, dikirim tanpa ekstensi). JSON dikenali dari
 *    field `format`, CSV dari judul kolomnya, ZIP dari magic bytes-nya.
 * 2. **CSV anggota vs koordinat.** Keduanya berjudul "Kode, Nama, …" —
 *    pembedanya hanya kolom X/Y/set. Urutan pemeriksaannya penting.
 * 3. **Aturan mode.** Paket anggota di mode pelatih DITOLAK (dulu ikut
 *    diterima pemulihan backup!), dan mode anggota HANYA menerima paket.
 */
import { deflateRawSync } from 'node:zlib'
import {
  catatanCsvSatuArah,
  tampakCsvAnggota,
  LABEL_JENIS,
  TUJUAN_JENIS,
  aturMode,
  hitungBaruTimpa,
  kenaliBerkas,
  kenaliBerkasAsync,
  kenaliCsv,
  kenaliJson,
  kenaliTeks,
  namaBackup,
  namaBackupZip,
  namaData,
  namaPaketAnggota,
  namaPaketGrup,
  namaRepertoar,
  namaShow,
  namaZipAnggota,
  ringkasBackup,
  ringkasCsv,
  ringkasDataPindah,
  ringkasPaket,
  ringkasShow,
  tanggalMuatan,
} from '/tmp/bukaBerkas.mjs'
import { bikinZip, crc32 } from '/tmp/zip.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const bita = (teks) => new TextEncoder().encode(teks)
const json = (o) => JSON.stringify(o)

// ------------------------------------------------------------- kenaliJson
{
  cek('backup', kenaliJson({ format: 'drillkit-backup' }).jenis === 'backup')
  cek('data', kenaliJson({ format: 'drillkit-data' }).jenis === 'data')
  cek('show', kenaliJson({ format: 'drillkit-show' }).jenis === 'show')
  cek('repertoar', kenaliJson({ format: 'drillkit-repertoar' }).jenis === 'repertoar')
  cek('paket', kenaliJson({ format: 'drillkit-share' }).jenis === 'paket')
  const asing = kenaliJson({ format: 'drillkit-masa-depan' })
  cek('format drillkit-* asing dilaporkan tak-dikenal', asing.jenis === 'tak-dikenal')
  cek('format asing tetap dicatat', asing.format === 'drillkit-masa-depan')
  cek('tanpa format tak-dikenal', kenaliJson({ a: 1 }).jenis === 'tak-dikenal')
  cek('larik tak-dikenal', kenaliJson([1, 2]).jenis === 'tak-dikenal')
  cek('null tak-dikenal', kenaliJson(null).jenis === 'tak-dikenal')
}

// ------------------------------------ kenaliBerkas: isi, bukan nama
{
  const isi = json({ format: 'drillkit-backup', version: 1, exportedAt: 111 })
  const h = kenaliBerkas('foto-liburan.png', bita(isi))
  cek('isi backup bernama .png tetap backup', h.jenis === 'backup', h.jenis)
  cek('tanggal terbaca', h.tanggal === 111, String(h.tanggal))
  cek('format tercatat', h.format === 'drillkit-backup')

  const sampah = kenaliBerkas('arsip.zip', bita('bukan zip sama sekali'))
  cek('ekstensi .zip tanpa magic ditolak', sampah.jenis === 'tak-dikenal')
  cek('penolakan zip palsu dijelaskan', /bukan ZIP/.test(sampah.catatan ?? ''), sampah.catatan)

  const kosong = kenaliBerkas('kosong.json', bita('   '))
  cek('berkas kosong tak-dikenal', kosong.jenis === 'kosong.json' ? false : kosong.jenis === 'tak-dikenal')

  const bukanDrill = kenaliBerkas('data.json', bita(json({ hello: 'world' })))
  cek('JSON biasa tak-dikenal', bukanDrill.jenis === 'tak-dikenal')
  cek('JSON biasa dijelaskan', /field format/.test(bukanDrill.catatan ?? ''), bukanDrill.catatan)

  const masaDepan = kenaliBerkas('baru.json', bita(json({ format: 'drillkit-masa-depan' })))
  cek('format masa depan tak-dikenal', masaDepan.jenis === 'tak-dikenal')
  cek('format masa depan disebut', /drillkit-masa-depan/.test(masaDepan.catatan ?? ''))
}

// ------------------------------------------------------------ tanggalMuatan
{
  cek('exportedAt dipakai', tanggalMuatan({ exportedAt: 5 }) === 5)
  cek('dibuat dipakai', tanggalMuatan({ dibuat: 7 }) === 7)
  cek('exportedAt menang', tanggalMuatan({ exportedAt: 5, dibuat: 7 }) === 5)
  cek('tanpa keduanya undefined', tanggalMuatan({}) === undefined)
}

// ------------------------------------------------------------------ CSV
const CSV_ANGGOTA = 'Kode,Nama,Panggilan,Section,Instrumen,Peran,Tahun Masuk,No. HP,Status,Catatan\nC01,Andra,Dede,Brass,Trumpet,Anggota,2024,,Aktif,'
const CSV_KOOR_LEBAR = 'Kode,Nama,Set 1 X,Set 1 Y,Set 2 X,Set 2 Y\nC01,Andra,-8,12,-4,10'
const CSV_KOOR_PANJANG = 'Set,Kode,Nama,X (steps),Y (steps)\nSet 1,C01,Andra,-8,12'
const CSV_JADWAL = 'id,judul,jenis,tanggal,mulai,selesai,tempat,setListId\ns1,Latihan,latihan,2026-10-06,08:00,,,'
const CSV_ABSENSI = 'id,sessionId,memberId,status,catatan\na1,s1,m1,hadir,'
// #10 — lembar koordinat Pyware: bentuk panjang dengan penanda khasnya.
const CSV_PYWARE = 'Set,Count,Performer,Instrument,X (Sidelong),Y (Depth)\n1,1,T1,Trumpet,-12,20'
// Lembar koordinat ekspor DrillKit sendiri — harus TETAP ke pintu DD7.
const CSV_KOOR_SENDIRI = 'Set,Kode,Nama,Section,Instrumen,X (steps),Y (steps),Koordinat\n1,T1,Andra,Brass,Trumpet,-8,20,B#4'
{
  cek('csv anggota', kenaliCsv(CSV_ANGGOTA) === 'csv-anggota', kenaliCsv(CSV_ANGGOTA))
  cek('csv koordinat lebar', kenaliCsv(CSV_KOOR_LEBAR) === 'csv-koordinat')
  cek('csv koordinat panjang', kenaliCsv(CSV_KOOR_PANJANG) === 'csv-koordinat')
  cek('csv jadwal', kenaliCsv(CSV_JADWAL) === 'csv-jadwal')
  cek('csv absensi', kenaliCsv(CSV_ABSENSI) === 'csv-absensi')
  // #10 — Pyware dikenali dari penanda khasnya, dan lembar ekspor DrillKit
  // sendiri tidak ikut terbawa ke pintu itu.
  cek('csv pyware', kenaliCsv(CSV_PYWARE) === 'csv-pyware', kenaliCsv(CSV_PYWARE))
  cek('lembar ekspor DrillKit tetap csv-koordinat',
    kenaliCsv(CSV_KOOR_SENDIRI) === 'csv-koordinat', kenaliCsv(CSV_KOOR_SENDIRI))
  cek('pyware lewat kenaliBerkas',
    kenaliBerkas('opener.csv', bita(CSV_PYWARE)).jenis === 'csv-pyware')
  cek('pyware punya isi teks untuk diteruskan',
    (kenaliBerkas('opener.csv', bita(CSV_PYWARE)).teks ?? '').includes('Sidelong'))
  // Pemisah titik koma (Excel Indonesia).
  cek('csv anggota titik koma',
    kenaliCsv(CSV_ANGGOTA.replace(/,/g, ';')) === 'csv-anggota')
  // "Kode, Nama" saja tanpa penanda lain bukan apa-apa.
  cek('kode+nama saja tak-dikenal', kenaliCsv('Kode,Nama\nC01,Andra') === null)
  // CSV satu arah TIDAK boleh dikenali sebagai yang bisa diimpor.
  const LAP_JADWAL = 'Tanggal,Judul,Jenis,Mulai,Selesai,Tempat,Materi,Catatan\n2026-10-06,Latihan,Latihan,08:00,,, ,'
  const ABSENSI = 'Sesi,Tanggal,Kode,Nama,Section,Status,Jam masuk\ns1,2026-10-06,C01,Andra,Brass,Hadir,08:01'
  const RINGKAS = 'Kode,Nama,Section,Instrumen,Peran,Hadir,Izin,Sakit,Tanpa keterangan,Total sesi,% Kehadiran,Predikat\nC01,Andra,Brass,Trumpet,Anggota,5,0,0,0,5,100%,Baik'
  const MATRIKS = 'Kode,Nama,Section,6 Okt · L,Hadir,Izin,Sakit,Tanpa keterangan,Total sesi,% Kehadiran\nC01,Andra,Brass,H,5,0,0,0,5,100%'
  cek('laporan jadwal bukan csv-jadwal (tanpa id)', kenaliCsv(LAP_JADWAL) === null)
  cek('absensi sesi bukan csv-anggota', kenaliCsv(ABSENSI) === null)
  cek('csv ringkas bukan csv-anggota', kenaliCsv(RINGKAS) === null)
  cek('csv matriks bukan csv-anggota', kenaliCsv(MATRIKS) === null)
  // …tetapi dikenali sebagai satu arah dengan pesan jujur.
  cek('laporan jadwal dijelaskan', /satu arah/.test(catatanCsvSatuArah(LAP_JADWAL) ?? ''))
  cek('absensi sesi dijelaskan', /satu sesi/.test(catatanCsvSatuArah(ABSENSI) ?? ''))
  cek('ringkas dijelaskan', /laporan kehadiran/.test(catatanCsvSatuArah(RINGKAS) ?? ''))
  cek('matriks dijelaskan', /laporan kehadiran/.test(catatanCsvSatuArah(MATRIKS) ?? ''))
  cek('csv impor bukan satu arah', catatanCsvSatuArah(CSV_ANGGOTA) === null)
  const hSatuArah = kenaliBerkas('lap.csv', bita(LAP_JADWAL))
  cek('satu arah lewat pintu: tak-dikenal + pesan',
    hSatuArah.jenis === 'tak-dikenal' && /satu arah/.test(hSatuArah.catatan ?? ''))
  // Jalan terakhir impor Anggota: longgar, tapi bukan untuk sampah.
  cek('parsial kode+nama tampak anggota', tampakCsvAnggota('Kode,Nama\nC01,Andra') === true)
  cek('sampah tidak tampak anggota', tampakCsvAnggota('halo dunia') === false)
  // Via kenaliBerkas penuh (tanpa ekstensi .csv pun dikenali).
  const h = kenaliBerkas('tanpa-ekstensi', bita(CSV_JADWAL))
  cek('csv dikenali tanpa ekstensi', h.jenis === 'csv-jadwal', h.jenis)
  cek('teks csv disimpan untuk pratinjau', h.teks === CSV_JADWAL)
}

// ------------------------------------------------ partitur #11a (MusicXML/PDF)
const XML_PARTITUR =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="3.1">' +
  '<movement-title>Pembuka</movement-title>' +
  '<identification><creator type="composer">Budi Santoso</creator></identification>' +
  '<part-list><score-part id="P1"><part-name>Trumpet 1</part-name>' +
  '<part-abbreviation>Tpt. 1</part-abbreviation></score-part></part-list>' +
  '<part id="P1"><measure number="1"><attributes><divisions>2</divisions>' +
  '<time><beats>4</beats><beat-type>4</beat-type></time></attributes>' +
  '<direction><sound tempo="120"/></direction>' +
  '<note><rest measure="yes"/><duration>2</duration></note></measure>' +
  '<measure number="2"><note><rest/></note></measure></part>' +
  '</score-partwise>'
const PDF = '%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\ntrailer\n%%EOF'
{
  // Nama berkas menipu: yang menentukan isinya (#11a §5.2).
  const h = kenaliBerkas('foto-liburan.png', bita(XML_PARTITUR))
  cek('partitur dikenali dari isi, bukan ekstensi', h.jenis === 'partitur', h.jenis)
  cek('tipe partitur: musicxml', h.partiturTipe === 'musicxml', String(h.partiturTipe))
  cek('ringkasan partitur tersedia untuk pratinjau', h.partiturRingkas?.judul === 'Pembuka', JSON.stringify(h.partiturRingkas?.judul))
  cek('ringkasan menyebut birama & part',
    h.partiturRingkas?.jumlahBirama === 2 && h.partiturRingkas?.jumlahPart === 1,
    JSON.stringify([h.partiturRingkas?.jumlahBirama, h.partiturRingkas?.jumlahPart]))
  cek('ringkasan menyebut sukat & tempo',
    h.partiturRingkas?.sukat?.beats === 4 && h.partiturRingkas?.tempo === 120,
    JSON.stringify([h.partiturRingkas?.sukat, h.partiturRingkas?.tempo]))
  cek('ringkasan menyebut nama part', h.partiturRingkas?.parts?.[0]?.nama === 'Trumpet 1')
  cek('teks partitur disimpan untuk diteruskan', (h.teks ?? '').includes('score-partwise'))
  cek('tanpa pesan gagal saat ringkasannya berhasil', h.partiturGagal === undefined)

  const p = kenaliBerkas('skor.pdf', bita(PDF))
  cek('PDF dikenali sebagai partitur', p.jenis === 'partitur' && p.partiturTipe === 'pdf', p.jenis)
  cek('PDF tanpa ringkasan (memang tidak ada yang bisa diringkas)', p.partiturRingkas === null)
  cek('bita PDF tidak disimpan sebagai teks', p.teks === undefined)

  // D4 — XML yang sah tetapi pemindainya menyerah: tetap berkas partitur.
  const aneh = kenaliBerkas(
    'x.musicxml',
    bita('<score-partwise version="3.1"><movement-title>A &nbsp; B</movement-title></score-partwise>'),
  )
  cek('D4: tetap dikenali sebagai partitur', aneh.jenis === 'partitur', aneh.jenis)
  cek('D4: pesan pemindai diteruskan apa adanya',
    /entitas &nbsp; tidak dikenal/.test(aneh.partiturGagal ?? ''), aneh.partiturGagal)
  cek('D4: ringkasannya kosong, bukan setengah jadi', aneh.partiturRingkas === null)

  // XML terpotong sebelum akar: pesannya menyebut apa yang dilihat.
  const potong = kenaliBerkas('a.xml', bita('<score-partwise version="3.1"'))
  cek('XML partitur terpotong dijelaskan, bukan "tidak dikenal"',
    potong.jenis === 'tak-dikenal' && /score-partwise/.test(potong.catatan ?? ''), potong.catatan)

  // Akan tetapi berkas lain TIDAK boleh ikut dilabeli masalah partitur.
  const html = kenaliBerkas('halaman.html', bita('<html><body>Halo</body></html>'))
  cek('HTML tidak dilabeli masalah partitur', !/score-partwise/.test(html.catatan ?? ''), html.catatan)
  cek('CSV tetap dikenali walau pengurai XML menolaknya',
    kenaliBerkas('anggota.csv', bita(CSV_ANGGOTA)).jenis === 'csv-anggota')

  // .mxl (MusicXML terkompresi) di jalur sinkron tetap mengembalikan pesan petunjuk (D1),
  // sementara di jalur asinkron (#11b `kenaliBerkasAsync`) diurai penuh menjadi partitur.
  const bitaMxlTanpaRoot = bikinZip([
    { nama: 'META-INF/container.xml', isi: '<container><rootfiles/></container>' },
    { nama: 'score.xml', isi: XML_PARTITUR },
  ])
  const mxl = kenaliBerkas('lagu.mxl', bitaMxlTanpaRoot)
  cek('.mxl sinkron ditolak, bukan gagal diam-diam', mxl.jenis === 'tak-dikenal', mxl.jenis)
  cek('.mxl sinkron: pesannya menyebut cara menyimpan ulang', /MuseScore/.test(mxl.catatan ?? ''), mxl.catatan)
  cek('.mxl sinkron: bukan pesan "ZIP tanpa JSON"', !/JSON DrillKit/.test(mxl.catatan ?? ''), mxl.catatan)

  // #11b — kenaliBerkasAsync mengurai .mxl deflate menjadi ringkasan partitur penuh.
  const bikinMxlDeflate = (entri) => {
    const kepingan = []
    const pusat = []
    let pos = 0
    for (const e of entri) {
      const namaBita = bita(e.nama)
      const mentah = bita(e.isi)
      const padat = new Uint8Array(deflateRawSync(mentah))
      const c = crc32(mentah)
      const hLokal = new Uint8Array(30 + namaBita.length)
      const dvL = new DataView(hLokal.buffer)
      dvL.setUint32(0, 0x04034b50, true)
      dvL.setUint16(4, 20, true)
      dvL.setUint16(6, 0x0800, true)
      dvL.setUint16(8, 8, true)
      dvL.setUint32(14, c, true)
      dvL.setUint32(18, padat.length, true)
      dvL.setUint32(22, mentah.length, true)
      dvL.setUint16(26, namaBita.length, true)
      hLokal.set(namaBita, 30)
      const offsetLokal = pos
      kepingan.push(hLokal, padat)
      pos += hLokal.length + padat.length

      const hPusat = new Uint8Array(46 + namaBita.length)
      const dvP = new DataView(hPusat.buffer)
      dvP.setUint32(0, 0x02014b50, true)
      dvP.setUint16(4, 20, true)
      dvP.setUint16(6, 20, true)
      dvP.setUint16(8, 0x0800, true)
      dvP.setUint16(10, 8, true)
      dvP.setUint32(16, c, true)
      dvP.setUint32(20, padat.length, true)
      dvP.setUint32(24, mentah.length, true)
      dvP.setUint16(28, namaBita.length, true)
      dvP.setUint32(42, offsetLokal, true)
      hPusat.set(namaBita, 46)
      pusat.push(hPusat)
    }
    const awalPusat = pos
    let ukuranPusat = 0
    for (const p of pusat) {
      kepingan.push(p)
      ukuranPusat += p.length
    }
    const eocd = new Uint8Array(22)
    const dvE = new DataView(eocd.buffer)
    dvE.setUint32(0, 0x06054b50, true)
    dvE.setUint16(8, entri.length, true)
    dvE.setUint16(10, entri.length, true)
    dvE.setUint32(12, ukuranPusat, true)
    dvE.setUint32(16, awalPusat, true)
    kepingan.push(eocd)
    const total = pos + ukuranPusat + 22
    const out = new Uint8Array(total)
    let k = 0
    for (const pot of kepingan) {
      out.set(pot, k)
      k += pot.length
    }
    return out
  }

  const mxlDeflateSah = bikinMxlDeflate([
    {
      nama: 'META-INF/container.xml',
      isi: '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
    },
    { nama: 'score.xml', isi: XML_PARTITUR },
  ])
  const mxlAsync = await kenaliBerkasAsync('lagu.mxl', mxlDeflateSah)
  cek('#11b: kenaliBerkasAsync mengenali .mxl deflate sebagai partitur', mxlAsync.jenis === 'partitur' && mxlAsync.partiturTipe === 'musicxml', mxlAsync.jenis)
  cek('#11b: kenaliBerkasAsync meringkas judul & birama dari dalam .mxl', mxlAsync.partiturRingkas?.judul === 'Pembuka' && mxlAsync.partiturRingkas?.jumlahBirama === 2)
  cek('#11b: kenaliBerkasAsync mencatat asal .mxl dan berkas utamanya', /\.mxl/.test(mxlAsync.catatan ?? '') && /score\.xml/.test(mxlAsync.catatan ?? ''), mxlAsync.catatan)
  cek('#11b: hasil .mxl diizinkan di mode anggota oleh aturMode', aturMode(mxlAsync.jenis, 'member').boleh === true)

  const mxlAsyncRusak = await kenaliBerkasAsync('rusak.mxl', bitaMxlTanpaRoot)
  cek('#11b: .mxl tanpa <rootfile> ditolak jelas oleh kenaliBerkasAsync', mxlAsyncRusak.jenis === 'tak-dikenal' && /rootfile/.test(mxlAsyncRusak.catatan ?? ''), mxlAsyncRusak.catatan)
  cek('#11b: berkas biasa (CSV) lewat kenaliBerkasAsync tetap identik', (await kenaliBerkasAsync('anggota.csv', bita(CSV_ANGGOTA))).jenis === 'csv-anggota')
}

// ------------------------------------------------------------------ ZIP
const backupJson = json({
  format: 'drillkit-backup', version: 1, exportedAt: 222,
  settings: { teamName: 'Gema' }, members: [{ id: 'm1' }], sessions: [],
})
const shareJson = (id) => json({
  format: 'drillkit-share', version: 1, exportedAt: 333,
  team: { teamName: 'Gema' }, members: [{ id }], forMember: id,
})
const showJson = json({ format: 'drillkit-show', versi: 1, dibuat: 444, tim: 'Gema', drill: { id: 'd1', name: 'Buka' }, sets: [], songs: [], members: [] })
{
  const zip = bikinZip([
    { nama: 'DrillKit - BACKUP LENGKAP - 2026-10-05.json', isi: backupJson },
    { nama: 'audio/s1_lagu.mp3', isi: new Uint8Array([1, 2, 3]) },
    { nama: 'audio/manifest.json', isi: '{}' },
  ])
  const h = kenaliBerkas('apapun.bin', zip)
  cek('zip backup dikenali dari magic', h.jenis === 'zip-backup', h.jenis)
  cek('audio dihitung (tanpa manifest)', h.audioZip === 1, String(h.audioZip))
  cek('zip tanpa partitur: hitungannya 0', h.partiturZip === 0, String(h.partiturZip))

  // #11a — round-trip ZIP: entri `partitur/` dihitung seperti `audio/`.
  const zipPartitur = bikinZip([
    { nama: 'DrillKit - BACKUP LENGKAP - 2026-10-05.json', isi: backupJson },
    { nama: 'partitur/L1_Pembuka.musicxml', isi: XML_PARTITUR },
    { nama: 'partitur/L1_Pembuka.pdf', isi: new Uint8Array([1, 2, 3]) },
    { nama: 'partitur/manifest.json', isi: '{}' },
  ])
  const zp = kenaliBerkas('backup-partitur.zip', zipPartitur)
  cek('zip backup + partitur tetap dikenali backup', zp.jenis === 'zip-backup', zp.jenis)
  cek('entri partitur/ dihitung (tanpa manifest)', zp.partiturZip === 2, String(zp.partiturZip))
  cek('tanggal backup zip terbaca', h.tanggal === 222)
  cek('data backup tersedia', h.data?.format === 'drillkit-backup')

  const perAnggota = bikinZip([
    { nama: 'a.json', isi: shareJson('m1') },
    { nama: 'b.json', isi: shareJson('m2') },
  ])
  const z = kenaliBerkas('kumpulan.zip', perAnggota)
  cek('zip per anggota dikenali', z.jenis === 'zip-anggota', z.jenis)
  cek('daftar zip lengkap', z.daftarZip?.length === 2)

  const satuShow = bikinZip([{ nama: 'show.json', isi: showJson }])
  const s = kenaliBerkas('x.zip', satuShow)
  cek('zip berisi satu show menjadi show', s.jenis === 'show', s.jenis)
  cek('asal zip dicatat', /ZIP/.test(s.catatan ?? ''), s.catatan)

  const campur = bikinZip([
    { nama: 'a.json', isi: showJson },
    { nama: 'b.json', isi: json({ format: 'drillkit-data', versi: 1, dibuat: 1 }) },
  ])
  cek('zip campuran tak-dikenal', kenaliBerkas('c.zip', campur).jenis === 'tak-dikenal')

  const kosongZip = kenaliBerkas('k.zip', bikinZip([]))
  cek('zip kosong tak-dikenal', kosongZip.jenis === 'tak-dikenal')
}

// --------------------------------------------------------------- aturMode
{
  const tolakPelatih = aturMode('paket', 'coach')
  cek('paket ditolak di mode pelatih', tolakPelatih.boleh === false)
  cek('penolakan paket dijelaskan', /anggota/.test(tolakPelatih.alasan), tolakPelatih.alasan)
  cek('zip anggota ditolak di mode pelatih', aturMode('zip-anggota', 'coach').boleh === false)
  cek('backup boleh di mode pelatih', aturMode('backup', 'coach').boleh === true)
  cek('zip backup boleh di mode pelatih', aturMode('zip-backup', 'coach').boleh === true)
  cek('csv boleh di mode pelatih', aturMode('csv-jadwal', 'coach').boleh === true)

  cek('paket boleh di mode anggota', aturMode('paket', 'member').boleh === true)
  const tolakBackup = aturMode('backup', 'member')
  cek('backup ditolak di mode anggota', tolakBackup.boleh === false)
  cek('penolakan backup menyebut jenisnya', /Backup lengkap/.test(tolakBackup.alasan), tolakBackup.alasan)
  cek('zip 1 paket boleh di mode anggota', aturMode('zip-anggota', 'member', 1).boleh === true)
  cek('zip 2 paket ditolak di mode anggota', aturMode('zip-anggota', 'member', 2).boleh === false)
  // #11a — partitur satu-satunya jenis bukan-paket yang boleh dibuka anggota:
  // pelatih memasang notasinya, anggota membukanya di perangkatnya sendiri.
  cek('partitur boleh di mode pelatih', aturMode('partitur', 'coach').boleh === true)
  cek('partitur boleh di mode anggota', aturMode('partitur', 'member').boleh === true)
  cek('tak-dikenal ditolak di kedua mode',
    aturMode('tak-dikenal', 'coach').boleh === false && aturMode('tak-dikenal', 'member').boleh === false)
}

// ---------------------------------------------------------- ringkasan
{
  const data = {
    members: [{ id: 'm1' }, { id: 'm2' }],
    sessions: [{ id: 's1' }],
    songs: [],
    kemajuan: [{ key: 'd1' }],
    settings: { teamName: 'Gema' },
  }
  const r = ringkasBackup(data, { members: ['m1'], kemajuan: [] })
  cek('backup: hanya tabel berisi', r.baris.length === 3, JSON.stringify(r.baris.map((b) => b.label)))
  const agt = r.baris.find((b) => b.label === 'Anggota')
  cek('backup: baru vs ditimpa', agt?.baru === 1 && agt?.ditimpa === 1, JSON.stringify(agt))
  cek('backup: total', r.total === 4, String(r.total))
  cek('backup: pengaturan ikut', r.adaPengaturan === true)
  const maju = r.baris.find((b) => b.label === 'Kemajuan')
  cek('backup: kemajuan berkunci key', maju?.jumlah === 1 && maju?.baru === 1)

  const h = hitungBaruTimpa([{ id: 'a' }, { key: 'k' }, null], new Set(['a']))
  cek('hitungBaruTimpa id+key', h.jumlah === 3 && h.baru === 2 && h.ditimpa === 1, JSON.stringify(h))
  cek('hitungBaruTimpa bukan larik', hitungBaruTimpa(undefined, []).jumlah === 0)

  const d = ringkasDataPindah({ format: 'drillkit-data', lagu: [{ id: 'l1' }] }, { lagu: ['l1'] })
  cek('data: lagu ditimpa', d.baris[0]?.ditimpa === 1 && d.total === 1)

  const rs = ringkasShow(JSON.parse(showJson))
  cek('show: nama', rs?.nama === 'Buka')
  const rs2 = ringkasShow({
    drill: { name: 'X' }, tim: 'T',
    sets: [{ points: { m1: {}, m2: {} } }, { points: { m2: {}, m3: {} } }],
    songs: [1, 2],
  })
  cek('show: pemain gabungan', rs2?.jumlahPemain === 3, String(rs2?.jumlahPemain))
  cek('show rusak null', ringkasShow({}) === null)

  const rp = ringkasPaket(JSON.parse(shareJson('m9')))
  cek('paket: tim', rp?.tim === 'Gema')
  const rpGrup = ringkasPaket({ team: {}, members: [], locked: { a: {}, b: {} } })
  cek('paket: grup + terkunci', rpGrup?.penerima.jenis === 'grup' && rpGrup?.terkunci === 2)

  const rc = ringkasCsv(CSV_ANGGOTA)
  cek('csv: baris tanpa judul', rc.baris === 1, String(rc.baris))
  cek('csv: kolom terbaca', rc.kolom[1] === 'Nama', JSON.stringify(rc.kolom))
}

// ------------------------------------------------------ nama berkas (B)
{
  const t = new Date('2026-10-05T00:00:00Z')
  cek('nama backup', namaBackup(t) === 'DrillKit - BACKUP LENGKAP - 2026-10-05.json', namaBackup(t))
  cek('nama backup zip',
    namaBackupZip(t) === 'DrillKit - BACKUP LENGKAP + REKAMAN - 2026-10-05.zip', namaBackupZip(t))
  cek('nama data', namaData(t) === 'DrillKit - DATA PILIHAN - 2026-10-05.json', namaData(t))
  cek('nama show', namaShow('Opening Number', t) === 'DrillKit - SHOW Opening Number - 2026-10-05.json', namaShow('Opening Number', t))
  cek('nama show dibersihkan',
    namaShow('A/B:C*D?"E<F>G|H', t) === 'DrillKit - SHOW ABCDEFGH - 2026-10-05.json', namaShow('A/B:C*D?"E<F>G|H', t))
  cek('nama repertoar', namaRepertoar(3, t) === 'DrillKit - LAGU (3 lagu) - 2026-10-05.json', namaRepertoar(3, t))
  cek('nama grup', namaPaketGrup() === 'DrillKit - UNTUK ANGGOTA - semua (grup).json', namaPaketGrup())
  cek('nama anggota',
    namaPaketAnggota('Andra Pratama', 'Dede', 'A07') === 'DrillKit - UNTUK ANGGOTA - Andra Pratama (Dede) A07.json',
    namaPaketAnggota('Andra Pratama', 'Dede', 'A07'))
  cek('nama anggota tanpa panggilan',
    namaPaketAnggota('Andra Pratama', undefined, 'A07') === 'DrillKit - UNTUK ANGGOTA - Andra Pratama A07.json')
  cek('nama anggota tanpa aksen',
    namaPaketAnggota('José Ángel', '', 'J1') === 'DrillKit - UNTUK ANGGOTA - Jose Angel J1.json',
    namaPaketAnggota('José Ángel', '', 'J1'))
  cek('nama zip anggota',
    namaZipAnggota('Gema Santi', t) === 'DrillKit - UNTUK ANGGOTA - Gema Santi - 2026-10-05.zip',
    namaZipAnggota('Gema Santi', t))
}

// ------------------------------------------------------ label & tujuan
{
  const semua = ['backup', 'data', 'show', 'repertoar', 'paket', 'zip-backup', 'zip-anggota',
    'csv-anggota', 'csv-koordinat', 'csv-pyware', 'csv-jadwal', 'csv-absensi', 'partitur', 'tak-dikenal']
  cek('semua jenis berlabel Indonesia',
    semua.every((j) => LABEL_JENIS[j] && !/[A-Z][a-z]+ [A-Z]/.test('') && LABEL_JENIS[j].length > 0))
  cek('label paket Indonesia', LABEL_JENIS.paket === 'Paket untuk anggota')
  cek('semua jenis punya tujuan', semua.every((j) => TUJUAN_JENIS[j]?.rute.startsWith('/')))
  cek('show ke drill', TUJUAN_JENIS.show.rute === '/drill')
  cek('csv anggota ke anggota', TUJUAN_JENIS['csv-anggota'].rute === '/anggota')
  cek('csv pyware ke drill', TUJUAN_JENIS['csv-pyware'].rute === '/drill')
  cek('csv pyware menyebut tempatnya', /Impor Pyware/.test(TUJUAN_JENIS['csv-pyware'].tempat))
  // #11a — label & tujuan sesuai rancangan §5.1.
  cek('label partitur', LABEL_JENIS.partitur === 'Partitur (MusicXML / PDF) (#11a)', LABEL_JENIS.partitur)
  cek('partitur ke musik', TUJUAN_JENIS.partitur.rute === '/musik', TUJUAN_JENIS.partitur.rute)
  cek('partitur menyebut tempatnya', /Partitur lagu/.test(TUJUAN_JENIS.partitur.tempat), TUJUAN_JENIS.partitur.tempat)
  // kenaliTeks = jalan pintas teks.
  cek('kenaliTeks json', kenaliTeks('a', json({ format: 'drillkit-data' })).jenis === 'data')
  cek('kenaliTeks csv', kenaliTeks('a', CSV_ABSENSI).jenis === 'csv-absensi')
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
