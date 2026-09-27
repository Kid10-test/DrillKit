/**
 * #3 — kalender pada mode anggota.
 *
 * Yang dijaga:
 * - layar lebar membuka tampilan Bulan, HP tetap bisa memilih Agenda
 * - kalender tidak menyediakan aksi ubah data atau seret-pindah
 * - status yang terlihat adalah status pribadi dari bagian `locked`, bukan
 *   absensi terbuka pada paket grup
 * - sesi lewat yang belum dicatat tidak disamakan dengan alpha
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { buatKunci } from '/tmp/kunci.mjs'
import { siapTerbitLengkap } from '/tmp/terbit.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const tanggal = (selisih) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + selisih)
  return iso(d)
}

const anggota = {
  id: 'm_kalender', code: 'A01', name: 'Anggota Kalender', section: 'brass',
  instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1, token: '', createdAt: 1,
}
const sesi = [
  { id: 's_lewat', title: 'Sesi lewat', type: 'latihan', date: tanggal(-2), startTime: '15:30', endTime: '18:00', checklist: [], createdAt: 1 },
  { id: 's_belum', title: 'Belum dicatat', type: 'section', date: tanggal(-1), startTime: '16:00', endTime: '18:00', checklist: [], createdAt: 1 },
  { id: 's_depan', title: 'Sesi mendatang', type: 'penampilan', date: tanggal(2), startTime: '08:00', endTime: '10:00', checklist: [{ id: 'c1', text: 'Materi', done: 0 }], createdAt: 1 },
]
const bundle = {
  format: 'drillkit-share', version: 1, exportedAt: Date.now(), team: { teamName: 'Tim Kalender' },
  members: [anggota], sessions: sesi, drills: [], sets: [], songs: [],
  attendance: [{ id: 'a1', sessionId: 's_lewat', memberId: anggota.id, status: 'hadir' }],
  memberNotes: [], mode: 'member',
}
const kunci = await buatKunci()
const { json } = await siapTerbitLengkap(bundle, { [anggota.id]: kunci })
const berkas = path.join(os.tmpdir(), `drillkit-kalender-anggota-${process.pid}.json`)
fs.writeFileSync(berkas, json)

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], defaultViewport: { width: 1280, height: 950 } })
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))
let lulus = 0
const gagal = []
const cek = (nama, ok, ket = '') => (ok ? lulus++ : gagal.push(`${nama}${ket ? ` — ${ket}` : ''}`))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (sel) => (await p.$(sel)) != null

try {
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await p.evaluate((key) => {
    localStorage.setItem('drillkit.mode', 'member')
    localStorage.setItem('drillkit.kunciAnggota', key)
    localStorage.setItem('drillkit.meId', 'm_kalender')
    localStorage.removeItem('drillkit.jadwal.tampilan')
  }, kunci)
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1500)

  const input = await p.$('#pkg-input')
  cek('input paket anggota ada', input != null)
  if (input) {
    await input.uploadFile(berkas)
    await wait(1800)
  }

  cek('kalender anggota tampil', await ada('[data-testid="kalender-anggota"]'))
  cek('laptop membuka Bulan', await ada('[data-testid="kalender-anggota-bulan"]'))
  cek('kotak kalender anggota ada', await ada('[data-testid="anggota-kotak-bulan"]'))
  cek('status pribadi terbuka dari kunci', (await p.$eval('[data-testid="status-kehadiran-anggota"]', (e) => e.textContent))?.includes('1 hadir') === true)

  await p.click(`[data-testid="anggota-hari-${tanggal(-2)}"]`)
  await wait(200)
  cek('sesi lewat menampilkan Hadir pribadi', (await p.$eval('[data-testid="kehadiran-s_lewat"]', (e) => e.textContent))?.trim() === 'Hadir')
  await p.click(`[data-testid="anggota-hari-${tanggal(-1)}"]`)
  await wait(200)
  cek('sesi lewat tanpa catatan bukan alpha', (await p.$eval('[data-testid="kehadiran-s_belum"]', (e) => e.textContent))?.trim() === 'Belum dicatat')

  const kalender = await p.$eval('[data-testid="kalender-anggota"]', (e) => ({ text: e.textContent, drag: e.querySelectorAll('[draggable="true"]').length }))
  cek('kalender tidak punya seret-pindah', kalender.drag === 0)
  cek('kalender tidak punya aksi pelatih', !/Tambah jadwal|Edit|Hapus seri|Duplikat|Pacu/.test(kalender.text ?? ''), (kalender.text ?? '').slice(0, 300))

  await p.click('[data-testid="anggota-tampilan-agenda"]')
  await wait(200)
  cek('tampilan Agenda bisa dipilih', await ada('[data-testid="kalender-anggota-agenda"]'))
  await p.click('[data-testid="anggota-lihat-lewat"]')
  await wait(200)
  cek('Agenda juga menampilkan status pribadi', (await p.$eval('[data-testid="kartu-anggota-s_lewat"]', (e) => e.textContent))?.includes('Hadir') === true)
  cek('Agenda anggota tetap baca saja', !(await p.$eval('[data-testid="kalender-anggota-agenda"]', (e) => e.textContent)).includes('Edit'))
  cek('tidak ada galat peramban', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
  fs.rmSync(berkas, { force: true })
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
for (const nama of gagal) console.log(`✗ ${nama}`)
process.exitCode = gagal.length ? 1 : 0
