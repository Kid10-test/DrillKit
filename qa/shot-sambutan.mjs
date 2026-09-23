/**
 * Tangkap halaman pengantar (landing page) DrillKit.
 *
 * Dua tangkapan: keadaan awal di perangkat benar-benar baru (belum ada
 * yang dipilih), lalu setelah memilih "Saya anggota". Perangkat baru
 * disimulasikan dengan konteks browser baru — bukan mengosongkan
 * localStorage & IndexedDB dari bawah aplikasi yang sedang berjalan.
 */
import puppeteer from 'puppeteer'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:4173'
const KELUAR = '/home/user/shots'
mkdirSync(KELUAR, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const ctx = await browser.createBrowserContext()
const h = await ctx.newPage()
await h.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)

const ada = async (sel) => (await h.$(sel)) != null
if (!(await ada('[data-testid="sambutan-mode"]'))) {
  throw new Error('layar sambutan tidak muncul di perangkat baru')
}
await h.screenshot({ path: `${KELUAR}/landing-1-atas.jpg`, type: 'jpeg', quality: 80 })

// Pilih anggota lalu biarkan aplikasi memuat ulang dirinya.
await h.click('[data-testid="pilih-member"]')
await wait(600)
await h.screenshot({ path: `${KELUAR}/landing-2-dipilih.jpg`, type: 'jpeg', quality: 80 })

await h.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await h.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await h.screenshot({ path: `${KELUAR}/landing-3-masuk-anggota.jpg`, type: 'jpeg', quality: 80 })

// Bukti tertulis (tangkapan layar tidak bisa saya periksa sendiri).
const mode = await h.evaluate(() => localStorage.getItem('drillkit.mode'))
const menu = await h.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))
console.log('mode:', mode, '| menu:', JSON.stringify(menu),
  '| sambutan masih tampil:', await ada('[data-testid="sambutan-mode"]'))

await browser.close()
console.log('selesai ->', KELUAR)
