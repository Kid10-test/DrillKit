/**
 * Mengubah palet warna bawaan Tailwind v4 (format oklch) menjadi hex,
 * lalu menuliskannya ke dalam `src/index.css` di antara penanda:
 *
 *   /* === PALETTE START === *\/
 *   ...
 *   /* === PALETTE END === *\/
 *
 * Kenapa perlu?
 * ------------------------------------------------------------------
 * Tailwind v4 mendefinisikan warna bawaan (slate, emerald, amber, ...) dengan
 * `oklch()` dan membuat utility ber-opasitas (`bg-slate-900/60`) dengan
 * `color-mix(in oklab, var(--color-slate-900) 60%, transparent)`.
 *
 * Browser yang lebih lama dari Chrome 111 / Safari 15.4 / Firefox 113 tidak
 * mengerti keduanya. Begitu `oklch()` tidak dikenali, browser MEMBUANG seluruh
 * deklarasi itu — bukan cuma warnanya — sehingga aplikasi tampil polos seperti
 * dokumen teks tanpa warna, tanpa latar gelap, tanpa kartu.
 *
 * Dengan palet berbentuk hex + `@theme inline`, utility class berisi nilai
 * literal (`background-color: #0f172a`), dan Lightning CSS bisa menurunkan
 * `color-mix(in oklab, #0f172a 60%, transparent)` menjadi `rgba(...)`.
 * Hasilnya: tampilan identik di browser baru DAN tetap berwarna di browser lama.
 *
 * Nilai hex dihasilkan oleh Lightning CSS sendiri dari nilai oklch asli,
 * jadi konversinya presisi (bukan tebakan).
 *
 * Pakai:  npm run palette
 * (perlu dijalankan ulang hanya kalau Tailwind dinaikkan versinya)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const lightningcss = require('lightningcss')
const browserslist = require('browserslist')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Warna bawaan Tailwind yang dipakai aplikasi. Tambah di sini bila perlu. */
const FAMILIES = ['slate', 'emerald', 'amber', 'sky', 'rose', 'violet', 'teal']

const themeCss = readFileSync(resolve(root, 'node_modules/tailwindcss/theme.css'), 'utf8')
const re = new RegExp(`--color-(${FAMILIES.join('|')})-(\\d+):\\s*([^;]+);`, 'g')

const raw = {}
for (const m of themeCss.matchAll(re)) raw[`${m[1]}-${m[2]}`] = m[3].trim()
const keys = Object.keys(raw)
if (!keys.length) throw new Error('Palet tidak ditemukan — apakah Tailwind sudah terpasang?')

// Konversi massal: satu deklarasi per warna, lalu diturunkan ke target lama.
const css = keys.map((k, i) => `.c${i}{color:${raw[k]}}`).join('\n')
const out = lightningcss.transform({
  code: Buffer.from(css),
  minify: true,
  targets: lightningcss.browserslistToTargets(
    browserslist(['chrome >= 87', 'safari >= 14', 'firefox >= 78']),
  ),
}).code.toString()

const hex = {}
for (const m of out.matchAll(/\.c(\d+)\{color:([^;}]+)/g)) hex[keys[Number(m[1])]] = m[2]

const missing = keys.filter((k) => !/^#|^rgb/.test(hex[k] ?? ''))
if (missing.length) throw new Error('Gagal mengonversi: ' + missing.join(', '))

const block = FAMILIES.map((fam) => {
  const shades = keys.filter((k) => k.startsWith(fam + '-')).sort((a, b) => +a.split('-')[1] - +b.split('-')[1])
  if (!shades.length) return ''
  return ['', `  /* ${fam} */`, ...shades.map((k) => `  --color-${k}: ${hex[k]};`)].join('\n')
}).join('\n')

const START = '/* === PALETTE START (dibuat oleh scripts/palette-hex.mjs) === */'
const END = '/* === PALETTE END === */'

const indexPath = resolve(root, 'src/index.css')
const index = readFileSync(indexPath, 'utf8')
const i = index.indexOf(START)
const j = index.indexOf(END)
if (i < 0 || j < 0) throw new Error('Penanda PALETTE START/END tidak ditemukan di src/index.css')

writeFileSync(indexPath, index.slice(0, i) + START + '\n' + block.trimStart() + '\n  ' + END + index.slice(j + END.length))
console.log(`✔ ${keys.length} warna ditulis ke src/index.css`)
