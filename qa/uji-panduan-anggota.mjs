/**
 * Uji murni J1 — panduan 1 halaman versi anggota (src/lib/panduan.ts).
 *
 * Tiga hal yang dijaga:
 * 1. **Dua keadaan tidak tertukar.** Disajikan situs → alamat + QR +
 *    "Ambil materi dari situs" + "Perbarui". Berkas portabel → tidak satu pun
 *    dari itu, karena aplikasinya memang menyembunyikan tombol-tombol itu.
 * 2. **Tidak ada menu pelatih** di lembar anggota (shortcut editor, backup,
 *    absensi), dan isi keenam tab muncul sesuai urutan bar tab di HP.
 * 3. **Setiap tombol yang disebut panduan benar-benar ada di kode.** Panduan
 *    yang menyuruh menekan tombol yang sudah berganti nama lebih buruk
 *    daripada tanpa panduan — dan tidak ada yang akan menyadarinya sampai
 *    seorang anggota tersesat. Uji ini mencari tiap label di berkas sumber.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-panduan-anggota.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { AKAR } from './lokasi.mjs'
import { bodyPanduanAnggota, htmlPanduanAnggota, htmlPanduan } from '/tmp/panduan.mjs'
import { DAFTAR_TRANSPOSISI } from '/tmp/tuner.mjs'

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
const teksDari = (html) =>
  html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

const dasar = { namaTim: 'Marching Band Uji', kota: 'Bandung', pelatih: 'Pak Budi', sesiMendatang: 4, drill: 2, lagu: 3 }
const QR = 'data:image/png;base64,iVBORw0KGgo='
const situs = htmlPanduanAnggota({ ...dasar, alamat: 'https://drillkit-tim.netlify.app/', qr: QR })
const berkas = htmlPanduanAnggota({ ...dasar })
const tSitus = teksDari(situs)
const tBerkas = teksDari(berkas)

/* ------------------------- 1. Dua keadaan ------------------------- */
uji('situs: alamat tercetak', tSitus.includes('https://drillkit-tim.netlify.app/'))
uji('situs: gambar QR tercetak', situs.includes(`src="${QR}"`))
uji('situs: "Ambil materi dari situs"', tSitus.includes('Ambil materi dari situs'))
uji('situs: "Perbarui"', tSitus.includes('Perbarui'))
uji('situs: panel darurat "Bersihkan & muat ulang"', tSitus.includes('Bersihkan & muat ulang'))
uji('situs: cara pasang ke layar utama', tSitus.includes('Add to Home Screen') && tSitus.includes('Install aplikasi'))
uji('berkas: tanpa QR', !berkas.includes('class="qr"') && !berkas.includes('Kode QR'))
uji('berkas: tanpa "Ambil materi dari situs"', !tBerkas.includes('Ambil materi dari situs'))
uji('berkas: tanpa tombol Perbarui', !/Perbarui/.test(tBerkas))
uji('berkas: tanpa panel darurat (khusus situs)', !tBerkas.includes('Bersihkan'))
uji('berkas: menyebut DrillKit.html', tBerkas.includes('DrillKit.html'))
uji('situs dengan QR gagal dibuat: alamat tetap ada', (() => {
  const h = htmlPanduanAnggota({ ...dasar, alamat: 'https://x.test/app/' })
  return teksDari(h).includes('https://x.test/app/') && !h.includes('<img src="data:')
})())

