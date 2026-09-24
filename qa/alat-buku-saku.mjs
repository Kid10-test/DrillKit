/**
 * Alat bersama untuk tujuh rangkaian uji buku saku:
 *
 *     dd8 · dd8b · dd9-kompas · dd10b-kartu · dd10b-mode · dd10b-override · kartu-lipat
 *
 * 2b — pembaca pratinjaunya mengenal kartu lipat (`.kartu` bermuka dua,
 * digabung menjadi satu kartu per pemain) dan lembar A4 (`section.page`).
 *
 * **Ini bukan rangkaian uji.** Jangan didaftarkan ke `regresi-penuh.sh` —
 * sama seperti `sambutan.mjs` dan `db-mentah.mjs`, berkas ini tidak menguji
 * apa pun sendirian.
 *
 * ## Mengapa ada (2a, 23 Sep 2026)
 *
 * Keenam rangkaian di atas mati bersama-sama karena satu sebab: layar
 * sambutan `PilihMode` menutupi aplikasi di setiap profil Puppeteer yang
 * baru, jadi klik pertama tidak mengenai apa pun. Tetapi mereka tidak pernah
 * GAGAL. Mereka ditulis sebagai skrip pengintai — `console.log(JSON.stringify(R))`
 * tanpa satu asersi pun — sehingga yang tercetak hanya `{"buka": false, ...}`
 * dengan kode keluar 0. Tidak ada baris "N lulus, M gagal"; `regresi.sh`
 * mencatatnya "(tanpa ringkasan)" dan orang melewatinya begitu saja.
 *
 * Karena itu alat ini menjamin tiga hal:
 *
 * 1. **Selalu ada baris "N lulus, M gagal".** Juga ketika rangkaiannya mogok
 *    di tengah jalan: mogok dihitung satu kegagalan, lengkap dengan
 *    sebabnya, dan kode keluarnya 1.
 * 2. **Langkah yang gagal menghentikan rangkaian dengan terang.** Pratinjau
 *    yang tidak muncul, jendela yang tidak terbuka, titik yang tidak ada —
 *    semuanya melempar galat berkalimat jelas, bukan diam-diam mengembalikan
 *    `null` untuk dibaca asersi berikutnya.
 * 3. **Kolom dicari lewat JUDULNYA, kartu lewat NAMA pemainnya.** Dua hal
 *    yang dulu diandaikan dan ternyata tidak benar lagi — lihat `sel()` dan
 *    `kartuMilik()`.
 *
 * Pakai:
 *
 *     import { jalankan } from './alat-buku-saku.mjs'
 *     await jalankan('judul', async (t) => { await t.siapkan(); t.cek(...) })
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { bacaSemua } from './db-mentah.mjs'

/*
 * N8 — lingkungan menang (`regresi.sh` mengirim alamat lewat `BASE`), argumen
 * tetap berlaku untuk dijalankan sendiri. N14 — bawaannya versi jadi (:4173):
 * server pengembangan (:5173) kehabisan memori di kotak pasir.
 */
export const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
/** Berkas portabel (`file://…/DrillKit.html`) dibuka apa adanya; situs diberi garis miring. */
const ALAMAT = /\.html?$/i.test(BASE) ? BASE : `${BASE}/`

export const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

/** Batas waktu satu rangkaian (detik); lihat `jalankan()`. */
const BATAS_DETIK = Number(process.env.BATAS_DETIK) || 240

/** Judul jendela (modal) yang dipakai rangkaian — dicocokkan dengan awalannya. */
export const JENDELA = {
  bukuSaku: 'Dot sheet & buku saku',
  pratinjau: 'Pratinjau hasil cetak',
  setelan: 'Pengaturan drill',
  detail: 'Detail —',
}

/** Langkah yang gagal: hentikan rangkaian dengan kalimat yang jelas. */
function langkah(ok, pesan) {
  if (!ok) throw new Error(pesan)
}

/* ------------------------------------------------------------------------ */
/*  Pembacaan hasil cetak — murni, dipakai di Node                           */
/* ------------------------------------------------------------------------ */

