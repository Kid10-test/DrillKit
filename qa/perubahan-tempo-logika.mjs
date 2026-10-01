/**
 * Uji logika **accelerando & ritardando** — apakah temponya benar-benar
 * berubah, bukan sekadar tombolnya yang berganti warna.
 *
 * Mengapa ini ada: permintaannya berbahasa musik ("accelerando",
 * "ritardando"), dan godaan terbesarnya adalah menganggap selesai setelah
 * dua tombol itu tampil dan bisa ditekan. Yang diminta pelatih bukan
 * sebuah tombol, melainkan **tempo yang makin cepat dari birama ke
 * birama**. Itu tidak bisa dibuktikan dari warna tombol.
 *
 * Sebabnya hitungannya dikeluarkan dari kelas `Metronom` menjadi fungsi
 * murni `tempoLatih`: sebelumnya satu-satunya cara membuktikannya adalah
 * menjalankan peramban dengan AudioContext sungguhan, yang mustahil
 * diuji. Sekarang bisa.
 */
import { tempoLatih, tempoRampBpm, tempoPeta, tempoBerlaku, adaBerangsur, jepitTempo, luncuranPada, daftarLuncuran, ringkasLuncuran, jejakLuncuran } from '/tmp/metronome.mjs'
import { biramaBaku, detikSampai, detikSisa, detikTotal, tempoPada } from '/tmp/birama.mjs'
import { detikSatuPutaran } from '/tmp/ulang.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/* ---------------------- Accelerando: makin cepat ----------------------- */
{
  const latih = { on: true, dari: 100, ke: 140, langkah: 2, tiap: 4 }
  const b1 = tempoLatih(100, latih, 1)
  const b5 = tempoLatih(100, latih, 5)
  const b17 = tempoLatih(100, latih, 17)
  const b65 = tempoLatih(100, latih, 65)
  const b200 = tempoLatih(100, latih, 200)

  cek('1: birama pertama belum berubah', b1 === 100, String(b1))
  cek('1: setelah 4 birama, tempo NAIK', b5 > b1, `${b1} -> ${b5}`)
  cek('1: makin lama makin cepat', b17 > b5, `${b5} -> ${b17}`)
  /*
   * Di birama 65 nilainya belum sampai 140 — dengan langkah 2 BPM tiap
   * 4 birama, ia baru tiba di tujuan pada birama ke-81. Awalnya uji ini
   * menuntut 140 di birama 65 dan GAGAL; yang keliru adalah harapannya,
   * bukan hitungannya. Yang penting: ia mendekati tujuan, tidak
   * melampaui, dan berhenti tepat di situ.
   */
  cek('1: mendekati tujuan tanpa melampaui', b65 > b17 && b65 < 140, String(b65))
  cek('1: berhenti di tujuan walau biramanya jauh', b200 === 140, String(b200))
}

/* ---------------------- Ritardando: makin lambat ----------------------- */
{
  const latih = { on: true, dari: 140, ke: 100, langkah: -2, tiap: 4 }
  const b1 = tempoLatih(140, latih, 1)
  const b5 = tempoLatih(140, latih, 5)
  const b17 = tempoLatih(140, latih, 17)
  const b65 = tempoLatih(140, latih, 65)

  cek('2: birama pertama belum berubah', b1 === 140, String(b1))
  cek('2: setelah 4 birama, tempo TURUN', b5 < b1, `${b1} -> ${b5}`)
  cek('2: makin lama makin lambat', b17 < b5, `${b5} -> ${b17}`)
  cek('2: mendekati tujuan tanpa melampaui', b65 < b17 && b65 > 100, String(b65))
  cek('2: berhenti di tujuan walau biramanya jauh',
    tempoLatih(140, latih, 200) === 100, String(tempoLatih(140, latih, 200)))
}

/* ---------------------- Tanpa perubahan: tetap datar ------------------- */
{
  cek('3: tanpa pengaturan, tempo tetap', tempoLatih(120, null, 40) === 120)
  cek('3: pengaturan mati, tempo tetap', tempoLatih(120, { on: false, dari: 100, ke: 140, langkah: 2, tiap: 4 }, 40) === 120)
}

