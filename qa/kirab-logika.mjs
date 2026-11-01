/**
 * Uji murni logika #19 — Mode Kirab / Street Parade & Display Barisan Jalan Raya (v1.2.3).
 *
 * Mencakup:
 *   1. Preset `parade-6m`, `parade-8m`, `parade-12m`, warna `aspal` hex murni, `activePreset`, & `coordText`/`coordParade`
 *   2. Pemeriksa lebar koridor jalan raya (`periksaKesesuaianJalan`) & saran otomatis jumlah banjar (`saranJumlahBanjar`)
 *   3. Penyusun barisan pokok Banjar × Saf (`susunBarisanParade`) dengan urutan Gitapati -> Spanduk -> Guard -> Brass -> Perkusi
 *   4. Pembaca posisi Saf × Banjar & jarak Panggung Kehormatan (`posisiSafBanjarAnggota`)
 *   5. Simulasi tikungan 90° Wheel/Gate Turn (`hitungTikungan90` & `buatSetTikungan90`) menjaga matriks Banjar × Saf utuh
 *   6. Simulasi Penghormatan & Display Panggung VIP (`buatSetPenghormatanVip`) memulihkan urutan defile 100% seusai display
 *   7. Kalkulator rute, kecepatan, pengulangan lagu, & cadangan napas (`hitungRuteParade`)
 *   8. Cetakan A4 Lembar Komando Kirab murni `#hex` (`bangunHtmlLembarParade`, bebas `oklch`/`color-mix`/`rgba` & tahan XSS)
 */
import {
  FIELD_PRESETS,
  M_TO_YD,
  PARADE_DEFAULT,
  PATOK_DEFAULT,
  WARNA_LAPANGAN,
  activePreset,
  apakahModeParade,
  coordParade,
  coordText,
  paradeOf,
  skalaTitik,
} from '/tmp/lapangan.mjs'
import {
  buatSetPenghormatanVip,
  buatSetTikungan90,
  hitungRuteParade,
  hitungTikungan90,
  periksaKesesuaianJalan,
  posisiSafBanjarAnggota,
  saranJumlahBanjar,
  susunBarisanParade,
} from '/tmp/parade.mjs'
import { bangunHtmlLembarParade } from '/tmp/paradeCetak.mjs'

