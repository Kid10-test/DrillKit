/**
 * N12 — pemeriksaan kesehatan situs, dijalankan DARI DALAM aplikasi.
 *
 * Mengapa ini perlu, padahal sudah ada `scripts/periksa-situs.sh`:
 * skrip itu butuh terminal dan `curl`. Pelatih yang memakai aplikasi
 * ini tidak selalu punya keduanya — dan keadaan yang paling perlu
 * diperiksa justru muncul saat ia hanya memegang HP.
 *
 * Pemeriksaan di sini bersifat **situs**, bukan perangkat, jadi hasilnya
 * berlaku untuk semua orang yang membuka alamat yang sama. Itu sebabnya
 * pemeriksaan dari HP pelatih bisa menjelaskan mengapa HP anggotanya
 * yang gagal: penyebabnya (berkas yang hilang, `sw.js` yang boleh
 * disimpan perambah) sama bagi semua orang.
 *
 * Modul ini **murni**: ia tidak menyentuh `fetch`, tidak menyentuh
 * `document`, dan tidak pernah melempar galat keluar. Semua pengambilan
 * dilewatkan lewat `Ambil`, sehingga seluruh keadaan — termasuk
 * "situsnya tidak menjawab sama sekali" — bisa diuji tanpa peramban.
 */

export type KeadaanSitus = 'baik' | 'peringatan' | 'gagal'

export interface HasilPeriksa {
  id: string
  judul: string
  keadaan: KeadaanSitus
  /** Apa yang ditemukan, ditulis untuk dibaca manusia. */
  rincian: string
  /** Apa yang harus dilakukan bila keadaannya tidak baik. */
  saran?: string
}

/** Satu balasan, sudah diratakan supaya modul ini tidak butuh `Response`. */
export interface Ambilan {
  status: number
  /** `content-type`, huruf kecil. */
  jenis: string
  /** Isi berkas — kosong bila diminta dengan `HEAD`. */
  teks: string
  /** `cache-control`, huruf kecil. */
  cacheKontrol: string
}

/**
 * Fungsi pengambil. Sengaja diberikan dari luar: modul ini bisa diuji
 * dengan pengambil pura-pura, dan pemanggilnya bebas memilih antara
 * `HEAD` (untuk sekadar mengecek ada-tidaknya) dan `GET` (bila isinya
 * memang perlu dibaca).
 */
export type Ambil = (alamat: string, metode?: 'GET' | 'HEAD') => Promise<Ambilan>

/** Alamat yang sengaja tidak ada, untuk menguji pengalih situsnya. */
export const ALAMAT_PERIKSA_ALIH = '__drillkit-periksa-alihtujuan__'

function pesan(e: unknown): string {
  return e instanceof Error && e.message ? e.message : String(e)
}

/**
 * Petik semua berkas `assets/` yang disebut `index.html`.
 *
 * Inilah pemeriksaan yang paling menentukan. Kegagalan yang pernah
 * dilaporkan bukan "situsnya mati", melainkan: perambah menyimpan
 * `index.html` lama, lalu meminta berkas ber-hash yang sudah dihapus
 * unggahan berikutnya. Jadi yang harus diperiksa bukan isi folder di
 * komputer pelatih, melainkan apa yang diminta `index.html` **yang
 * sedang melayani saat ini**.
 */
