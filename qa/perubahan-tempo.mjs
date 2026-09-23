/**
 * Uji **accelerando & ritardando** pada antarmukanya.
 *
 * Mengapa ini ada: mesin perubahan temponya sudah lama ada, tetapi
 * tersembunyi di dalam kartu "Pola ritme" dengan nama "Latih tempo
 * (naik/turun bertahap)" dan empat angka yang harus diketik sendiri —
 * salah satunya boleh diisi nol, yang membuat tempo tidak pernah berubah
 * sedetik pun tanpa peringatan apa pun. Jadi fiturnya ada, tetapi tidak
 * dapat ditemukan dan bisa berujung pada keadaan mati.
 *
 * Yang diuji di sini:
 *   1. Namanya berbahasa musik, dan bisa dipakai dengan satu ketuk.
 *   2. Langkahnya DIHITUNG, bukan diketik — jadi tidak mungkin nol.
 *   3. **Anggota bisa memakainya.** Ini yang menentukan: sebelumnya
 *      kendalinya ikut tersembunyi bersama kartu Pola ritme, padahal
 *      berlatih accelerando justru paling sering dilakukan sendiri.
 *      Perubahan tempo adalah perilaku metronom di perangkat ini sendiri,
 *      bukan data repertoar — jadi ia tidak melanggar aturan bahwa
 *      repertoar milik pelatih.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAKET = '/home/user/drillkit/dist/paket.json'
const UNDUH = path.join(os.tmpdir(), 'unduh-perubahan')
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  // Bagian 16 memutar metronom sungguhan; tanpa kebijakan ini AudioContext
  // ditangguhkan, `currentTime`-nya tidak jalan, dan birama tidak pernah maju.
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (h) => h.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
const ada = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)
const isi = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent ?? '', id)

try {
  /* ==================== Pelatih ==================== */
  const A = await browser.newPage()
  A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  A.on('pageerror', (e) => errors.push(String(e)))
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)
  await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
  await wait(2500)

  cek('1: kartu Perubahan tempo ada', await ada(A, 'kartu-perubahan-tempo'))
  cek('1: tombol Accelerando ada', await ada(A, 'tombol-accelerando'))
  cek('1: tombol Ritardando ada', await ada(A, 'tombol-ritardando'))
  cek('1: keadaan awal datar', /Tempo tetap dari awal sampai akhir/.test(await isi(A, 'keterangan-arah-tempo')))

  // --- Accelerando ---
  await (await A.$('[data-testid="tombol-accelerando"]')).click()
  await wait(900)
  {
    const k = await isi(A, 'keterangan-arah-tempo')
    const r = await isi(A, 'latih-ringkasan')
    cek('2: Accelerando mengatakan makin cepat', /Makin lama makin cepat/.test(k), k)
    cek('2: ringkasannya menyebut NAIK', /naik/.test(r), r)
    /*
     * Yang menentukan: langkahnya TIDAK BOLEH nol. Nol adalah keadaan
     * mati pada bentuk lama — tempo tak pernah berubah tanpa peringatan.
     */
    const cocok = r.match(/([\d.,]+)\s*BPM/)
    const langkah = cocok ? Number(String(cocok[1]).replace(',', '.')) : NaN
    cek('2: langkahnya DIHITUNG dan tidak nol', Number.isFinite(langkah) && langkah !== 0,
      `${langkah} dari "${r}"`)
    cek('2: tujuan lebih tinggi dari awal', /Dari \d+ ke \d+ BPM/.test(r), r)
  }

  // --- Tekan lagi = kembali datar ---
  await (await A.$('[data-testid="tombol-accelerando"]')).click()
  await wait(900)
  cek('3: menekan arah yang sama mengembalikan tempo jadi datar',
    /Tempo tetap dari awal sampai akhir/.test(await isi(A, 'keterangan-arah-tempo')))

  // --- Ritardando ---
  await (await A.$('[data-testid="tombol-ritardando"]')).click()
  await wait(900)
  {
    const k = await isi(A, 'keterangan-arah-tempo')
    const r = await isi(A, 'latih-ringkasan')
    cek('4: Ritardando mengatakan makin lambat', /Makin lama makin lambat/.test(k), k)
    cek('4: ringkasannya menyebut TURUN', /turun/.test(r), r)
    const cocok = r.match(/([\d.,]+)\s*BPM/)
    const langkah = cocok ? Number(String(cocok[1]).replace(',', '.')) : NaN
    cek('4: langkahnya tidak nol', Number.isFinite(langkah) && langkah !== 0, `${langkah}`)
  }

  // --- Berpindah arah langsung ---
  await (await A.$('[data-testid="tombol-accelerando"]')).click()
  await wait(900)
  cek('5: berpindah arah tanpa harus mematikan dulu',
    /Makin lama makin cepat/.test(await isi(A, 'keterangan-arah-tempo')))

  // --- Mengubah tujuan memperbarui ringkasannya ---
  {
    const before = await isi(A, 'latih-ringkasan')
    const kolom = await A.$('[data-testid="latih-ke"]')
    if (kolom) {
      await kolom.click({ clickCount: 3 })
      await A.keyboard.down('Control'); await A.keyboard.press('KeyA'); await A.keyboard.up('Control')
      await A.keyboard.type('180', { delay: 20 })
      await wait(900)
    }
    const after = await isi(A, 'latih-ringkasan')
    cek('6: mengubah tujuan memperbarui ringkasannya', before !== after, `${before} -> ${after}`)
    cek('6: ringkasannya memuat tujuan yang baru', /180/.test(after), after)
  }

  // --- Metronom tetap berjalan dengan perubahan tempo menyala ---
  await (await A.$('[data-testid="tombol-mulai"]')).click()
  await wait(800)
  cek('7: metronom tetap berjalan dengan accelerando menyala',
    /Berhenti/.test(await teks(A)))
  const m1 = await isi(A, 'birama-ke')
  await wait(2600)
  const m2 = await isi(A, 'birama-ke')
  cek('7: biramanya bertambah', m1 !== m2, `${m1} -> ${m2}`)
  await (await A.$('[data-testid="tombol-mulai"]')).click()
  await wait(500)

  /* ==================== Anggota ==================== */
  const cdp = await A.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  let f = null
  for (let i = 0; i < 120 && !f; i += 1) {
    await wait(250)
    const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
    if (x.length) f = path.join(UNDUH, x[0])
  }
  cek('8: berkas grup terunduh', f != null)
  fs.writeFileSync(PAKET, fs.readFileSync(f))

  const B = await (await browser.createBrowserContext()).newPage()
  B.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  B.on('pageerror', (e) => errors.push(String(e)))
  B.on('dialog', async (d) => { await d.accept() })
  await B.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await B.click('[data-testid="pilih-member"]')
  await wait(300)
  await B.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2500)
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)
  await (await B.$('[data-testid="tab-musik"]')).click()
  await wait(2000)

  /*
   * Ini inti permintaannya: anggota berlatih accelerando sendiri.
   * Kendali ini TIDAK boleh ikut tersembunyi bersama kartu Pola ritme.
   */
  cek('9: anggota MELIHAT kartu Perubahan tempo', await ada(B, 'kartu-perubahan-tempo'))
  cek('9: anggota TIDAK melihat kartu Pola ritme', !(await ada(B, 'kartu-pola')))
  cek('9: anggota bisa memilih Accelerando', await ada(B, 'tombol-accelerando'))

  await (await B.$('[data-testid="tombol-accelerando"]')).click()
  await wait(900)
  {
    const r = await isi(B, 'latih-ringkasan')
    cek('9: ringkasannya tampil untuk anggota', /naik/.test(r), r)
    const cocok = r.match(/([\d.,]+)\s*BPM/)
    const langkah = cocok ? Number(String(cocok[1]).replace(',', '.')) : NaN
    cek('9: langkahnya tidak nol untuk anggota', Number.isFinite(langkah) && langkah !== 0, `${langkah}`)
  }

  // Anggota berlatih: metronomnya benar-benar berdetak.
  await (await B.$('[data-testid="tombol-mulai"]')).click()
  await wait(800)
  const n1 = await isi(B, 'birama-ke')
  await wait(2600)
  const n2 = await isi(B, 'birama-ke')
  cek('10: metronom anggota berdetak dengan accelerando', n1 !== n2, `${n1} -> ${n2}`)
  await (await B.$('[data-testid="tombol-mulai"]')).click()
  await wait(500)

  /* --- Yang menulis ke basis data tidak boleh muncul untuk anggota --- */
  {
    const t = await teks(B)
    cek('11: anggota tetap TIDAK bisa menambah lagu', !/Tambah lagu/.test(t), t.slice(0, 160))
    cek('11: kolom langkah tidak lagi ditawarkan (cegah keadaan mati)',
      !(await ada(B, 'latih-langkah')))
  }

  /* ===== 12. Separuh REPERTOAR: tersimpan di lagu & ikut ke anggota ======
   *
   * Kendali di kartu metronom hanya untuk berlatih sesaat di perangkat
   * ini. Yang diminta pelatih adalah "di metronome REPERTOAR nya" — jadi
   * perubahan temponya harus tersimpan DI LAGUNYA dan ikut terbawa ke
   * HP seluruh anggota, supaya satu band berlatih tempo yang sama.
   * Tanpa butir ini, separuh permintaannya belum dikerjakan.
   */
  {
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)
    // Buka editor lagu lewat tombol Tambah lagu.
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Tambah lagu'))
      if (b) b.click()
    })
    await wait(1200)
    cek('12: editor lagu terbuka', await ada(A, 'modal-lagu'))
    cek('12: editor lagu punya bagian Perubahan tempo', await ada(A, 'lagu-perubahan-tempo'))

    // Isi judul & tempo dasar.
    const kolom = await A.$$('[data-testid="modal-lagu"] input')
    if (kolom[0]) {
      await kolom[0].click({ clickCount: 3 })
      await A.keyboard.down('Control'); await A.keyboard.press('KeyA'); await A.keyboard.up('Control')
      await A.keyboard.type('Mars Accelerando', { delay: 15 })
      await wait(300)
    }
    // Tempo dasar ada di kolom ketiga (judul, komposer, tempo).
    if (kolom[2]) {
      await kolom[2].click({ clickCount: 3 })
      await A.keyboard.down('Control'); await A.keyboard.press('KeyA'); await A.keyboard.up('Control')
      await A.keyboard.type('120', { delay: 15 })
      await wait(400)
    }

    await (await A.$('[data-testid="lagu-accelerando"]')).click()
    await wait(800)
    {
      const k = await isi(A, 'lagu-keterangan-arah')
      const r = await isi(A, 'lagu-latih-ringkasan')
      cek('12: lagu bisa diberi Accelerando', /makin cepat/.test(k), k)
      cek('12: ringkasannya menyebut naik', /naik/.test(r), r)
      cek('12: ringkasannya menyebut bahwa ia tersimpan di lagu',
        /Tersimpan di lagu ini/.test(r), r)
      const cocok = r.match(/([\d.,]+)\s*BPM/)
      const langkah = cocok ? Number(String(cocok[1]).replace(',', '.')) : NaN
      cek('12: langkahnya tidak nol', Number.isFinite(langkah) && langkah !== 0, `${langkah}`)
    }

    await A.evaluate(() => {
      const b = [...document.querySelectorAll('[data-testid="modal-lagu"] button')]
        .find((y) => y.textContent.trim() === 'Simpan')
      if (b) b.click()
    })
    await wait(1800)
    cek('12: editor lagu tertutup setelah disimpan', !(await ada(A, 'modal-lagu')))

    // Lencananya harus tampil di daftar repertoar — untuk pelatih...
    const daftar = await teks(A)
    cek('12: lencana accelerando tampil di repertoar',
      /accelerando/i.test(daftar), daftar.slice(0, 200))
  }

  /* ===== 13. Dan yang terpenting: sampai ke HP anggota =================== */
  {
    await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    await (await A.$('[data-testid="unduh-grup"]')).click()
    let g = null
    for (let i = 0; i < 160 && !g; i += 1) {
      await wait(250)
      const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
      if (x.length) g = path.join(UNDUH, x[0])
    }
    cek('13: berkas grup terunduh', g != null)
    // Terbitkan ulang supaya anggota mengambil versi yang sudah ada lagunya.
    fs.copyFileSync(g, PAKET)

    await (await B.$('[data-testid="perbarui-alamat"]')).click()
    await wait(3500)
    await (await B.$('[data-testid="tab-musik"]')).click()
    await wait(2000)

    const t = await teks(B)
    cek('13: lagu yang diberi accelerando SAMPAI ke anggota',
      /Mars Accelerando/.test(t), t.slice(0, 200))
    cek('13: lencana accelerando tampil untuk anggota',
      /accelerando/i.test(t), t.slice(0, 260))

    // Pilih lagunya: perubahan tempo yang tersimpan harus ikut terbaca.
    await B.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Mars Accelerando'))
      if (b) b.click()
    })
    await wait(1800)
    {
      const r = await isi(B, 'latih-ringkasan')
      cek('13: memilih lagunya MEMICU perubahan temponya — tidak perlu diatur ulang',
        /naik/.test(r), r)
      const k = await isi(B, 'keterangan-arah-tempo')
      cek('13: dan dikatakan makin cepat', /Makin lama makin cepat/.test(k), k)
    }
  }

  /* ===== 14. Luncuran DI ANTARA dua segmen — permintaan sebenarnya ======
   *
   * Bukan accelerando menyeluruh, melainkan: ketik tempo di dua segmen,
   * lalu tandai segmen awalnya supaya birama DI ANTARANYA meluncur.
   * Contoh yang diberikan pelatih: 172 di bar 88, 140 di bar 91, dan
   * bar 89-90 meluncur.
   */
  {
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Tambah lagu'))
      if (b) b.click()
    })
    await wait(1200)

    /*
     * Kolom ANGKA tidak bisa dikosongkan dengan Ctrl+A: pintas itu tidak
     * memilih isinya, sehingga ketikan baru MENEMPEL di belakang nilai
     * lama (120 lalu diketik 172 menjadi 120172). Karena itu dipakai
     * `select()` pada kolomnya sendiri, baru mengetik — ketikan
     * menggantikan pilihannya.
     *
     * Ini sempat membuat empat butir gagal dengan nilai BPM yang tetap
     * 120, dan kelihatan seperti cacat pada fiturnya. Bukan: fiturnya
     * benar, caranya mengisi yang keliru.
     */
    const isiKolom = async (id, nilai) => {
      const el = await A.$(`[data-testid="${id}"]`)
      if (!el) return false
      await el.click()
      await wait(150)
      await A.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.select(), id)
      await A.keyboard.type(String(nilai), { delay: 20 })
      await wait(350)
      return true
    }
    const daftarSegmen = () =>
      A.evaluate(() =>
        [...document.querySelectorAll('[data-testid^="segmen-birama-"]')].map((el) =>
          el.getAttribute('data-testid').replace('segmen-birama-', ''),
        ),
      )
    const tambahSegmen = async () => {
      await A.evaluate(() => {
        const b = [...document.querySelectorAll('[data-testid="modal-lagu"] button')]
          .find((y) => y.textContent.trim() === 'Segmen')
        if (b) b.click()
      })
      await wait(700)
    }

    /*
     * Judulnya WAJIB diisi — aplikasi menolak menyimpan lagu tanpa judul
     * ("Judul lagu wajib diisi"). Semula uji ini tidak memberi nama, dan
     * dua butir gagal seolah tanda berangsurnya tidak ikut terbawa;
     * padahal lagunya sendiri tidak pernah tersimpan.
     */
    const judul = await A.$('[data-testid="modal-lagu"] input')
    if (judul) {
      await judul.click()
      await wait(150)
      await A.evaluate(() => {
        const e = document.querySelector('[data-testid="modal-lagu"] input')
        if (e) e.select()
      })
      await A.keyboard.type('Mars Berangsur', { delay: 15 })
      await wait(300)
    }

    /*
     * Jangan menekan saklar secara buta. Kalau satu klik tidak mengenai
     * sasaran (mis. karena modalnya bergulir), seluruh urutan bergeser
     * satu langkah dan keadaannya terbalik — yang membuat butir-butir
     * berikutnya gagal bertubi-tubi seolah fiturnya rusak, padahal yang
     * keliru cuma urutan kliknya.
     *
     * Karenanya: BACA keadaannya dulu, tekan hanya bila perlu, lalu
     * PERIKSA hasilnya.
     */
    const nyalaBerangsur = async (id) =>
      (await ada(A, `berangsur-ringkasan-${id}`)) ||
      (await ada(A, `berangsur-tanpa-tujuan-${id}`)) ||
      (await ada(A, `berangsur-tumpang-${id}`))

    const setelBerangsur = async (id, mau) => {
      for (let i = 0; i < 3; i += 1) {
        if ((await nyalaBerangsur(id)) === mau) return true
        const el = await A.$(`[data-testid="segmen-berangsur-${id}"]`)
        if (!el) return false
        await el.click()
        await wait(700)
      }
      return (await nyalaBerangsur(id)) === mau
    }

    await tambahSegmen()
    await tambahSegmen()
    const ids = await daftarSegmen()
    cek('14: dua segmen bisa ditambahkan', ids.length === 2, String(ids.length))

    // Bar 88 = 172, bar 91 = 140 — persis contohnya.
    await isiKolom(`segmen-birama-${ids[0]}`, 88)
    await isiKolom(`segmen-bpm-${ids[0]}`, 172)
    await isiKolom(`segmen-birama-${ids[1]}`, 91)
    await isiKolom(`segmen-bpm-${ids[1]}`, 140)
    await wait(600)

    // Keadaan awal: TIDAK ADA luncuran. Ini janjinya — lagu yang sudah
    // ada tidak berubah perilakunya dengan sendirinya.
    cek('14: tanpa ditandai, TIDAK ada ringkasan luncuran',
      !(await ada(A, `berangsur-ringkasan-${ids[0]}`)))

    // Tandai segmen bar 88 sebagai awal luncuran.
    cek('14: saklar berangsur bisa dinyalakan', await setelBerangsur(ids[0], true))
    {
      const r = await isi(A, `berangsur-ringkasan-${ids[0]}`)
      cek('14: menandainya menampilkan ringkasannya', r.trim().length > 0, r)
      cek('14: ringkasannya menyebut bar 88 dan 172', /88/.test(r) && /172/.test(r), r)
      cek('14: ringkasannya menyebut bar 91 dan 140', /91/.test(r) && /140/.test(r), r)
      cek('14: dan menyebut ritardando, karena temponya TURUN', /ritardando/.test(r), r)
      cek('14: menyebut selama 3 birama', /3 birama/.test(r), r)
    }

    // Arah sebaliknya harus menyebut accelerando.
    await setelBerangsur(ids[0], false)
    await isiKolom(`segmen-bpm-${ids[1]}`, 200)
    cek('14: saklar berangsur bisa dinyalakan lagi', await setelBerangsur(ids[0], true))
    {
      const r2 = await isi(A, `berangsur-ringkasan-${ids[0]}`)
      cek('14: kalau temponya NAIK, ringkasannya menyebut accelerando',
        /accelerando/.test(r2), r2)
    }

    /*
     * KEMBALIKAN bar 91 ke 140 sebelum lanjut.
     *
     * Bar 91 sudah diubah jadi 200 hanya untuk memeriksa kata
     * "accelerando". Kalau dibiarkan, lagu yang tersimpan — dan ikut
     * TERBIT ke anggota — meluncur 172 → 200, bukan contoh ritardando
     * 172 → 140 yang diminta pelatih. Butir 16 membacanya dan
     * menyangka panelnya berbohong; yang berbohong adalah contohnya.
     * Jadi: setiap kali sebuah butir mengubah contoh untuk keperluan
     * selingan, butir itu WAJIB mengembalikannya.
     */
    await isiKolom(`segmen-bpm-${ids[1]}`, 140)
    await wait(500)

    // Matikan lagi = kembali melompat, tanpa sisa.
    cek('14: saklar berangsur bisa dimatikan', await setelBerangsur(ids[0], false))
    cek('14: mematikannya menghilangkan ringkasannya',
      !(await ada(A, `berangsur-ringkasan-${ids[0]}`)))

    /*
     * Simpan lalu terbitkan: tanda "berangsur" harus IKUT di dalam lagu,
     * karena ia bagian dari Song. Tanpa ini anggota menerima lagunya
     * tetapi luncuran temponya hilang — dan mereka akan berlatih dengan
     * tempo yang melompat padahal pelatih sudah mengaturnya meluncur.
     */
    cek('14: saklar berangsur dinyalakan sebelum disimpan', await setelBerangsur(ids[0], true))
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('[data-testid="modal-lagu"] button')]
        .find((y) => y.textContent.trim() === 'Simpan')
      if (b) b.click()
    })
    await wait(1800)

    await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    await (await A.$('[data-testid="unduh-grup"]')).click()
    let h = null
    for (let i = 0; i < 160 && !h; i += 1) {
      await wait(250)
      const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
      if (x.length) h = path.join(UNDUH, x[0])
    }
    cek('14: berkas grup terunduh', h != null)
    if (h) {
      const paket = JSON.parse(fs.readFileSync(h, 'utf8'))
      const lagu = (paket.songs ?? []).find((x) => x.title === 'Mars Berangsur')
      cek('14: lagunya ikut di dalam materi', lagu != null,
        (paket.songs ?? []).map((x) => x.title).join(' | '))
      const berangsur = (lagu?.tempoMap ?? []).filter((x) => x.berangsur === 1)
      cek('14: tanda BERANGSUR ikut terbawa ke dalam materi',
        berangsur.length === 1, JSON.stringify(lagu?.tempoMap ?? []))
      cek('14: dan segmen tujuannya ikut juga',
        (lagu?.tempoMap ?? []).length === 2, String((lagu?.tempoMap ?? []).length))
      const bar91 = (lagu?.tempoMap ?? []).find((x) => x.measure === 91)
      cek('14: materi yang TERBIT berisi contoh utuhnya (bar 91 = 140, bukan 200)',
        bar91?.bpm === 140, JSON.stringify(bar91 ?? null))
    }
  }

  /* ===== 15. Aturan prioritas harus TERLIHAT, bukan terjadi diam-diam ===
   *
   * Luncuran per segmen menang atas luncuran menyeluruh. Tetapi aturan
   * yang tidak terlihat sama saja dengan tidak ada: pelatih mengatur
   * ritardando dengan hati-hati, mendengar tempo datar, dan tidak tahu
   * alasannya. Karena itu kedua tempat yang dikesampingkan WAJIB
   * mengatakannya.
   */
  {
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)
    // Pilih lagu yang punya luncuran per segmen (dibuat pada butir 14).
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) =>
        y.textContent.includes('Mars Berangsur'),
      )
      if (b) b.click()
    })
    await wait(1800)
    cek('15: lagu berangsur bisa dipilih',
      /Mars Berangsur/.test(await teks(A)))

    // Nyalakan luncuran menyeluruh — harus DIBERITAHU bahwa ia dikesampingkan.
    if (!(await ada(A, 'catatan-dikesampingkan'))) {
      await (await A.$('[data-testid="tombol-accelerando"]')).click()
      await wait(900)
    }
    cek('15: bila lagu punya luncuran per segmen, metronom MENGATAKANNYA',
      await ada(A, 'catatan-dikesampingkan'))
    {
      const c = await isi(A, 'catatan-dikesampingkan')
      cek('15: dan menyebut bahwa pengaturannya DIKESAMPINGKAN',
        /dikesampingkan/i.test(c), c.slice(0, 160))
      cek('15: serta menyebut penyebabnya: luncuran per segmen',
        /per segmen/i.test(c), c.slice(0, 160))
      cek('15: dan memberitahu cara mengembalikannya',
        /Matikan tanda/i.test(c), c.slice(0, 200))
    }

    // Lagu TANPA luncuran per segmen tidak boleh memunculkan peringatan.
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) =>
        y.textContent.includes('Mars Accelerando'),
      )
      if (b) b.click()
    })
    await wait(1800)
    await (await A.$('[data-testid="tombol-accelerando"]')).click()
    await wait(1000)
    cek('15: lagu TANPA luncuran per segmen tidak memunculkan peringatan',
      !(await ada(A, 'catatan-dikesampingkan')))
  }

  /* ===== 16. Panel tidak boleh BERBOHONG tentang tempo (N7) ===============
   *
   * Luncuran per segmen sudah berbunyi sejak butir 14. Tetapi panel lagu
   * menghitung temponya sendiri (tangga per segmen), sehingga pada empat
   * birama yang menurun 172 → 161,3 → 150,7 → 140 ia menampilkan 172
   * empat kali berturut-turut.
   *
   * Ini cacat yang paling merugikan pada saat yang paling penting: pelatih
   * mencoba lagunya di section, MELIHAT angka datar, dan menyimpulkan
   * luncurannya tidak jalan — padahal telinganya mendengar yang sebaliknya.
   * Karena itu butir ini tidak memeriksa mesinnya (sudah diuji di
   * perubahan-tempo-logika), melainkan angka yang DIBACA pelatih.
   */
  {
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) =>
        y.textContent.includes('Mars Berangsur'),
      )
      if (b) b.click()
    })
    await wait(2000)

    /*
     * Matikan dulu luncuran menyeluruh supaya yang diuji murni luncuran
     * per segmen. Menekan arah yang SAMA mengembalikan tempo jadi datar —
     * jadi baca dulu arahnya, jangan menekan secara buta (butir 14 sudah
     * membayar mahal untuk pelajaran itu).
     */
    const arah = await isi(A, 'keterangan-arah-tempo')
    if (/makin cepat/i.test(arah)) {
      await (await A.$('[data-testid="tombol-accelerando"]')).click()
      await wait(900)
    } else if (/makin lambat/i.test(arah)) {
      await (await A.$('[data-testid="tombol-ritardando"]')).click()
      await wait(900)
    }
    cek('16: luncuran menyeluruh dimatikan lebih dulu',
      /Tempo tetap/.test(await isi(A, 'keterangan-arah-tempo')),
      await isi(A, 'keterangan-arah-tempo'))

    // Ikuti tempo map — tanpa ini lagu diputar pada tempo dasarnya.
    await A.select('[data-testid="pilih-tempo-map"]', '1')
    await wait(1000)
    cek('16: tempo map bisa diikuti', !(await ada(A, 'panel-peringatan-map')))

    // Loncat ke segmen bar 88, lalu PUTAR dari situ (chip hanya loncat
    // bila mesin sudah jalan — jadi tekan Mulai sesudahnya).
    await A.evaluate(() => {
      document.querySelector('[data-testid="chip-segmen-0"]')?.click()
    })
    await wait(700)
    await A.evaluate(() => {
      document.querySelector('[data-testid="tombol-mulai"]')?.click()
    })

    /*
     * Sampel (birama → tempo) selama ~12 detik. Bar 88-91 pada 4/4 makan
     * waktu sekitar 1,4-1,6 detik per birama, jadi interval 150 ms tidak
     * mungkin meloncati satu birama pun.
     */
    const sampel = new Map()
    let infoLuncur = ''
    for (let i = 0; i < 80; i += 1) {
      const bir = await isi(A, 'panel-birama')
      const t = await isi(A, 'panel-tempo')
      if (bir && t) sampel.set(Number(bir), t.trim())
      /*
       * Keterangannya hanya ada SELAGI birama itu meluncur. Dibaca di
       * sini, di dalam putaran, bukan setelah Berhenti — kalau dibaca
       * belakangan, biramanya sudah lewat dari 90 dan keterangannya
       * hilang, sehingga ujinya gagal karena waktu yang salah, bukan
       * karena fiturnya yang salah.
       */
      const n = Number(bir)
      if ((n === 89 || n === 90) && !infoLuncur) {
        infoLuncur = await A.evaluate(
          () =>
            document.querySelector('[data-testid="panel-tempo"]')?.parentElement?.innerText ?? '',
        )
      }
      if (n >= 92) break
      await wait(150)
    }
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) =>
        y.textContent.trim().startsWith('Berhenti'),
      )
      if (b) b.click()
    })
    await wait(400)

    const ke = (n) => sampel.get(n) ?? '(tidak pernah terbaca)'
    cek('16: birama 88-91 sempat terbaca saat diputar',
      [88, 89, 90, 91].every((n) => sampel.has(n)),
      [...sampel.entries()].map(([k, v]) => `${k}:${v}`).join(' '))

    cek('16: di bar 88 panel menampilkan 172', ke(88) === '172 BPM', ke(88))
    cek('16: di bar 89 panel menampilkan 161.3 — BUKAN 172', ke(89) === '161.3 BPM', ke(89))
    cek('16: di bar 90 panel menampilkan 150.7', ke(90) === '150.7 BPM', ke(90))
    cek('16: di bar 91 panel menampilkan 140', ke(91) === '140 BPM', ke(91))
    cek('16: empat birama, empat angka — panelnya bergerak, bukan diam',
      new Set([ke(88), ke(89), ke(90), ke(91)]).size === 4,
      [ke(88), ke(89), ke(90), ke(91)].join(' → '))

    // Dan angka yang bergerak itu DIJELASKAN, supaya tidak disangka galat.
    cek('16: panel menyebut bahwa temponya BERANGSUR dan ke bar berapa',
      /berangsur ke bar 91/i.test(infoLuncur),
      infoLuncur.replace(/\s+/g, ' ').slice(0, 160))
  }

  /* ===== 17. Lagu MENGAKU luncurannya SEBELUM diputar (N10) ===============
   *
   * Sebuah lagu tertulis "120 BPM" di daftar repertoar, padahal ia
   * meluncur 172 → 140 pada bar 88–91. Yang tahu hanya orang yang
   * membuka editor lagunya — padahal yang MEMUTARNYA belum tentu orang
   * itu, dan anggota tidak punya editor sama sekali.
   *
   * Alasannya persis seperti penanda accelerando yang sudah ada:
   * ketahui SEBELUM memutarnya, bukan terkejut di tengah lagu.
   */
  {
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)

    const idLencana = await A.$$eval('[data-testid^="lencana-berangsur-"]', (els) =>
      els.map((e) => e.getAttribute('data-testid')),
    )
    cek('17: lagu yang berluncuran punya lencananya', idLencana.length === 1,
      'jumlah ' + idLencana.length + ' → ' + JSON.stringify(idLencana))

    if (idLencana.length === 1) {
      const t = (await isi(A, idLencana[0])).trim()
      cek('17: lencananya menyebut kedua temponya', t === 'luncur 172 → 140', t)
      const judul = await A.$eval(
        `[data-testid="${idLencana[0]}"]`,
        (e) => e.getAttribute('title') ?? '',
      )
      cek('17: dan menyebut bar awal & bar tujuannya',
        /Bar 88: 172 → bar 91: 140/.test(judul), judul)
    }

    /*
     * Lagu TANPA luncuran tidak boleh punya lencana. Lencana yang selalu
     * muncul akan berubah menjadi kebisingan yang diabaikan — dan
     * kebisingan yang diabaikan sama bahayanya dengan tidak ada penanda.
     */
    const idLagu = await A.$$eval('[data-testid^="pilih-lagu-"]', (els) =>
      els.map((e) => ({
        id: e.getAttribute('data-testid').replace('pilih-lagu-', ''),
        teks: e.textContent || '',
      })),
    )
    const idol = idLagu.find((x) => /Mars Accelerando/.test(x.teks))
    cek('17: lagu pembanding ketemu di daftar', !!idol, JSON.stringify(idLagu.map((x) => x.teks.slice(0, 24))))
    if (idol) {
      cek('17: lagu TANPA luncuran tidak punya lencana',
        !(await ada(A, `lencana-berangsur-${idol.id}`)))
    }

    /* --- Dan yang menentukan: lencananya SAMPAI ke HP anggota -----------
     * Anggota tidak punya editor lagu. Kalau penandanya hanya tampil di
     * perangkat pelatih, ia tidak berguna bagi orang yang paling perlu
     * mengetahuiinya.
     */
    fs.rmSync(UNDUH, { recursive: true, force: true })
    fs.mkdirSync(UNDUH, { recursive: true })
    await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    await (await A.$('[data-testid="unduh-grup"]')).click()
    let g = null
    for (let i = 0; i < 160 && !g; i += 1) {
      await wait(250)
      const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
      if (x.length) g = path.join(UNDUH, x[0])
    }
    cek('17: berkas grup terunduh untuk anggota', g != null)
    if (g) {
      fs.copyFileSync(g, PAKET)
      await (await B.$('[data-testid="perbarui-alamat"]')).click()
      await wait(3500)
      await (await B.$('[data-testid="tab-musik"]')).click()
      await wait(2200)
      const lencanaB = await B.$$eval('[data-testid^="lencana-berangsur-"]', (els) =>
        els.map((e) => (e.textContent || '').trim()),
      )
      cek('17: lencana luncuran SAMPAI ke anggota', lencanaB.length === 1,
        JSON.stringify(lencanaB))
      cek('17: dan terbaca sama seperti di perangkat pelatih',
        lencanaB[0] === 'luncur 172 → 140', String(lencanaB[0]))
    }
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
