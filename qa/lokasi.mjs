/**
 * Lokasi direktori bersama untuk rangkaian uji. Bukan rangkaian — jangan
 * didaftarkan ke `regresi-penuh.sh` (seperti `sambutan.mjs`).
 *
 * Dulu tiap rangkaian menulis sendiri `/home/user/drillkit/dist` — jalur
 * yang hanya benar di satu kotak pasir (huruf kecil `drillkit`, lewat
 * symlink yang harus dibuat ulang tiap sesi). Di checkout lain (huruf
 * besar DrillKit) maupun di CI, jalur itu tidak ada dan rangkaiannya
 * mogok. Aturannya kini: **semua jalur repo diturunkan dari berkas ini**
 * — tidak ada lagi alamat absolut ke repo di dalam rangkaian uji.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Akar repo: direktori di atas `qa/`, di mana pun ia di-checkout. */
export const AKAR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * Direktori `dist` yang disajikan pratinjau. Bisa ditimpa lewat `DIST`
 * bila pratinjau menyajikan tempat lain — bawaan: `<akar>/dist`.
 */
export const DIST = process.env.DIST || path.join(AKAR, 'dist')

/** Direktori `qa/` — untuk folder unduhan & berkas sementara uji. */
export const QA = path.join(AKAR, 'qa')