/** Angka pertama di dalam teks sel (`"13 ↘"` → 13, `"22.5″"` → 22,5, `"-"` → NaN). */
export function angka(teks) {
  const m = String(teks ?? '').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

/**
 * Sel pada baris `iBaris`, dicari lewat **judul kolomnya**.
 *
 * Rangkaian aslinya membaca "sel terakhir" dan menganggapnya `Lk/cnt`. Itu
 * benar di DD8 — lalu DD10b menambah kolom `Ukuran langkah` di belakangnya,
 * dan sejak itu dd8/dd8b diam-diam membaca kolom yang salah. Posisi kolom
 * berubah setiap kali buku saku bertambah isi; judulnya tidak.
 */
export function sel(kartu, iBaris, judul) {
  const i = kartu.kepala.indexOf(judul)
  if (i < 0) return null
  return kartu.baris[iBaris]?.[i] ?? null
}

/**
 * Kartu milik satu pemain, dicari lewat **namanya**.
 *
 * Urutan kartu mengikuti urutan anggota di IndexedDB, yaitu urutan `id` —
 * dan `id` dibuat dengan akhiran acak (`uid()`). Jadi "kartu pertama" adalah
 * pemain yang berbeda di setiap perangkat baru: DD8 mencatat angka Eka,
 * DD8b angka Andra, dari rangkaian yang sama-sama membaca kartu pertama.
 */
export function kartuMilik(daftar, nama) {
  return daftar.find((k) => k.nama === nama) ?? null
}

/** Perpindahan pertama (Set 1 → Set 2) pada satu kartu, sudah diurai. */
export function gerakPertama(kartu) {
  const ambil = (judul) => sel(kartu, 0, judul)
  // Judulnya "Langkah & arah" bila panah dicetak, "→ langkah" bila tidak.
  const lk = ambil('Langkah & arah') ?? ambil('→ langkah')
  const lpc = ambil('Lk/cnt')
  const uk = ambil('Ukuran langkah')
  return {
    cnt: angka(ambil('Cnt')?.teks),
    koordinat: ambil('Koordinat')?.teks ?? null,
    langkah: angka(lk?.teks),
    panah: lk?.teks.match(/[→↘↓↙←↖↑↗]/g) ?? [],
    lpc: lpc ? angka(lpc.teks) : null,
    lpcTeks: lpc?.teks ?? null,
    lpcHtml: lpc?.html ?? null,
    ukuran: uk ? angka(uk.teks) : null,
    ukuranTeks: uk?.teks ?? null,
    ukuranHtml: uk?.html ?? null,
  }
}

/** Warna yang dipakai sebuah sel (`style="color:…"`), atau `null` bila hitam biasa. */
export function warnaSel(html) {
  const m = String(html ?? '').match(/color:\s*(#[0-9a-f]{3,8}|[a-z]+)/i)
  return m ? m[1].toLowerCase() : null
}

/**
 * Warna "berat" & "mustahil" menurut **legenda kartu itu sendiri**.
 *
 * Sengaja dibaca dari kertasnya, bukan disalin dari `TINGKAT_WARNA`: yang
 * diuji adalah apa yang dilihat pemain — angka merah di tabel harus sama
 * merahnya dengan kata "mustahil" di bawahnya.
 */
export function warnaLegenda(kartu) {
  const hasil = {}
  for (const html of kartu.legendaHtml) {
    for (const m of html.matchAll(/color:\s*(#[0-9a-f]{3,8}|[a-z]+)[^>]*>\s*(berat|mustahil)\s*</gi)) {
      hasil[m[2].toLowerCase()] = m[1].toLowerCase()
    }
  }
  return hasil
}

/**
 * Apakah `Lk/cnt` sejalan dengan "Langkah ÷ Cnt"?
 *
 * Bukan selisih tetap 0,02 seperti rangkaian aslinya. Angka langkah dicetak
 * DIBULATKAN ke bilangan bulat, sedangkan `Lk/cnt` dihitung dari jarak yang
 * belum dibulatkan lalu dibulatkan ke dua desimal. Selisih yang jujur karena
 * itu bisa mencapai ½ ÷ Cnt + 0,005 — untuk 16 hitungan 0,036. Dengan batas
 * 0,02, tujuh dari delapan belas kartu data contoh akan "gagal" padahal
 * angkanya benar: 8,49 langkah dicetak "8" dengan Lk/cnt 0,53, sedangkan
 * 8 ÷ 16 = 0,50.
 *
 * Berlaku bila tidak ada **tunda mulai per section** (DD2) — data contoh
 * tidak memakainya. Tunda memotong waktu yang tersedia, sehingga Lk/cnt
 * memang sengaja lebih besar daripada Langkah ÷ Cnt yang tercetak.
 */
export function lkCntSejalan(langkah, cnt, lpc) {
  if (![langkah, cnt, lpc].every(Number.isFinite) || cnt <= 0) return false
  return Math.abs(langkah / cnt - lpc) <= 0.5 / cnt + 0.005 + 1e-9
}

/** Tempo & ketukan per hitungan yang tercetak di kepala kartu. */
export function tempoKartu(kartu) {
  for (const s of kartu.sub) {
    const m = s.match(/(\d+(?:\.\d+)?) BPM · (\d+(?:\.\d+)?) ketuk\/count/)
    if (m) return { tempo: Number(m[1]), ketuk: Number(m[2]) }
  }
  return null
}

/**
 * Baca semua kartu di dalam pratinjau. Dijalankan DI DALAM bingkai, jadi
 * harus mandiri — `evaluate` hanya mengirim fungsi ini, bukan isi modulnya.
 */
function bacaKartuDiBingkai() {
  const bersih = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const bacaBaris = (akar) =>
    akar
      ? [...akar.querySelectorAll('tbody tr')].map((tr) =>
          [...tr.children].map((td) => ({ teks: bersih(td.textContent), html: td.innerHTML.trim() })),
        )
      : []
  const bacaKepala = (akar) => {
    const t = akar && akar.querySelector('table')
    return t ? [...t.querySelectorAll('thead th')].map((th) => bersih(th.textContent)) : []
  }
  const bacaKompas = (akar) => {
    const kompas = akar && akar.querySelector('.kompas')
    // Label mata angin (teks SVG) dan keterangannya, dibaca terpisah.
    return kompas
      ? {
          label: [...kompas.querySelectorAll('svg text')].map((x) => bersih(x.textContent)),
          teks: bersih(kompas.querySelector(':scope > div') ? kompas.querySelector(':scope > div').textContent : ''),
        }
      : null
  }
  /*
   * 2b — kartu lipat: tiap pemain punya satu `.kartu` bermuka dua (atau
   * lebih bila show-nya panjang). Baris digabung sesuai urutan cetak —
   * muka depan dulu, lalu muka belakang, kartu demi kartu — supaya
   * pemeriksaannya tetap "satu kartu per pemain". Kompas dibaca dari muka
   * depan kartu pertama, keterangan dari muka belakang kartu terakhir.
   */
  const lipat = [...document.querySelectorAll('.kartu')]
  if (lipat.length) {
    const perPemain = new Map()
    for (const sec of lipat) {
      const depan = sec.querySelector('.muka.depan')
      const belakang = sec.querySelector('.muka:not(.depan)')
      const h2 = depan && depan.querySelector('h2')
      const nama = h2 && h2.firstChild ? bersih(h2.firstChild.textContent) : ''
      const satu = {
        nama,
        kode: bersih(h2 && h2.querySelector('.code') ? h2.querySelector('.code').textContent : ''),
        sub: depan ? [...depan.querySelectorAll('header .sub')].map((x) => bersih(x.textContent)) : [],
        kepala: bacaKepala(depan),
        baris: [...bacaBaris(depan), ...bacaBaris(belakang)],
        kompas: bacaKompas(depan),
        legenda: belakang ? [...belakang.querySelectorAll('.legend')].map((e) => bersih(e.textContent)) : [],
        legendaHtml: belakang ? [...belakang.querySelectorAll('.legend')].map((e) => e.innerHTML) : [],
      }
      const ada = perPemain.get(nama)
      if (ada) {
        ada.baris.push(...satu.baris)
        ada.legenda = satu.legenda
        ada.legendaHtml = satu.legendaHtml
      } else {
        perPemain.set(nama, satu)
      }
    }
    return [...perPemain.values()]
  }
  return [...document.querySelectorAll('section.page')].map((sec) => {
    const h2 = sec.querySelector('h2')
    const legenda = [...sec.querySelectorAll('.legend')]
    return {
      nama: h2 && h2.firstChild ? bersih(h2.firstChild.textContent) : '',
      kode: bersih(h2 && h2.querySelector('.code') ? h2.querySelector('.code').textContent : ''),
      sub: [...sec.querySelectorAll('header .sub')].map((x) => bersih(x.textContent)),
      kepala: bacaKepala(sec),
      baris: bacaBaris(sec),
      kompas: bacaKompas(sec),
      legenda: legenda.map((e) => bersih(e.textContent)),
      legendaHtml: legenda.map((e) => e.innerHTML),
    }
  })
}

/** Baca panel Detail pemain. Dijalankan di dalam halaman — mandiri. */
function bacaDetailDiHalaman() {
  const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith('Detail —'))
  if (!h) return null
  const panel = h.closest('.relative')
  const t = panel && panel.querySelector('table')
  if (!t) return null
  const bersih = (s) => (s || '').replace(/\s+/g, ' ').trim()
  return {
    nama: bersih(h.textContent.replace('Detail —', '')),
    kepala: [...t.querySelectorAll('thead th')].map((th) => bersih(th.textContent)),
    baris: [...t.querySelectorAll('tbody tr')].map((tr) => {
      const btn = tr.querySelector('td:last-child button')
      return {
        sel: [...tr.children].map((td) => bersih(td.textContent)),
        mode: btn ? bersih(btn.textContent) : null,
        // DD10b — perpindahan yang ditimpa ditandai biru.
        ditandai: btn ? btn.className.includes('bg-sky-500/20') : null,
      }
    }),
  }
}

/** Satu baris panel Detail, diurai lewat judul kolomnya. */
export function barisDetail(detail, i = 0) {
  const b = detail?.baris[i]
  if (!b) return null
  const ambil = (judul) => {
    const k = detail.kepala.indexOf(judul)
    return k < 0 ? null : b.sel[k]
  }
  return {
    perpindahan: ambil('Perpindahan'),
    cnt: angka(ambil('Cnt')),
    langkah: angka(ambil('Langkah')),
    lpc: angka(ambil('Lk/cnt')),
    lpm: angka(ambil('Lk/mnt')),
    ukuran: angka(ambil('Ukuran')),
    ukuranTeks: ambil('Ukuran'),
    mode: b.mode,
    ditandai: b.ditandai,
    // Semua angka tanpa tombol mode — untuk membandingkan dua keadaan.
    angka: b.sel.slice(0, -1),
  }
}

/* ------------------------------------------------------------------------ */
/*  Langkah-langkah di peramban                                              */
/* ------------------------------------------------------------------------ */

function alatHalaman(p) {
  /** Adakah jendela berjudul (awalan) ini? */
  const jendelaAda = (judul) =>
    p.evaluate((j) => [...document.querySelectorAll('h3')].some((h) => h.textContent.trim().startsWith(j)), judul)

  /** Tunggu jendela muncul (`ada = true`) atau hilang (`ada = false`). */
  const tungguJendela = (judul, ada = true, ms = 8000) =>
    p
      .waitForFunction(
        (j, a) => [...document.querySelectorAll('h3')].some((h) => h.textContent.trim().startsWith(j)) === a,
        { timeout: ms },
        judul,
        ada,
      )
      .then(
        () => true,
        () => false,
      )

  /**
   * Klik tombol lewat teksnya. `jendela` membatasi pencarian ke satu jendela,
   * supaya "Simpan" di Pengaturan drill tidak tertukar dengan "Simpan" milik
   * panel lain yang kebetulan terbuka.
   */
  const klikTeks = (teks, { jendela = null, tepat = true } = {}) =>
    p.evaluate(
      (t, j, tp) => {
        let akar = document
        if (j) {
          const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
          akar = h && h.closest('.relative')
          if (!akar) return false
        }
        const el = [...akar.querySelectorAll('button')].find((b) =>
          tp ? b.textContent.trim() === t : b.textContent.includes(t),
        )
        if (!el || el.disabled) return false
        el.click()
        return true
      },
      teks,
      jendela,
      tepat,
    )

  /** Tunggu editor drill menampilkan 18 titik data contoh; kembalikan jumlahnya. */
  const tungguTitik = () =>
    p
      .waitForFunction(
        () => {
          const n = document.querySelectorAll('circle[data-titik="1"]').length
          return n >= 18 ? n : 0
        },
        { timeout: 20000 },
      )
      .then(
        (h) => h.jsonValue(),
        () => 0,
      )

  /**
   * Muat ulang halaman editor. Dipakai untuk membuktikan sesuatu benar-benar
   * TERSIMPAN — bukan sekadar masih hidup di memori komponen.
   */
  async function muatUlangEditor() {
    await p.reload({ waitUntil: 'networkidle2' })
    const n = await tungguTitik()
    langkah(n === 18, `setelah dimuat ulang, editor drill tidak menampilkan 18 titik (dapat ${n})`)
    await tunggu(500)
  }

  /**
   * Buka aplikasi di perangkat uji yang baru, lewati layar sambutan, muat
   * data contoh, lalu buka editor drill. Setiap langkahnya DIPERIKSA — kalau
   * satu saja gagal, rangkaian berhenti di sini dengan sebab yang jelas.
   */
  async function siapkan() {
    await p.goto(ALAMAT, { waitUntil: 'networkidle2' })
    /*
     * Layar sambutan muncul di setiap profil baru. `lewatSambutan` menjadikan
     * perangkat uji ini "perangkat milik pelatih" — keadaan sesudah pelatih
     * memilih sekali — lalu memuat ulang. Bukan jalan pintas yang
     * menyembunyikan cacat: layar itu sendiri diuji oleh `sambutan-mode`.
     */
    await lewatSambutan(p)
    langkah(
      !(await p.$('[data-testid="sambutan-mode"]')),
      'layar sambutan masih menutupi aplikasi setelah lewatSambutan()',
    )

    const adaTombol = await p
      .waitForFunction(
        () => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Muat data contoh')),
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      )
    langkah(adaTombol, 'tombol "Muat data contoh" tidak ada — perangkat uji tidak kosong?')
    await klikTeks('Muat data contoh', { tepat: false })
    await p.waitForFunction(() => document.body.innerText.includes('Data contoh dimuat'), { timeout: 10000 }).catch(() => {})

    await p.evaluate(() => {
      location.hash = '#/drill'
    })
    const n = await tungguTitik()
    langkah(n === 18, `editor drill tidak menampilkan 18 titik data contoh (dapat ${n})`)

    /*
     * Tunggu pesan "Data contoh dimuat" HILANG. Pesan itu melayang di bagian
     * bawah layar selama ~3 detik dan menerima klik; titik yang diklik dengan
     * tetikus di bawahnya bisa meleset mengenai pesannya.
     */
    await p.waitForFunction(() => !document.body.innerText.includes('Data contoh dimuat'), { timeout: 8000 }).catch(() => {})
    await tunggu(400)
    console.log('    · persiapan: sambutan dilewati, data contoh termuat, 18 titik di editor drill')
  }

  /* ---------------------------- buku saku ---------------------------- */

  async function bukaBukuSaku() {
    if (await jendelaAda(JENDELA.bukuSaku)) return
    const ok = await p.evaluate(() => {
      const el = document.querySelector('button[title="Kartu/dot sheet per pemain"]')
      if (!el) return false
      el.click()
      return true
    })
    langkah(ok, 'tombol "Kartu" (dot sheet & buku saku) tidak ada di editor drill')
    langkah(await tungguJendela(JENDELA.bukuSaku), 'jendela "Dot sheet & buku saku" tidak terbuka')
  }

  /** Keadaan kotak centang di jendela buku saku (`null` bila tidak ada). */
  const statusCentang = (label) =>
    p.evaluate(
      (l, j) => {
        const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
        const panel = h && h.closest('.relative')
        const lab = panel && [...panel.querySelectorAll('label')].find((x) => x.textContent.includes(l))
        const cb = lab && lab.querySelector('input[type="checkbox"]')
        return cb ? cb.checked : null
      },
      label,
      JENDELA.bukuSaku,
    )

  /** Nyalakan/matikan kotak centang di jendela buku saku; kembalikan keadaan akhirnya. */
  async function centang(label, nilai) {
    await bukaBukuSaku()
    const sekarang = await statusCentang(label)
    langkah(sekarang !== null, `kotak centang "${label}" tidak ada di jendela buku saku`)
    if (sekarang !== nilai) {
      await p.evaluate(
        (l, j) => {
          const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
          const lab = [...h.closest('.relative').querySelectorAll('label')].find((x) => x.textContent.includes(l))
          lab.querySelector('input[type="checkbox"]').click()
        },
        label,
        JENDELA.bukuSaku,
      )
      await tunggu(300)
    }
    return statusCentang(label)
  }

  /** Pilih pemain di buku saku lewat namanya; `null` = semua pemain. */
  async function pilihPemain(nama) {
    await bukaBukuSaku()
    const h = await p.evaluateHandle((j) => {
      const judul = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
      const panel = judul && judul.closest('.relative')
      return (
        (panel && [...panel.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'all'))) ||
        null
      )
    }, JENDELA.bukuSaku)
    const pilihan = h.asElement()
    langkah(pilihan, 'pilihan "Pemain" tidak ada di jendela buku saku')
    const nilai = await pilihan.evaluate((s, n) => {
      // Teks pilihannya "KODE — Nama". Dicocokkan TEPAT pada namanya: "Kirana"
      // ada di dua nama pemain contoh (Indah Kirana, Kirana Ayu).
      const namaDari = (o) => o.textContent.split(' — ').slice(1).join(' — ').trim()
      const o = n ? [...s.options].find((x) => namaDari(x) === n) : [...s.options].find((x) => x.value === 'all')
      return o ? o.value : null
    }, nama)
    langkah(nilai, `pemain "${nama}" tidak ada di pilihan buku saku`)
    await pilihan.select(nilai)
    await tunggu(300)
  }

  /**
   * Klik Pratinjau lalu baca SEMUA kartu di dalam bingkai pratinjau.
   * `pemain`: nama pemain, `null` untuk semua, atau biarkan kosong untuk
   * memakai pilihan yang sedang aktif.
   */
  async function pratinjau({ pemain } = {}) {
    await bukaBukuSaku()
    /*
     * Pratinjau yang masih terbuka harus ditutup dulu. Kalau tidak, bingkai
     * lamanya langsung "ditemukan" dan isinya terbaca sebelum isi baru
     * sempat dimuat — hasilnya kartu dari keadaan sebelumnya.
     */
    if (await jendelaAda(JENDELA.pratinjau)) await tutupPratinjau()
    if (pemain !== undefined) await pilihPemain(pemain)
    langkah(await klikTeks('Pratinjau', { jendela: JENDELA.bukuSaku }), 'tombol Pratinjau tidak ada di jendela buku saku')
    const el = await p.waitForSelector('iframe[title="Pratinjau cetak"]', { timeout: 8000 }).catch(() => null)
    langkah(el, 'pratinjau cetak tidak muncul setelah tombol Pratinjau diklik')
    const bingkai = await el.contentFrame()
    langkah(bingkai, 'bingkai pratinjau tidak bisa dibaca')
    const ada = await bingkai.waitForSelector('section.page table, .kartu table', { timeout: 8000 }).then(
      () => true,
      () => false,
    )
    langkah(ada, 'pratinjau tampil tetapi tidak berisi tabel kartu')
    /*
     * Tabel PERTAMA sudah ada belum berarti semua kartu sudah ada: dokumen
     * 18 kartu diurai bertahap, dan membacanya di tengah jalan menghasilkan
     * kartu yang kurang — kegagalan acak yang tidak ada sangkut pautnya
     * dengan yang diuji. Tunggu dokumennya selesai.
     */
    const selesai = await bingkai.waitForFunction(() => document.readyState === 'complete', { timeout: 8000 }).then(
      () => true,
      () => false,
    )
    langkah(selesai, 'pratinjau tidak selesai dimuat')
    return bingkai.evaluate(bacaKartuDiBingkai)
  }

  /** Tutup pratinjau saja; jendela buku saku tetap terbuka. */
  async function tutupPratinjau() {
    langkah(await klikTeks('Tutup', { jendela: JENDELA.pratinjau }), 'tombol Tutup pratinjau tidak ada')
    langkah(await tungguJendela(JENDELA.pratinjau, false), 'pratinjau tidak tertutup')
  }

  /**
   * Tutup SEMUA jendela dengan Escape.
   *
   * Escape menutup semua jendela bertumpuk sekaligus, karena tiap jendela
   * memasang pendengarnya sendiri di `window`. Hati-hati dengan efek
   * sampingnya di editor drill (diamati, 23 Sep 2026): tanpa jendela
   * terbuka, Escape MEMBATALKAN PILIHAN TITIK dan tombol Detail ikut hilang;
   * dengan panel Detail terbuka, pilihannya bertahan. Yang kedua tidak
   * dijanjikan di mana pun di kode. Karena itu rangkaian tidak pernah
   * mengandalkan pilihan titik sesudah Escape: panel Detail ditutup lewat
   * tombol Tutup (`tutupDetail`), dan pemain dipilih ulang lewat namanya
   * (`pilihAnggota`).
   */
  async function tutupSemua() {
    await p.keyboard.press('Escape')
    const ok = await p
      .waitForFunction(() => !document.querySelector('.fixed.inset-0.z-50'), { timeout: 5000 })
      .then(
        () => true,
        () => false,
      )
    langkah(ok, 'Escape tidak menutup jendela yang terbuka')
    await tunggu(250)
  }

  /** Simpan gambar pratinjau — hanya bila `SHOTS=<folder>` diisi (untuk mata manusia). */
  async function simpanGambar(namaBerkas) {
    const folder = process.env.SHOTS
    if (!folder) return
    fs.mkdirSync(folder, { recursive: true })
    const el = await p.$('iframe[title="Pratinjau cetak"]')
    if (el) await el.screenshot({ path: path.join(folder, namaBerkas) })
  }

  /* -------------------------- Pengaturan drill ------------------------- */

  /** Buka ⚙, jalankan `ubah()`, lalu Simpan. */
  async function ubahSetelanDrill(ubah) {
    const ok = await p.evaluate(() => {
      const el = document.querySelector('button[title="Pengaturan drill"]')
      if (!el) return false
      el.click()
      return true
    })
    langkah(ok, 'tombol ⚙ Pengaturan drill tidak ada')
    langkah(await tungguJendela(JENDELA.setelan), 'jendela Pengaturan drill tidak terbuka')
    const hasil = await ubah()
    await tunggu(300)
    langkah(await klikTeks('Simpan', { jendela: JENDELA.setelan }), 'tombol Simpan tidak ada di Pengaturan drill')
    langkah(await tungguJendela(JENDELA.setelan, false), 'Pengaturan drill tidak tertutup setelah Simpan')
    await tunggu(600)
    return hasil
  }

  /**
   * Setel saklar (komponen `Toggle`: `<button>` yang bulatannya
   * `.bg-emerald-500` bila menyala) di jendela Pengaturan drill.
   * Mengembalikan keadaan sesudahnya, dibaca ulang dari layar.
   */
  async function saklar(label, nilai) {
    const baca = () =>
      p.evaluate(
        (l, j) => {
          const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
          const panel = h && h.closest('.relative')
          const b = panel && [...panel.querySelectorAll('button')].find((x) => x.textContent.trim() === l)
          return b ? !!b.querySelector('.bg-emerald-500') : null
        },
        label,
        JENDELA.setelan,
      )
    const sekarang = await baca()
    langkah(sekarang !== null, `saklar "${label}" tidak ada di Pengaturan drill`)
    if (sekarang !== nilai) {
      await klikTeks(label, { jendela: JENDELA.setelan })
      await tunggu(300)
    }
    return baca()
  }

  /* --------------------------- panel Detail --------------------------- */

  /** Pilih titik pertama di lapangan dengan tetikus (seperti pemakai). */
  async function pilihTitikPertama() {
    const titik = await p.$$('circle[data-titik="1"]')
    langkah(titik.length > 0, 'tidak ada titik pemain di lapangan')
    await titik[0].click()
    const ada = await p
      .waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Detail'), {
        timeout: 5000,
      })
      .then(
        () => true,
        () => false,
      )
    langkah(ada, 'tombol Detail tidak muncul setelah titik dipilih')
  }

  /** Pilih pemain lewat daftar Anggota di samping lapangan (lewat namanya). */
  async function pilihAnggota(nama) {
    const ok = await p.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        [...x.querySelectorAll('span')].some((s) => s.textContent.trim() === n),
      )
      if (!b) return false
      b.click()
      return true
    }, nama)
    langkah(ok, `pemain "${nama}" tidak ada di daftar Anggota editor drill`)
    const ada = await p
      .waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Detail'), {
        timeout: 5000,
      })
      .then(
        () => true,
        () => false,
      )
    langkah(ada, `tombol Detail tidak muncul setelah "${nama}" dipilih`)
  }

  async function bukaDetail() {
    langkah(await klikTeks('Detail'), 'tombol Detail tidak ada')
    langkah(await tungguJendela(JENDELA.detail), 'panel Detail tidak terbuka')
    const ada = await p
      .waitForFunction(
        () => {
          const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith('Detail —'))
          return !!(h && h.closest('.relative') && h.closest('.relative').querySelector('table tbody tr'))
        },
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      )
    langkah(ada, 'panel Detail terbuka tetapi tabel geraknya kosong')
    await tunggu(250)
    return bacaDetail()
  }

  const bacaDetail = () => p.evaluate(bacaDetailDiHalaman)

  /** Tutup panel Detail lewat tombol Tutup — pilihan titik tetap bertahan. */
  async function tutupDetail() {
    langkah(await klikTeks('Tutup', { jendela: JENDELA.detail }), 'tombol Tutup di panel Detail tidak ada')
    langkah(await tungguJendela(JENDELA.detail, false), 'panel Detail tidak tertutup')
    await tunggu(250)
  }

  /**
   * Klik tombol mode langkah pada baris ke-`i`, lalu TUNGGU tulisannya
   * berubah — perubahan disimpan ke basis data dulu, baru tampil.
   */
  async function klikModeDetail(i = 0) {
    const sebelum = (await bacaDetail())?.baris[i]?.mode ?? null
    langkah(sebelum !== null, `tombol mode baris ${i} tidak ada di panel Detail`)
    await p.evaluate((k) => {
      const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith('Detail —'))
      const tr = h.closest('.relative').querySelectorAll('table tbody tr')[k]
      tr.querySelector('td:last-child button').click()
    }, i)
    const berubah = await p
      .waitForFunction(
        (k, s) => {
          const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith('Detail —'))
          const tr = h && h.closest('.relative') && h.closest('.relative').querySelectorAll('table tbody tr')[k]
          const b = tr && tr.querySelector('td:last-child button')
          return !!b && b.textContent.trim() !== s
        },
        { timeout: 5000 },
        i,
        sebelum,
      )
      .then(
        () => true,
        () => false,
      )
    langkah(berubah, `mode baris ${i} tidak berubah dari "${sebelum}" setelah diklik`)
    await tunggu(250)
    return bacaDetail()
  }

  /* ------------------------------ lain-lain ----------------------------- */

  /**
   * Isi "Count ke set berikutnya" untuk set yang sedang dibuka — DIKETIK,
   * seperti pemakai (lihat README: jangan menimpa `value` kolom React).
   */
  async function isiCount(n) {
    const h = await p.evaluateHandle(() => {
      const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Count ke set berikutnya')
      return (lab && lab.parentElement && lab.parentElement.querySelector('input')) || null
    })
    const el = h.asElement()
    langkah(el, 'kolom "Count ke set berikutnya" tidak ada di editor drill')
    await el.click({ clickCount: 3 })
    await el.evaluate((e) => e.select())
    await p.keyboard.type(String(n), { delay: 30 })
    await tunggu(700)
    return el.evaluate((e) => e.value)
  }

  /*
   * Bacaan dari basis data, bukan dari layar, bila klaimnya tentang data
   * yang TERSIMPAN (README). Data contoh hanya berisi satu drill.
   */
  const drillDiDb = async () => (await bacaSemua(p, 'drills'))[0] ?? null
  const setDiDb = async () => (await bacaSemua(p, 'sets')).sort((a, b) => a.order - b.order)
  const anggotaDiDb = () => bacaSemua(p, 'members')

  return {
    siapkan,
    muatUlangEditor,
    klikTeks,
    jendelaAda,
    tungguJendela,
    bukaBukuSaku,
    statusCentang,
    centang,
    pilihPemain,
    pratinjau,
    tutupPratinjau,
    tutupSemua,
    simpanGambar,
    ubahSetelanDrill,
    saklar,
    pilihTitikPertama,
    pilihAnggota,
    bukaDetail,
    bacaDetail,
    tutupDetail,
    klikModeDetail,
    isiCount,
    drillDiDb,
    setDiDb,
    anggotaDiDb,
  }
}

