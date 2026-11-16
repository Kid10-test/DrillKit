/**
 * v2.11 — mesin pembaca rundown (logika murni).
 *
 * Yang dijaga:
 * - HTML papan klip Google Docs / Sheets / Word: tabel, colspan, rowspan, <br>, entitas,
 *   judul tabel dari teks sebelum tabel, tabel bersarang diratakan
 * - .docx (word/document.xml): tabel, gridSpan, vMerge
 * - teks: TSV (salin dari Sheets), CSV, baris bebas WhatsApp (jam, PJ, tempat)
 * - jam: "17.30", "17:30", rentang dengan –, -, s.d.; durasi "10'", "10 menit", "1 jam", "1j 20m"
 * - tebak kolom dengan & tanpa baris judul; "Waktu" berisi menit = durasi
 * - durasi dari jam selesai → jam berikutnya → kolom durasi → jam selesai sesi → baku
 * - jeda tak tertulis jadi blok "Jeda", tumpang tindih dipotong, lewat tengah malam
 * - jenis ditebak dari kegiatan; PJ → pelatih; tempat; baris tanpa jam → catatan
 * - kolom per seksi → blok paralel (Perkusi mewakili Battery + Pit)
 * - rundown P3 nyata (165′) → 6 blok, jam 17:30–20:15
 */
import {
  tabelDariHtml, tabelDariTeks, tabelDariSumber, tabelDariNilai, docxKeHtml, teksHtml,
  bacaJam, bacaSatuJam, bacaDurasi, tebakJenisBlok, tebakKolomRundown, bacaRundown,
  pilihTabelRundown, seksiDariJudul, dekodeEntitas,
} from '/tmp/rundown.mjs'

let lulus = 0
const gagal = []
const cek = (nama, ok) => (ok ? lulus++ : gagal.push(nama))
let n = 0
const buatId = (a = 'x') => `${a}${++n}`
const SEKSI = [
  { id: 'brass', label: 'Brass' },
  { id: 'percussion', label: 'Battery' },
  { id: 'pit', label: 'Pit' },
  { id: 'guard', label: 'Color Guard' },
]
const baca = (tabel, o = {}) => bacaRundown(tabel, tebakKolomRundown(tabel.baris, SEKSI), { seksi: SEKSI, buatId, ...o })

/* ---------------- jam & durasi ---------------- */
cek('jam titik', bacaSatuJam('17.30') === 1050)
cek('jam titik dua', bacaSatuJam('17:30') === 1050)
cek('jam pk.', bacaSatuJam('pk. 18.05 WIB') === 1085)
cek('jam empat digit', bacaSatuJam('1730') === 1050)
cek('jam tidak sah', bacaSatuJam('25.10') === null && bacaSatuJam('Apel') === null)
cek('rentang –', JSON.stringify(bacaJam('17.30 – 17.40')) === JSON.stringify({ mulai: 1050, selesai: 1060 }))
cek('rentang s.d.', bacaJam('17.30 s.d. 18.00 WIB').selesai === 1080)
cek('rentang - selesai', bacaJam('19.00 - selesai').mulai === 1140 && bacaJam('19.00 - selesai').selesai === null)
cek("durasi 10'", bacaDurasi("10'") === 10)
cek('durasi 10 menit', bacaDurasi('10 menit') === 10)
cek('durasi ± 15 mnt', bacaDurasi('± 15 mnt') === 15)
cek('durasi 1 jam', bacaDurasi('1 jam') === 60)
cek('durasi 1j 20m', bacaDurasi('1j 20m') === 80)
cek('durasi 1,5 jam', bacaDurasi('1,5 jam') === 90)
cek('durasi angka', bacaDurasi('35') === 35)
cek('durasi teks bukan', bacaDurasi('Apel pembuka') === null && bacaDurasi('') === null)
cek("durasi 35′", bacaDurasi('35′') === 35)

