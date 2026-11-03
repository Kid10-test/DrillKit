/**
 * #23 — Uji logika murni:
 *  - #23.1 Titik Singgah Per-Pemain (`Midsets`) + integrasi `analitik.ts` & `segmenDrill.ts`
 *  - #23.2 Sistem `Tags` Lintas-Seksi Terpadu (`tagAnggota.ts` + `sinkronkanKelompokDariTag`)
 *  - #23.3 Mesin Pointer Terpadu (`touch` / `pen` / `mouse`) & Viewport Zoom/Pan (`mesinPointer.ts`)
 *  - #23.4 Palet Perintah & Pintasan Terpadu (`paletPerintah.ts`)
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/midsets-tags-pointer-palet-logika.mjs
 */
import {
  deltaMidsets,
  normalisasiMidsetsPemain,
  panjangJalurMidsets,
  pathSvgMidsets,
  proyeksiMidsets,
  sinkronkanKelompokDariTag,
} from '/tmp/gerak.mjs'
import { analisisPerpindahan } from '/tmp/analitik.mjs'
import { pecahSet } from '/tmp/segmen.mjs'
import {
  PALET_WARNA_TAG,
  gabungDaftarTag,
  gayaTitikPemain,
  kumpulkanTagRoster,
  lepasTagDariAnggota,
  pasangTagKeAnggota,
  poligonBentukTitik,
  punyaTag,
  uraiInputTag,
} from '/tmp/tagAnggota.mjs'
import {
  VIEWPORT_AWAL,
  aksiSeretKanvasKosong,
  hitungCubitDuaJari,
  hitungRadiusTangkapSvg,
  hitungViewBoxKanvas,
  jepitViewport,
  peranPointerEfektif,
  zoomSekitarTitik,
} from '/tmp/mesinPointer.mjs'
import { lengkapiReferensiPintasan, saringPerintahPalet } from '/tmp/paletPerintah.mjs'
import { DAFTAR_SHORTCUT } from '/tmp/shortcut.mjs'
import { tulisUlangSet } from '/tmp/namaAnggota.mjs'

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

