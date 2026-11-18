/**
 * v2.14 — Kehadiran bersama: uji peramban ujung ke ujung.
 *
 * Servernya Supabase tiruan (`server-palsu.mjs`): Postgres sungguhan (PGlite)
 * yang menjalankan migrasi `supabase/v2.14.0-kehadiran-bersama.sql`
 * lengkap dengan RLS-nya, di balik potongan PostgREST & Auth. Lima perangkat
 * (konteks peramban terpisah) memakai satu tim:
 *
 *   1. Pemilik: peran terbaca, mengundang 3 staf lewat kartu Pengaturan,
 *      sinkron pertama mengirim anggota/sesi/aturan/kehadiran — tanpa nomor
 *      HP, token QR, rundown, atau alumni tanpa catatan.
 *   2. Pencatat (perangkat baru): menerima anggota, sesi, kehadiran; pita di
 *      Absensi; isiannya terkirim otomatis, putusan yang ia ubah dibuang
 *      server dan dikembalikan di perangkatnya.
 *   3. Danlat: putusannya terkirim dan sampai ke pemilik.
 *   4. PH & asisten: lihat saja — isian di perangkatnya dikembalikan.
 *   5. Pemilik mengganti nama & menghapus catatan → sampai ke pencatat.
 *   6. Akun yang belum diundang; kembali dari halaman Google (?code= →
 *      #/pengaturan, kode ditukar) dan galat "access_denied".
 *   7. Kunci rahasia ditolak; halaman Tentang/Privasi/Ketentuan; perangkat
 *      tanpa kehadiran bersama tidak mengunduh pustaka Supabase; HP 360 px.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/server-kehadiran-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { mulaiServerPalsu, sesiUji, siapkanDb, tambahPemakai } from './server-palsu.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------- server ------------------------------- */
const pg = await siapkanDb()
const TIM = '00000000-0000-4000-8000-000000000001'
const P = await tambahPemakai(pg, '11111111-1111-4111-8111-111111111111', 'pemilik@contoh.id')
const D = await tambahPemakai(pg, '22222222-2222-4222-8222-222222222222', 'danlat@contoh.id')
const C = await tambahPemakai(pg, '33333333-3333-4333-8333-333333333333', 'catat@contoh.id')
const V = await tambahPemakai(pg, '44444444-4444-4444-8444-444444444444', 'ph@contoh.id')
const X = await tambahPemakai(pg, '55555555-5555-4555-8555-555555555555', 'asing@contoh.id')
await pg.exec(`insert into public.tim (id, nama) values ('${TIM}', 'Tim Uji');
  insert into public.staf_tim (tim_id, email, peran, nama) values ('${TIM}', 'pemilik@contoh.id', 'pemilik', 'Pelatih');`)
const srv = await mulaiServerPalsu(pg, { kodeMasuk: { 'kode-danlat': D } })
const KONFIG = { url: srv.alamat, kunci: 'sb_publishable_ujiujiujiuji1234' }
const baris = async (sql, p) => (await pg.query(sql, p)).rows

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR|apis\.google|accounts\.google|gsi/i

const dua = (n) => String(n).padStart(2, '0')
const kini = new Date()
const HARI = `${kini.getFullYear()}-${dua(kini.getMonth() + 1)}-${dua(kini.getDate())}`

/** Satu perangkat = satu konteks peramban (penyimpanan terpisah). */
async function perangkat(nama, pemakai, { konfig = true } = {}) {
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  const unduhan = []
  p.on('request', (r) => unduhan.push(r.url()))
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(`${nama}: ${m.text()}`)
  })
  p.on('pageerror', (e) => errors.push(`${nama}: ${String(e)}`))
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  const alat = buatAlat(p)
  if (konfig) await alat.aturSettings((t, k) => ({ ...t, serverKehadiran: k }), KONFIG)
  if (pemakai) await p.evaluate((s) => localStorage.setItem('drillkit-supabase', JSON.stringify(s)), sesiUji(pemakai))
  return { p, ctx, unduhan, ...alat }
}

