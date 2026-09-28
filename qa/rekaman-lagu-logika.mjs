/**
 * #6 — Uji logika rekaman lagu (MP3, WAV, dsb):
 * 1. Sidik unik (SHA-256/hash) & validasi kecocokan materi pelatih vs unggahan anggota.
 * 2. Perhitungan lini masa: offset titik mulai (birama 1 ketuk 1), konversi birama ke detik audio,
 *    dan koreksi offset per segmen tempo.
 * 3. Pembalikan waktu: detik audio ke birama lagu.
 * 4. Pengemasan ZIP: pembentukan biner ZIP dan ekstraksi kembali (round-trip) data JSON + biner audio.
 * 5. Integrasi set list: metadata rekaman pada baris set list.
 */

import {
  hitungHashAudio,
  cekKesesuaianRekaman,
  waktuBiramaKeDetikAudio,
  waktuKetukKeDetikAudio,
  detikAudioKeBirama,
  detikAudioKeDetikLagu,
  detikLaguKeDetikAudio,
} from '/tmp/rekaman.mjs'
import { bikinZip, bukaZip } from '/tmp/zip.mjs'
import { hitungSetList } from '/tmp/setlist.mjs'
import { LAJU_MAKS, LAJU_MIN, lajuRekaman, lajuSeragam, terapkanLatihan } from '/tmp/tempoLatihan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${ket ? ' — ' + ket : ''}`)
}

/* ------------------ 1. Sidik Audio & Validasi Kecocokan ------------------ */
{
  const audioA = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const audioB = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const audioC = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 99])

  const hashA = await hitungHashAudio(audioA)
  const hashB = await hitungHashAudio(audioB)
  const hashC = await hitungHashAudio(audioC)

  cek('1.1: hash deterministik untuk data identik', hashA === hashB && typeof hashA === 'string' && hashA.length > 0)
  cek('1.2: hash berbeda untuk data yang berbeda', hashA !== hashC)

  // Kecocokan rekaman
  const metaPelatih = {
    namaFile: 'show_opener.mp3',
    durasi: 125.4,
    hash: hashA,
    titikMulaiDetik: 3.25,
    modeBunyi: 'keduanya',
    volumeAudio: 1.0,
    volumeKlik: 0.8,
  }

  // Anggota mengunggah file persis sama
  const ujiCocok = cekKesesuaianRekaman(metaPelatih, { hash: hashB, durasi: 125.4 })
  cek('1.3: berkas identik dinyatakan cocok', ujiCocok.cocok === true)

  // Anggota mengunggah berkas dengan beda container sedikit (< 0.75 detik)
  const ujiToleran = cekKesesuaianRekaman(metaPelatih, { hash: 'hash_berbeda_karena_tag_id3', durasi: 125.7 })
  cek('1.4: durasi selisih 0.3 dtk dianggap cocok (toleransi)', ujiToleran.cocok === true)

  // Anggota mengunggah berkas versi aransemen yang salah (durasi beda jauh)
  const ujiSalah = cekKesesuaianRekaman(metaPelatih, { hash: 'hash_lain', durasi: 180.0 })
  cek('1.5: durasi beda jauh (>0.75 dtk) ditolak', ujiSalah.cocok === false && typeof ujiSalah.alasan === 'string')
}

