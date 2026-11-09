/**
 * #35 — isi sesi per ranah, blok paralel per seksi, pola sesi, neraca
 * mingguan, dan cetakan A4 Jadwal (logika murni).
 *
 * Yang dijaga:
 * - pemetaan jenis blok → ranah neraca (lima nilai lama tetap bermakna sama)
 * - komposisi per seksi: blok bersama, blok paralel, seksi menganggur = non-materi,
 *   seksi di dua jalur hanya dihitung sekali, ranah jalur menimpa ranah blok
 * - label otomatis "Fisik + Visual + Musik bersama" (porsi < 15% tidak disebut)
 * - pemeriksaan: seksi kosong, seksi ganda, jalur tanpa seksi, pelatih ganda, tempat ganda (info)
 * - neraca minggu: sesi tanpa rencana, rencana lebih dari slot, selisih target dikelompokkan
 * - pola: salin dengan id baru, simpan menimpa nama sama, terapkan ke hari/jenis/rentang,
 *   realisasi tidak pernah ditimpa, mode "hanya yang kosong"
 * - contoh pola Latsar 120 menit dengan blok paralel per seksi aktif
 * - "ubah semua berikutnya" kini hanya menerapkan bidang yang berubah (pola A/B/C selamat)
 * - kalender A4 tegak: hex murni, Goals & Catatan, Minggu-pertama, 31 Desember ada
 * - lembar rencana minggu: kolom per seksi, sel menganggur, neraca & target
 */
import {
  ranahDariJenis, komposisiRencana, labelKomposisi, teksKomposisi, persenMateri, jumlahMateri,
  periksaRencana, namaPelatih, neracaSesi, teksSelisih, PRESET_TARGET, jumlahTarget,
  salinRencana, buatPola, simpanPola, rencanakanTerapPola, polaContohLatsar, hariSeninDari,
  URUTAN_RANAH, WARNA_RANAH_HEX, menitKosong,
} from '/tmp/ranahSesi.mjs'
import { htmlKalenderTegak, htmlRencanaMinggu } from '/tmp/jadwalCetak.mjs'
import { ubahSeri } from '/tmp/kalender.mjs'
import { URUTAN_BLOK, LABEL_BLOK } from '/tmp/latihan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, ok) => (ok ? lulus++ : gagal.push(nama))

let n = 0
const id = (a = 'x') => `${a}${++n}`
const SEKSI = ['brass', 'percussion', 'guard']
const LABEL = { brass: 'Brass', percussion: 'Perkusi', guard: 'CG' }
const lbl = (x) => LABEL[x] ?? x
const b = (judul, jenis, menit, o = {}) => ({ id: id('b'), judul, jenis, menit, ...o })
const sesi = (o = {}) => ({
  id: id('s'), title: 'Latsar Cab 42', type: 'latihan', date: '2026-11-12', startTime: '18:00', endTime: '20:00',
  checklist: [], createdAt: 0, ...o,
})