/* --------------- Keadaan mati lama: langkah nol ----------------------- */
{
  /*
   * Ini cacat yang mendorong bentuk barunya. Dulu `langkah` diketik
   * sendiri dan boleh nol — dan nol membuat tempo tidak pernah berubah
   * sedetik pun, tanpa peringatan apa pun. Keadaan ini masih boleh
   * terjadi pada lagu yang tersimpan versi lama, jadi perilakunya
   * dicatat di sini sebagai pengingat, dan sekarang dicegah dari
   * antarmuka: langkahnya dihitung aplikasi, bukan diketik.
   */
  const latih = { on: true, dari: 100, ke: 140, langkah: 0, tiap: 4 }
  cek('4: langkah nol = tempo tidak pernah berubah (keadaan mati lama)',
    tempoLatih(100, latih, 1) === 100 && tempoLatih(100, latih, 99) === 100)
  // Dan itulah sebabnya antarmukanya tidak lagi menawarkan angka ini.
}

/* --------- Langkah hasil hitungan: pecahan pun harus masuk akal -------- */
{
  // 120 -> 160 dalam 32 birama, tiap 4 birama = 8 siklus = 5 BPM/siklus
  const latih = { on: true, dari: 120, ke: 160, langkah: 5, tiap: 4 }
  cek('5: langkah hasil hitungan menghasilkan urutan yang masuk akal',
    tempoLatih(120, latih, 1) === 120 &&
    tempoLatih(120, latih, 5) === 125 &&
    tempoLatih(120, latih, 9) === 130,
    `${tempoLatih(120, latih, 1)}, ${tempoLatih(120, latih, 5)}, ${tempoLatih(120, latih, 9)}`)
  cek('5: sampai ke tujuan tepat di akhir rentangnya',
    tempoLatih(120, latih, 33) === 160, String(tempoLatih(120, latih, 33)))
}

/* -------------- Tiap = 0 tidak boleh membuatnya membagi nol ------------ */
{
  const latih = { on: true, dari: 100, ke: 140, langkah: 2, tiap: 0 }
  const hasil = tempoLatih(100, latih, 10)
  cek('6: "tiap 0 birama" tidak menghasilkan NaN atau Infinity',
    Number.isFinite(hasil), String(hasil))
}

/* ============ N6 — luncuran DI ANTARA dua segmen (yang diminta) ========
 *
 * Inilah permintaan sebenarnya. Bukan accelerando menyeluruh, melainkan:
 * ketik tempo di dua segmen, lalu tandai segmen awalnya supaya birama di
 * ANTARA keduanya meluncur, bukan menunggu lompatan di segmen berikutnya.
 *
 * Contoh yang diberikan pelatih, dipakai apa adanya:
 *   bar 88 = 172, ditandai berangsur
 *   bar 91 = 140
 * maka bar 89 dan 90 harus MELUNCUR dari 172 ke 140.
 */
{
  const seg = [
    { measure: 88, bpm: 172, berangsur: 1 },
    { measure: 91, bpm: 140 },
  ]
  const b88 = tempoPeta(seg, 88, 120)
  const b89 = tempoPeta(seg, 89, 120)
  const b90 = tempoPeta(seg, 90, 120)
  const b91 = tempoPeta(seg, 91, 120)

  cek('7: bar 88 masih persis 172 (titik awal, belum bergerak)', b88 === 172, String(b88))
  cek('7: bar 89 MELUNCUR ke bawah, bukan melompat', b89 < 172 && b89 > 140, String(b89))
  cek('7: bar 90 terus meluncur', b90 < b89 && b90 > 140, String(b90))
  cek('7: bar 91 tiba persis di 140', b91 === 140, String(b91))
  // Luncurannya harus LINIER: selisih 89->90 sama dengan 88->89.
  const d1 = b88 - b89
  const d2 = b89 - b90
  cek('7: luncurannya rata (linier), tidak meloncat-loncat',
    Math.abs(d1 - d2) < 0.001, `${d1.toFixed(3)} lawan ${d2.toFixed(3)}`)
  cek('7: sebelum segmen pertama, tempo dasarnya yang dipakai',
    tempoPeta(seg, 87, 120) === 120, String(tempoPeta(seg, 87, 120)))
  cek('7: sesudah segmen terakhir, temponya bertahan',
    tempoPeta(seg, 150, 120) === 140, String(tempoPeta(seg, 150, 120)))
}

