/** #11a §13 step 5 — ZIP score export/preview/restore metadata round-trip. */
import { bikinZip, bukaZip } from '/tmp/zip.mjs'
import { ekstrakPartiturZip } from '/tmp/partiturZip.mjs'
import { kenaliBerkas, ringkasBackup } from '/tmp/bukaBerkas.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, detail = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${detail ? ` — ${detail}` : ''}`)
}

const bytesXml = new Uint8Array([0x3c, 0x78, 0x6d, 0x6c, 0x3e, 0x41, 0x3c, 0x2f, 0x78, 0x6d, 0x6c, 0x3e])
const bytesPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const xmlPath = 'partitur/song_1_Pembuka.musicxml'
const pdfPath = 'partitur/song-2_Lagu_Akhir.pdf'
const manifest = {
  [xmlPath]: { songId: 'song_1', namaFile: 'Pembuka.musicxml', tipe: 'musicxml', ukuran: bytesXml.length, hash: 'sha-xml' },
  [pdfPath]: { songId: 'song-2', namaFile: 'Lagu Akhir.pdf', tipe: 'pdf', ukuran: bytesPdf.length, hash: 'sha-pdf' },
}
const zip = bikinZip([
  { nama: 'backup.json', isi: JSON.stringify({ format: 'drillkit-backup', songs: [{ id: 'song_1', partitur: { namaFile: 'Pembuka.musicxml' } }] }) },
  { nama: xmlPath, isi: bytesXml },
  { nama: pdfPath, isi: bytesPdf },
  { nama: 'partitur/manifest.json', isi: JSON.stringify(manifest) },
])
const unzip = bukaZip(zip)
const pulih = ekstrakPartiturZip(zip)
const kenali = kenaliBerkas('backup.zip', zip)
cek('deteksi preview mengabaikan manifest partitur sebagai backup ekstra', kenali.jenis === 'zip-backup' && kenali.daftarZip?.length === 1 && kenali.partiturZip === 2)
cek('ZIP menyimpan dua entri partitur dan manifest', unzip.some((e) => e.nama === xmlPath) && unzip.some((e) => e.nama === pdfPath) && unzip.some((e) => e.nama === 'partitur/manifest.json'))
cek('manifest mempertahankan songId termasuk garis bawah', pulih.find((p) => p.namaFile === 'Pembuka.musicxml')?.songId === 'song_1')
cek('PDF tipe dan nama asli dipertahankan', pulih.find((p) => p.songId === 'song-2')?.tipe === 'pdf' && pulih.find((p) => p.songId === 'song-2')?.namaFile === 'Lagu Akhir.pdf')
cek('biner MusicXML pulih byte-per-byte', pulih.find((p) => p.songId === 'song_1')?.blob.size === bytesXml.length && new Uint8Array(await pulih.find((p) => p.songId === 'song_1').blob.arrayBuffer()).every((b, i) => b === bytesXml[i]))
cek('biner PDF pulih byte-per-byte', pulih.find((p) => p.songId === 'song-2')?.blob.size === bytesPdf.length && new Uint8Array(await pulih.find((p) => p.songId === 'song-2').blob.arrayBuffer()).every((b, i) => b === bytesPdf[i]))
cek('ukuran dan hash dari manifest dipertahankan', pulih.find((p) => p.songId === 'song-2')?.ukuran === bytesPdf.length && pulih.find((p) => p.songId === 'song-2')?.hash === 'sha-pdf')

const ringkasan = ringkasBackup(
  { songs: [{ id: 'song_1', partitur: { namaFile: 'Pembuka.musicxml' } }], partiturBerkas: pulih.map((p) => ({ id: p.songId })) },
  { songs: ['song_1'], partiturBerkas: ['song-2'] },
)
const barisBerkas = ringkasan.baris.find((b) => b.label === 'Berkas partitur')
cek('pratinjau menghitung partitur baru dan yang ditimpa', barisBerkas?.jumlah === 2 && barisBerkas.baru === 1 && barisBerkas.ditimpa === 1, JSON.stringify(barisBerkas))
cek('metadata partitur lagu tetap ada di payload lagu', ringkasan.baris.some((b) => b.label === 'Lagu' && b.jumlah === 1))

console.log(`Partitur ZIP: ${lulus} lulus, ${gagal.length} gagal`)
for (const nama of gagal) console.error(`  GAGAL: ${nama}`)
if (gagal.length) process.exitCode = 1