function buatAlat(p) {
  const idb = (fn, arg) =>
    p.evaluate(
      (src, a) =>
        new Promise((res, rej) => {
          const r = indexedDB.open('drillkit')
          r.onerror = () => rej(r.error)
          r.onsuccess = () => {
            const db = r.result
            Promise.resolve(new Function('db', 'arg', src)(db, a)).then((x) => {
              db.close()
              res(x)
            }, rej)
          }
        }),
      `return (${fn})(db, arg)`,
      arg,
    )
  const semua = (store) =>
    idb(
      (db, s) =>
        new Promise((res) => {
          const q = db.transaction(s).objectStore(s).getAll()
          q.onsuccess = () => res(q.result)
        }),
      store,
    )
  const tulis = (store, nilai) =>
    idb(
      (db, a) =>
        new Promise((res, rej) => {
          const tx = db.transaction(a.store, 'readwrite')
          for (const v of a.nilai) tx.objectStore(a.store).put(v)
          tx.oncomplete = () => res(true)
          tx.onerror = () => rej(tx.error)
        }),
      { store, nilai },
    )
  const hapus = (store, id) =>
    idb(
      (db, a) =>
        new Promise((res) => {
          const tx = db.transaction(a.store, 'readwrite')
          tx.objectStore(a.store).delete(a.id)
          tx.oncomplete = () => res(true)
        }),
      { store, id },
    )
  const aturSettings = (fn, arg) =>
    idb(
      (db, a) =>
        new Promise((res, rej) => {
          const tx = db.transaction('settings', 'readwrite')
          const g = tx.objectStore('settings').get('team')
          g.onsuccess = () => {
            const ubah = new Function('t', 'k', `return (${a.fn})(t, k)`)
            tx.objectStore('settings').put(ubah(g.result ?? { key: 'team', teamName: 'Uji', coachName: 'P', memberMode: 0, sections: [], backupIntervalDays: 7 }, a.arg))
          }
          tx.oncomplete = () => res(true)
          tx.onerror = () => rej(tx.error)
        }),
      { fn: String(fn), arg },
    )
  const ada = async (sel) => (await p.$(sel)) != null
  const teks = (sel) => p.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).catch(() => '')
  const klik = async (sel) => {
    await p.waitForSelector(sel, { timeout: 15000 })
    await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
    await p.click(sel)
  }
  const isi = async (sel, nilai) => {
    await p.waitForSelector(sel, { timeout: 10000 })
    await p.$eval(
      sel,
      (el, v) => {
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      },
      String(nilai),
    )
  }
  const status = () => p.evaluate(() => JSON.parse(localStorage.getItem('drillkit.server') ?? '{}'))
  const tunggu = (fn, arg, ms = 12000) =>
    p
      .waitForFunction(fn, { timeout: ms }, arg)
      .then(() => true)
      .catch(() => false)
  /** Ketuk Sinkronkan di Pengaturan, tunggu cap "terakhir" berganti. */
  const sinkron = async () => {
    const sebelum = (await status()).terakhir ?? 0
    await klik('[data-testid="server-sinkron"]')
    return tunggu((t) => {
      const s = JSON.parse(localStorage.getItem('drillkit.server') ?? '{}')
      return (s.terakhir ?? 0) > t || !!s.galat
    }, sebelum)
  }
  const bukaPengaturan = async () => {
    await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
    await p.reload({ waitUntil: 'networkidle2' })
    await p.waitForSelector('[data-testid="kartu-kehadiran-bersama"]', { timeout: 15000 }).catch(() => {})
  }
  return { idb, semua, tulis, hapus, aturSettings, ada, teks, klik, isi, status, tunggu, sinkron, bukaPengaturan }
}

const kh = async (sesi, anggota) => (await baris(`select data, dihapus from public.kehadiran where sesi_id=$1 and anggota_id=$2`, [sesi, anggota]))[0]