/* --------- Tanpa tanda berangsur: tetap MELOMPAT seperti sediakala ----- */
{
  const seg = [
    { measure: 88, bpm: 172 },
    { measure: 91, bpm: 140 },
  ]
  cek('8: TANPA tanda berangsur, bar 88 tetap 172', tempoPeta(seg, 88, 120) === 172)
  cek('8: TANPA tanda berangsur, bar 89 TETAP 172 (tidak ikut berubah)',
    tempoPeta(seg, 89, 120) === 172, String(tempoPeta(seg, 89, 120)))
  cek('8: TANPA tanda berangsur, bar 90 TETAP 172', tempoPeta(seg, 90, 120) === 172)
  cek('8: TANPA tanda berangsur, bar 91 MELOMPAT ke 140',
    tempoPeta(seg, 91, 120) === 140)
  // Inilah janjinya: lagu yang sudah ada tidak berubah perilakunya sendirian.
}

/* --------------- Accelerando di antara dua segmen ---------------------- */
{
  const seg = [
    { measure: 1, bpm: 100, berangsur: 1 },
    { measure: 5, bpm: 140 },
  ]
  cek('9: bar 1 = 100', tempoPeta(seg, 1, 100) === 100)
  cek('9: bar 2 meluncur NAIK', tempoPeta(seg, 2, 100) > 100, String(tempoPeta(seg, 2, 100)))
  cek('9: bar 3 = 120 (di tengah-tengah)', Math.abs(tempoPeta(seg, 3, 100) - 120) < 0.001,
    String(tempoPeta(seg, 3, 100)))
  cek('9: bar 5 tiba di 140', tempoPeta(seg, 5, 100) === 140)
}

/* -------------- Keadaan pinggir yang tidak boleh merusak --------------- */
{
  // Segmen terakhir ditandai berangsur, padahal tidak ada sesudahnya.
  const seg = [{ measure: 10, bpm: 150, berangsur: 1 }]
  cek('10: segmen terakhir berangsur tidak menghasilkan NaN',
    Number.isFinite(tempoPeta(seg, 12, 120)), String(tempoPeta(seg, 12, 120)))
  cek('10: dan temponya tetap 150, bukan berubah sendiri',
    tempoPeta(seg, 12, 120) === 150, String(tempoPeta(seg, 12, 120)))

  // Dua segmen di birama yang sama: tidak boleh membagi nol.
  const tumpang = [
    { measure: 4, bpm: 100, berangsur: 1 },
    { measure: 4, bpm: 200 },
  ]
  cek('10: dua segmen di birama sama tidak menghasilkan NaN/Infinity',
    Number.isFinite(tempoPeta(tumpang, 4, 120)), String(tempoPeta(tumpang, 4, 120)))

  // Segmen berikutnya di birama yang LEBIH KECIL (salah urut).
  const mundur = [
    { measure: 9, bpm: 100, berangsur: 1 },
    { measure: 5, bpm: 200 },
  ]
  cek('10: segmen berikutnya yang mundur tidak menghasilkan NaN',
    Number.isFinite(tempoPeta(mundur, 7, 120)), String(tempoPeta(mundur, 7, 120)))

  // Tanpa segmen sama sekali.
  cek('10: tanpa segmen, tempo dasarnya yang dipakai', tempoPeta([], 40, 120) === 120)
}