/* ---------------------------- 2. Isi ---------------------------- */
for (const [nama, t] of [['situs', tSitus], ['berkas', tBerkas]]) {
  uji(`${nama}: judul Panduan Anggota`, t.includes('Panduan Anggota DrillKit'))
  uji(`${nama}: memilih "Saya anggota"`, t.includes('Saya anggota'))
  const urutan = ['Jadwal', 'Formasi', 'Kuis', 'Absensi', 'Catatan', 'Musik'].map((x) => t.indexOf(` ${x} `, t.indexOf('Isi tiap tab')))
  uji(`${nama}: enam tab, urut seperti di HP`, urutan.every((i, k) => i > 0 && (k === 0 || i > urutan[k - 1])), urutan.join(','))
  uji(`${nama}: semua pilihan transposisi`, DAFTAR_TRANSPOSISI.every((x) => t.includes(x.label) && t.includes(x.contoh)))
  uji(`${nama}: toleransi kuis 2 langkah`, t.includes('paling jauh 2 langkah'))
  uji(`${nama}: "Belum dicatat" bukan tidak hadir`, t.includes('Belum dicatat') && t.includes('bukan berarti kamu tidak hadir'))
  uji(`${nama}: peringatan privasi berkas atas nama`, t.includes('jangan diteruskan'))
  uji(`${nama}: tanpa shortcut editor`, !t.includes('Shortcut') && !t.includes('Ctrl + Z'))
  uji(`${nama}: tanpa backup/pengaturan pelatih`, !t.includes('Ekspor backup') && !t.includes('Kelola data'))
  uji(`${nama}: tanpa oklch/color-mix`, !/oklch\(|color-mix\(/.test(nama === 'situs' ? situs : berkas))
}
uji('kepala: jumlah jadwal/drill/lagu', tSitus.includes('4 jadwal mendatang · 2 drill · 3 lagu'))
uji('kepala: hitungan nol tidak ditulis', !teksDari(htmlPanduanAnggota({ ...dasar, sesiMendatang: 0, drill: 0, lagu: 0 })).includes(' 0 '))
uji('nama pelatih di catatan kaki', tSitus.includes('pelatih: Pak Budi'))
{
  const jahat = bodyPanduanAnggota({ ...dasar, namaTim: '<script>alert(1)</script>', alamat: 'https://a.test/"><img src=x>' })
  uji('nama tim & alamat di-escape', !jahat.includes('<script>alert') && !jahat.includes('"><img src=x>'))
}
{
  const pelatih = teksDari(htmlPanduan({ namaTim: 'T', section: [], anggotaAktif: 1, sesi: 1, drill: 1, lagu: 1, hariBackup: 7, portabel: false }))
  uji('panduan pelatih menunjuk ke panduan anggota', pelatih.includes('Panduan anggota'))
  uji('panduan pelatih menyebut kotak Instrumen penala', pelatih.includes('Instrumen'))
  uji('panduan pelatih menyebut pintu Buka berkas DrillKit (#7)', pelatih.includes('Buka berkas DrillKit'))
  uji('panduan pelatih menyebut impor Pyware (#10)', pelatih.includes('Pyware'))
  uji('panduan pelatih menyebut partitur & Pilih frasa di partitur (#11)', pelatih.includes('Buka partitur') && pelatih.includes('Pilih frasa di partitur'))
  uji('panduan pelatih menyebut Backup + rekaman (ZIP) (#6/#11a)', pelatih.includes('Backup + rekaman (ZIP)'))
}

/* --------------- 3. Tombol yang disebut benar-benar ada --------------- */
{
  const baca = (f) => fs.readFileSync(path.join(AKAR, f), 'utf8')
  const sumber = [
    'src/pages/Share.tsx', 'src/components/PengingatJadwal.tsx', 'src/components/TunerDrone.tsx',
    'src/components/PilihMode.tsx', 'src/components/ModePerangkat.tsx', 'src/pages/Music.tsx', 'src/App.tsx', 'index.html',
    'src/components/ModalRekamanLagu.tsx', 'src/components/PanelPartitur.tsx', 'src/components/LayarPartitur.tsx',
  ].map(baca).join('\n').replace(/&amp;/g, '&')
  const LABEL = [
    'Saya anggota', 'Ambil materi dari situs', 'Buka paket tim', 'Ganti paket', 'Ganti nama',
    'Ada materi baru dari pelatih',
    'Pilih namamu dulu', 'Perbarui', 'Kalender', 'Kunci jawaban', 'Putar perpindahan', 'Belum dicatat',
    'Penala & nada dengung', 'Putar dengung', 'Dengarkan', 'Bb konser', 'Instrumen',
    'Tambahkan rekaman dari pelatih', 'Tambahkan dari pelatih', 'Buka partitur', 'Ke part saya', 'Pilih frasa di partitur',
    'Lihat mode anggota', 'Bersihkan & muat ulang', 'Aplikasi gagal dimuat',
    'Penyimpanan browser belum bisa dipakai',
  ]
  for (const l of LABEL) {
    uji(`label "${l}" disebut panduan & ada di aplikasi`, tSitus.includes(l) && sumber.includes(l),
      `panduan:${tSitus.includes(l)} aplikasi:${sumber.includes(l)}`)
  }
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