/* ---------------- ranah ---------------- */
cek('pemanasan/fisik/pendingin → fisik', ['pemanasan', 'fisik', 'pendingin'].every((j) => ranahDariJenis(j) === 'fisik'))
cek('tes & teori → teori', ranahDariJenis('tes') === 'teori' && ranahDariJenis('teori') === 'teori')
cek('apel/istirahat/lainnya → non-materi', ['apel', 'istirahat', 'lainnya'].every((j) => ranahDariJenis(j) === 'nonmateri'))
cek('nilai lama section/gabungan tetap', ranahDariJenis('section') === 'section' && ranahDariJenis('gabungan') === 'gabungan')
cek('jenis tak dikenal → non-materi', ranahDariJenis('aneh') === 'nonmateri' && ranahDariJenis(undefined) === 'nonmateri')
cek('URUTAN_BLOK memuat 13 jenis & semua berlabel', URUTAN_BLOK.length === 13 && URUTAN_BLOK.every((j) => LABEL_BLOK[j]))
cek('URUTAN_BLOK tetap memuat 5 nilai lama', ['pemanasan', 'section', 'gabungan', 'pendingin', 'lainnya'].every((j) => URUTAN_BLOK.includes(j)))
cek('warna ranah semuanya hex', URUTAN_RANAH.every((r) => /^#[0-9a-f]{6}$/i.test(WARNA_RANAH_HEX[r])))

/* ---------------- komposisi ---------------- */
const latsarA = [
  b('Apel', 'apel', 10), b('Pemanasan', 'pemanasan', 15), b('Kardio', 'fisik', 25),
  b('Langkah dasar', 'visual', 45), b('Minum', 'istirahat', 5), b('Hitungan', 'teori', 10), b('Pendinginan', 'pendingin', 10),
]
const kA = komposisiRencana(latsarA, SEKSI)
cek('blok bersama: tiap seksi sama', JSON.stringify(kA.perSeksi.brass) === JSON.stringify(kA.perSeksi.guard))
cek('fisik = 15+25+10 = 50', kA.rataRata.fisik === 50)
cek('visual 45, teori 10, non-materi 15', kA.rataRata.visual === 45 && kA.rataRata.teori === 10 && kA.rataRata.nonmateri === 15)
cek('total 120', kA.total === 120 && !kA.adaParalel)
cek('label A = Fisik + Visual', labelKomposisi(kA.rataRata) === 'Fisik + Visual')
cek('teks komposisi berurutan & tanpa nol', teksKomposisi(kA.rataRata) === 'Fisik 50′ · Visual 45′ · Teori & tes 10′ · Non-materi 15′')
cek('persen materi dibulatkan', JSON.stringify(persenMateri(kA.rataRata)) .includes('"fisik":48') && jumlahMateri(kA.rataRata) === 105)

const paralel = b('Section', 'section', 50, {
  cabang: [
    { id: 'j1', seksi: ['brass'], judul: 'Long tone', pelatih: 'Kak Dimas', tempat: 'Aula' },
    { id: 'j2', seksi: ['percussion'], judul: '8-on-a-hand', pelatih: 'Kak Rani', tempat: 'Lapangan' },
    { id: 'j3', seksi: ['guard'], judul: 'Drop spin', jenis: 'visual', pelatih: 'Bu Sari', tempat: 'Lapangan' },
  ],
})
const kB = komposisiRencana([b('Apel', 'apel', 10), b('Ritme', 'musik', 30), paralel], SEKSI)
cek('paralel: Brass section 50', kB.perSeksi.brass.section === 50)
cek('paralel: CG ranah jalur (visual) menimpa ranah blok', kB.perSeksi.guard.visual === 50 && kB.perSeksi.guard.section === 0)
cek('paralel: adaParalel', kB.adaParalel)
cek('rata-rata section = 33,3', Math.abs(kB.rataRata.section - 33.3) < 0.05)
cek('total tetap durasi blok, bukan × jalur', kB.total === 90)

const sebagian = b('Section', 'section', 40, { cabang: [{ id: 'j', seksi: ['brass', 'brass'], judul: 'x' }, { id: 'k', seksi: ['brass', 'percussion'], judul: 'y', jenis: 'drill' }] })
const kC = komposisiRencana([sebagian], SEKSI)
cek('seksi di dua jalur hanya dihitung di jalur pertama', kC.perSeksi.brass.section === 40 && kC.perSeksi.brass.drill === 0)
cek('jalur kedua tetap menghitung seksi lainnya', kC.perSeksi.percussion.drill === 40)
cek('seksi tanpa jalur = non-materi (menganggur)', kC.perSeksi.guard.nonmateri === 40)
const kD = komposisiRencana([paralel], [])
cek('tanpa daftar seksi: blok paralel dihitung ranah blok', kD.perSeksi['*'].section === 50)
cek('menit tidak sah diabaikan', komposisiRencana([b('x', 'fisik', 0), b('y', 'fisik', -5)], SEKSI).total === 0)
cek('label kosong untuk rencana kosong', labelKomposisi(menitKosong()) === '')
const hanyaNon = menitKosong(); hanyaNon.nonmateri = 10
cek('label "Tanpa materi" bila hanya non-materi', labelKomposisi(hanyaNon) === 'Tanpa materi')
const kecil = menitKosong(); kecil.fisik = 90; kecil.drill = 10
cek('porsi < 15% tidak disebut', labelKomposisi(kecil) === 'Fisik')

/* ---------------- pemeriksaan ---------------- */
cek('nama pelatih dipecah & dinormalkan', JSON.stringify(namaPelatih('Kak Dimas, kak  rani & Bu Sari dan Pak Budi')) === '["kak dimas","kak rani","bu sari","pak budi"]')
const p1 = periksaRencana([paralel], SEKSI, lbl)
cek('paralel lengkap: tanpa peringatan, hanya info tempat ganda', p1.length === 1 && p1[0].kode === 'tempat-ganda' && p1[0].tingkat === 'info')
cek('info tempat ganda menyebut Lapangan', p1[0].teks.includes('Lapangan') && p1[0].teks.includes('2 jalur'))
const p2 = periksaRencana([b('Section', 'section', 30, { cabang: [
  { id: 'a', seksi: ['brass'], judul: 'A', pelatih: 'Kak Dimas' },
  { id: 'c', seksi: ['brass'], judul: 'B', pelatih: 'kak dimas, Kak Rani' },
  { id: 'd', seksi: [], judul: 'C' },
] })], SEKSI, lbl)
const kode = p2.map((x) => x.kode)
cek('seksi kosong terdeteksi (Perkusi dan CG)', p2.some((x) => x.kode === 'seksi-kosong' && x.teks.startsWith('Perkusi dan CG')))
cek('seksi ganda terdeteksi', kode.includes('seksi-ganda'))
cek('jalur tanpa seksi terdeteksi', kode.includes('cabang-tanpa-seksi'))
cek('pelatih ganda (beda huruf besar) terdeteksi', p2.some((x) => x.kode === 'pelatih-ganda' && x.teks.startsWith('Kak Dimas')))
cek('blok bersama tidak diperiksa', periksaRencana(latsarA, SEKSI, lbl).length === 0)

/* ---------------- neraca ---------------- */
const minggu = [
  sesi({ date: '2026-11-12', rencanaLatihan: latsarA }),
  sesi({ date: '2026-11-13', rencanaLatihan: [b('Apel', 'apel', 10), b('Ritme', 'musik', 30), paralel, b('Tambahan', 'fisik', 60)] }),
  sesi({ date: '2026-11-14', type: 'rapat', title: 'Rapat pelatih' }),
  sesi({ date: '2026-11-15', type: 'section', title: 'Section kosong' }),
]
const n1 = neracaSesi(minggu, SEKSI, { label: lbl, target: PRESET_TARGET[0] })
cek('rapat tanpa rencana tidak dihitung', n1.sesi.length === 3 && !n1.sesi.some((x) => x.judul === 'Rapat pelatih'))
cek('sesi section tanpa rencana diperingatkan', n1.peringatan.some((p) => p.kode === 'tanpa-rencana' && p.judulSesi === 'Section kosong'))
cek('rencana 150 menit di slot 120 diperingatkan', n1.peringatan.some((p) => p.kode === 'lebih-slot' && p.teks.includes('150 menit')))
cek('info tempat ganda ikut ke neraca dengan tanggal', n1.peringatan.some((p) => p.kode === 'tempat-ganda' && p.tanggal === '2026-11-13'))
cek('Brass: fisik 50+60, section 50', n1.perSeksi[0].menit.fisik === 110 && n1.perSeksi[0].menit.section === 50)
cek('CG: visual 45+50', n1.perSeksi[2].menit.visual === 95)
cek('sesi neraca berlabel', n1.sesi[0].label === 'Fisik + Visual' && n1.sesi[1].adaParalel)
cek('selisih target terhitung & terurut', n1.selisih.length > 0 && n1.selisih.every((x, i, a) => i === 0 || Math.abs(a[i - 1].beda) >= Math.abs(x.beda)))
const musikSel = n1.selisih.find((x) => x.ranah === 'musik')
cek('selisih musik dikelompokkan untuk semua seksi', musikSel && musikSel.seksi.length === 3)
cek('teks selisih "Semua seksi"', teksSelisih(musikSel, lbl, 3).startsWith('Semua seksi: Musik bersama'))
const n2 = neracaSesi(minggu, SEKSI, { label: lbl })
cek('tanpa target = tanpa selisih', n2.selisih.length === 0)
cek('jumlah preset target 100', PRESET_TARGET.every((t) => jumlahTarget(t) === 100))

/* ---------------- pola ---------------- */
const salin = salinRencana([paralel], (a) => id(a))
cek('salin: id blok baru', salin[0].id !== paralel.id && salin[0].judul === 'Section')
cek('salin: id jalur baru & seksi disalin dalam', salin[0].cabang[0].id !== 'j1' && salin[0].cabang[0].seksi !== paralel.cabang[0].seksi)
salin[0].cabang[0].seksi.push('guard')
cek('salin: asli tidak berubah', paralel.cabang[0].seksi.length === 1)
const pA = buatPola('  Latsar A  ', latsarA, (a) => id(a), 5)
cek('buat pola: nama dirapikan', pA.nama === 'Latsar A' && pA.dibuat === 5 && pA.rencana.length === 7)
const d1 = simpanPola([], pA)
const d2 = simpanPola(d1.daftar, { ...buatPola('latsar a', [b('x', 'fisik', 5)], (a) => id(a)) })
cek('simpan pola: nama sama ditimpa, id lama dipertahankan', d2.ditimpa && d2.daftar.length === 1 && d2.daftar[0].id === pA.id && d2.daftar[0].rencana.length === 1)
cek('simpan pola: nama baru ditambah', !d1.ditimpa && d1.daftar.length === 1)

cek('hari Senin-0: Kamis 12 Nov = 3', hariSeninDari('2026-11-12') === 3 && hariSeninDari('2026-11-15') === 6)
const semua = [
  sesi({ date: '2026-11-12' }), sesi({ date: '2026-11-13' }), sesi({ date: '2026-11-17' }),
  sesi({ date: '2026-11-19', rencanaLatihan: [b('lama', 'fisik', 10)] }),
  sesi({ date: '2026-11-20', realisasiLatihan: [{ id: 'r', mulai: 1, selesai: 2 }] }),
  sesi({ date: '2026-11-22', type: 'lainnya', title: 'Hakrab' }),
  sesi({ date: '2026-12-01' }),
]
const atur = { dari: '2026-11-12', sampai: '2026-11-30', hari: [], jenis: ['latihan', 'section', 'gabungan'], mode: 'kosong' }
const t1 = rencanakanTerapPola(semua, pA, atur, (a) => id(a))
cek('terap: hanya rentang & jenis latihan', t1.isi.map((s) => s.date).join() === '2026-11-12,2026-11-13,2026-11-17')
cek('terap: Hakrab (lainnya) tidak tersentuh', !t1.isi.some((s) => s.title === 'Hakrab'))
cek('terap mode kosong: sesi berencana dilewati', t1.dilewati.some((d) => d.alasan === 'sudah-ada-rencana' && d.sesi.date === '2026-11-19'))
cek('terap: sesi berealisasi tidak pernah ditimpa', t1.dilewati.some((d) => d.alasan === 'sudah-berjalan' && d.sesi.date === '2026-11-20'))
cek('terap: id blok unik per sesi', new Set(t1.isi.flatMap((s) => s.rencanaLatihan.map((x) => x.id))).size === 21)
cek('terap: sesi asli tidak diubah', !semua[0].rencanaLatihan)
const t2 = rencanakanTerapPola(semua, pA, { ...atur, mode: 'ganti', hari: [1, 3] }, (a) => id(a))
cek('terap hari Sel & Kam + mode ganti', t2.isi.map((s) => s.date).join() === '2026-11-12,2026-11-17,2026-11-19')
cek('terap mode ganti tetap melewati realisasi', !t2.isi.some((s) => s.date === '2026-11-20'))
const t3 = rencanakanTerapPola(semua, pA, { ...atur, jenis: [] }, (a) => id(a))
cek('terap jenis kosong = semua jenis', t3.isi.some((s) => s.title === 'Hakrab'))

const contoh = polaContohLatsar([{ id: 'brass', label: 'Brass' }, { id: 'percussion', label: 'Perkusi' }, { id: 'guard', label: 'CG' }], (a) => id(a), 1)
cek('contoh: tiga pola', contoh.length === 3 && contoh[0].nama.startsWith('Latsar A'))
cek('contoh: semuanya 120 menit', contoh.every((p) => p.rencana.reduce((t, x) => t + x.menit, 0) === 120))
const blokSeksi = contoh[1].rencana.find((x) => x.cabang)
cek('contoh B: blok section paralel 3 jalur', blokSeksi && blokSeksi.cabang.length === 3)
cek('contoh B: materi per seksi sesuai', blokSeksi.cabang[0].judul.includes('Long tone') && blokSeksi.cabang[1].judul.includes('8-on-a-hand') && blokSeksi.cabang[2].judul.includes('bendera'))
cek('contoh B: tanpa peringatan', periksaRencana(contoh[1].rencana, SEKSI, lbl).length === 0)
cek('contoh A label Fisik + Visual', labelKomposisi(komposisiRencana(contoh[0].rencana, SEKSI).rataRata) === 'Fisik + Visual')
cek('contoh satu seksi: tanpa paralel', polaContohLatsar([{ id: 'brass', label: 'Brass' }], (a) => id(a))[1].rencana.every((x) => !x.cabang))

/* ---------------- ubah seri: hanya bidang yang berubah ---------------- */
const seri = [
  sesi({ id: 'a1', date: '2026-11-12', seriId: 'S', rencanaLatihan: contoh[0].rencana }),
  sesi({ id: 'a2', date: '2026-11-13', seriId: 'S', rencanaLatihan: contoh[1].rencana }),
  sesi({ id: 'a3', date: '2026-11-17', seriId: 'S', rencanaLatihan: contoh[2].rencana }),
]
const ubahJam = ubahSeri(seri, seri[0], { ...seri[0], startTime: '18:30', endTime: '20:30' }, 'berikutnya')
cek('ubah jam semua berikutnya: jam ikut', ubahJam.every((s) => s.startTime === '18:30'))
cek('ubah jam: rencana Pola B/C tidak ditimpa', ubahJam.find((s) => s.id === 'a2').rencanaLatihan === contoh[1].rencana && ubahJam.find((s) => s.id === 'a3').rencanaLatihan === contoh[2].rencana)
const ubahRencana = ubahSeri(seri, seri[0], { ...seri[0], rencanaLatihan: [b('baru', 'drill', 30)] }, 'berikutnya')
cek('ubah rencana: memang diterapkan ke berikutnya', ubahRencana.every((s) => s.rencanaLatihan.length === 1 && s.rencanaLatihan[0].judul === 'baru'))

/* ---------------- cetak: kalender A4 tegak ---------------- */
const des = [
  sesi({ date: '2026-12-01', title: 'Latsar Cab 42', rencanaLatihan: contoh[0].rencana }),
  sesi({ date: '2026-12-05', title: 'Pelantikan Cab 42', type: 'lainnya' }),
  sesi({ date: '2026-12-05', title: 'Gladi', type: 'penampilan', startTime: '07:00' }),
  sesi({ date: '2026-11-30', title: 'Bulan lain' }),
]
const kal = htmlKalenderTegak(2026, 12, des, { namaTim: 'Marching Band Atmajaya Yogyakarta', goals: ['Lulus sikap dasar'], catatan: 'Bawa air', komposisi: true, seksi: SEKSI })
cek('tegak: A4 portrait', kal.includes('size: A4 portrait'))
cek('tegak: tanpa oklch/color-mix', !/oklch|color-mix/.test(kal))
cek('tegak: semua warna CSS hex/rgb', !/(?:color|background(?:-color)?):\s*(?!#|rgb|transparent|radial|inherit)[a-z]/i.test(kal.replace(/background-image:[^;]+;/g, '')))
cek('tegak: judul bulan & unit & tahun', kal.includes('>Desember<') && kal.includes('Marching Band Atmajaya Yogyakarta') && kal.includes('>2026<'))
cek('tegak: 31 Desember ada', kal.includes('<div class="tgl">31</div>'))
cek('tegak: tanggal bulan lain tidak masuk', !kal.includes('BULAN LAIN'))
cek('tegak: judul sesi kapital', kal.includes('LATSAR CAB 42') && kal.includes('PELANTIKAN CAB 42'))
cek('tegak: Goals & Catatan', kal.includes('GOALS') && kal.includes('Lulus sikap dasar') && kal.includes('CATATAN') && kal.includes('Bawa air'))
cek('tegak: komposisi tercetak', kal.includes('Fisik + Visual') && kal.includes('class="legenda"'))
cek('tegak: Minggu-pertama → 1 Des (Selasa) di kolom ke-3', /^(?:<div class="sel kosong"><\/div>){2}<div class="sel/.test(kal.slice(kal.indexOf('<div class="grid">') + 18)))
cek('tegak: hari pertama MIN', kal.indexOf('<span>MIN</span>') < kal.indexOf('<span>SEN</span>'))
const kalSen = htmlKalenderTegak(2026, 12, des, { mulaiMinggu: false })
cek('tegak Senin-pertama: 1 Des di kolom ke-2', /^<div class="sel kosong"><\/div><div class="sel[^k]/.test(kalSen.slice(kalSen.indexOf('<div class="grid">') + 18)))
cek('tegak: hari bersesi diwarnai palet (peach latihan)', kal.includes('background:#f8d5a5'))
cek('tegak: escape HTML', htmlKalenderTegak(2026, 12, [sesi({ date: '2026-12-02', title: '<b>x</b>' })]).includes('&lt;B&gt;X&lt;/B&gt;'))
cek('tegak: 6 baris untuk Agustus 2026 (Minggu-pertama)', htmlKalenderTegak(2026, 8, []).includes('repeat(6, 1fr)'))

/* ---------------- cetak: rencana minggu ---------------- */
const seksiInfo = [{ id: 'brass', label: 'Brass', dot: '#f59e0b' }, { id: 'percussion', label: 'Perkusi', dot: '#fb7185' }, { id: 'guard', label: 'CG', dot: '#34d399' }]
const rm = htmlRencanaMinggu('2026-11-09', minggu.concat([sesi({ date: '2026-11-17', title: 'Minggu depan' })]), { namaTim: 'MB', seksi: seksiInfo, target: PRESET_TARGET[0] })
cek('rencana minggu: rentang judul', rm.includes('9 November – 15 November 2026'))
cek('rencana minggu: sesi minggu lain tidak masuk', !rm.includes('Minggu depan'))
cek('rencana minggu: jam blok dari jam mulai', rm.includes('18:00–18:10') && rm.includes('19:50–20:00'))
cek('rencana minggu: kolom per seksi di sesi paralel', rm.includes('>Brass</th>') && rm.includes('>Perkusi</th>') && rm.includes('>CG</th>'))
cek('rencana minggu: jalur berisi pelatih & tempat', rm.includes('Long tone') && rm.includes('Kak Dimas · Aula'))
cek('rencana minggu: ranah jalur yang beda ditampilkan', rm.includes('<b>Drop spin</b><small>Visual</small>'))
cek('rencana minggu: sesi tanpa rencana ditandai', rm.includes('Belum ada rencana isi sesi.'))
cek('rencana minggu: neraca & baris target', rm.includes('Neraca ranah minggu ini') && rm.includes('Target · Dasar bersama'))
cek('rencana minggu: peringatan lebih slot ikut', rm.includes('slotnya 120 menit'))
cek('rencana minggu: tanpa oklch', !/oklch|color-mix/.test(rm))
const rmMenganggur = htmlRencanaMinggu('2026-11-09', [sesi({ rencanaLatihan: [sebagian] })], { seksi: seksiInfo })
cek('rencana minggu: seksi menganggur ditandai', rmMenganggur.includes('— tanpa kegiatan —'))
cek('rencana minggu: minggu kosong', htmlRencanaMinggu('2027-03-01', minggu, { seksi: seksiInfo }).includes('Tidak ada sesi di minggu ini.'))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