try {
  /* ============================== 1. Pemilik ============================== */
  console.log('\n— Pemilik: peran, undang staf, sinkron pertama —')
  const pm = await perangkat('pemilik', P)
  await pm.tulis('members', [
    { id: 'd1', name: 'Ayu Lestari', code: 'B1', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1, createdAt: 0, token: 't_rahasia1', phone: '081200000001', notes: 'catatan pribadi' },
    { id: 'd2', name: 'Bima Sakti', code: 'P1', section: 'percussion', instrument: 'Snare', role: 'member', joinYear: 2026, active: 1, createdAt: 0, token: 't_rahasia2' },
    { id: 'd3', name: 'Citra Dewi', code: 'G1', section: 'guard', instrument: 'Flag', role: 'member', joinYear: 2026, active: 1, createdAt: 0, token: 't3' },
    { id: 'd4', name: 'Dodi Pratama', code: 'B2', section: 'brass', instrument: 'Mellophone', role: 'member', joinYear: 2026, active: 1, createdAt: 0, token: 't4' },
    { id: 'd5', name: 'Alumni Lama', code: 'X', section: 'brass', instrument: '', role: 'member', joinYear: 2020, active: 0, createdAt: 0, token: 't5' },
  ])
  await pm.tulis('sessions', [
    { id: 's_p4', type: 'latihan', title: 'P4', date: HARI, startTime: '17:30', endTime: '20:15', checklist: [{ id: 'c', text: 'bawa pad', done: 0 }], createdAt: 0, notes: 'catatan staf', rencanaLatihan: [{ id: 'b1', judul: 'Apel', menit: 10 }], formPresensi: { d1: 1 } },
  ])
  await pm.tulis('attendance', [
    { id: 'a1', sessionId: 's_p4', memberId: 'd1', status: 'hadir', checkInAt: 1 },
    { id: 'a2', sessionId: 's_p4', memberId: 'd2', status: 'izin', kategoriIzin: 'kuliah', bukti: 'https://drive.google.com/open?id=b2', putusanIzin: 'sah', putusanOleh: 'Danlat', putusanAt: 5 },
  ])
  await pm.aturSettings((t) => ({ ...t, programLatihan: [{ id: 'prog', nama: 'Latsar', mulai: '2026-11-01', selesai: '2026-12-06', hari: [], jamMulai: '17:30', jamSelesai: '20:15', tambahan: [], libur: [], fase: [], tonggak: [], sesiIds: ['s_p4'], wajibIds: ['s_p4'], peserta: [{ memberId: 'd1', bergabung: '2026-11-01' }], aturan: { sakitMaksJam: 24, batasIzin: '15:00' }, dibuat: 1, diubah: 1 }] }))
  await pm.bukaPengaturan()
  cek('badge peran: Pemilik', await pm.tunggu(() => document.querySelector('[data-testid="server-peran"]')?.textContent === 'Pemilik'), await pm.teks('[data-testid="kartu-kehadiran-bersama"]'))
  cek('akun & tim tampil', (await pm.teks('[data-testid="server-akun"]')).includes('pemilik@contoh.id') && (await pm.teks('[data-testid="server-akun"]')).includes('Tim Uji'))
  cek('daftar staf: 1 baris (pemilik)', await pm.tunggu(() => document.querySelectorAll('[data-testid="baris-staf"]').length === 1))
  cek('pengingat test user Google', (await pm.teks('[data-testid="server-staf"]')).includes('Test users'))
  for (const [email, peran, nama] of [
    ['Danlat@Contoh.id', 'danlat', 'Danlat'],
    ['catat@contoh.id', 'pencatat', 'Pencatat absen'],
    ['ph@contoh.id', 'pengamat', ''],
  ]) {
    await pm.isi('[data-testid="undang-email"]', email)
    await pm.isi('[data-testid="undang-nama"]', nama)
    await pm.isi('[data-testid="undang-peran"]', peran)
    const n = await pm.p.$$eval('[data-testid="baris-staf"]', (l) => l.length)
    await pm.klik('[data-testid="undang-kirim"]')
    await pm.tunggu((m) => document.querySelectorAll('[data-testid="baris-staf"]').length > m, n)
  }
  const staf = await baris(`select email, peran from public.staf_tim order by email`)
  cek('3 staf diundang (email dirapikan huruf kecil)', staf.map((s) => `${s.email}:${s.peran}`).join() === 'catat@contoh.id:pencatat,danlat@contoh.id:danlat,pemilik@contoh.id:pemilik,ph@contoh.id:pengamat', JSON.stringify(staf))
  cek('daftar staf: 4 baris, belum pernah masuk', (await pm.p.$$eval('[data-testid="baris-staf"]', (l) => l.length)) === 4 && (await pm.teks('[data-testid="server-staf"]')).includes('belum pernah masuk'))
  await pm.isi('[data-testid="undang-email"]', 'catat@contoh.id')
  await pm.klik('[data-testid="undang-kirim"]')
  cek('undangan ganda ditolak dengan pesan jelas', await pm.tunggu(() => document.body.textContent.includes('sudah ada di daftar staf')))

  cek('sinkron pertama selesai', await pm.sinkron())
  const st = await pm.status()
  cek('status: aktif, tanpa galat, ada yang dikirim', st.aktif === true && !st.galat && st.dikirim >= 7, JSON.stringify(st))
  const kr = await baris(`select jenis, id, data from public.kerangka order by jenis, id`)
  cek('kerangka: 4 anggota aktif + 1 sesi + aturan (alumni tanpa catatan tidak)', kr.map((r) => `${r.jenis}:${r.id}`).join() === 'anggota:d1,anggota:d2,anggota:d3,anggota:d4,konfig:program,sesi:s_p4', kr.map((r) => r.id).join())
  const ayu = kr.find((r) => r.id === 'd1')?.data ?? {}
  cek('anggota di server tanpa HP/token/catatan', ayu.name === 'Ayu Lestari' && !('phone' in ayu) && !('token' in ayu) && !('notes' in ayu), JSON.stringify(ayu))
  const p4 = kr.find((r) => r.id === 's_p4')?.data ?? {}
  cek('sesi di server tanpa rundown/catatan/ceklis, dengan formPresensi', p4.title === 'P4' && !('rencanaLatihan' in p4) && !('notes' in p4) && !('checklist' in p4) && p4.formPresensi?.d1 === 1, JSON.stringify(p4))
  const k2 = await kh('s_p4', 'd2')
  cek('kehadiran terkirim lengkap dengan putusan, tanpa id lokal', k2?.data.status === 'izin' && k2.data.putusanIzin === 'sah' && !('id' in k2.data) && (await kh('s_p4', 'd1'))?.data.status === 'hadir')
  cek('teks terakhir: baru saja', (await pm.teks('[data-testid="server-terakhir"]')).includes('baru saja'))

  /* ============================== 2. Pencatat ============================== */
  console.log('\n— Pencatat: perangkat baru menerima, isian terkirim, putusan dibuang —')
  const pc = await perangkat('pencatat', C)
  await pc.bukaPengaturan()
  cek('badge peran: Pencatat', await pc.tunggu(() => document.querySelector('[data-testid="server-peran"]')?.textContent === 'Pencatat'))
  cek('pencatat tidak melihat daftar staf', !(await pc.ada('[data-testid="server-staf"]')))
  cek('sinkron pencatat selesai', await pc.sinkron())
  const mC = await pc.semua('members')
  const sC = await pc.semua('sessions')
  const aC = await pc.semua('attendance')
  cek('menerima 4 anggota dengan nama & section', ['d1', 'd2', 'd3', 'd4'].every((id) => mC.some((m) => m.id === id && m.name && m.section)) && !mC.some((m) => m.id === 'd5'), mC.map((m) => m.id).join())
  cek('anggota diterima tanpa HP, dengan token baru', !mC.find((m) => m.id === 'd1')?.phone && mC.find((m) => m.id === 'd1')?.token && mC.find((m) => m.id === 'd1')?.token !== 't_rahasia1')
  cek('menerima sesi P4 (tanpa rundown pemilik)', sC.some((s) => s.id === 's_p4' && s.title === 'P4' && !s.rencanaLatihan && Array.isArray(s.checklist)))
  cek('menerima 2 catatan kehadiran', aC.length === 2 && aC.find((r) => r.memberId === 'd2')?.putusanIzin === 'sah')
  const setC = await pc.idb(
    (db) =>
      new Promise((res) => {
        const q = db.transaction('settings').objectStore('settings').get('team')
        q.onsuccess = () => res(q.result)
      }),
  )
  cek('menerima aturan program (sesi wajib)', setC?.programLatihan?.[0]?.wajibIds?.[0] === 's_p4')
  await pc.p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await pc.p.waitForSelector('[data-testid="pita-server"]', { timeout: 10000 }).catch(() => {})
  const pita = await pc.teks('[data-testid="pita-server"]')
  cek('pita Absensi: peran & catatan putusan', pita.includes('Kehadiran bersama') && pita.includes('Pencatat') && pita.includes('di tangan danlat'), pita)
  cek('daftar Absensi memuat anggota dari server', (await pc.teks('main')).includes('Citra Dewi'))
  // Pencatat mengisi Citra hadir (mencoba memberi putusan) dan mengubah putusan Bima.
  const a2C = aC.find((r) => r.memberId === 'd2')
  await pc.tulis('attendance', [
    { id: 'c3', sessionId: 's_p4', memberId: 'd3', status: 'hadir', checkInAt: 3, putusanIzin: 'sah', putusanOleh: 'Pencatat' },
    { ...a2C, putusanIzin: 'tidak-sah', note: 'dari pencatat' },
  ])
  // Sinkron otomatis menyusul beberapa detik sesudah ada perubahan.
  const terkirim = await pc.tunggu(
    () => {
      const s = JSON.parse(localStorage.getItem('drillkit.server') ?? '{}')
      return (s.dikirim ?? 0) >= 2
    },
    null,
    20000,
  )
  cek('isian pencatat terkirim otomatis', terkirim, JSON.stringify(await pc.status()))
  await wait(500)
  const k3 = await kh('s_p4', 'd3')
  cek('server: Citra hadir, putusan pencatat dibuang', k3?.data.status === 'hadir' && !('putusanIzin' in k3.data), JSON.stringify(k3?.data))
  const k2b = await kh('s_p4', 'd2')
  cek('server: putusan Bima tetap sah, catatan pencatat masuk', k2b?.data.putusanIzin === 'sah' && k2b.data.note === 'dari pencatat', JSON.stringify(k2b?.data))
  const a2Cb = (await pc.semua('attendance')).find((r) => r.memberId === 'd2')
  cek('perangkat pencatat: putusan Bima dikembalikan ke sah', a2Cb?.putusanIzin === 'sah' && a2Cb.note === 'dari pencatat', JSON.stringify(a2Cb))

  /* ============================== 3. Danlat ============================== */
  console.log('\n— Danlat: memutus, sampai ke pemilik —')
  const dl = await perangkat('danlat', D)
  await dl.bukaPengaturan()
  cek('badge peran: Danlat', await dl.tunggu(() => document.querySelector('[data-testid="server-peran"]')?.textContent === 'Danlat'))
  cek('sinkron danlat selesai', await dl.sinkron())
  const c3D = (await dl.semua('attendance')).find((r) => r.memberId === 'd3')
  cek('danlat menerima isian pencatat', c3D?.status === 'hadir')
  await dl.tulis('attendance', [{ ...c3D, status: 'hadir', datangAt: 9, putusanIzin: 'jatah', putusanOleh: 'Danlat', putusanAt: 10 }])
  await dl.tunggu(
    () => (JSON.parse(localStorage.getItem('drillkit.server') ?? '{}').dikirim ?? 0) >= 1,
    null,
    20000,
  )
  await wait(500)
  cek('server: putusan danlat tersimpan', (await kh('s_p4', 'd3'))?.data.putusanIzin === 'jatah')
  await pm.bukaPengaturan()
  await pm.sinkron()
  const c3P = (await pm.semua('attendance')).find((r) => r.memberId === 'd3')
  cek('pemilik menerima isian pencatat + putusan danlat', c3P?.status === 'hadir' && c3P.putusanIzin === 'jatah' && c3P.putusanOleh === 'Danlat')
  cek('pemilik: id lokal lama tetap untuk Bima', (await pm.semua('attendance')).find((r) => r.memberId === 'd2')?.id === 'a2')
  cek('daftar staf: danlat sudah masuk', (await pm.teks('[data-testid="server-staf"]')).includes('sudah masuk'))

  /* ============================== 4. PH & asisten ============================== */
  console.log('\n— PH & asisten: lihat saja —')
  const ph = await perangkat('ph', V)
  await ph.bukaPengaturan()
  cek('badge peran: PH & asisten', await ph.tunggu(() => document.querySelector('[data-testid="server-peran"]')?.textContent === 'PH & asisten'))
  await ph.sinkron()
  const aV = await ph.semua('attendance')
  cek('PH menerima 3 catatan', aV.length === 3)
  await ph.tulis('attendance', [
    { ...aV.find((r) => r.memberId === 'd1'), status: 'alpha' },
    { id: 'v4', sessionId: 's_p4', memberId: 'd4', status: 'sakit' },
  ])
  await ph.sinkron()
  const aV2 = await ph.semua('attendance')
  cek('isian PH dikembalikan: Ayu tetap hadir, catatan Dodi hilang', aV2.find((r) => r.memberId === 'd1')?.status === 'hadir' && !aV2.some((r) => r.memberId === 'd4'), JSON.stringify(aV2.map((r) => `${r.memberId}:${r.status}`)))
  cek('server tidak berubah oleh PH', (await kh('s_p4', 'd1'))?.data.status === 'hadir' && !(await kh('s_p4', 'd4')))
  await ph.p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await ph.p.waitForSelector('[data-testid="pita-server"]', { timeout: 10000 }).catch(() => {})
  cek('pita PH: lihat saja', (await ph.teks('[data-testid="pita-server"]')).includes('Lihat saja'))

  /* ============================== 5. Perubahan pemilik ============================== */
  console.log('\n— Pemilik mengganti nama & menghapus catatan —')
  const d4P = (await pm.semua('members')).find((m) => m.id === 'd4')
  await pm.tulis('members', [{ ...d4P, name: 'Dodi P. Pratama', panggilan: 'Dodi' }])
  await pm.hapus('attendance', 'a1')
  await pm.sinkron()
  cek('server: catatan Ayu ditandai dihapus', (await kh('s_p4', 'd1'))?.dihapus === true)
  await pc.bukaPengaturan()
  await pc.sinkron()
  const mC2 = await pc.semua('members')
  cek('pencatat: nama & panggilan baru diterima', mC2.find((m) => m.id === 'd4')?.name === 'Dodi P. Pratama' && mC2.find((m) => m.id === 'd4')?.panggilan === 'Dodi')
  cek('pencatat: catatan Ayu ikut terhapus', !(await pc.semua('attendance')).some((r) => r.memberId === 'd1'))
  // Pencatat mengubah nama anggota di perangkatnya → dikembalikan (kerangka milik pemilik).
  await pc.tulis('members', [{ ...mC2.find((m) => m.id === 'd3'), name: 'Nama Salah' }])
  await pc.sinkron()
  cek('pencatat: nama anggota yang diubah sendiri dikembalikan', (await pc.semua('members')).find((m) => m.id === 'd3')?.name === 'Citra Dewi')

  /* ============================== 6. Belum diundang & masuk Google ============================== */
  console.log('\n— Akun belum diundang & kembali dari Google —')
  const xs = await perangkat('asing', X)
  await xs.bukaPengaturan()
  cek('akun asing: belum diundang', await xs.tunggu(() => !!document.querySelector('[data-testid="server-belum-diundang"]')))
  cek('akun asing: tanpa tombol sinkron', !(await xs.ada('[data-testid="server-sinkron"]')))

  const lg = await perangkat('masuk', null)
  await lg.bukaPengaturan()
  cek('belum masuk: tombol Masuk dengan Google', await lg.tunggu(() => !!document.querySelector('[data-testid="server-masuk"]')))
  await lg.p.evaluate(() => {
    localStorage.setItem('drillkit.server.masuk', JSON.stringify({ at: Date.now(), kembali: '#/pengaturan' }))
    localStorage.setItem('drillkit-supabase-code-verifier', JSON.stringify('verifier-uji'))
  })
  await lg.p.goto(`${BASE}/?code=kode-danlat`, { waitUntil: 'networkidle2' })
  cek('alamat dibersihkan & rute dipulihkan', await lg.tunggu(() => location.search === '' && location.hash === '#/pengaturan'), await lg.p.evaluate(() => location.href))
  cek('kode ditukar → masuk sebagai Danlat', await lg.tunggu(() => document.querySelector('[data-testid="server-peran"]')?.textContent === 'Danlat', null, 15000), await lg.teks('[data-testid="kartu-kehadiran-bersama"]'))
  cek('sinkron otomatis menyala sesudah masuk', await lg.tunggu(() => {
    const s = JSON.parse(localStorage.getItem('drillkit.server') ?? '{}')
    return s.aktif === true && (s.terakhir ?? 0) > 0
  }, null, 15000))
  cek('perangkat baru danlat langsung menerima anggota', (await lg.semua('members')).some((m) => m.id === 'd3'))
  await lg.klik('[data-testid="server-keluar"]')
  cek('keluar: kembali ke tombol masuk', await lg.tunggu(() => !!document.querySelector('[data-testid="server-masuk"]')))
  await lg.p.evaluate(() => localStorage.setItem('drillkit.server.masuk', JSON.stringify({ at: Date.now(), kembali: '#/absensi' })))
  await lg.p.goto(`${BASE}/?error=access_denied&error_description=access_denied`, { waitUntil: 'networkidle2' })
  cek('galat masuk: rute dipulihkan', await lg.tunggu(() => location.search === '' && location.hash === '#/absensi'))
  await lg.bukaPengaturan()
  cek('galat masuk dijelaskan (test user)', await lg.tunggu(() => (document.querySelector('[data-testid="server-galat"]')?.textContent ?? '').includes('test user')))
  await lg.p.goto(`${BASE}/?code=bukan-dari-sini`, { waitUntil: 'networkidle2' })
  cek('?code= tanpa permintaan masuk tidak disentuh', await lg.p.evaluate(() => location.search === '?code=bukan-dari-sini'))

  /* ============================== 7. Lain-lain ============================== */
  console.log('\n— Kunci rahasia, halaman publik, bundel, HP —')
  await pm.bukaPengaturan()
  await pm.klik('[data-testid="server-atur"]')
  await pm.isi('[data-testid="server-kunci"]', 'sb_secret_abcdefghijklmnopqrstu')
  cek('kunci rahasia: peringatan & Simpan mati', (await pm.teks('[data-testid="server-masalah"]')).includes('RAHASIA') && (await pm.p.$eval('[data-testid="server-simpan"]', (b) => b.disabled)))
  await pm.p.keyboard.press('Escape')

  for (const [berkas, judul, kata] of [
    ['tentang.html', 'DrillKit', 'Kehadiran bersama'],
    ['privasi.html', 'Kebijakan Privasi', 'openid'],
    ['ketentuan.html', 'Ketentuan Penggunaan', 'Pelindungan Data Pribadi'],
  ]) {
    const r = await pm.p.goto(`${BASE}/${berkas}`, { waitUntil: 'networkidle2' })
    const h1 = await pm.teks('h1')
    const isi = await pm.teks('body')
    cek(`${berkas}: 200, judul & isi`, r?.status() === 200 && h1 === judul && isi.includes(kata), `${r?.status()} ${h1}`)
  }
  const tautan = await pm.p.$$eval('footer a', (l) => l.map((a) => a.getAttribute('href')))
  cek('halaman publik saling bertaut & ke aplikasi', ['./', './tentang.html', './privasi.html', './ketentuan.html'].every((h) => tautan.includes(h)))
  await pm.p.goto(`${BASE}/privasi.html`, { waitUntil: 'networkidle2' })
  const privasi = await pm.teks('main')
  cek('privasi menyebut Limited Use & tanpa nomor HP', privasi.includes('Limited Use') && privasi.includes('nomor HP') && !/\b08\d{8,}/.test(privasi))

  const polos = await perangkat('polos', null, { konfig: false })
  await polos.p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await polos.p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(800)
  cek('tanpa kehadiran bersama: pustaka Supabase tidak diunduh', !polos.unduhan.some((u) => /serverKehadiran-/.test(u)), polos.unduhan.filter((u) => /assets/.test(u)).join(' '))
  cek('tanpa kehadiran bersama: badge belum diatur, tanpa pita', (await polos.teks('[data-testid="kartu-kehadiran-bersama"]')).includes('belum diatur'))
  cek('tanpa kehadiran bersama: nol permintaan ke server', !srv.permintaan.length || !polos.unduhan.some((u) => u.startsWith(srv.alamat)))

  await pm.p.setViewport({ width: 360, height: 780 })
  await pm.bukaPengaturan()
  await pm.p.waitForSelector('[data-testid="server-staf"]', { timeout: 10000 }).catch(() => {})
  const lebar = await pm.p.evaluate(() => document.documentElement.scrollWidth)
  cek('HP 360 px: tanpa gulir mendatar', lebar <= 362, String(lebar))

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 4).join(' | '))
} catch (e) {
  cek('rangkaian berjalan tanpa pengecualian', false, String(e?.stack ?? e))
} finally {
  await browser.close()
  await srv.tutup()
}

console.log(`\nRingkasan: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
