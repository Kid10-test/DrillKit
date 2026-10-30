/**
 * Rangkaian uji logika murni #16 — Koreografi Visual Lanjut (v1.2.0):
 *  1. Follow-the-Leader (FTL) & sub-kelompok jalur (`bangunPetaFtl`, `deltaPoliFtl`, `kelompokPemain`)
 *  2. Generator bentuk cepat (`susunBentukCepat` company_front, busur, lingkaran, blok, garis_diagonal & `cerminTitikFormasi`)
 *  3. Move + Hold (`jalanCount`), Ripple (`grup` A/B/C/D & `berurutan` 1..N), dan Simbol Visual (`ringkasKoreografiSet`)
 *  4. Properti panggung bergerak & kru pendorong (`posisiPenandaPadaIndeksSet`, `penandaEfektifPadaSet`, `tugasKruPropertiAnggota`)
 *  5. Integrasi log perubahan show otomatis (`cicipKeadaanShow` & `bandingkanKeadaanShow`)
 */
import {
  bangunPetaFtl,
  deltaPoliFtl,
  gerakOf,
  kelompokPemain,
  pathPoliFtl,
  progresPemain,
  ringkasKoreografiSet,
} from '/tmp/gerak.mjs'
import {
  OPSI_BENTUK_BAWAAN,
  cerminTitikFormasi,
  susunBentukCepat,
} from '/tmp/bentukFormasi.mjs'
import {
  apakahPropertiBergerak,
  penandaEfektifPadaSet,
  posisiPenandaPadaIndeksSet,
  ringkasKruProperti,
  tugasKruPropertiAnggota,
} from '/tmp/propertiGerak.mjs'
import {
  bandingkanKeadaanShow,
  cicipKeadaanShow,
} from '/tmp/logPerubahan.mjs'

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

function dekat(a, b, eps = 0.02) {
  return Math.abs(a - b) <= eps
}

console.log('== #16 Koreografi Visual Lanjut — Uji Logika Murni ==')

/* ----------------------- 1. Follow-the-Leader (FTL) ----------------------- */
{
  const awal = {
    m1: { x: 0, y: 0 },
    m2: { x: -4, y: 0 },
    m3: { x: -8, y: 0 },
  }
  const akhir = {
    m1: { x: 0, y: 8 },
    m2: { x: 0, y: 4 },
    m3: { x: 0, y: 0 },
  }
  const kelompok = [
    {
      id: 'ftl-1',
      nama: 'Baris Terompet',
      memberIds: ['m1', 'm2', 'm3'],
      jalur: 'ftl',
    },
  ]
  const peta = bangunPetaFtl(kelompok, awal, akhir)
  cek(peta.size === 3, 'FTL membangun lintasan untuk pemimpin dan seluruh pengikut')

  // Pengikut m3 harus mulai dari (-8,0) -> melewati (-4,0) -> berakhir di (0,0)
  const poli3 = peta.get('m3')
  cek(poli3.titik.length === 3, 'FTL pengikut ke-3 melewati titik jejak pendahulunya sebelum titik akhir')
  const [dx0, dy0] = deltaPoliFtl(poli3, 0)
  const [dxMid, dyMid] = deltaPoliFtl(poli3, 0.5)
  const [dx1, dy1] = deltaPoliFtl(poli3, 1)
  cek(dekat(dx0, 0) && dekat(dy0, 0), 'FTL pada t=0 tetap di titik awal pemain')
  cek(dekat(awal.m3.x + dxMid, -4) && dekat(awal.m3.y + dyMid, 0), 'FTL pada t=0,5 melewati titik awal pendahulu tepat di depannya')
  cek(dekat(awal.m3.x + dx1, akhir.m3.x) && dekat(awal.m3.y + dy1, akhir.m3.y), 'FTL pada t=1 tiba presisi di koordinat tujuan akhir')
  cek(
    pathPoliFtl(poli3).startsWith('M -8.000 0.000 L -4.000 0.000 L 0.000 0.000'),
    'pathPoliFtl menghasilkan atribut d SVG bersegmen rapi',
  )

  const gr = gerakOf({ jalur: 'lurus', kelompok })
  cek(kelompokPemain(gr, 'm2')?.jalur === 'ftl', 'kelompokPemain menemukan override jalur sub-kelompok')
  cek(kelompokPemain(gr, 'm99') === undefined, 'kelompokPemain mengembalikan undefined untuk pemain di luar kelompok')
}