/* ---------------- jenis ---------------- */
const J = (t) => tebakJenisBlok(t)
cek('jenis apel', J('Apel pembuka') === 'apel' && J('Apel penutup & evaluasi') === 'apel')
cek('jenis maghrib → istirahat', J('Sholat Maghrib') === 'istirahat' && J('ISHOMA') === 'istirahat' && J('Maghrib') === 'istirahat')
cek('jenis pemanasan', J('Pemanasan & peregangan') === 'pemanasan')
cek('jenis tes', J('Tes II (jalur T)') === 'tes')
cek('jenis section', J('Sectional per section') === 'section')
cek('jenis fisik', J('Fisik: sirkuit 3 pos') === 'fisik')
cek('jenis visual', J('PBB sikap dasar') === 'visual' && J('Baris-berbaris') === 'visual')
cek('jenis drill', J('Drill set 1–4') === 'drill')
cek('jenis musik', J('Long tone & lip slur') === 'musik')
cek('jenis gabungan', J('Full run show') === 'gabungan')
cek('jenis teori', J('Materi kelas: sejarah unit') === 'teori')
cek('jenis lainnya', J('Foto bersama') === 'lainnya' && J('') === 'lainnya')

/* ---------------- HTML Google Docs ---------------- */
const htmlDocs = `<html><head><style>.c1{color:red}</style></head><body>
<p class="c2"><span>Rundown P3 &mdash; Selasa, 17 November 2026</span></p>
<table class="c9"><tbody>
<tr class="c3"><td class="c4"><p><span class="c0">Jam</span></p></td><td><p><span>Kegiatan</span></p></td><td><p><span>PJ</span></p></td><td><p><span>Tempat</span></p></td></tr>
<tr><td><p><span>17.30&nbsp;&ndash; 17.40</span></p></td><td><p><span>Apel pembuka</span></p></td><td><p><span>Danlat</span></p></td><td><p><span>Lapangan</span></p></td></tr>
<tr><td><p><span>17.40 &ndash; 17.55</span></p></td><td><p><span>Sholat Maghrib</span></p></td><td><p><span>-</span></p></td><td><p><span>Musala</span></p></td></tr>
<tr><td><p><span>17.55 &ndash; 18.05</span></p></td><td><p><span>Pemanasan</span></p></td><td><p><span>Pelatih fisik</span></p></td><td rowspan="2"><p><span>Lapangan</span></p></td></tr>
<tr><td><p><span>18.05 &ndash; 18.40</span></p></td><td><p><span>Tes II</span></p><p><span>jalur T per saf</span></p></td><td><p><span>Danlat</span></p></td></tr>
<tr><td><p><span>18.40 &ndash; 20.00</span></p></td><td><p><span>Section</span></p></td><td><p><span>Pelatih section</span></p></td><td><p><span>Per section</span></p></td></tr>
<tr><td><p><span>20.00 &ndash; 20.15</span></p></td><td><p><span>Apel penutup</span></p></td><td><p><span>Danlat</span></p></td><td><p><span>Lapangan</span></p></td></tr>
</tbody></table>
<p><span>Catatan: bawa air minum.</span></p>
<table><tr><td>Perlengkapan</td><td>Jumlah</td></tr><tr><td>Patok</td><td>20</td></tr></table>
</body></html>`
const tDocs = tabelDariHtml(htmlDocs)
cek('docs: dua tabel', tDocs.length === 2)
cek('docs: judul tabel dari paragraf sebelumnya', tDocs[0].judul === 'Rundown P3 — Selasa, 17 November 2026')
cek('docs: 7 baris (judul + 6)', tDocs[0].baris.length === 7)
cek('docs: entitas & nbsp', tDocs[0].baris[1][0] === '17.30 – 17.40')
cek('docs: paragraf dalam sel jadi baris baru', tDocs[0].baris[4][1] === 'Tes II\njalur T per saf')
cek('docs: rowspan diisi ulang', tDocs[0].baris[4][3] === 'Lapangan')
cek('docs: pilih tabel berjam', pilihTabelRundown(tDocs) === 0)
const pDocs = tebakKolomRundown(tDocs[0].baris, SEKSI)
cek('docs: baris judul 0', pDocs.judulBaris === 0)
cek('docs: kolom jam/kegiatan/pj/tempat', pDocs.kolom.jam === 0 && pDocs.kolom.kegiatan === 1 && pDocs.kolom.pj === 2 && pDocs.kolom.tempat === 3)
const hDocs = baca(tDocs[0], { selesaiSesi: '20:15' })
cek('docs: 6 blok', hDocs.blok.length === 6)
cek('docs: durasi 10/15/10/35/80/15', hDocs.blok.map((b) => b.menit).join('/') === '10/15/10/35/80/15')
cek('docs: total 165', hDocs.blok.reduce((a, b) => a + b.menit, 0) === 165)
cek('docs: jam rundown 17:30–20:15', hDocs.mulai === '17:30' && hDocs.selesai === '20:15')
cek('docs: jenis apel/istirahat/pemanasan/tes/section/apel', hDocs.blok.map((b) => b.jenis).join(',') === 'apel,istirahat,pemanasan,tes,section,apel')
cek('docs: PJ → pelatih', hDocs.blok[0].pelatih === 'Danlat' && hDocs.blok[3].pelatih === 'Danlat')
cek('docs: tempat', hDocs.blok[1].tempat === 'Musala')
cek('docs: baris kedua sel → catatan', hDocs.blok[3].judul === 'Tes II' && hDocs.blok[3].catatan === 'jalur T per saf')
cek('docs: tanpa peringatan', hDocs.peringatan.length === 0)
cek('docs: semua id unik', new Set(hDocs.blok.map((b) => b.id)).size === 6)

