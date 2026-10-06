/**
 * Uji #8 PIN pelatih tim (modul murni).
 *
 * Tanpa env = perilaku lama; PIN salah ditahan; PIN benar diingat;
 * ganti PIN → ditanya lagi; keluar mode anggota menerima PIN tim ATAU kios.
 */
import { pbkdf2Sync } from 'node:crypto'
import {
  ANJURAN_PANJANG,
  BATAS_SALAH,
  GARAM_PIN,
  ITER_PIN,
  JEDA_MS,
  KUNCI_INGAT,
  adaPinTim,
  bolehMasukPelatih,
  hashPinTim,
  hashPinTersuntik,
  jedaSetelahSalah,
  pinKeluarDiterima,
  pinPendek,
  pinTimCocok,
  perangkatSudahLolos,
} from '/tmp/pinPelatih.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const pin = '246810'
const hashNode = pbkdf2Sync(pin, GARAM_PIN, ITER_PIN, 32, 'sha256').toString('hex')

cek('hash tersuntik kosong di uji (perilaku lama)', hashPinTersuntik() === '')
cek('tanpa hash: tidak ada PIN tim', adaPinTim() === false)
cek('tanpa hash: perangkat sudah lolos', perangkatSudahLolos() === true)
cek('tanpa hash: boleh masuk pelatih', bolehMasukPelatih({
  adaPinTim: false, sudahIngat: false, pinBenar: false,
}) === true)

cek('ada hash: ada PIN tim', adaPinTim(hashNode) === true)
cek('ada hash belum ingat: belum lolos', perangkatSudahLolos(hashNode) === false)
cek('PIN salah ditahan', bolehMasukPelatih({
  adaPinTim: true, sudahIngat: false, pinBenar: false,
}) === false)
cek('PIN benar boleh', bolehMasukPelatih({
  adaPinTim: true, sudahIngat: false, pinBenar: true,
}) === true)
cek('sudah ingat hash yang sama: boleh tanpa mengetik', bolehMasukPelatih({
  adaPinTim: true, sudahIngat: true, pinBenar: false,
}) === true)

cek('ganti PIN (hash lain) = belum lolos', perangkatSudahLolos('deadbeef') === false)

cek('jeda sebelum 5 salah = 0', jedaSetelahSalah(4) === 0)
cek('jeda setelah 5 salah', jedaSetelahSalah(BATAS_SALAH) === JEDA_MS)
cek('anjuran 6 angka', ANJURAN_PANJANG === 6)
cek('pin 4 angka dianggap pendek', pinPendek('1234') === true)
cek('pin 6 angka tidak pendek', pinPendek('123456') === false)

cek('keluar: tanpa keduanya = boleh (lama)', pinKeluarDiterima({
  adaPinKios: false, pinKiosBenar: false, adaPinTim: false, pinTimBenar: false,
}) === true)
cek('keluar: PIN kios salah ditahan', pinKeluarDiterima({
  adaPinKios: true, pinKiosBenar: false, adaPinTim: false, pinTimBenar: false,
}) === false)
cek('keluar: PIN kios benar', pinKeluarDiterima({
  adaPinKios: true, pinKiosBenar: true, adaPinTim: false, pinTimBenar: false,
}) === true)
cek('keluar: PIN tim benar walau kios salah', pinKeluarDiterima({
  adaPinKios: true, pinKiosBenar: false, adaPinTim: true, pinTimBenar: true,
}) === true)
cek('keluar: PIN tim salah & tanpa kios = ditahan', pinKeluarDiterima({
  adaPinKios: false, pinKiosBenar: false, adaPinTim: true, pinTimBenar: false,
}) === false)
cek('keluar: PIN kios benar walau ada PIN tim', pinKeluarDiterima({
  adaPinKios: true, pinKiosBenar: true, adaPinTim: true, pinTimBenar: false,
}) === true)

const hashWeb = await hashPinTim(pin)
cek('PBKDF2 web = node:crypto', hashWeb === hashNode, `${hashWeb} vs ${hashNode}`)
cek('pinTimCocok benar', await pinTimCocok(pin, hashNode) === true)
cek('pinTimCocok salah', await pinTimCocok('000000', hashNode) === false)
cek('pinTimCocok tanpa hash = true (lama)', await pinTimCocok('apa saja', '') === true)

cek('kunci ingat stabil', KUNCI_INGAT === 'drillkit.pinPelatih.hash')
cek('garam tidak berubah', GARAM_PIN === 'drillkit-pin-pelatih-v1')
cek('iterasi 10000', ITER_PIN === 10_000)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