/* ---------------- 1. #23.1 — Geometri Midsets Per-Pemain ---------------- */
{
  const mentah = [
    { padaCount: 12, x: 99, y: 99 }, // luar batas counts=8 -> disaring
    { padaCount: 0, x: 1, y: 1 }, // pada 0 -> disaring
    { padaCount: 6, x: 10, y: 0 },
    { padaCount: 4, x: 0, y: 8 },
    { padaCount: 4, x: 0, y: 6 }, // duplikat count 4 -> entri terakhir menang
  ]
  const rapi = normalisasiMidsetsPemain(mentah, 8)
  cek(
    rapi.length === 2 && rapi[0].padaCount === 4 && rapi[0].y === 6 && rapi[1].padaCount === 6,
    'normalisasiMidsetsPemain menyaring hitungan tidak sah, mengurutkan naik, dan mendeduplikasi count kembar',
  )

  // Siku 90 derajat: (0,0) -> count 8 ke (0,6) -> count 16 ke (8,6)
  // Panjang L-path = 6 + 8 = 14 yd (lebih panjang dari diagonal lurus sqrt(64+36) = 10 yd)
  const awal = { x: 0, y: 0 }
  const akhir = { x: 8, y: 6 }
  const midSiku = [{ padaCount: 8, x: 0, y: 6 }]
  const [dx50, dy50] = deltaMidsets(awal, akhir, midSiku, 16, 0.5)
  cek(
    Math.abs(dx50 - 0) < 1e-6 && Math.abs(dy50 - 6) < 1e-6,
    'deltaMidsets tepat menyentuh titik singgah (0, 6) pada pertengahan hitungan 8/16',
  )

  const [dx25, dy25] = deltaMidsets(awal, akhir, midSiku, 16, 0.25)
  cek(
    Math.abs(dx25 - 0) < 1e-6 && Math.abs(dy25 - 3) < 1e-6,
    'deltaMidsets menginterpolasi segmen pertama secara presisi di hitungan 4/16 -> (0, 3)',
  )

  const diproyeksi = proyeksiMidsets(midSiku, 16, (x, y) => ({ x: 60 - x, y: 26 - y }))
  cek(
    diproyeksi.length === 1 && diproyeksi[0].x === 60 && diproyeksi[0].y === 20,
    'proyeksiMidsets memproyeksikan koordinat yard titik singgah ke ruang gambar SVG secara akurat',
  )

  const [dx75, dy75] = deltaMidsets(awal, akhir, midSiku, 16, 0.75)
  cek(
    Math.abs(dx75 - 4) < 1e-6 && Math.abs(dy75 - 6) < 1e-6,
    'deltaMidsets mengembalikan perpindahan relatif yang akurat di segmen kedua (hitungan 12/16 -> (4, 6))',
  )

  const pjg = panjangJalurMidsets(awal, akhir, midSiku, 16, 0)
  cek(
    Math.abs(pjg - 14) < 1e-4,
    `panjangJalurMidsets menghitung panjang lintasan siku 6+8 = 14 yd (terukur ${pjg.toFixed(3)} yd)`,
  )

  const svgD = pathSvgMidsets({ x: 60, y: 26 }, { x: 52, y: 20 }, [{ padaCount: 8, x: 60, y: 20 }], 16)
  cek(
    svgD.startsWith('M 60.000 26.000') &&
      svgD.includes('L 60.000 20.000') &&
      svgD.includes('L 52.000 20.000'),
    'pathSvgMidsets menghasilkan path multi-segmen SVG bersih untuk jejak belokan midset',
  )

  // Integrasi analitikSet: pemain bermidset jauh harus terukur 14 yd, bukan 10 yd lurus
  const s1 = {
    id: 's1',
    drillId: 'd1',
    order: 0,
    name: 'Set 1',
    counts: 16,
    points: { m1: { x: 0, y: 0 }, m2: { x: 0, y: 0 } },
    midsets: { m1: midSiku },
    createdAt: 1,
  }
  const s2 = {
    id: 's2',
    drillId: 'd1',
    order: 1,
    name: 'Set 2',
    counts: 8,
    points: { m1: { x: 8, y: 6 }, m2: { x: 8, y: 6 } },
    createdAt: 2,
  }
  const rosterDua = [
    { id: 'm1', code: 'T1', name: 'Andi', section: 'brass', instrument: 'Trumpet', active: true, createdAt: 1 },
    { id: 'm2', code: 'T2', name: 'Budi', section: 'brass', instrument: 'Trumpet', active: true, createdAt: 1 },
  ]
  const hslAnalitik = analisisPerpindahan(s1, s2, rosterDua, 5 / 8, 120, 1)
  const itemM1 = hslAnalitik.daftar.find((x) => x.id === 'm1')
  const itemM2 = hslAnalitik.daftar.find((x) => x.id === 'm2')
  cek(
    Math.abs((itemM1?.jarakYd ?? 0) - 14) < 0.05 && Math.abs((itemM2?.jarakYd ?? 0) - 10) < 0.05,
    'analitikSet menghitung jarak sesungguhnya 14 yd untuk pemain ber-midset sementara pemain lain tetap 10 yd lurus',
  )

  // Integrasi pecahSet: memecah di count 8 menempatkan m1 di (0, 6) dan membagi sisa midsets
  const dipecah = pecahSet({
    counts: 16,
    points: s1.points,
    tujuan: s2.points,
    di: 8,
    midsets: {
      m1: [
        { padaCount: 4, x: 0, y: 3 },
        { padaCount: 8, x: 0, y: 6 },
        { padaCount: 12, x: 4, y: 6 },
      ],
    },
  })
  cek(
    Boolean(dipecah) &&
      Math.abs(dipecah.tengah.m1.x - 0) < 1e-6 &&
      Math.abs(dipecah.tengah.m1.y - 6) < 1e-6 &&
      dipecah.midsetsPertama?.m1?.length === 1 &&
      dipecah.midsetsPertama.m1[0].padaCount === 4 &&
      dipecah.midsetsKedua?.m1?.length === 1 &&
      dipecah.midsetsKedua.m1[0].padaCount === 4,
    'pecahSet menjaga posisi belokan midset dan membagi midsets sebelum/sesudah titik pecah secara utuh',
  )

  // Integrasi namaAnggota (penggabungan ID anggota ganda ikut memindahkan midsets)
  const { set: setTulisUlang } = tulisUlangSet(s1, { m1: 'm1_baru' })
  cek(
    Boolean(setTulisUlang.midsets?.m1_baru) && !setTulisUlang.midsets?.m1,
    'tulisUlangSet ikut memigrasikan kunci midsets ketika anggota ganda digabung',
  )
}