/* ---------------- HTML Google Sheets (papan klip) ---------------- */
const htmlSheets = `<meta charset="utf-8"><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}--></style>
<table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1"><colgroup><col width="100"/></colgroup><tbody>
<tr style="height:21px;"><td>Mulai</td><td>Selesai</td><td>Acara</td><td>Durasi</td></tr>
<tr><td>15.00</td><td>15.15</td><td>Apel</td><td>15</td></tr>
<tr><td>15.15</td><td>15.45</td><td>Fisik</td><td>30</td></tr>
<tr><td>16.00</td><td>17.30</td><td>Drill formasi</td><td>90</td></tr>
<tr><td>17.30</td><td>18.30</td><td>Gabungan</td><td>45</td></tr>
</tbody></table>`
const tSheets = tabelDariSumber({ html: htmlSheets, teks: 'abaikan' })
const pSheets = tebakKolomRundown(tSheets[0].baris, SEKSI)
cek('sheets: kolom mulai/selesai/kegiatan/durasi', pSheets.kolom.mulai === 0 && pSheets.kolom.selesai === 1 && pSheets.kolom.kegiatan === 2 && pSheets.kolom.durasi === 3)
const hSheets = baca(tSheets[0])
cek('sheets: jeda 15.45–16.00 jadi blok Jeda', hSheets.blok.length === 5 && hSheets.blok[2].judul === 'Jeda' && hSheets.blok[2].menit === 15)
cek('sheets: peringatan jeda', hSheets.peringatan.some((p) => p.kode === 'jeda'))
cek('sheets: kolom durasi beda dari jam → jam menang + peringatan', hSheets.blok[4].menit === 60 && hSheets.peringatan.some((p) => p.kode === 'durasi-beda'))
cek('sheets: total sama dengan rentang jam', hSheets.mulai === '15:00' && hSheets.selesai === '18:30')
cek('sheets: drill', hSheets.blok[3].jenis === 'drill')