let lulus = 0
let gagal = 0
function cek(kondisi, pesan, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}${detail ? ' -> ' + detail : ''}`)
  }
}

const JALAN_8M = {
  widthYd: 8 * M_TO_YD,
  lengthYd: 60 * M_TO_YD,
  endZoneYd: 0,
  gridYd: 5 * M_TO_YD,
  hash: 'none',
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 0,
  satuan: 'm',
  warna: 'aspal',
  patok: { ...PATOK_DEFAULT, aktif: 0 },
  parade: { ...PARADE_DEFAULT, aktif: 1, bahuJalanM: 0.5, panjangPanggungM: 16 },
}

const buatAnggotaUji = () => [
  { id: 'dm1', name: 'Raka Gitapati', code: 'DM1', section: 'other', instrument: 'Mace', role: 'drumMajor', joinYear: 2024, active: 1, token: 't1', createdAt: 1 },
  { id: 'cg1', name: 'Sinta Guard', code: 'CG1', section: 'guard', instrument: 'Flag', role: 'member', joinYear: 2024, active: 1, token: 't2', createdAt: 1 },
  { id: 'cg2', name: 'Tari Guard', code: 'CG2', section: 'guard', instrument: 'Flag', role: 'member', joinYear: 2024, active: 1, token: 't3', createdAt: 1 },
  { id: 'cg3', name: 'Uli Guard', code: 'CG3', section: 'guard', instrument: 'Rifle', role: 'member', joinYear: 2024, active: 1, token: 't4', createdAt: 1 },
  { id: 'cg4', name: 'Vina Guard', code: 'CG4', section: 'guard', instrument: 'Sabre', role: 'member', joinYear: 2024, active: 1, token: 't5', createdAt: 1 },
  { id: 'br1', name: 'Adi Trumpet', code: 'B1', section: 'brass', instrument: 'Trumpet', role: 'sectionLeader', joinYear: 2024, active: 1, token: 't6', createdAt: 1 },
  { id: 'br2', name: 'Bima Trumpet', code: 'B2', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2024, active: 1, token: 't7', createdAt: 1 },
  { id: 'br3', name: 'Candra Mello', code: 'B3', section: 'brass', instrument: 'Mellophone', role: 'member', joinYear: 2024, active: 1, token: 't8', createdAt: 1 },
  { id: 'br4', name: 'Deni Baritone', code: 'B4', section: 'brass', instrument: 'Baritone', role: 'member', joinYear: 2024, active: 1, token: 't9', createdAt: 1 },
  { id: 'br5', name: 'Eka Tuba', code: 'B5', section: 'brass', instrument: 'Tuba', role: 'member', joinYear: 2024, active: 1, token: 't10', createdAt: 1 },
  { id: 'bt1', name: 'Fajar Snare', code: 'P1', section: 'battery', instrument: 'Snare', role: 'sectionLeader', joinYear: 2024, active: 1, token: 't11', createdAt: 1 },
  { id: 'bt2', name: 'Gilang Snare', code: 'P2', section: 'battery', instrument: 'Snare', role: 'member', joinYear: 2024, active: 1, token: 't12', createdAt: 1 },
  { id: 'bt3', name: 'Hadi Tenor', code: 'P3', section: 'battery', instrument: 'Quads', role: 'member', joinYear: 2024, active: 1, token: 't13', createdAt: 1 },
  { id: 'bt4', name: 'Indra Bass', code: 'P4', section: 'battery', instrument: 'Bass Drum', role: 'member', joinYear: 2024, active: 1, token: 't14', createdAt: 1 },
  { id: 'off1', name: 'Alumni Nonaktif', code: 'Z9', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2022, active: 0, token: 't15', createdAt: 1 },
]

/* --- 1. Preset Jalan Parade, warna hex aspal, & koordinat jalan raya --- */
{
  const ids = FIELD_PRESETS.map((p) => p.id)
  cek(
    ids.includes('parade-6m') && ids.includes('parade-8m') && ids.includes('parade-12m'),
    '1: FIELD_PRESETS memuat tiga preset Jalan Parade (6 m, 8 m, 12 m)',
  )
  const aspal = WARNA_LAPANGAN.find((w) => w.id === 'aspal')
  cek(
    Boolean(aspal) && /^#[0-9a-f]{6}$/i.test(aspal.rumput) && /^#[0-9a-f]{6}$/i.test(aspal.zona),
    '1: Warna latar jalan aspal memakai kode #hex murni',
  )
  cek(activePreset(JALAN_8M) === 'parade-8m', '1: activePreset mengenali Jalan Parade 8 m secara tepat', String(activePreset(JALAN_8M)))
  cek(
    activePreset({ ...JALAN_8M, parade: { ...JALAN_8M.parade, aktif: 0 }, warna: 'hijau' }) === null,
    '1: mematikan parade tidak tertukar dengan preset jalan raya',
  )
  cek(apakahModeParade(JALAN_8M) === true && paradeOf(JALAN_8M).panjangPanggungM === 16, '1: apakahModeParade & paradeOf membaca konfigurasi VIP 16 m')

  const kTengah = coordText(0, 0, JALAN_8M)
  const kMajuDepan = coordParade(-10 * M_TO_YD, -1.25, JALAN_8M)
  cek(kTengah === 'Defile 0,0 m · As Jalan', '1: titik (0,0) pada Jalan Parade terbaca "Defile 0,0 m · As Jalan"', kTengah)
  cek(
    kMajuDepan.includes('Defile +10,0 m') && kMajuDepan.includes('Depan As 2 lkh'),
    '1: titik maju searah defile & ke tepi penonton terbaca dalam meter + langkah dari As Jalan',
    kMajuDepan,
  )

  // Skala titik pada jalan sempit 8 m lebih kecil dari lapangan football lebar 53 yd agar banjar tidak menumpuk
  const skalaFootball = skalaTitik({ ...JALAN_8M, widthYd: 53.33, parade: { ...PARADE_DEFAULT, aktif: 0 } })
  const skalaJalan = skalaTitik(JALAN_8M)
  cek(skalaJalan < skalaFootball, `1: skalaTitik jalan sempit (${skalaJalan.toFixed(2)}) otomatis lebih ramping dari lapangan lebar (${skalaFootball.toFixed(2)})`)
}

/* --- 2. Pemeriksa kesesuaian lebar jalan & saran banjar --- */
{
  const j6 = { ...JALAN_8M, widthYd: 6 * M_TO_YD, parade: { ...JALAN_8M.parade, bahuJalanM: 0.4 } }
  const j12 = { ...JALAN_8M, widthYd: 12 * M_TO_YD, parade: { ...JALAN_8M.parade, bahuJalanM: 0.75 } }
  const s6 = saranJumlahBanjar(j6, 2)
  const s8 = saranJumlahBanjar(JALAN_8M, 2)
  const s12 = saranJumlahBanjar(j12, 2)
  cek(s6 < s8 && s8 < s12, `2: saran jumlah banjar bertambah wajar mengikuti lebar jalan (${s6} < ${s8} < ${s12})`)
  cek(periksaKesesuaianJalan(JALAN_8M, 4, 2).status === 'aman', '2: 4 banjar di jalan 8 m berstatus aman')
  cek(periksaKesesuaianJalan(j6, 9, 2).status === 'meluber', '2: 9 banjar di jalan 6 m terdeteksi meluber melewati bahu jalan')
}

/* --- 3 & 4. Susunan Banjar × Saf & pembacaan posisi anggota --- */
{
  const anggota = buatAnggotaUji()
  const susun = susunBarisanParade(anggota, JALAN_8M, {
    jumlahBanjar: 4,
    jarakAntarBanjarLangkah: 2,
    jarakAntarSafLangkah: 2,
    jarakAntarSeksiLangkah: 4,
    jumlahSpanduk: 2,
  })
  cek(susun.jumlahPemain === 14 && !susun.points.off1, '3: hanya 14 anggota aktif yang disusun (anggota nonaktif diabaikan)')
  cek(
    susun.ringkasanSaf[0]?.blok === 'gitapati' && susun.ringkasanSaf[0]?.memberIds[0] === 'dm1',
    '3: Saf 1 ditempati oleh Gitapati/Drum Major tepat di kepala barisan',
  )
  cek(
    Math.abs(susun.points.dm1.y) < 1e-6 && susun.points.dm1.facing === 'right',
    '3: Gitapati tunggal berdiri tepat di As Jalan (y = 0) menghadap arah defile',
  )
  const urutanBlokTerbentuk = susun.ringkasanSaf.map((s) => s.blok)
  const idxGita = urutanBlokTerbentuk.indexOf('gitapati')
  const idxSpan = urutanBlokTerbentuk.indexOf('spanduk')
  const idxGuard = urutanBlokTerbentuk.indexOf('guard')
  const idxBrass = urutanBlokTerbentuk.indexOf('brass')
  const idxPerk = urutanBlokTerbentuk.indexOf('perkusi')
  cek(
    idxGita < idxSpan && idxSpan < idxGuard && idxGuard < idxBrass && idxBrass < idxPerk,
    '3: urutan blok defile terjaga dari kepala ke ekor (Gitapati -> Spanduk -> Guard -> Brass -> Perkusi)',
    urutanBlokTerbentuk.join(' -> '),
  )

  const infoDm = posisiSafBanjarAnggota(susun.points, 'dm1', JALAN_8M)
  const infoEkor = posisiSafBanjarAnggota(susun.points, 'bt4', JALAN_8M)
  cek(infoDm?.nomorSaf === 1 && infoDm?.nomorBanjar === 1, '4: posisiSafBanjarAnggota mengenali Gitapati sebagai Saf 1 Banjar 1')
  cek(
    infoEkor && infoEkor.nomorSaf === susun.jumlahSaf && infoEkor.nomorBanjar >= 1 && infoEkor.nomorBanjar <= 4,
    `4: personel Battery terakhir berada di saf paling ekor (Saf ${infoEkor?.nomorSaf}/${susun.jumlahSaf})`,
  )

  // Uji arah sebaliknya (`kanan-ke-kiri`): Gitapati menghadap kiri dan x-nya lebih positif dari ekor
  const susunKiri = susunBarisanParade(anggota, JALAN_8M, {
    jumlahBanjar: 4,
    arahDefile: 'kanan-ke-kiri',
  })
  cek(
    susunKiri.points.dm1.facing === 'left' && susunKiri.points.dm1.x > susunKiri.points.bt4.x,
    '3b: arah defile kanan-ke-kiri membalik hadap ke kiri & menempatkan kepala di sisi +x',
  )
}

/* --- 5. Simulasi Tikungan 90° (Wheel / Gate Turn) --- */
{
  const analAman = hitungTikungan90(JALAN_8M, { jumlahBanjar: 5, jarakAntarBanjarLangkah: 2 })
  const analSempit = hitungTikungan90(JALAN_8M, {
    jumlahBanjar: 6,
    jarakAntarBanjarLangkah: 2,
    hitunganPutarSaf: 4,
  })
  cek(analAman.amanLangkahLuar && analAman.hitunganDipakaiPerSaf >= 12, '5: hitungTikungan90 memberi hitungan cukup agar langkah banjar luar aman')
  cek(!analSempit.amanLangkahLuar, '5: hitungTikungan90 mendeteksi langkah banjar luar terlalu lebar bila dipaksa 4 ketukan')

  const anggota = buatAnggotaUji()
  const awal = susunBarisanParade(anggota, JALAN_8M, { jumlahBanjar: 4 })
  const tikungKanan = buatSetTikungan90(awal.points, JALAN_8M, 'kanan')
  const tikungKiri = buatSetTikungan90(awal.points, JALAN_8M, 'kiri')

  cek(tikungKanan.sets.length === 2 && tikungKanan.sets[0].gerak?.jalur === 'lengkung', '5: buatSetTikungan90 menghasilkan 2 set (Poros + Belok) berjalur lengkung')
  const ptKanan = tikungKanan.sets[1].points
  const ptKiri = tikungKiri.sets[1].points
  cek(
    ptKanan.dm1.facing === 'front' && ptKanan.dm1.y < ptKanan.bt4.y,
    '5: setelah belok kanan 90° dari defile kiri->kanan, Gitapati menghadap depan (-y) & tetap berada paling depan dibanding ekor',
  )
  cek(
    ptKiri.dm1.facing === 'back' && ptKiri.dm1.y > ptKiri.bt4.y,
    '5: setelah belok kiri 90° dari defile kiri->kanan, Gitapati menghadap belakang (+y) & tetap memimpin barisan',
  )
}

/* --- 6. Penghormatan & Display Panggung VIP Tanpa Membubarkan Defile --- */
{
  const anggota = buatAnggotaUji()
  const awal = susunBarisanParade(anggota, JALAN_8M, { jumlahBanjar: 4 })
  const setHormat = buatSetPenghormatanVip(awal.points, JALAN_8M, 'hormat_jalan', anggota)
  cek(
    setHormat.length === 1 && setHormat[0].visual?.simbol?.includes('hadap_depan'),
    '6: mode hormat_jalan membuat 1 set defile dengan instruksi visual penghormatan ke Panggung VIP',
  )

  const setDisplay = buatSetPenghormatanVip(awal.points, JALAN_8M, 'display_buka_tutup', anggota, { hitunganDisplay: 24 })
  cek(setDisplay.length === 3 && setDisplay[1].counts === 24, '6: mode display_buka_tutup menghasilkan 3 set (MasukVIP -> DisplayVIP -> KembaliDefile)')
  // Semua pemain menghadap tribun VIP ('front') saat set DisplayVIP
  const semuaHadapVip = Object.values(setDisplay[1].points).every((pt) => pt.facing === 'front')
  cek(semuaHadapVip, '6: pada set DisplayVIP seluruh personel menghadap ke sisi Panggung Kehormatan')

  // Pada set ke-3 (KembaliDefile), posisi Saf × Banjar tiap anggota harus kembali PERSIS seperti saat MasukVIP!
  const titikMasuk = setDisplay[0].points
  const titikPulih = setDisplay[2].points
  const urutanPulihUtuh = Object.keys(titikMasuk).every((id) => {
    const a = posisiSafBanjarAnggota(titikMasuk, id, JALAN_8M)
    const b = posisiSafBanjarAnggota(titikPulih, id, JALAN_8M)
    return a && b && a.nomorSaf === b.nomorSaf && a.nomorBanjar === b.nomorBanjar && Math.abs(titikMasuk[id].y - titikPulih[id].y) < 1e-6
  })
  cek(urutanPulihUtuh, '6: seusai DisplayVIP, set KembaliDefile memulihkan 100% urutan Saf × Banjar defile semula tanpa kacau')
}

/* --- 7. Kalkulator Ketukan, Kecepatan, & Ketahanan Napas Rute --- */
{
  const nyaman = hitungRuteParade({
    panjangRuteM: 1800,
    bpm: 120,
    panjangLangkahCm: 60,
    durasiLaguDetik: 120,
    ketukanStreetBeat: 64,
    durasiDisplayVipMenit: 2,
  })
  // 120 BPM * 0.6 m = 72 m/menit = 4.32 km/jam; 1800 / 72 = 25 menit jalan + 2 menit display = 27 menit total; 1800 / 0.6 = 3000 langkah
  cek(
    Math.abs(nyaman.kecepatanMPerMenit - 72) < 0.01 &&
      Math.abs(nyaman.kecepatanKmPerJam - 4.32) < 0.01 &&
      nyaman.totalLangkah === 3000 &&
      Math.abs(nyaman.totalWaktuTempuhMenit - 27) < 0.01,
    '7: hitungRuteParade menghitung kecepatan (4,32 km/jam), 3.000 langkah, & waktu tempuh 27 menit secara presisi',
    JSON.stringify(nyaman),
  )
  cek(nyaman.statusKetahanan === 'nyaman' && nyaman.jumlahPengulanganLagu >= 6, '7: siklus 120 dtk lagu + 64 ketuk street beat dinilai nyaman untuk ketahanan napas')

  const lelah = hitungRuteParade({
    panjangRuteM: 2500,
    bpm: 120,
    panjangLangkahCm: 60,
    durasiLaguDetik: 180,
    ketukanStreetBeat: 8,
  })
  cek(lelah.statusKetahanan === 'rawan_kelelahan', '7: street beat terlalu pendek pada rute 2,5 km otomatis memberi peringatan rawan_kelelahan')
}

/* --- 8. Cetakan A4 Lembar Komando Kirab murni #hex --- */
{
  const anggota = buatAnggotaUji()
  const susun = susunBarisanParade(anggota, JALAN_8M, { jumlahBanjar: 4 })
  const rute = hitungRuteParade({
    panjangRuteM: 1500,
    bpm: 116,
    panjangLangkahCm: 60,
    durasiLaguDetik: 150,
    ketukanStreetBeat: 32,
  })
  const html = bangunHtmlLembarParade({
    namaTim: 'MB Bahana <script>alert(1)</script>',
    judulDrill: 'Kirab HUT RI',
    namaSet: 'Set 1 (Defile)',
    field: JALAN_8M,
    points: susun.points,
    members: anggota,
    rute,
    namaLagu: 'Mars Nusantara',
  })
  cek(!/oklch\(|color-mix\(|rgba\(/i.test(html), '8: HTML cetak Lembar Komando Kirab murni #hex (0 oklch / 0 color-mix / 0 rgba)')
  cek(!html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'), '8: HTML cetak mensterilkan karakter berbahaya (XSS-safe)')
  cek(
    html.includes('LEMBAR KOMANDO KIRAB') && html.includes('Saf 1') && html.includes('Banjar 4') && html.includes('DM1'),
    '8: HTML cetak memuat kop rute, Panggung Kehormatan, serta peta matriks Saf × Banjar lengkap',
  )
}

console.log(`\nkirab-logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