/* --------------------- 2. Generator Bentuk Cepat (#16.2) ------------------- */
{
  const field = {
    preset: 'hs',
    lengthYd: 100,
    widthYd: 53.33,
    endZoneYd: 10,
    frontHashYd: 17.78,
    step: '8to5',
  }
  const ids = ['a', 'b', 'c', 'd']
  const ptsAwal = {
    a: { x: -6, y: 0, facing: 'front' },
    b: { x: -2, y: 0, facing: 'front' },
    c: { x: 2, y: 0, facing: 'front' },
    d: { x: 6, y: 0, facing: 'front' },
  }

  // Company front 2-step interval (1 step = 0.625 yd -> 2 step = 1.25 yd)
  const cf = susunBentukCepat(ids, ptsAwal, field, {
    ...OPSI_BENTUK_BAWAAN,
    jenis: 'company_front',
    intervalLangkah: 2,
    pusatYd: { x: 0, y: -5 },
    snap: false,
  })
  cek(
    dekat(cf.a.y, -5) && dekat(cf.d.y, -5) && dekat(cf.a.x - cf.b.x, 1.25),
    'Company Front menyusun pemain sejajar y sama dengan interval 2 langkah presisi',
  )

  // Brass Arc (busur cekung ke penonton: ujung lebih depan daripada puncak tengah)
  const arc = susunBentukCepat(ids, ptsAwal, field, {
    ...OPSI_BENTUK_BAWAAN,
    jenis: 'busur',
    intervalLangkah: 4,
    lengkunganLangkah: 6,
    pusatYd: { x: 0, y: 0 },
    snap: false,
  })
  cek(arc.b.y > arc.a.y && dekat(arc.a.y, arc.d.y), 'Busur simetris kiri-kanan dengan puncak melengkung presisi')

  // Lingkaran merata
  const ling = susunBentukCepat(ids, ptsAwal, field, {
    ...OPSI_BENTUK_BAWAAN,
    jenis: 'lingkaran',
    jariJariLangkah: 8,
    pusatYd: { x: 0, y: 0 },
    snap: false,
  })
  const rYd = 8 * 0.625
  const semuaJariSama = ids.every((id) => dekat(Math.hypot(ling[id].x, ling[id].y), rYd, 0.05))
  cek(semuaJariSama, 'Lingkaran menempatkan seluruh pemain pada jari-jari yang seragam dari pusat')

  // Grid Blok 2 kolom × 2 baris
  const blok = susunBentukCepat(ids, ptsAwal, field, {
    ...OPSI_BENTUK_BAWAAN,
    jenis: 'blok',
    kolomBlok: 2,
    intervalLangkah: 2,
    jarakBarisLangkah: 4,
    pusatYd: { x: 0, y: 0 },
    snap: false,
  })
  cek(
    dekat(blok.a.y, blok.b.y) && dekat(blok.c.y - blok.a.y, 4 * 0.625),
    'Grid Blok menyusun saf depan-belakang dengan jarak baris presisi',
  )

  // Cermin kiri-kanan menjaga simetri x dan membalik hadap left <-> right
  const cermin = cerminTitikFormasi(
    ['a'],
    { a: { x: 10, y: -4, facing: 'left' } },
    field,
    'x',
    'lapangan',
    false,
  )
  cek(dekat(cermin.a.x, -10) && cermin.a.facing === 'right', 'Cermin sumbu X membalik koordinat Side 1/2 sekaligus arah hadap')
}