/* ---------------- 2. Lini Masa & Penyelarasan Titik Mulai ----------------- */
{
  // Lagu 4/4 120 BPM: tiap birama = 2.0 detik.
  // Titik mulai birama 1 ketuk 1 diselaraskan di detik 2.500 audio
  const meta = {
    namaFile: 'lagu.mp3',
    durasi: 60.0,
    titikMulaiDetik: 2.5,
    modeBunyi: 'keduanya',
    volumeAudio: 1.0,
    volumeKlik: 0.8,
  }

  const sukat4_4 = { pembilang: 4, penyebut: 4, kelompok: [4] }
  const segmen = [] // tempo datar 120 BPM

  // Birama 1 = tepat di titik mulai (2.500 dtk)
  const tBar1 = waktuBiramaKeDetikAudio(1, meta, segmen, sukat4_4, 120)
  cek('2.1: birama 1 tepat di titik mulai', Math.abs(tBar1 - 2.5) < 0.001, String(tBar1))

  // Birama 5 = 4 birama lewat (4 * 2.0s = 8.0s) -> 2.5 + 8.0 = 10.5 dtk
  const tBar5 = waktuBiramaKeDetikAudio(5, meta, segmen, sukat4_4, 120)
  cek('2.2: birama 5 di 10.5 detik', Math.abs(tBar5 - 10.5) < 0.001, String(tBar5))

  // Ketukan: birama 1 ketuk 2 (0-based ketuk 1) = 2.5 + 0.5s = 3.0 dtk
  const tBeat2 = waktuKetukKeDetikAudio(1, 1, 0.5, meta, segmen, sukat4_4, 120)
  cek('2.3: ketuk ke-2 di 3.0 detik', Math.abs(tBeat2 - 3.0) < 0.001, String(tBeat2))

  // Koreksi segmen: misal ada fermata/jeda live di awal segmen Bar 9 (+200 ms)
  const metaKoreksi = {
    ...meta,
    koreksiSegmen: { '9': 200 },
  }
  const segmenDua = [
    { id: '9', measure: 9, bpm: 120, birama: sukat4_4 },
  ]
  // Bar 9 normal = 2.5 + 16.0 = 18.5 dtk, dengan koreksi +200ms = 18.7 dtk
  const tBar9 = waktuBiramaKeDetikAudio(9, metaKoreksi, segmenDua, sukat4_4, 120)
  cek('2.4: koreksi segmen +200ms diterapkan di bar 9', Math.abs(tBar9 - 18.7) < 0.001, String(tBar9))
}

/* ---------------- 3. Pembalikan Lini Masa: Detik ke Birama ---------------- */
{
  const meta = {
    namaFile: 'test.mp3',
    durasi: 60.0,
    titikMulaiDetik: 3.0,
  }
  const sukat = { pembilang: 4, penyebut: 4, kelompok: [4] }

  // Di bawah titik mulai (pre-roll) -> birama 1
  cek('3.1: sebelum titik mulai mengembalikan birama 1', detikAudioKeBirama(1.5, meta, [], sukat, 120) === 1)

  // Tepat di titik mulai (3.0s) -> birama 1
  cek('3.2: tepat di titik mulai mengembalikan birama 1', detikAudioKeBirama(3.0, meta, [], sukat, 120) === 1)

  // 3.0s + 2.0s = 5.0s -> birama 2
  cek('3.3: 5.0 detik mengembalikan birama 2', detikAudioKeBirama(5.0, meta, [], sukat, 120) === 2)

  // Konversi detik lagu vs audio
  cek('3.4: konversi detik lagu ke detik audio', detikLaguKeDetikAudio(10.0, meta) === 13.0)
  cek('3.5: konversi detik audio ke detik lagu', detikAudioKeDetikLagu(13.0, meta) === 10.0)
}

/* ---------------- 4. Buka & Bikin ZIP dengan Berkas Biner Audio ----------- */
{
  const teksJson = JSON.stringify({ format: 'drillkit-backup', version: 1, test: 'ok' })
  const binerMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x44])

  const zipBytes = bikinZip([
    { nama: 'backup.json', isi: teksJson },
    { nama: 'audio/song_01_track.mp3', isi: binerMp3 },
  ])

  cek('4.1: bikinZip menghasilkan byte ZIP biner', zipBytes instanceof Uint8Array && zipBytes.length > 50)

  // Ekstrak kembali lewat bukaZip
  const hasilUnzip = bukaZip(zipBytes)
  cek('4.2: bukaZip menemukan 2 entri berkas', hasilUnzip.length === 2)

  const entriJson = hasilUnzip.find((e) => e.nama === 'backup.json')
  const entriAudio = hasilUnzip.find((e) => e.nama === 'audio/song_01_track.mp3')

  cek('4.3: teks JSON diekstrak sama persis', entriJson?.teks() === teksJson)
  cek(
    '4.4: biner audio diekstrak sama persis byte-per-byte',
    entriAudio !== undefined &&
      entriAudio.bita.length === binerMp3.length &&
      entriAudio.bita.every((b, i) => b === binerMp3[i]),
  )
}

