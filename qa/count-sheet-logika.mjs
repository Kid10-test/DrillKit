/**
 * Uji murni #17 — Logika Count Sheet Color Guard, Buku Saku Hex, & Keutuhan Lintas Modul.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/count-sheet-logika.mjs
 */
import {
  apakahAnggotaGuard,
  bangunHtmlCetakCountSheet,
  bersihkanSetIdCountSheet,
  buatBlokDariDrill,
  buatBlokDariLagu,
  countSheetUntukAnggota,
  hitungSorotCountSheet,
  ringkasKerjaGuardPadaSet,
  salinCountSheetUntukDrillBaru,
  sinkronkanCountSheetSaatPecahSet,
  sisipkanTeknikCepat,
  toggleNomorCount,
} from '/tmp/countSheet.mjs'
import { tulisUlangMuatan } from '/tmp/namaAnggota.mjs'
import { putusRujukan } from '/tmp/pindah.mjs'
import { apakahButirMenyangkutAnggota, bandingkanKeadaanShow, ekstrakKeadaanShow } from '/tmp/logPerubahan.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'

let lulus = 0
let gagal = 0

function cek(kondisi, pesan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}`)
  }
}

const fieldBawaan = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'ncaa',
  gridYd: 5,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
}

const drillContoh = {
  id: 'd_1',
  name: 'Opening Show',
  showTitle: 'Nusantara',
  field: fieldBawaan,
  tempo: 120,
  beatsPerCount: 1,
  songId: 'sg_1',
  rosterIds: ['m_cg1', 'm_cg2', 'm_br1'],
  createdAt: 1000,
  updatedAt: 1000,
}

const setsContoh = [
  {
    id: 'st_1',
    drillId: 'd_1',
    order: 0,
    name: 'Set 1',
    counts: 16,
    points: {
      m_cg1: { x: 5, y: -10, facing: 'front' },
      m_cg2: { x: -5, y: -10, facing: 'front' },
    },
    createdAt: 1000,
  },
  {
    id: 'st_2',
    drillId: 'd_1',
    order: 1,
    name: 'Set 2',
    counts: 8,
    points: {
      m_cg1: { x: 10, y: -5, facing: 'front' },
      m_cg2: { x: -10, y: -5, facing: 'front' },
    },
    createdAt: 1000,
  },
]

const laguContoh = {
  id: 'sg_1',
  title: 'Mars Pembuka',
  bpm: 120,
  beats: 4,
  panjangBirama: 8,
  tempoMap: [],
  createdAt: 1000,
}

const anggotaContoh = [
  { id: 'm_cg1', code: 'CG1', name: 'Sinta Dewi', section: 'guard', instrument: 'Flag', role: 'member', active: 1, token: 'tok_1' },
  { id: 'm_cg2', code: 'CG2', name: 'Rina Putri', section: 'guard', instrument: 'Rifle', role: 'member', active: 1, token: 'tok_2' },
  { id: 'm_br1', code: 'T1', name: 'Budi Santoso', section: 'brass', instrument: 'Trumpet', role: 'member', active: 1, token: 'tok_3' },
]

console.log('1. Generator Blok dari Drill & Lagu')
{
  const per8 = buatBlokDariDrill({
    drill: drillContoh,
    sets: setsContoh,
    song: laguContoh,
    mode: 'per-8',
    alatUtama: 'flag',
  })
  cek(per8.length === 3, `Set 16 + Set 8 menghasilkan 3 blok 8-count (dapat ${per8.length})`)
  cek(per8[0].labelBagian === 'Set 1 (1–8)' && per8[0].biramaDari === 1 && per8[0].biramaSampai === 2, 'Blok 1 memetakan Set 1 (1–8) ke Bar 1–2')
  cek(per8[1].labelBagian === 'Set 1 (9–16)' && per8[1].offsetDalamSet === 8 && per8[1].biramaDari === 3 && per8[1].biramaSampai === 4, 'Blok 2 memetakan Set 1 (9–16) ke Bar 3–4')
  cek(per8[2].setId === 'st_2' && per8[2].biramaDari === 5 && per8[2].biramaSampai === 6, 'Blok 3 memetakan Set 2 ke Bar 5–6')

  // Sinkronisasi ulang mempertahankan isian teknik & catch
  per8[0].teknik = 'Drop Spin 1–6, Toss 45 di 8'
  per8[0].tangkapCount = [8]
  const sinkronUlang = buatBlokDariDrill({
    drill: drillContoh,
    sets: setsContoh,
    song: laguContoh,
    mode: 'per-8',
    alatUtama: 'flag',
    blokSebelumnya: per8,
  })
  cek(
    sinkronUlang[0].teknik === 'Drop Spin 1–6, Toss 45 di 8' && sinkronUlang[0].tangkapCount?.[0] === 8,
    'Sinkronisasi ulang mempertahankan teknik & hitungan catch yang sudah ditulis',
  )

  const perSet = buatBlokDariDrill({
    drill: drillContoh,
    sets: setsContoh,
    song: laguContoh,
    mode: 'per-set',
  })
  cek(perSet.length === 2 && perSet[0].counts === 16, 'Mode per-set menghasilkan 1 blok utuh per DrillSet')

  const dariLagu = buatBlokDariLagu(laguContoh, 'rifle', 2)
  cek(dariLagu.length === 4 && dariLagu[0].alat === 'rifle' && dariLagu[0].counts === 8, 'Generator langsung dari lagu 8 birama 4/4 menghasilkan 4 blok 8-count')
}

console.log('2. Helper Pil Hitungan, Teknik Cepat, & Pencocokan Seksi Guard')
{
  let daftar = toggleNomorCount(undefined, 6, 8)
  daftar = toggleNomorCount(daftar, 8, 8)
  cek(JSON.stringify(daftar) === '[6,8]', 'toggleNomorCount menambahkan & mengurutkan nomor hitungan')
  daftar = toggleNomorCount(daftar, 6, 8)
  cek(JSON.stringify(daftar) === '[8]', 'toggleNomorCount melepas hitungan yang diketuk ulang')

  const tek = sisipkanTeknikCepat(sisipkanTeknikCepat('', 'Drop Spin'), 'Toss 45')
  cek(tek === 'Drop Spin, Toss 45', 'sisipkanTeknikCepat merangkai teknik dengan koma rapi')

  cek(apakahAnggotaGuard(anggotaContoh[0]) === true && apakahAnggotaGuard(anggotaContoh[2]) === false, 'apakahAnggotaGuard membedakan seksi Guard vs Brass')
}

console.log('3. Sorotan Hitungan Sinkron (Mode Set & Mode Musik)')
const sheetUji = {
  id: 'cs_1',
  judul: 'Opening — Flag Utama',
  drillId: 'd_1',
  songId: 'sg_1',
  seksi: 'guard',
  alatUtama: 'flag',
  catatanUmum: 'Flag cadangan di garis 40 S1',
  blok: [
    {
      id: 'b_1',
      urutan: 0,
      setId: 'st_1',
      offsetDalamSet: 0,
      labelBagian: 'Set 1 (1–8)',
      counts: 8,
      biramaDari: 1,
      biramaSampai: 2,
      alat: 'flag',
      teknik: 'Drop Spin 1–6, Prep 7, Release 8',
      aksenCount: [6],
      tangkapCount: [8],
      detailPerCount: { 6: 'Prep Cones', 8: 'Toss Release!' },
      arahHadap: 'depan',
      posisiTangan: 'Kanan di tab',
    },
    {
      id: 'b_2',
      urutan: 1,
      setId: 'st_1',
      offsetDalamSet: 8,
      labelBagian: 'Set 1 (9–16)',
      counts: 8,
      biramaDari: 3,
      biramaSampai: 4,
      alat: 'rifle',
      teknik: 'Triple Toss, Catch 4',
      aksenCount: [1],
      tangkapCount: [4],
      arahHadap: 'serong_depan_1',
    },
  ],
  createdAt: 1000,
  updatedAt: 1000,
}

{
  // Mode 'set': Set 1 punya 16 counts. Progres 7/16 -> count ke-8 (blok 1 count 8 = Catch!)
  const s1 = hitungSorotCountSheet(sheetUji, {
    mode: 'set',
    setIdAktif: 'st_1',
    progresSet: 7.2 / 16,
    countsSet: 16,
  })
  cek(s1?.blok.id === 'b_1' && s1?.countAktif === 8 && s1?.adalahTangkap === true, 'Mode set menyorot count 8 (★ Catch) pada paruh pertama Set 1')

  // Progres 11.1/16 -> count ke-12 di Set 1 = count ke-4 di Blok 2 (Catch!)
  const s2 = hitungSorotCountSheet(sheetUji, {
    mode: 'set',
    setIdAktif: 'st_1',
    progresSet: 11.1 / 16,
    countsSet: 16,
  })
  cek(s2?.blok.id === 'b_2' && s2?.countAktif === 4 && s2?.adalahTangkap === true, 'Mode set menyorot count 4 pada blok kedua Set 1 (offset 8)')

  // Mode 'musik': Bar 2 ketuk 2 pada 4/4 -> count ke-6 dari Blok 1 (▲ Aksen + teksDetail)
  const m1 = hitungSorotCountSheet(sheetUji, {
    mode: 'musik',
    biramaAktif: 2,
    ketukDalamBirama: 2,
    ketukPerBirama: 4,
  })
  cek(
    m1?.blok.id === 'b_1' && m1?.countAktif === 6 && m1?.adalahAksen === true && m1?.teksDetail === 'Prep Cones',
    'Mode musik menghitung Bar 2 ketuk 2 menjadi Count 6 (▲ Aksen + rincian)',
  )

  // Mode 'musik': Bar 3 ketuk 4 -> count ke-4 dari Blok 2
  const m2 = hitungSorotCountSheet(sheetUji, {
    mode: 'musik',
    biramaAktif: 3,
    ketukDalamBirama: 4,
    ketukPerBirama: 4,
  })
  cek(m2?.blok.id === 'b_2' && m2?.countAktif === 4 && m2?.adalahTangkap === true, 'Mode musik menyorot Bar 3 ketuk 4 menjadi Count 4 Blok 2 (★ Catch)')

  // Saat sedang hitung mundur -> null
  const mHitung = hitungSorotCountSheet(sheetUji, {
    mode: 'musik',
    biramaAktif: 1,
    ketukDalamBirama: 1,
    sedangHitungMundur: true,
  })
  cek(mHitung === null, 'Mode musik tidak menyorot saat metronom masih hitung mundur')
}

console.log('4. Cetak HTML A4 Gabungan & Buku Saku A5 (Hex Murni)')
{
  const htmlA4 = bangunHtmlCetakCountSheet({
    sheet: sheetUji,
    format: 'a4',
    namaTim: 'MB Gita Bahana',
    drill: drillContoh,
    sets: setsContoh,
    song: laguContoh,
    daftarAnggota: [anggotaContoh[0]],
  })
  cek(!/oklch\(|color-mix\(/i.test(htmlA4), 'HTML cetak A4 murni #hex (bebas oklch/color-mix)')
  cek(htmlA4.includes('CG1') && htmlA4.includes('Drop Spin 1–6') && htmlA4.includes('8★') && htmlA4.includes('Kanan di tab'), 'HTML cetak A4 memuat kode pemain, koordinat, teknik, simbol ★, dan posisi tangan')

  const htmlSaku = bangunHtmlCetakCountSheet({
    sheet: sheetUji,
    format: 'buku-saku',
    namaTim: 'MB Gita Bahana',
    drill: drillContoh,
    sets: setsContoh,
    daftarAnggota: [anggotaContoh[0]],
  })
  cek(!/oklch\(|color-mix\(/i.test(htmlSaku) && htmlSaku.includes('kartu-saku-guard'), 'HTML cetak Buku Saku A5 murni #hex dan berformat kartu lipat')

  const ringkasBaris = ringkasKerjaGuardPadaSet([sheetUji], 'st_1', anggotaContoh[0])
  cek(ringkasBaris.length === 2 && ringkasBaris[0].includes('★Catch 8'), 'ringkasKerjaGuardPadaSet menghasilkan baris sisipan DotSheetModal untuk Guard')
  cek(ringkasKerjaGuardPadaSet([sheetUji], 'st_1', anggotaContoh[2]).length === 0, 'ringkasKerjaGuardPadaSet kosong untuk anggota Brass')
}

console.log('5. Keutuhan Lintas Modul (Pecah/Hapus Set, Salin, NamaAnggota, Pindah, Log, & Privasi)')
{
  // Pecah set pada hitungan ke-4 (di tengah blok 8-count b_1!)
  const pecah = sinkronkanCountSheetSaatPecahSet(
    sheetUji,
    'st_1',
    { id: 'st_1', name: 'Set 1', counts: 4 },
    { id: 'st_1b', name: 'Set 1A', counts: 12 },
  )
  cek(
    pecah.blok.length === 3 &&
      pecah.blok[0].setId === 'st_1' &&
      pecah.blok[0].counts === 4 &&
      pecah.blok[1].setId === 'st_1b' &&
      pecah.blok[1].counts === 4 &&
      pecah.blok[1].aksenCount?.[0] === 2 &&
      pecah.blok[1].tangkapCount?.[0] === 4 &&
      pecah.blok[2].setId === 'st_1b' &&
      pecah.blok[2].offsetDalamSet === 4,
    'sinkronkanCountSheetSaatPecahSet membelah blok 8-count & menggeser aksen/catch secara presisi',
  )

  const bersih = bersihkanSetIdCountSheet(sheetUji, 'st_1')
  cek(bersih.blok.every((b) => b.setId === undefined), 'bersihkanSetIdCountSheet melepas setId yatim saat set dihapus')

  const salin = salinCountSheetUntukDrillBaru(
    [{ ...sheetUji, memberIds: ['m_cg1'] }],
    'd_baru',
    { st_1: 'st_baru_1' },
    { m_cg1: 'm_baru_1' },
  )
  cek(
    salin[0].id !== sheetUji.id &&
      salin[0].drillId === 'd_baru' &&
      salin[0].blok[0].setId === 'st_baru_1' &&
      salin[0].memberIds?.[0] === 'm_baru_1',
    'salinCountSheetUntukDrillBaru memetakan drillId, setId, dan memberIds',
  )

  // namaAnggota: tulisUlangMuatan
  const rw = tulisUlangMuatan(
    { countSheets: [{ ...sheetUji, memberIds: ['m_lama', 'm_cg2'] }] },
    { m_lama: 'm_cg1' },
  )
  cek(JSON.stringify(rw.data.countSheets[0].memberIds) === '["m_cg1","m_cg2"]', 'tulisUlangMuatan memetakan memberIds pada countSheets saat gabung duplikat')

  // pindah.ts: putusRujukan
  const pr = putusRujukan(
    {
      format: 'drillkit-data',
      versi: 1,
      dibuat: 1000,
      countSheet: [{ ...sheetUji, drillId: 'd_hilang', songId: 'sg_hilang', memberIds: ['m_cg1', 'm_hilang'] }],
    },
    { anggota: ['m_cg1'], drill: [], lagu: [], set: [] },
  )
  const csHasil = pr.berkas.countSheet[0]
  cek(
    csHasil.drillId === undefined &&
      csHasil.songId === undefined &&
      JSON.stringify(csHasil.memberIds) === '["m_cg1"]' &&
      csHasil.blok[0].setId === undefined &&
      pr.putus.length >= 4,
    'putusRujukan menyaring drillId, songId, setId, dan memberIds yatim pada countSheet',
  )

  // logPerubahan.ts: bandingkanKeadaanShow
  const kLama = ekstrakKeadaanShow({ members: anggotaContoh, countSheets: [] })
  const kBaru = ekstrakKeadaanShow({ members: anggotaContoh, countSheets: [sheetUji] })
  const diff = bandingkanKeadaanShow(kLama, kBaru)
  const butirCs = diff.butir.find((b) => b.kategori === 'count_sheet')
  cek(
    !!butirCs &&
      apakahButirMenyangkutAnggota(butirCs, anggotaContoh[0]) === true &&
      apakahButirMenyangkutAnggota(butirCs, anggotaContoh[2]) === false,
    'Log perubahan show mendeteksi revisi Count Sheet dan menyorot hanya anggota seksi Guard',
  )

  // bagikan.ts: paketGrup & paketAnggota
  const bundleMentah = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 2000,
    team: null,
    members: anggotaContoh,
    sessions: [],
    drills: [drillContoh],
    sets: setsContoh,
    songs: [laguContoh],
    countSheets: [sheetUji],
    attendance: [],
  }
  const pg = paketGrup(bundleMentah)
  const paSah = paketAnggota(bundleMentah, 'm_cg1')
  const paAsing = paketAnggota(bundleMentah, 'id_tak_dikenal')
  cek(
    pg.countSheets?.length === 1 &&
      paSah.countSheets?.length === 1 &&
      (paAsing.countSheets?.length ?? 0) === 0 &&
      paSah.members.every((m) => m.token === ''),
    'paketGrup & paketAnggota menyertakan countSheets dengan aman dan mengosongkan untuk memberId asing',
  )

  // countSheetUntukAnggota sub-kelompok
  const khususRifle = { ...sheetUji, id: 'cs_rifle', memberIds: ['m_cg2'] }
  cek(
    countSheetUntukAnggota([khususRifle], anggotaContoh[0]).length === 0 &&
      countSheetUntukAnggota([khususRifle], anggotaContoh[1]).length === 1,
    'countSheetUntukAnggota menghormati filter sub-kelompok memberIds',
  )
}

console.log(`\nSelesai: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