/* --------- 3. Move + Hold, Ripple, & Simbol Visual (#16.3) ---------------- */
{
  // Move 12 + Hold 4 pada set 16 count -> p = 12/16 = 0.75 harus sudah t = 1!
  const grMh = gerakOf({ jalur: 'lurus', jalanCount: 12 })
  cek(dekat(progresPemain(0.375, grMh, 'brass', 16, 'm1'), 0.5), 'Move+Hold: setengah durasi jalan (count 6/12) berada di t=0,5')
  cek(dekat(progresPemain(0.75, grMh, 'brass', 16, 'm1'), 1), 'Move+Hold: tepat di batas jalanCount (count 12/16) sudah tiba di t=1')
  cek(dekat(progresPemain(0.95, grMh, 'brass', 16, 'm1'), 1), 'Move+Hold: selama fase Hold (count 13..16) pemain diam di t=1')

  // Ripple grup A (indeks 0), B (indeks 1), C (indeks 2) dengan selang 2 count pada set 8 count
  const grRp = gerakOf({
    jalur: 'lurus',
    ripple: {
      mode: 'grup',
      selangCount: 2,
      urutan: { mA: 0, mB: 1, mC: 2 },
    },
  })
  // Pada p = 0.25 (count 2/8): grup A sudah jalan (t=0.25), grup B baru akan mulai (t=0), grup C masih diam (t=0)
  cek(dekat(progresPemain(0.25, grRp, 'brass', 8, 'mA'), 0.25), 'Ripple: Grup A bergerak sejak hitungan pertama')
  cek(dekat(progresPemain(0.25, grRp, 'brass', 8, 'mB'), 0), 'Ripple: Grup B masih menunda tepat sampai selangCount tercapai')
  cek(dekat(progresPemain(0.5, grRp, 'brass', 8, 'mC'), 0), 'Ripple: Grup C menunda 2× selangCount sebelum mengejar')
  cek(dekat(progresPemain(1, grRp, 'brass', 8, 'mC'), 1), 'Ripple: seluruh grup tetap tiba serempak di t=1 pada akhir set')

  // Ringkasan simbol visual & koreografi untuk Buku Saku & Mode Anggota
  const setKoreo = {
    id: 's1',
    drillId: 'd1',
    order: 0,
    name: 'Set 1',
    counts: 16,
    points: {},
    gerak: {
      jalur: 'lurus',
      jalanCount: 12,
      ripple: { mode: 'grup', selangCount: 2, urutan: { mB: 1 } },
      kelompok: [{ id: 'k1', nama: 'Ular Brass', memberIds: ['mA', 'mB'], jalur: 'ftl' }],
    },
    visual: {
      simbol: ['horn_up', 'halt'],
      catatan: 'Tegak hadap depan',
      seksi: ['brass'],
    },
  }
  const isyPadat = ringkasKoreografiSet(setKoreo, { memberId: 'mB', sectionId: 'brass', padat: true })
  cek(
    isyPadat.some((s) => s.includes('Horn Up')) &&
      isyPadat.some((s) => s.includes('Jln 12+Hold 4')) &&
      isyPadat.some((s) => s.includes('Rpl B(+2)')) &&
      isyPadat.some((s) => s.includes('FTL#2')),
    'ringkasKoreografiSet menghasilkan isyarat padat lengkap (Simbol + M+H + Ripple + FTL + Seksi)',
  )
  const isySeksiLain = ringkasKoreografiSet(setKoreo, { memberId: 'mZ', sectionId: 'battery', padat: true })
  cek(
    !isySeksiLain.some((s) => s.includes('Horn Up')),
    'ringkasKoreografiSet menyembunyikan simbol visual khusus seksi dari seksi lain',
  )
}