/* ---------------- 5. Integrasi Set List & Rekaman ------------------------- */
{
  const lagu1 = {
    id: 's1',
    title: 'Opener',
    bpm: 120,
    beats: 4,
    panjangBirama: 32,
    tempoMap: [],
    rekaman: {
      namaFile: 'opener.mp3',
      durasi: 64.0,
      titikMulaiDetik: 0,
      modeBunyi: 'keduanya',
      volumeAudio: 1.0,
      volumeKlik: 0.8,
    },
  }
  const lagu2 = {
    id: 's2',
    title: 'Ballad',
    bpm: 80,
    beats: 4,
    panjangBirama: 16,
    tempoMap: [],
  }

  const sl = { id: 'sl1', name: 'Show', songIds: ['s1', 's2'] }
  const hitung = hitungSetList(sl, [lagu1, lagu2])

  cek('5.1: set list menghitung 2 baris', hitung.baris.length === 2)
  cek('5.2: lagu dengan rekaman ditandai adaRekaman = true', hitung.baris[0].adaRekaman === true)
  cek('5.3: lagu tanpa rekaman memiliki adaRekaman = false', hitung.baris[1].adaRekaman === false)
}

/* -------- 6. Keiringan rekaman × tempo latihan (#6) ---------------------- */
{
  const BPM = 172
  const dekat = (nama, a, b, tol = 1e-9) => cek(nama, Math.abs(a - b) <= tol, `${a} vs ${b}`)

  cek('6.1: tanpa latihan → laju 1', lajuRekaman(BPM, null) === 1)
  cek('6.2: latihan netral (100%) → laju 1', lajuRekaman(BPM, { mode: 'persen', persen: 100, geser: 0 }) === 1)
  dekat('6.3: persen 80 → laju 0,8', lajuRekaman(BPM, { mode: 'persen', persen: 80, geser: 0 }), 0.8)
  dekat('6.4: BPM −20 @172 → laju 152/172', lajuRekaman(BPM, { mode: 'bpm', persen: 100, geser: -20 }), 152 / 172)

  /*
   * INTI perbaikan: laju yang benar adalah rasio antara tempo yang BERBUNYI
   * (klik) dan tempo partitur. Kalau tidak sama, klik dan rekaman berpisah
   * makin jauh tiap ketukan — 2,7 detik dalam 25 detik pada kasus 172→152.
   */
  for (const t of [
    { mode: 'persen', persen: 80, geser: 0 },
    { mode: 'persen', persen: 120, geser: 0 },
    { mode: 'bpm', persen: 100, geser: -20 },
    { mode: 'bpm', persen: 100, geser: 12 },
  ]) {
    dekat(
      `6.5: laju × tempo dasar = tempo klik (${t.mode} ${t.mode === 'bpm' ? t.geser : t.persen})`,
      lajuRekaman(BPM, t) * BPM,
      terapkanLatihan(BPM, t),
      1e-9,
    )
  }

  // Di luar 0,25–3,0 peramban menolak `playbackRate`; laju harus dijepit.
  // Nilai ekstrem tetap mungkin: tempo lagu boleh serendah 20, geseran BPM
  // boleh −60…+30.
  cek(
    '6.6: laju dijepit ke batas bawah',
    lajuRekaman(20, { mode: 'bpm', persen: 100, geser: -60 }) === LAJU_MIN,
    String(lajuRekaman(20, { mode: 'bpm', persen: 100, geser: -60 })),
  )
  cek(
    '6.7: laju dijepit ke batas atas',
    lajuRekaman(12, { mode: 'bpm', persen: 100, geser: 30 }) === LAJU_MAKS,
    String(lajuRekaman(12, { mode: 'bpm', persen: 100, geser: 30 })),
  )

  // 6.8 — lagu bertempo map: mode BPM tidak bisa diwakili satu laju.
  cek('6.8: persen selalu seragam', lajuSeragam(172, [{ bpm: 172 }, { bpm: 140 }], { mode: 'persen', persen: 80, geser: 0 }))
  cek('6.9: BPM + tempo berbeda → tidak seragam', !lajuSeragam(172, [{ bpm: 172 }, { bpm: 140 }], { mode: 'bpm', persen: 100, geser: -20 }))
  cek('6.10: BPM + tempo sama → seragam', lajuSeragam(172, [{ bpm: 172 }, { bpm: 172 }], { mode: 'bpm', persen: 100, geser: -20 }))
  cek('6.11: tanpa latihan selalu seragam', lajuSeragam(172, [{ bpm: 172 }, { bpm: 140 }], { mode: 'bpm', persen: 100, geser: 0 }))
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) {
  console.error('Kegagalan:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