/* ============ Prioritas: yang lebih khusus MENANG ======================
 *
 * Tiga cara mengubah tempo bisa menyala bersamaan. Tanpa aturan, luncuran
 * per segmen yang diatur hati-hati (172 -> 161,3 -> 150,7 -> 140) diratakan
 * oleh luncuran menyeluruh menjadi SATU ANGKA (180), tanpa peringatan apa
 * pun. Itu kegagalan yang tampak berhasil: lagunya berbunyi, hanya saja
 * temponya bukan yang diatur pelatihnya.
 */
{
  const seg = [
    { measure: 88, bpm: 172, berangsur: 1 },
    { measure: 91, bpm: 140 },
  ]
  const latih = { on: true, dari: 120, ke: 180, langkah: 2, tiap: 4 }
  const opsi = (pakai) => ({ dasar: 120, segmen: seg, pakaiTempoMap: pakai, latih })

  cek('11: adaBerangsur mendeteksi segmen yang ditandai', adaBerangsur(seg) === true)
  cek('11: dan TIDAK mendeteksi tempo map tanpa tanda',
    adaBerangsur([{ measure: 1, bpm: 100 }]) === false)

  /*
   * Kalau tempo map-nya tidak dipakai, luncuran menyeluruh tetap berlaku.
   *
   * Semula butir ini menuntut 180 di bar 89 dan GAGAL — untuk kedua
   * kalinya aku membuat kesalahan yang sama: lupa bahwa dengan langkah
   * 2 BPM tiap 4 birama, di bar 89 baru naik 22 langkah = +44 BPM,
   * yaitu 164, belum sampai tujuan. Yang benar: 164 di bar 89, dan 180
   * baru tercapai jauh kemudian (dijepit di tujuan).
   */
  cek('11: tanpa tempo map, luncuran menyeluruh tetap berlaku (naik bertahap)',
    tempoBerlaku(opsi(false), 89) === 164, String(tempoBerlaku(opsi(false), 89)))
  cek('11: dan akhirnya berhenti di tujuannya',
    tempoBerlaku(opsi(false), 400) === 180, String(tempoBerlaku(opsi(false), 400)))

  // Kalau tempo map TANPA tanda berangsur, luncuran menyeluruh tetap
  // berlaku di atas tangganya — perilaku lama tidak berubah.
  const tangga = [{ measure: 88, bpm: 172 }, { measure: 91, bpm: 140 }]
  const dua = tempoBerlaku({ dasar: 120, segmen: tangga, pakaiTempoMap: true, latih }, 89)
  cek('11: tempo map TANPA tanda berangsur tetap boleh dilapisi luncuran menyeluruh',
    dua === 180, String(dua))

  // Intinya: dengan tanda berangsur, luncuran per segmen MENANG.
  const b89 = tempoBerlaku(opsi(true), 89)
  const b90 = tempoBerlaku(opsi(true), 90)
  cek('11: luncuran PER SEGMEN menang, tidak diratakan jadi 180',
    Math.abs(b89 - 161.333) < 0.01, String(b89))
  cek('11: dan tetap meluncur ke bar berikutnya', b90 < b89 && b90 > 140, String(b90))
  cek('11: bar 88 tetap di titik awalnya', tempoBerlaku(opsi(true), 88) === 172,
    String(tempoBerlaku(opsi(true), 88)))
  cek('11: bar 91 tetap tiba di tujuannya', tempoBerlaku(opsi(true), 91) === 140,
    String(tempoBerlaku(opsi(true), 91)))
}