/* --------- 4. Properti Panggung Bergerak & Kru Pendorong (#16.4) ---------- */
{
  const sets = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]
  const prop = {
    id: 'prop-1',
    jenis: 'kotak',
    label: 'Panggung Barat',
    x: -10,
    y: 0,
    x2: -6,
    y2: 4,
    rotasi: 0,
    warna: '#f59e0b',
    kruIds: ['m1', 'm2'],
    perSet: {
      s2: { x: 0, y: 0, x2: 4, y2: 4, rotasi: 90 },
    },
  }
  cek(apakahPropertiBergerak(prop) === true, 'apakahPropertiBergerak mendeteksi properti dengan keyframe perSet')
  const posS1 = posisiPenandaPadaIndeksSet(prop, sets, 0)
  const posS3 = posisiPenandaPadaIndeksSet(prop, sets, 2)
  cek(posS1.x === -10 && posS1.rotasi === 0, 'Set 1 memakai posisi & rotasi dasar properti')
  cek(posS3.x === 0 && posS3.rotasi === 90, 'Set 3 mewarisi posisi & rotasi terakhir dari Set 2')

  // Interpolasi di tengah transisi Set 1 -> Set 2 (progress = 0.5)
  const [efektifMid] = penandaEfektifPadaSet([prop], sets, 0, 0.5)
  cek(
    dekat(efektifMid.x, -5) && dekat(efektifMid.rotasi, 45),
    'penandaEfektifPadaSet menginterpolasi koordinat dan sudut rotasi mulus di tengah perpindahan',
  )
  cek(tugasKruPropertiAnggota([prop], 'm1').length === 1, 'tugasKruPropertiAnggota menemukan tugas properti milik anggota')
  cek(tugasKruPropertiAnggota([prop], 'm9').length === 0, 'tugasKruPropertiAnggota kosong bagi anggota bukan kru')
  const petaNama = new Map([
    ['m1', { code: 'T1', name: 'Adi' }],
    ['m2', { code: 'T2', name: 'Budi' }],
  ])
  cek(ringkasKruProperti(prop, petaNama) === 'T1, T2', 'ringkasKruProperti mencetak daftar kode kru dengan ringkas')
}

/* --------- 5. Integrasi Log Perubahan Show Otomatis (#15.3 + #16) --------- */
{
  const acuanLama = {
    dibuatAt: 1000,
    members: [{ id: 'm1', code: 'T1', name: 'Adi', section: 'brass' }],
    drills: [{ id: 'd1', name: 'Pembuka', tempo: 120, beatsPerCount: 1, rosterIds: ['m1'], markers: [] }],
    sets: [{ id: 's1', drillId: 'd1', order: 0, name: '1', counts: 8, points: { m1: { x: 0, y: 0, facing: 'front' } } }],
    songs: [],
    sessions: [],
    targetSetoran: [],
  }
  const acuanBaru = {
    ...acuanLama,
    dibuatAt: 2000,
    drills: [
      {
        ...acuanLama.drills[0],
        markers: [{ id: 'p1', jenis: 'kotak', label: 'Menara', x: 0, y: 0, x2: 2, y2: 2, warna: '#f59e0b' }],
      },
    ],
    sets: [
      {
        ...acuanLama.sets[0],
        visual: { simbol: ['horns_up'] },
        gerak: { jalur: 'lurus', jalanCount: 6 },
      },
    ],
  }
  cek(cicipKeadaanShow(acuanLama) !== cicipKeadaanShow(acuanBaru), 'cicipKeadaanShow berubah ketika simbol visual / Move+Hold / properti diperbarui')
  const log = bandingkanKeadaanShow(acuanLama, acuanBaru, 2000)
  cek(
    log.butir.some((b) => b.teks.includes('koreografi visual')) &&
      log.butir.some((b) => b.teks.includes('properti panggung')),
    'bandingkanKeadaanShow mencatat pembaruan koreografi visual dan properti panggung di log show',
  )
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