/* ---------------- 2. #23.2 — Sistem Tags Lintas-Seksi Terpadu ---------------- */
{
  const parsed = uraiInputTag(' #Solois, Sayap Kiri ; solois ,  FTL Tuba ')
  cek(
    parsed.length === 3 && parsed[0] === 'Solois' && parsed[1] === 'Sayap Kiri' && parsed[2] === 'FTL Tuba',
    'uraiInputTag membersihkan tanda #, spasi ganda, dan duplikat tanpa membedakan huruf besar/kecil',
  )

  let agt = { id: 'a1', code: 'A1', name: 'Citra', section: 'pit', instrument: 'Marimba', active: true, createdAt: 1 }
  agt = pasangTagKeAnggota(agt, '#Solois')
  agt = pasangTagKeAnggota(agt, 'Kuartet Pembuka')
  cek(
    punyaTag(agt, 'solois') && punyaTag(agt, 'Kuartet Pembuka'),
    'pasangTagKeAnggota & punyaTag mengenali tag secara case-insensitive',
  )
  const dilepas = lepasTagDariAnggota(agt, 'SOLOIS')
  cek(
    !punyaTag(dilepas, 'Solois') && punyaTag(dilepas, 'Kuartet Pembuka'),
    'lepasTagDariAnggota menghapus tag sasaran tanpa merusak tag lain pada anggota tersebut',
  )

  const digabung = gabungDaftarTag(['Solois', 'Inti'], ['solois', 'Penutup'])
  cek(
    digabung?.length === 3 && digabung.includes('Penutup'),
    'gabungDaftarTag menyatukan tag dari dua entri anggota tanpa duplikat',
  )

  const kumpulan = kumpulkanTagRoster([
    agt,
    { id: 'a2', code: 'B1', name: 'Deni', section: 'brass', instrument: 'Tuba', active: true, tags: ['Solois'], createdAt: 2 },
  ])
  const entriSolois = kumpulan.find((k) => k.tag === 'Solois')
  cek(
    entriSolois?.memberIds.length === 2,
    'kumpulkanTagRoster menghimpun anggota lintas-seksi (Pit + Brass) di bawah satu tag bersama',
  )

  const gayaDrill = { Soloist: { warna: '#f43f5e' }, Solois: { warna: '#f59e0b', bentuk: 'intan' } }
  const gayaSet = { Solois: { warna: '#10b981', bentuk: 'segitiga' } }
  const hasilDrillSaja = gayaTitikPemain(agt, '#38bdf8', gayaDrill, undefined)
  const hasilTimpaSet = gayaTitikPemain(agt, '#38bdf8', gayaDrill, gayaSet)
  cek(
    hasilDrillSaja.warna === '#f59e0b' &&
      hasilDrillSaja.bentuk === 'intan' &&
      hasilTimpaSet.warna === '#10b981' &&
      hasilTimpaSet.bentuk === 'segitiga',
    'gayaTitikPemain mengutamakan timpaan tampilanTag per-set di atas tampilanTag level drill & warna seksi bawaan',
  )

  cek(
    PALET_WARNA_TAG.every((w) => /^#[0-9a-f]{6}$/i.test(w.hex)) &&
      poligonBentukTitik('intan', 50, 25, 2).split(' ').length === 4,
    'PALET_WARNA_TAG memakai 100% warna #hex murni dan poligonBentukTitik menghasilkan koordinat bentuk geometris valid',
  )

  const gerakSinkron = sinkronkanKelompokDariTag(
    [
      {
        id: 'klp1',
        nama: '#Solois',
        tag: 'Solois',
        memberIds: ['lama_saja'],
        jalur: 'lengkung',
        lengkung: 0.45,
      },
    ],
    [
      agt,
      { id: 'a2', code: 'B1', name: 'Deni', section: 'brass', instrument: 'Tuba', active: true, tags: ['Solois'], createdAt: 2 },
    ],
  )
  cek(
    gerakSinkron?.[0]?.memberIds.length === 2 &&
      gerakSinkron[0].memberIds.includes('a1') &&
      gerakSinkron[0].memberIds.includes('a2'),
    'sinkronkanKelompokDariTag menyegarkan daftar anggota sub-kelompok/FTL secara otomatis dari Member.tags',
  )
}

/* ---------------- 3. #23.3 — Mesin Pointer & Viewport Kanvas ---------------- */
{
  cek(
    peranPointerEfektif('otomatis', 'touch') === 'sentuh' &&
      peranPointerEfektif('otomatis', 'pen') === 'pena' &&
      peranPointerEfektif('otomatis', 'mouse') === 'tetikus' &&
      peranPointerEfektif('sentuh', 'mouse') === 'sentuh' &&
      peranPointerEfektif('tetikus', 'touch') === 'tetikus',
    'peranPointerEfektif menghormati deteksi otomatis pointerType sekaligus sakelar paksa Sentuh/Tetikus',
  )

  cek(
    aksiSeretKanvasKosong({ peran: 'sentuh', alat: 'select' }) === 'pan' &&
      aksiSeretKanvasKosong({ peran: 'tetikus', alat: 'select' }) === 'marquee' &&
      aksiSeretKanvasKosong({ peran: 'pena', alat: 'select' }) === 'marquee' &&
      aksiSeretKanvasKosong({ peran: 'sentuh', alat: 'lasso' }) === 'lasso' &&
      aksiSeretKanvasKosong({ peran: 'tetikus', alat: 'pan' }) === 'pan',
    'aksiSeretKanvasKosong mengubah seret 1 jari di kanvas kosong menjadi pan tanpa merusak marquee desktop/stylus maupun lasso',
  )

  const vpZoom = zoomSekitarTitik(VIEWPORT_AWAL, 2, 60, 26.665, 120, 53.33)
  const vbZoom = hitungViewBoxKanvas(vpZoom, 120, 53.33)
  cek(
    Math.abs(vpZoom.zoom - 2) < 1e-6 &&
      Math.abs(vbZoom.x + vbZoom.width / 2 - 60) < 0.05 &&
      Math.abs(vbZoom.y + vbZoom.height / 2 - 26.665) < 0.05,
    'zoomSekitarTitik & hitungViewBoxKanvas menjaga titik fokus tetap berada di bawah kursor/jari saat zoom 200%',
  )

  const vpCubit = hitungCubitDuaJari(
    { x: 300, y: 200 },
    { x: 500, y: 200 },
    { x: 200, y: 200 },
    { x: 600, y: 200 },
    VIEWPORT_AWAL,
    { left: 0, top: 0, width: 800, height: 400 },
    120,
    53.33,
  )
  cek(
    Math.abs(vpCubit.zoom - 2) < 0.05,
    `hitungCubitDuaJari menggandakan zoom menjadi ~2x saat rentang 2 jari melebar dari 200 px ke 400 px (zoom=${vpCubit.zoom})`,
  )

  const vpJepit = jepitViewport({ zoom: 99, panX: 9999, panY: -9999 }, 120, 53.33)
  cek(
    vpJepit.zoom === 4 && vpJepit.panX <= 120 && vpJepit.panY >= -10,
    'jepitViewport membatasi zoom maksimum 400% dan menahan lapangan agar tidak hilang keluar layar',
  )

  // Pada layar tablet lebar 720 px untuk viewBox 120 unit -> 6 px per unit SVG.
  // Target diameter sentuh >= 42 px berarti rSvg >= 3.5 unit (diameter >= 7 unit = 42 px).
  const rSentuh = hitungRadiusTangkapSvg(120, 720, 'sentuh', 1.35)
  const diameterPx = rSentuh * 2 * (720 / 120)
  cek(
    diameterPx >= 40,
    `hitungRadiusTangkapSvg menjamin diameter area tangkap sentuh >= 40 px di layar tablet (terukur ${diameterPx.toFixed(1)} px)`,
  )
}

/* ---------------- 4. #23.4 — Palet Perintah & Pintasan Terpadu ---------------- */
{
  const katalog = lengkapiReferensiPintasan(
    [
      {
        id: 'gandakan-set',
        label: 'Gandakan Set 1',
        kategori: 'Set & Navigasi',
        pintasan: 'Ctrl + D',
        kataKunci: ['duplikat', 'tambah set'],
        jalankan: () => {},
      },
      {
        id: 'mode-sentuh',
        label: 'Mode Input: Sentuh / Tablet',
        kategori: 'Tampilan & Mode',
        kataKunci: ['ipad', 'jari', 'touch'],
        jalankan: () => {},
      },
    ],
    DAFTAR_SHORTCUT,
  )
  cek(
    katalog.length > DAFTAR_SHORTCUT.length &&
      katalog.filter((x) => (x.pintasan || '').toLowerCase() === 'ctrl + d').length === 1,
    'lengkapiReferensiPintasan menyatukan aksi aktif & referensi DAFTAR_SHORTCUT tanpa menggandakan pintasan yang sudah beraksi',
  )

  const cariDuplikat = saringPerintahPalet(katalog, 'duplikat')
  const cariIpad = saringPerintahPalet(katalog, 'ipad')
  const cariPanah = saringPerintahPalet(katalog, 'panah')
  cek(
    cariDuplikat[0]?.id === 'gandakan-set' &&
      cariIpad[0]?.id === 'mode-sentuh' &&
      cariPanah.length >= 1,
    'saringPerintahPalet menemukan aksi lewat sinonim kataKunci maupun baris referensi pintasan keyboard',
  )
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