/* ------------- 12 — Tampilan memakai sumber yang sama (N7) ------------- */
/*
 * Mengapa butir ini ada: panel lagu dulu menghitung temponya sendiri
 * (fungsi `tempoPada`, tangga per segmen) sementara mesin memainkan
 * `tempoBerlaku`. Pada lagu yang meluncur, keduanya berbeda — panel
 * menampilkan 172 pada keempat birama yang sebenarnya sedang turun
 * 172 → 161,3 → 150,7 → 140. Itu cacat yang paling merugikan saat
 * mencoba: pelatih melihat angka datar dan menyimpulkan luncurannya
 * tidak jalan, padahal yang tidak jalan hanya angkanya.
 */
{
  const seg = [
    { measure: 88, bpm: 172, berangsur: 1 },
    { measure: 91, bpm: 140 },
  ]
  const tangga = seg.map(({ measure, bpm }) => ({ measure, bpm }))

  // Penjepit tempo diekspor supaya tampilan menjepit seperti mesin.
  cek('12: tempo dijepit di batas yang masih bisa dimainkan',
    jepitTempo(500) === 400 && jepitTempo(5) === 20,
    `${jepitTempo(500)} / ${jepitTempo(5)}`)
  cek('12: tempo yang bukan angka jatuh ke batas bawah, bukan NaN',
    jepitTempo(NaN) === 20, String(jepitTempo(NaN)))

  // Jendela luncuran hanya ada DI ANTARA dua segmen, tidak di ujungnya.
  cek('12: bar 88 bukan luncuran — itu titik awalnya',
    luncuranPada(seg, 88) === null, String(luncuranPada(seg, 88)))
  cek('12: bar 91 bukan luncuran — sudah tiba di tujuan',
    luncuranPada(seg, 91) === null, String(luncuranPada(seg, 91)))
  const l89 = luncuranPada(seg, 89)
  cek('12: bar 89 sedang meluncur dari bar 88 (172) ke bar 91 (140)',
    !!l89 && l89.dariBar === 88 && l89.keBar === 91 && l89.dari === 172 && l89.ke === 140,
    JSON.stringify(l89))
  cek('12: posisinya tepat sepertiga perjalanan',
    !!l89 && Math.abs(l89.posisi - 1 / 3) < 1e-9, String(l89 && l89.posisi))
  cek('12: tanpa tanda berangsur tidak ada jendela luncuran',
    luncuranPada(tangga, 89) === null, String(luncuranPada(tangga, 89)))
  cek('12: sebelum segmen pertama pun tidak ada yang diluncurkan',
    luncuranPada(seg, 12) === null, String(luncuranPada(seg, 12)))

  // Inti butir ini: angka lama berbeda dari yang berbunyi.
  const lama = tempoPada(tangga, 89, 120)
  const baru = jepitTempo(tempoBerlaku({ dasar: 120, segmen: seg, pakaiTempoMap: true }, 89))
  cek('12: cara lama menampilkan 172 di bar 89 — padahal yang berbunyi 161,3',
    lama === 172, String(lama))
  cek('12: tampilan kini menampilkan angka yang sama dengan mesin',
    Math.abs(baru - 161.333) < 0.01, String(baru))
  cek('12: bedanya lebih dari 10 BPM — cacatnya nyata, bukan khayalan',
    Math.abs(lama - baru) > 10, `${lama} vs ${baru}`)

  // Empat birama, empat angka: panel bergerak, tidak diam.
  const tampil = [88, 89, 90, 91].map((b) =>
    jepitTempo(tempoBerlaku({ dasar: 120, segmen: seg, pakaiTempoMap: true }, b)),
  )
  cek('12: empat birama menampilkan empat angka yang berbeda',
    new Set(tampil.map((v) => v.toFixed(2))).size === 4,
    tampil.map((v) => v.toFixed(1)).join(' → '))
  cek('12: dan urutannya menurun (ritardando)',
    tampil.every((v, i, a) => i === 0 || v < a[i - 1]),
    tampil.map((v) => v.toFixed(1)).join(' → '))

  // Tanpa tempo map, panel mengikuti tempo dasar — bukan angka kosong.
  cek('12: tempo map dimatikan ⇒ panel kembali ke tempo dasar',
    jepitTempo(tempoBerlaku({ dasar: 120, segmen: seg, pakaiTempoMap: false }, 89)) === 120,
    String(tempoBerlaku({ dasar: 120, segmen: seg, pakaiTempoMap: false }, 89)))
}