/* ------------------------------------------------------------------------ */
/*  Kerangka rangkaian                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Jalankan satu rangkaian dan SELALU akhiri dengan "N lulus, M gagal".
 *
 * `isi(t)` menerima `t.p` (halaman), `t.cek(nama, syarat, keterangan)`,
 * `t.sama(nama, aktual, harapan)`, `t.catat(teks)`, dan semua langkah di
 * `alatHalaman`. Galat yang lolos dari `isi` dihitung satu kegagalan
 * ("rangkaian mogok") — bukan membuat skrip mati tanpa ringkasan.
 */
export async function jalankan(judul, isi) {
  console.log(`== ${judul} ==`)
  console.log(`   BASE = ${BASE}`)
  let lulus = 0
  let gagal = 0
  const cek = (nama, syarat, keterangan = '') => {
    if (syarat) {
      lulus++
      console.log(`  ✓ ${nama}`)
    } else {
      gagal++
      console.log(`  ✗ ${nama}${keterangan !== '' ? ` → ${keterangan}` : ''}`)
    }
    return !!syarat
  }
  const sama = (nama, aktual, harapan) => {
    const a = JSON.stringify(aktual)
    const h = JSON.stringify(harapan)
    return cek(nama, a === h, `dapat ${a}, harap ${h}`)
  }
  const catat = (teks) => console.log(`    · ${teks}`)

  /*
   * Batas waktu sendiri, jauh di bawah `timeout 600` milik regresi.sh.
   * Rangkaian yang macet lalu dibunuh dari luar tidak sempat mencetak
   * ringkasan — dan tercatat "(tanpa ringkasan)", persis kegagalan sunyi
   * yang hendak dihindari. Satu rangkaian di sini selesai dalam ±15 detik.
   */
  const jam = setTimeout(() => {
    console.log(`  ✗ rangkaian melewati batas waktu (${BATAS_DETIK} detik) — macet di tengah jalan`)
    console.log(`\n${lulus} lulus, ${gagal + 1} gagal`)
    process.exit(1)
  }, BATAS_DETIK * 1000)
  jam.unref()

  const errs = []
  let b = null
  try {
    b = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'],
    })
    const p = await b.newPage()
    await p.setViewport({ width: 1440, height: 1000 })
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
    p.on('console', (m) => {
      if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160))
    })
    await isi({ p, cek, sama, catat, ...alatHalaman(p) })
    cek('tidak ada error di konsol', errs.length === 0, errs.slice(0, 3).join(' | '))
  } catch (e) {
    gagal++
    const pesan = String(e?.message ?? e).split('\n')[0].slice(0, 220)
    console.log(`  ✗ rangkaian mogok sebelum selesai → ${pesan}`)
    if (errs.length) console.log(`    · error konsol: ${errs.slice(0, 3).join(' | ')}`)
  } finally {
    if (b) await b.close().catch(() => {})
  }
  clearTimeout(jam)
  console.log(`\n${lulus} lulus, ${gagal} gagal`)
  process.exit(gagal ? 1 : 0)
}