export function petikAset(teks: string): string[] {
  const cocok = teks.match(/assets\/[A-Za-z0-9_.@-]+\.(?:js|css)/g) ?? []
  // Berkas yang sama bisa disebut lebih dari sekali (modul + pramuat).
  return [...new Set(cocok.map((a) => a.replace(/^\.?\//, '')))]
}

/**
 * Apakah berkas ini boleh disimpan perambah?
 *
 * Dua berkas yang namanya TIDAK ber-hash — `index.html` dan `sw.js` —
 * adalah sumber utama keadaan "link rusak". Bila keduanya boleh
 * disimpan, perambah akan meminta berkas lama yang sudah tiada.
 */
function periksaCache(id: string, nama: string, cacheKontrol: string): HasilPeriksa {
  const aman = /no-store|no-cache/.test(cacheKontrol)
  return {
    id,
    judul: `${nama} tidak disimpan perambah`,
    keadaan: aman ? 'baik' : 'peringatan',
    rincian: aman
      ? `Berkas ini selalu diminta ulang (${cacheKontrol || 'tanpa aturan ketat'}).`
      : `Berkas ini boleh disimpan perambah${cacheKontrol ? ` (${cacheKontrol})` : ''}.`,
    saran: aman
      ? undefined
      : `Berkas _headers belum berlaku di situs ini. Unggah ulang folder yang berisi _headers — tanpa itu perambah bisa meminta versi lama yang sudah dihapus, dan pemakai melihat "link rusak".`,
  }
}

/**
 * Jalankan semua pemeriksaan.
 *
 * Tidak pernah melempar galat: kegagalan pengambilan dicatat sebagai
 * hasil, bukan sebagai pengecualian. Alat diagnosis yang berhenti
 * berjalan pada keadaan terburuk tidak ada gunanya — justru pada
 * keadaan itulah ia dibutuhkan.
 */
export async function periksaSitus(ambil: Ambil): Promise<HasilPeriksa[]> {
  const hasil: HasilPeriksa[] = []
  let teksIndeks = ''

  /* ------------------------------- 1. index.html ------------------------------ */
  try {
    const r = await ambil('index.html', 'GET')
    teksIndeks = r.teks
    if (r.status !== 200) {
      hasil.push({
        id: 'indeks',
        judul: 'Halaman utama',
        keadaan: 'gagal',
        rincian: `Menjawab ${r.status}, bukan 200.`,
        saran:
          'Biasanya berarti folder yang diunggah salah tingkat: index.html harus berada di tingkat paling atas, bukan di dalam subfolder.',
      })
    } else if (!r.jenis.includes('text/html')) {
      hasil.push({
        id: 'indeks',
        judul: 'Halaman utama',
        keadaan: 'gagal',
        rincian: `Ada (200), tapi bukan HTML — jenisnya ${r.jenis || 'tidak disebut'}.`,
        saran: 'Periksa apakah yang terunggah benar-benar hasil build, bukan berkas lain.',
      })
    } else {
      hasil.push({
        id: 'indeks',
        judul: 'Halaman utama',
        keadaan: 'baik',
        rincian: 'Menjawab 200 dan berupa HTML.',
      })
    }
    hasil.push(periksaCache('indeks-cache', 'index.html', r.cacheKontrol))
  } catch (e) {
    hasil.push({
      id: 'indeks',
      judul: 'Halaman utama',
      keadaan: 'gagal',
      rincian: `Tidak bisa diambil sama sekali (${pesan(e)}).`,
      saran: 'Periksa koneksi internet perangkat ini, lalu coba lagi.',
    })
  }

  /* --------------------------- 2. sw.js & cache-nya --------------------------- */
  try {
    const r = await ambil('sw.js', 'HEAD')
    hasil.push(
      r.status !== 200
        ? {
            id: 'sw',
            judul: 'Pekerja layanan (sw.js)',
            keadaan: 'peringatan',
            rincian: `Menjawab ${r.status}. Aplikasi tidak akan bisa dibuka tanpa koneksi.`,
            saran: 'Unggah ulang SELURUH folder hasil build, bukan sebagian berkas.',
          }
        : {
            id: 'sw',
            judul: 'Pekerja layanan (sw.js)',
            keadaan: 'baik',
            rincian: 'Ada.',
          },
    )
    hasil.push(periksaCache('sw-cache', 'sw.js', r.cacheKontrol))
  } catch (e) {
    hasil.push({
      id: 'sw',
      judul: 'Pekerja layanan (sw.js)',
      keadaan: 'peringatan',
      rincian: `Tidak bisa diperiksa (${pesan(e)}).`,
    })
  }

  /* ---------------------- 3. berkas yang diminta index.html ------------------- */
  {
    const aset = petikAset(teksIndeks)
    if (aset.length === 0) {
      hasil.push({
        id: 'aset',
        judul: 'Berkas aplikasi',
        keadaan: 'peringatan',
        rincian: 'Tidak ada berkas assets/ yang terbaca dari halaman utama.',
        saran: 'Struktur hasil build berubah. Periksa sendiri isi index.html di situs.',
      })
    } else {
      const hilang: string[] = []
      for (const a of aset) {
        try {
          const r = await ambil(a, 'HEAD')
          if (r.status !== 200) hilang.push(`${a} (${r.status})`)
        } catch {
          hilang.push(a)
        }
      }
      hasil.push(
        hilang.length === 0
          ? {
              id: 'aset',
              judul: 'Berkas aplikasi',
              keadaan: 'baik',
              rincian: `Semua ${aset.length} berkas yang diminta halaman utama ada.`,
            }
          : {
              id: 'aset',
              judul: 'Berkas aplikasi',
              keadaan: 'gagal',
              rincian: `${hilang.length} dari ${aset.length} berkas yang diminta halaman utama TIDAK ADA: ${hilang.join(', ')}`,
              saran:
                'Pemakai yang menyimpan versi lama akan melihat "link rusak". Unggah ulang SELURUH folder — sekali unggah adalah penggantian, bukan penambahan.',
            },
      )
    }
  }

  /* ------------------------------- 4. paket.json ------------------------------ */
  /*
   * `paket.json` TIDAK pernah ikut di dalam hasil build. Sekali unggah
   * adalah penggantian, jadi berkas ini mudah sekali ikut terhapus —
   * dan tanpa berkasnya tombol "Perbarui" di HP seluruh anggota mati,
   * tanpa ada yang tampak rusak di aplikasinya.
   */
  try {
    const r = await ambil('paket.json', 'HEAD')
    const html = r.jenis.includes('text/html')
    if (r.status === 200 && !html) {
      hasil.push({
        id: 'paket',
        judul: 'Berkas materi (paket.json)',
        keadaan: 'baik',
        rincian: 'Ada dan berbentuk berkas materi.',
      })
    } else {
      hasil.push({
        id: 'paket',
        judul: 'Berkas materi (paket.json)',
        keadaan: 'peringatan',
        rincian:
          r.status === 200 && html
            ? 'Alamatnya menjawab halaman aplikasi, bukan berkas materi — berarti berkasnya tidak ada di situs.'
            : `Tidak ada di situs (menjawab ${r.status}).`,
        saran:
          'Tombol "Perbarui" di HP anggota belum akan jalan. Terbitkan dari menu Berbagi, atau salin paket.json ke sebelah index.html. Kalau situs memakai Vercel, rewrite /paket.json ke berkas mentah di repo materi supaya berkas ini tidak ikut terhapus setiap kali aplikasi diperbarui.',
      })
    }
  } catch (e) {
    hasil.push({
      id: 'paket',
      judul: 'Berkas materi (paket.json)',
      keadaan: 'peringatan',
      rincian: `Tidak bisa diperiksa (${pesan(e)}).`,
    })
  }

  /* --------------------- 5. pengalih untuk alamat yang tidak ada -------------- */
  /*
   * Aplikasi memakai HashRouter, jadi aturan ini bukan untuk routing.
   * Gunanya: bila perambah meminta berkas lama yang sudah tiada, ia
   * menerima halaman aplikasi dan bisa menampilkan panel daruratnya —
   * bukan halaman 404 yang tidak bisa dijelaskan kepada anak-anak.
   */
  try {
    const r = await ambil(ALAMAT_PERIKSA_ALIH, 'HEAD')
    hasil.push(
      r.status === 200
        ? {
            id: 'alih',
            judul: 'Pengalih untuk alamat yang tidak ada',
            keadaan: 'baik',
            rincian: 'Alamat yang tidak ada dikembalikan ke aplikasi.',
          }
        : {
            id: 'alih',
            judul: 'Pengalih untuk alamat yang tidak ada',
            keadaan: 'peringatan',
            rincian: `Menjawab ${r.status}, bukan 200 — berkas _redirects belum berlaku.`,
            saran:
              'Tanpa berkas ini, perambah yang meminta berkas lama akan melihat halaman "link rusak" alih-alih panel darurat aplikasi.',
          },
    )
  } catch {
    // Kegagalan pada pemeriksaan ini tidak menambah pengetahuan apa pun.
  }

  return hasil
}

/** Ringkasan satu baris: ada berapa yang tidak baik. */
export function ringkasPeriksa(hasil: HasilPeriksa[]): string {
  const gagal = hasil.filter((h) => h.keadaan === 'gagal').length
  const peringatan = hasil.filter((h) => h.keadaan === 'peringatan').length
  if (gagal === 0 && peringatan === 0) return 'Semua pemeriksaan baik.'
  const bagian: string[] = []
  if (gagal > 0) bagian.push(`${gagal} gagal`)
  if (peringatan > 0) bagian.push(`${peringatan} peringatan`)
  return bagian.join(', ') + '.'
}

/** Apakah aplikasi dijalankan dari berkas (portable), bukan dari situs? */
export function dariBerkas(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'file:'
}