/* --------------- 13 — Hitungan waktu ikut luncuran (N7) ---------------- */
/*
 * Durasi lagu, sisa waktu, dan batang progres semuanya berakar pada
 * `detikSampai`, yang dulu menganggap tempo datar di dalam satu segmen.
 * Tiga birama yang meluncur 172 → 140 ternyata LEBIH PANJANG daripada
 * tiga birama 172, jadi jamnya ikut meleset — pelan-pelan, tidak pernah
 * berteriak, dan karena itu tidak pernah dicurigai.
 */
{
  const m44 = biramaBaku(4, 4)
  const seg = [
    { measure: 88, bpm: 172, berangsur: 1 },
    { measure: 91, bpm: 140 },
  ]
  const tangga = seg.map(({ measure, bpm }) => ({ measure, bpm }))
  const tempoUntuk = (b) =>
    jepitTempo(tempoBerlaku({ dasar: 120, segmen: seg, pakaiTempoMap: true }, b))
  /** Tempo tangga — dipakai untuk membuktikan jalan baru = jalan lama. */
  const tanggaUntuk = (b) => tempoPada(tangga, b, 120)

  // Jalan baru (per birama) harus sama dengan jalan lama (per rentang)
  // selama tempo tidak bergerak. Ini yang menjamin lagu lama aman.
  const jalanLama = detikSampai(tangga, 92, m44, 120)
  const jalanBaru = detikSampai(tangga, 92, m44, 120, tanggaUntuk)
  cek('13: tempo yang diam ⇒ hasil per birama sama dengan per rentang',
    Math.abs(jalanLama - jalanBaru) < 1e-9, `${jalanLama} vs ${jalanBaru}`)

  // Dengan luncuran, birama 89 & 90 lebih panjang daripada kiraan tangga.
  const dengan = detikSampai(tangga, 92, m44, 120, tempoUntuk)
  const selisih = dengan - jalanBaru
  cek('13: luncuran membuat hitungan waktu lebih panjang (lagu melambat)',
    dengan > jalanBaru, `${jalanBaru.toFixed(3)} → ${dengan.toFixed(3)}`)
  /*
   * Selisihnya bukan pembulatan: birama 89 dan 90 masing-masing lebih
   * panjang 0,092 dan 0,198 detik (4/4 pada 161,3 dan 150,7 BPM).
   */
  cek('13: selisihnya sekitar 0,29 detik — bukan kebetulan pembulatan',
    Math.abs(selisih - 0.29) < 0.02, selisih.toFixed(4))

  // detikTotal & detikSisa hanya meneruskan ke detikSampai; pastikan
  // tembus, jangan sampai tersisa satu jalan lama yang terlupakan.
  cek('13: durasi total ikut memakai tempo per birama',
    detikTotal(tangga, 92, m44, 120, tempoUntuk) === detikSampai(tangga, 93, m44, 120, tempoUntuk),
    String(detikTotal(tangga, 92, m44, 120, tempoUntuk)))
  cek('13: sisa waktu ikut memakai tempo per birama',
    Math.abs(
      detikSisa(tangga, 92, 1, m44, 120, tempoUntuk) -
        detikTotal(tangga, 92, m44, 120, tempoUntuk),
    ) < 1e-9,
    String(detikSisa(tangga, 92, 1, m44, 120, tempoUntuk)))

  // Durasi satu putaran rentang ulang pun ikut — dipakai tombol Ulang.
  const putarTangga = detikSatuPutaran(tangga, 88, 91, m44, 120)
  const putarLuncur = detikSatuPutaran(tangga, 88, 91, m44, 120, tempoUntuk)
  cek('13: durasi satu putaran rentang ikut luncuran',
    putarLuncur > putarTangga, `${putarTangga.toFixed(3)} → ${putarLuncur.toFixed(3)}`)
}