/* ---------------- colspan & tabel bersarang ---------------- */
const tSpan = tabelDariHtml('<table><tr><td>Jam</td><td>Kegiatan</td><td>Tempat</td></tr><tr><td>18.00</td><td colspan="2">Apel gabungan</td></tr><tr><td>18.15</td><td><table><tr><td>a</td><td>b</td></tr></table></td><td>Aula</td></tr></table>')
cek('colspan diisi di tiap kolom', tSpan[0].baris[1][1] === 'Apel gabungan' && tSpan[0].baris[1][2] === 'Apel gabungan')
cek('tabel bersarang diratakan', tSpan.length === 1 && tSpan[0].baris[2][2] === 'Aula' && tSpan[0].baris[2][1].includes('a'))

/* ---------------- .docx ---------------- */
const docx = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>Rundown Hakrab</w:t></w:r></w:p>
<w:tbl><w:tblPr/><w:tblGrid/>
<w:tr><w:tc><w:p><w:r><w:t>Waktu</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Kegiatan</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>PJ</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t xml:space="preserve">08.00 - 08.30</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val="1"/></w:tcPr><w:p><w:r><w:t>Registrasi</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>Sie Acara</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>08.30 - 09.00</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Pembukaan</w:t></w:r><w:r><w:br/><w:t>sambutan</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc></w:tr>
<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>09.00 Outbound</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sie Lapangan</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl><w:sectPr/></w:body></w:document>`
const tDocx = tabelDariHtml(docxKeHtml(docx))
cek('docx: satu tabel berjudul', tDocx.length === 1 && tDocx[0].judul === 'Rundown Hakrab')
cek('docx: vMerge lanjutan diisi dari atas', tDocx[0].baris[2][2] === 'Sie Acara')
cek('docx: br dalam paragraf', tDocx[0].baris[2][1] === 'Pembukaan\nsambutan')
cek('docx: gridSpan', tDocx[0].baris[3][0] === '09.00 Outbound' && tDocx[0].baris[3][1] === '09.00 Outbound')
const hDocx = baca(tDocx[0], { selesaiSesi: '10:00' })
cek('docx: blok terakhir sampai jam selesai sesi', hDocx.blok.length === 3 && hDocx.blok[2].menit === 60)
cek('docx: apel dari "Pembukaan"', hDocx.blok[1].jenis === 'apel')

/* ---------------- TSV (salin dari Sheets) ---------------- */
const tsv = 'Jam\tKegiatan\tPJ\n17.30\tApel\tDanlat\n17.45\tFisik\tKak A\n18.30\tSection\t\n19.45\tApel penutup\tDanlat'
const tTsv = tabelDariTeks(tsv)
cek('tsv: satu tabel 5 baris', tTsv.length === 1 && tTsv[0].baris.length === 5)
const hTsv = baca(tTsv[0])
cek('tsv: baris terakhir tanpa ujung → baku 15 + peringatan', hTsv.blok[3].menit === 15 && hTsv.peringatan.some((p) => p.kode === 'durasi-tebak'))
cek('tsv: durasi dari jam berikutnya', hTsv.blok.map((b) => b.menit).slice(0, 3).join('/') === '15/45/75')
const hTsv2 = baca(tTsv[0], { selesaiSesi: '20:00' })
cek('tsv: jam selesai sesi menutup baris terakhir', hTsv2.blok[3].menit === 15 && !hTsv2.peringatan.some((p) => p.kode === 'durasi-tebak'))
cek('tsv: kolom PJ kosong tidak jadi pelatih', hTsv.blok[2].pelatih === undefined)

/* ---------------- CSV ---------------- */
const csv = 'No;Waktu;Kegiatan;Keterangan\n1;10 menit;Apel;Lapangan\n2;30 menit;Pemanasan + fisik;\n3;1 jam;Drill;"bawa patok, meteran"'
const tCsv = tabelDariTeks(csv)
const pCsv = tebakKolomRundown(tCsv[0].baris, SEKSI)
cek('csv: "Waktu" berisi menit = durasi', pCsv.kolom.durasi === 1 && pCsv.kolom.jam === -1)
const hCsv = baca(tCsv[0])
cek('csv: tanpa jam → durasi kolom', hCsv.blok.map((b) => b.menit).join('/') === '10/30/60' && hCsv.mulai === null)
cek('csv: peringatan tanpa jam', hCsv.peringatan.some((p) => p.kode === 'tanpa-jam'))
cek('csv: keterangan berkutip → catatan', hCsv.blok[2].catatan === 'bawa patok, meteran')

/* ---------------- WhatsApp ---------------- */
const wa = `*Rundown Latsar P4 — Kamis 19 Nov*
17.30 - 17.40 Apel pembuka (PJ Danlat)
17.40 – 17.55 : Sholat Maghrib
17.55-18.05 Pemanasan @ Lapangan
- jogging 2 putaran
18.05 Fisik sirkuit, PJ: Kak Fisik
18.40 s.d. 20.00 Section
20.00 - 20.15 Apel penutup`
const tWa = tabelDariTeks(wa)
cek('wa: judul dari baris tanpa jam', tWa[0].judul === '*Rundown Latsar P4 — Kamis 19 Nov*')
const hWa = baca(tWa[0])
cek('wa: 6 blok', hWa.blok.length === 6)
cek('wa: PJ dalam kurung', hWa.blok[0].pelatih === 'Danlat' && hWa.blok[0].judul === 'Apel pembuka')
cek('wa: PJ: setelah koma', hWa.blok[3].pelatih === 'Kak Fisik' && hWa.blok[3].judul === 'Fisik sirkuit')
cek('wa: @ tempat', hWa.blok[2].tempat === 'Lapangan' && hWa.blok[2].judul === 'Pemanasan')
cek('wa: baris tanpa jam jadi catatan blok sebelumnya', (hWa.blok[2].catatan ?? '').includes('jogging 2 putaran'))
cek('wa: total 165', hWa.blok.reduce((a, b) => a + b.menit, 0) === 165)
cek('wa: titik dua sesudah jam dibuang', hWa.blok[1].judul === 'Sholat Maghrib')

/* ---------------- tumpang tindih & tengah malam ---------------- */
const tTumpang = { judul: '', baris: [['Jam', 'Kegiatan'], ['18.00 - 18.40', 'Fisik'], ['18.30 - 19.00', 'Musik']] }
const hTumpang = baca(tTumpang)
cek('tumpang: dipotong ke jam berikutnya', hTumpang.blok[0].menit === 30 && hTumpang.peringatan.some((p) => p.kode === 'tumpang'))
const tMalam = { judul: '', baris: [['Jam', 'Kegiatan'], ['22.00', 'Api unggun'], ['23.30', 'Renungan'], ['00.30', 'Tidur'], ['04.30 - 05.00', 'Bangun & sholat subuh']] }
const hMalam = baca(tMalam)
cek('malam: lewat tengah malam dihitung', hMalam.blok.map((b) => b.menit).join('/') === '90/60/240/30')
cek('malam: peringatan sekali', hMalam.peringatan.filter((p) => p.kode === 'lewat-tengah-malam').length === 1)
const tSiang = { judul: '', baris: [['Jam', 'Kegiatan'], ['10.00', 'Musik'], ['12.00', 'Ishoma'], ['1.00', 'Drill'], ['3.00 - 3.30', 'Apel']] }
const hSiang = baca(tSiang)
cek('jam 12-an: 1.00 sesudah 12.00 = 13.00', hSiang.blok.map((b) => b.menit).join('/') === '120/60/120/30' && hSiang.selesai === '15:30')

/* ---------------- tanpa baris judul ---------------- */
const tPolos = { judul: '', baris: [['17.30', 'Apel pembuka', 'Danlat', 'Lapangan'], ['17.45', 'Fisik', 'Kak A', 'Lapangan'], ['18.30', 'Musik', 'Kak B', 'Aula']] }
const pPolos = tebakKolomRundown(tPolos.baris, SEKSI)
cek('polos: tanpa judul', pPolos.judulBaris === -1)
cek('polos: jam/kegiatan/pj/tempat dari isi', pPolos.kolom.jam === 0 && pPolos.kolom.kegiatan === 1 && pPolos.kolom.pj === 2 && pPolos.kolom.tempat === 3)
const hPolos = baca(tPolos, { selesaiSesi: '20:00' })
cek('polos: 3 blok, terakhir sampai 20.00', hPolos.blok.length === 3 && hPolos.blok[2].menit === 90)

/* ---------------- kolom per seksi → blok paralel ---------------- */
cek('seksi: "Perkusi" = Battery + Pit', seksiDariJudul('Perkusi', SEKSI).join(',') === 'percussion,pit')
cek('seksi: "CG" = Color Guard', seksiDariJudul('CG', SEKSI).join(',') === 'guard')
cek('seksi: label persis', seksiDariJudul('Brass', SEKSI).join(',') === 'brass')
cek('seksi: bukan seksi', seksiDariJudul('Kegiatan', SEKSI).length === 0)
const tSeksi = {
  judul: '',
  baris: [
    ['Jam', 'Kegiatan', 'Brass', 'Perkusi', 'CG'],
    ['18.00 - 18.15', 'Apel', '', '', ''],
    ['18.15 - 19.15', 'Sectional', 'Long tone\nTempat: Aula', 'Basic strokes', 'Drop spin\nPJ: Kak CG'],
    ['19.15 - 19.45', 'Ensemble', 'Ensemble', 'Ensemble', 'Ensemble'],
    ['19.45 - 20.00', 'Apel penutup', '', '', ''],
  ],
}
const pSeksi = tebakKolomRundown(tSeksi.baris, SEKSI)
cek('seksi: tiga kolom seksi', pSeksi.seksi.length === 3)
const hSeksi = baca(tSeksi)
const par = hSeksi.blok[1]
cek('seksi: blok paralel dengan 3 jalur', par.cabang?.length === 3 && par.jenis === 'section')
cek('seksi: jalur Perkusi berisi Battery + Pit', par.cabang?.find((c) => c.judul === 'Basic strokes')?.seksi.join(',') === 'percussion,pit')
cek('seksi: jenis jalur ditebak (musik)', par.cabang?.find((c) => c.judul === 'Long tone')?.jenis === 'musik')
cek('seksi: tempat & PJ jalur dari baris di sel', par.cabang?.find((c) => c.judul === 'Long tone')?.tempat === 'Aula' && par.cabang?.find((c) => c.judul === 'Drop spin')?.pelatih === 'Kak CG')
cek('seksi: isi seksi sama → blok bersama', !hSeksi.blok[2].cabang && hSeksi.blok[2].judul === 'Ensemble')

/* ---------------- Sheets API (values) ---------------- */
const tNilai = tabelDariNilai('Rundown', [['Jam', 'Kegiatan'], ['18.00', 'Apel'], [], ['18.15', 'Fisik', '']])
cek('values: baris kosong dibuang & lebar disamakan', tNilai.baris.length === 3 && tNilai.baris.every((b) => b.length === 2))

/* ---------------- lain-lain ---------------- */
cek('entitas angka', dekodeEntitas('&#8211; &#x2014; &amp;') === '– — &')
cek('teksHtml li', teksHtml('<ul><li>satu</li><li>dua</li></ul>') === '• satu\n• dua')
cek('sumber kosong', tabelDariSumber({ teks: '   ' }).length === 0)
cek('sumber HTML tanpa tabel → teks', tabelDariSumber({ html: '<p>17.30 Apel</p><p>17.45 Fisik</p>' })[0].baris.length === 3)
const tBaris = { judul: '', baris: [['Jam', 'Kegiatan'], ['18.00', ''], ['18.30 - 19.00', 'Musik']] }
const hBaris = baca(tBaris)
cek('baris berjam tanpa kegiatan diberi nama sementara', hBaris.blok[0].judul === 'Kegiatan' && hBaris.peringatan.some((p) => p.kode === 'tanpa-kegiatan'))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
