/**
 * #4 — uji logika tempo latihan: persen/BPM diterapkan paling akhir,
 * batas 20 BPM, naik otomatis berhenti di tujuan, simpanan per lagu, dan
 * set list (tempo latihan vs tempo asli untuk layar hari H).
 */
import {
  terapkanLatihan, latihanAktif, geserLangkah, labelLatihan, labelTempo, rapikanTempo,
  nilaiPutaran, tujuanTercapai, tempoPutaran, labelPutaran, rapikanNaik,
  bacaSemua, tulisSemua, tempoLagu, semuaAsli, KUNCI_SIMPAN,
} from '/tmp/tempoLatihan.mjs'
import { tempoBerlaku, jepitTempo } from '/tmp/metronome.mjs'
import { hitungSetList } from '/tmp/setlist.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${ket ? ' — ' + ket : ''}`)
}
const p80 = { mode: 'persen', persen: 80, geser: 0 }

/* 1. 80% dari tempo map 172 → 140 dengan luncuran berangsur = 138 → 112 */
{
  const segmen = [{ measure: 88, bpm: 172, berangsur: 1 }, { measure: 91, bpm: 140 }]
  const t = (ke, latihan) => tempoBerlaku({ dasar: 120, segmen, pakaiTempoMap: true, latihan }, ke)
  cek('1: bar 88 → 138', Math.round(t(88, p80)) === 138, String(t(88, p80)))
  cek('1: bar 91 → 112', Math.round(t(91, p80)) === 112, String(t(91, p80)))
  cek('1: bar 89 ikut meluncur (80% × 161,3)', Math.abs(t(89, p80) - 161.333 * 0.8) < 0.01, String(t(89, p80)))
  cek('1: tanpa latihan tetap asli', t(88, null) === 172 && t(91) === 140)
  // Latih tempo lama juga kena, paling akhir.
  const latih = { on: true, dari: 100, ke: 140, langkah: 10, tiap: 1 }
  const v = tempoBerlaku({ dasar: 100, latih, latihan: p80 }, 3)
  cek('1: diterapkan sesudah latih tempo lama (120 × 80%)', v === 96, String(v))
}

/* 2. Batas 20 BPM & rentang */
{
  cek('2: 40% dari 30 → 20 (bukan 12)', terapkanLatihan(30, { mode: 'persen', persen: 40, geser: 0 }) === 20)
  cek('2: −60 BPM dari 60 → 20', terapkanLatihan(60, { mode: 'bpm', persen: 100, geser: -60 }) === 20)
  cek('2: mode BPM +10', terapkanLatihan(120, { mode: 'bpm', persen: 100, geser: 10 }) === 130)
  cek('2: persen dijepit 40–150', rapikanTempo({ persen: 10 }).persen === 40 && rapikanTempo({ persen: 999 }).persen === 150)
  cek('2: geser dijepit −60…+30', rapikanTempo({ mode: 'bpm', geser: -99 }).geser === -60 && rapikanTempo({ mode: 'bpm', geser: 99 }).geser === 30)
  cek('2: +5% berhenti di 150', geserLangkah({ mode: 'persen', persen: 150, geser: 0 }, 1).persen === 150)
  cek('2: −5% dari 100 → 95', geserLangkah({ mode: 'persen', persen: 100, geser: 0 }, -1).persen === 95)
  cek('2: tempo asli tidak aktif', !latihanAktif({ mode: 'persen', persen: 100, geser: 0 }))
  cek('2: lencana', labelLatihan(p80) === 'Latihan 80%', labelLatihan(p80))
  cek('2: label tempo', labelTempo(172, p80) === '138 BPM (asli 172)', labelTempo(172, p80))
  cek('2: lencana BPM', labelLatihan({ mode: 'bpm', persen: 100, geser: -20 }) === 'Latihan −20 BPM')
  cek('2: jepitTempo mesin setelah latihan ≥ 20', jepitTempo(tempoBerlaku({ dasar: 25, latihan: { mode: 'persen', persen: 40, geser: 0 } }, 1)) === 20)
}

/* 3. Naik otomatis berhenti di tujuan */
{
  const n = rapikanNaik({ on: true, mode: 'persen', mulai: 70, naik: 5, tiap: 1, sampai: 100, akhir: 'berhenti' })
  cek('3: putaran 1 = 70', nilaiPutaran(n, 1) === 70)
  cek('3: putaran 3 = 80', nilaiPutaran(n, 3) === 80)
  cek('3: putaran 7 = 100 (tujuan)', nilaiPutaran(n, 7) === 100 && tujuanTercapai(n, 7))
  cek('3: tidak melewati tujuan', nilaiPutaran(n, 50) === 100)
  cek('3: belum tujuan di putaran 6', !tujuanTercapai(n, 6))
  cek('3: label', labelPutaran(n, 3) === 'Putaran 3 · 80% → 100%', labelPutaran(n, 3))
  const n2 = rapikanNaik({ ...n, tiap: 2 })
  cek('3: setiap 2 putaran', nilaiPutaran(n2, 2) === 70 && nilaiPutaran(n2, 3) === 75)
  const nb = rapikanNaik({ on: true, mode: 'bpm', mulai: -20, naik: 5, tiap: 1, sampai: 0 })
  const tp = tempoPutaran(nb, 2)
  cek('3: mode BPM', tp.mode === 'bpm' && tp.geser === -15, JSON.stringify(tp))
}

/* 4. Diingat per lagu (localStorage tiruan) */
{
  const mem = new Map()
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  tulisSemua({ a: { tempo: p80 }, b: { tempo: { mode: 'persen', persen: 100, geser: 0 } } }, st)
  const baca = bacaSemua(st)
  cek('4: lagu a diingat 80%', tempoLagu(baca, 'a').persen === 80)
  cek('4: lagu lain tempo asli', !latihanAktif(tempoLagu(baca, 'c')))
  cek('4: tempo asli tidak ditulis', !('b' in JSON.parse(mem.get(KUNCI_SIMPAN))))
  cek('4: semua ke tempo asli', !latihanAktif(tempoLagu(semuaAsli(baca), 'a')))
  mem.set(KUNCI_SIMPAN, '{rusak')
  cek('4: simpanan rusak tidak meledak', Object.keys(bacaSemua(st)).length === 0)
}

/* 5. Set list: tempo latihan vs tempo asli (layar hari H) */
{
  const lagu = { id: 's1', title: 'Mars', bpm: 120, beats: 4, tempoMap: [], createdAt: 0, panjangBirama: 10 }
  const sl = { id: 'x', name: 'SL', songIds: ['s1'], createdAt: 0, updatedAt: 0 }
  const asli = hitungSetList(sl, [lagu])
  const lat = hitungSetList(sl, [lagu], () => ({ mode: 'persen', persen: 50, geser: 0 }))
  cek('5: hari H = tempo asli (20 dtk)', Math.abs(asli.total - 20) < 0.01, String(asli.total))
  cek('5: latihan 50% → dua kali lebih lama', Math.abs(lat.total - 40) < 0.01, String(lat.total))
  cek('5: baris ditandai', lat.baris[0].latihan === 'Latihan 50%' && lat.baris[0].bpmLatihan === 60)
  cek('5: baris asli tidak ditandai', asli.baris[0].latihan === null)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