/* ----------- 14 — Lagu memberitahu luncurannya SEBELUM diputar (N10) ------- */
/*
 * Mengapa butir ini ada: sebuah lagu tertulis "120 BPM" di daftar
 * repertoar, padahal ia meluncur 172 → 140 pada bar 88–91. Yang tahu
 * hanya orang yang membuka editor lagunya — padahal yang MEMUTARNYA
 * belum tentu orang itu, dan anggota tidak punya editor sama sekali.
 * Karena itu luncurannya harus terbaca dari daftar lagu, dengan alasan
 * yang sama dengan penanda accelerando: ketahui sebelum terkejut.
 */
{
  const berangsur = [
    { measure: 88, bpm: 172, berangsur: 1 },
    { measure: 91, bpm: 140 },
  ]

  // Daftar luncurannya: titik awal, titik akhir, dan kedua temponya.
  const daftar = daftarLuncuran(berangsur)
  cek('14: satu luncuran terbaca dari tempo mapnya', daftar.length === 1, JSON.stringify(daftar))
  cek('14: dan menyebut bar 88 → 91 dengan 172 → 140',
    daftar[0]?.dariBar === 88 && daftar[0]?.keBar === 91 && daftar[0]?.dari === 172 && daftar[0]?.ke === 140,
    JSON.stringify(daftar[0] ?? null))

  // Ringkasannya pendek — yang muat di lencana daftar lagu.
  cek('14: ringkasannya "luncur 172 → 140"', ringkasLuncuran(berangsur) === 'luncur 172 → 140',
    String(ringkasLuncuran(berangsur)))
  cek('14: penjelasannya menyebut kedua bar & kedua tempo',
    /Bar 88: 172 → bar 91: 140/.test(String(jejakLuncuran(berangsur))),
    String(jejakLuncuran(berangsur)))

  // Lagu TANPA tanda tidak boleh punya lencana: kebisingan yang selalu
  // muncul akan diabaikan, dan lencana yang diabaikan sama dengan tidak
  // ada lencana.
  const tangga = [
    { measure: 88, bpm: 172 },
    { measure: 91, bpm: 140 },
  ]
  cek('14: tempo map tanpa tanda tidak menghasilkan luncuran', daftarLuncuran(tangga).length === 0,
    JSON.stringify(daftarLuncuran(tangga)))
  cek('14: dan ringkasannya null — jadi tidak ada lencana', ringkasLuncuran(tangga) === null,
    String(ringkasLuncuran(tangga)))
  cek('14: tempo map kosong pun null', ringkasLuncuran([]) === null, String(ringkasLuncuran([])))

  // Beberapa luncuran: ringkasannya dihitung, tidak disebut satu-satu.
  const banyak = [
    { measure: 8, bpm: 120, berangsur: 1 },
    { measure: 12, bpm: 150, berangsur: 1 },
    { measure: 16, bpm: 100 },
    { measure: 20, bpm: 180, berangsur: 1 },
    { measure: 24, bpm: 90 },
  ]
  cek('14: tiga luncuran terbaca', daftarLuncuran(banyak).length === 3,
    JSON.stringify(daftarLuncuran(banyak).map((g) => `${g.dariBar}→${g.keBar}`)))
  cek('14: ringkasannya menyebut jumlahnya, bukan daftar panjang',
    ringkasLuncuran(banyak) === '3 luncuran', String(ringkasLuncuran(banyak)))
  cek('14: urutannya mengikuti birama, bukan urutan penulisan',
    daftarLuncuran([...banyak].reverse()).map((g) => g.dariBar).join() === '8,12,20',
    daftarLuncuran([...banyak].reverse()).map((g) => g.dariBar).join())

  // Tanda pada segmen TERAKHIR tidak punya tujuan — jangan dihitung.
  const buntu = [
    { measure: 8, bpm: 120 },
    { measure: 12, bpm: 150, berangsur: 1 },
  ]
  cek('14: tanda di segmen terakhir tidak menghasilkan luncuran',
    daftarLuncuran(buntu).length === 0, JSON.stringify(daftarLuncuran(buntu)))
  // Dan dua segmen pada bar yang sama tidak punya jarak untuk diluncurkan.
  const tumpang = [
    { measure: 8, bpm: 120, berangsur: 1 },
    { measure: 8, bpm: 150 },
  ]
  cek('14: dua segmen pada bar yang sama tidak bisa diluncurkan',
    daftarLuncuran(tumpang).length === 0, JSON.stringify(daftarLuncuran(tumpang)))

  // Yang terpenting: ringkasannya SEJALAN dengan yang berbunyi.
  cek('14: tempo bar 89 sesuai luncuran yang diiklankan (161,3)',
    Math.abs(tempoBerlaku({ dasar: 120, segmen: berangsur, pakaiTempoMap: true }, 89) - 161.333) < 0.01,
    String(tempoBerlaku({ dasar: 120, segmen: berangsur, pakaiTempoMap: true }, 89)))
}

/* ============ 15 — Ramp per hitungan dengan batas inklusif ============
 *
 * Contoh Sibelius/Tonal Energy dari pelatih:
 * - Accelerando 160 → 180 selama 8 hitungan: tempo 160 berlaku SEBELUM
 *   ramp; hitungan 1 sudah menjadi 162,5 dan hitungan 8 tepat 180.
 * - Ritardando 172 → 140 selama 6 hitungan: hitungan 1 sudah berubah,
 *   hitungan 6 tepat 140. Jangan menyimpulkan jumlah langkah dari birama.
 */
{
  const akselHarapan = [162.5, 165, 167.5, 170, 172.5, 175, 177.5, 180]
  const aksel = akselHarapan.map((_, i) => tempoRampBpm(160, 180, 8, i + 1))
  cek('15: sebelum accelerando, hitungan 0 masih 160', tempoRampBpm(160, 180, 8, 0) === 160)
  cek('15: akselerando 8 hitungan tepat mengikuti Sibelius',
    aksel.every((bpm, i) => Math.abs(bpm - akselHarapan[i]) < 1e-9),
    aksel.map((bpm) => bpm.toFixed(2)).join(' → '))
  cek('15: hitungan pertama sudah berubah ke 162,5', aksel[0] === 162.5, String(aksel[0]))
  cek('15: hitungan kedelapan tepat mencapai 180', aksel[7] === 180, String(aksel[7]))
  cek('15: accelerando menahan tempo tujuan sesudah hitungan 8',
    tempoRampBpm(160, 180, 8, 9) === 180, String(tempoRampBpm(160, 180, 8, 9)))
  cek('15: jarak tiap langkah accelerando tepat 2,5 BPM',
    aksel.every((bpm, i) => i === 0 || Math.abs((bpm - aksel[i - 1]) - 2.5) < 1e-9))

  const ritHarapan = Array.from({ length: 6 }, (_, i) => 172 + ((140 - 172) * (i + 1)) / 6)
  const rit = ritHarapan.map((_, i) => tempoRampBpm(172, 140, 6, i + 1))
  cek('15: sebelum ritardando, hitungan 0 masih 172', tempoRampBpm(172, 140, 6, 0) === 172)
  cek('15: ritardando 6 hitungan tepat mengikuti tempo pulse Sibelius',
    rit.every((bpm, i) => Math.abs(bpm - ritHarapan[i]) < 1e-9),
    rit.map((bpm) => bpm.toFixed(2)).join(' → '))
  cek('15: hitungan pertama ritardando sudah berubah', rit[0] < 172, String(rit[0]))
  cek('15: hitungan keenam tepat mencapai 140', Math.abs(rit[5] - 140) < 1e-9, String(rit[5]))
  cek('15: ritardando menahan tempo tujuan sesudah hitungan 6',
    tempoRampBpm(172, 140, 6, 7) === 140, String(tempoRampBpm(172, 140, 6, 7)))
  const langkahRit = (140 - 172) / 6
  cek('15: jarak tiap langkah ritardando tetap −32/6 BPM',
    rit.every((bpm, i) => i === 0 || Math.abs((bpm - rit[i - 1]) - langkahRit) < 1e-9))
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
