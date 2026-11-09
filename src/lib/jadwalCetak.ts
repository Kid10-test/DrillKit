/**
 * #35 — cetakan A4 Jadwal yang dimuat **malas** (tidak masuk bundel awal):
 *
 * 1. **Kalender bulan A4 tegak** bergaya poster — judul bulan besar, nama
 *    unit & tahun, kotak tanggal membulat, kolom *Goals* & *Catatan* di
 *    bawah — mengikuti kalender cetak yang sudah dipakai unit. Kalender
 *    A4 mendatar yang lama (`htmlKalenderBulan`) tetap ada untuk detail jam.
 * 2. **Lembar rencana minggu** — tiap sesi dengan jam per blok, jalur
 *    paralel per seksi berdampingan (siapa di mana bersama siapa), lalu
 *    neraca ranah minggu itu. Lembar inilah yang dibawa pelatih ke lapangan.
 *
 * Warna hanya hex/rgb (tanpa oklch/color-mix) supaya aman dicetak.
 */
import type { Session, TargetNeraca } from '../db/types'
import { NAMA_BULAN, NAMA_HARI_PANJANG, tambahHari } from './kalender'
import { LABEL_BLOK, susunRencana } from './latihan'
import {
  LABEL_RANAH,
  RANAH_MATERI,
  URUTAN_RANAH,
  WARNA_RANAH_HEX,
  komposisiRencana,
  labelKomposisi,
  neracaSesi,
  JENIS_BERENCANA,
  ranahDariJenis,
  teksKomposisi,
  teksSelisih,
  type InfoSeksi,
  type Menit,
} from './ranahSesi'

const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Palet kalender tegak: krem/peach seperti kalender unit, abu-abu untuk penampilan. */
export const WARNA_TEGAK_HEX: Record<string, { bg: string; fg: string; garis: string }> = {
  latihan: { bg: '#f8d5a5', fg: '#1f2937', garis: '#d6a76a' },
  section: { bg: '#fde68a', fg: '#1f2937', garis: '#d6b24a' },
  gabungan: { bg: '#e9d5ff', fg: '#1f2937', garis: '#b794e0' },
  penampilan: { bg: '#9ca3af', fg: '#ffffff', garis: '#7b8390' },
  rapat: { bg: '#bae6fd', fg: '#1f2937', garis: '#7cc3e6' },
  lainnya: { bg: '#e5e7eb', fg: '#1f2937', garis: '#b8bcc4' },
}

const HARI_SINGKAT_SENIN = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN']

function hariSeninIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

function isoDari(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Bilah komposisi ranah sebagai HTML (lebar 100%). */
function bilahHtml(m: Menit, tinggi = '1.6mm'): string {
  const tot = URUTAN_RANAH.reduce((t, r) => t + m[r], 0)
  if (tot <= 0) return ''
  return `<div class="bilah" style="height:${tinggi}">${URUTAN_RANAH.filter((r) => m[r] > 0)
    .map((r) => `<i style="width:${((m[r] / tot) * 100).toFixed(2)}%;background:${WARNA_RANAH_HEX[r]}"></i>`)
    .join('')}</div>`
}

function legendaHtml(): string {
  return `<div class="legenda">${URUTAN_RANAH.map(
    (r) => `<span><i style="background:${WARNA_RANAH_HEX[r]}"></i>${esc(LABEL_RANAH[r])}</span>`,
  ).join('')}</div>`
}

export interface OpsiKalenderTegak {
  namaTim?: string
  /** Minggu dimulai hari Minggu (gaya kalender dinding) atau Senin. */
  mulaiMinggu?: boolean
  goals?: string[]
  catatan?: string
  /** Tampilkan bilah & label komposisi ranah tiap sesi. */
  komposisi?: boolean
  seksi?: string[]
  label?: (type: string) => string
}

/** Kalender satu bulan, A4 tegak bergaya poster dengan Goals & Catatan. */
export function htmlKalenderTegak(tahun: number, bulan: number, sesi: Session[], opsi: OpsiKalenderTegak = {}): string {
  const mulaiMinggu = opsi.mulaiMinggu ?? true
  const label = opsi.label ?? ((t: string) => t)
  const per = new Map<string, Session[]>()
  for (const s of [...sesi].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))) {
    const a = per.get(s.date)
    if (a) a.push(s)
    else per.set(s.date, [s])
  }
  const jumlahHari = new Date(tahun, bulan, 0).getDate()
  const pertama = isoDari(tahun, bulan, 1)
  const geser = mulaiMinggu ? (hariSeninIso(pertama) + 1) % 7 : hariSeninIso(pertama)
  const sel: (string | null)[] = []
  for (let i = 0; i < geser; i++) sel.push(null)
  for (let d = 1; d <= jumlahHari; d++) sel.push(isoDari(tahun, bulan, d))
  while (sel.length % 7) sel.push(null)
  const baris = sel.length / 7
  const namaHari = mulaiMinggu ? ['MIN', ...HARI_SINGKAT_SENIN.slice(0, 6)] : HARI_SINGKAT_SENIN

  const kotak = sel
    .map((t) => {
      if (!t) return '<div class="sel kosong"></div>'
      const isi = per.get(t) ?? []
      const w = isi.length ? WARNA_TEGAK_HEX[isi[0].type] ?? WARNA_TEGAK_HEX.lainnya : null
      const gaya = w ? ` style="background:${w.bg};color:${w.fg};border-color:${w.garis}"` : ''
      const kecil = isi.length > 1 ? ' banyak' : ''
      const daftar = isi
        .map((s) => {
          const k = opsi.komposisi ? komposisiRencana(s.rencanaLatihan, opsi.seksi ?? []) : null
          const lbl = k && k.total > 0 ? labelKomposisi(k.rataRata) : ''
          return `<div class="acara"><b>${esc(s.title.toUpperCase())}</b><span class="jam">${esc(s.startTime)}–${esc(s.endTime)}${
            s.place ? ` · ${esc(s.place)}` : ''
          }</span>${lbl ? `<span class="komp">${esc(lbl)}</span>${bilahHtml(k!.rataRata)}` : ''}${
            !lbl && opsi.komposisi ? `<span class="komp">${esc(label(s.type))}</span>` : ''
          }</div>`
        })
        .join('')
      return `<div class="sel${kecil}"${gaya}><div class="tgl">${Number(t.slice(8))}</div><div class="isi">${daftar}</div></div>`
    })
    .join('')

  const goals = [...(opsi.goals ?? [])]
  while (goals.length < 4) goals.push('')
  const judul = `${NAMA_BULAN[bulan - 1]} ${tahun}`
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kalender ${esc(judul)}</title>
<style>
@page { size: A4 portrait; margin: 7mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #ffffff; }
.halaman { border: 2.2mm solid #0b93b0; border-radius: 3mm; background: #fffdf7; padding: 7mm 8mm 6mm; height: 282mm; display: flex; flex-direction: column; }
header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; }
h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: normal; font-size: 40pt; margin: 2mm 0 0; line-height: 1; color: #111111; }
.unit { text-align: right; }
.unit .nama { font-weight: bold; font-size: 10.5pt; letter-spacing: .4px; text-transform: uppercase; max-width: 80mm; line-height: 1.35; }
.unit .tahun { font-weight: bold; font-size: 24pt; margin-top: 1mm; }
.hari { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2.4mm; margin-bottom: 2mm; text-align: center; }
.hari span { justify-self: center; background: #fbd9a8; font-size: 7.5pt; letter-spacing: 1.6px; padding: .6mm 2.5mm; font-weight: bold; color: #1f2937; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(${baris}, 1fr); gap: 2.4mm; min-height: 0; }
.sel { border: .35mm solid #d6b98a; border-radius: 2.6mm; background: #fffdf7; padding: 1.4mm 1.4mm 1mm; overflow: hidden; display: flex; flex-direction: column; }
.sel.kosong { border-color: #ecdcc2; }
.tgl { font-weight: bold; font-size: 8.5pt; letter-spacing: .5px; }
.isi { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1mm; min-height: 0; }
.acara { text-align: center; line-height: 1.2; }
.acara b { display: block; font-size: 7.4pt; letter-spacing: .6px; }
.acara .jam { display: block; font-size: 5.8pt; opacity: .85; margin-top: .3mm; }
.acara .komp { display: block; font-size: 5.6pt; margin-top: .3mm; }
.banyak .acara b { font-size: 6.2pt; }
.bilah { display: flex; width: 100%; border-radius: .6mm; overflow: hidden; margin-top: .6mm; }
.bilah i { display: block; height: 100%; }
footer { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 6mm; }
footer h2 { text-align: center; font-size: 8.5pt; letter-spacing: 2px; margin: 0 0 3mm; font-weight: bold; }
.goal { display: flex; align-items: flex-end; gap: 2.5mm; margin-bottom: 2.6mm; }
.goal .o { width: 4mm; height: 4mm; border: .35mm solid #111827; border-radius: 50%; flex: none; }
.goal .g { flex: 1; border-bottom: .3mm solid #111827; font-size: 8pt; min-height: 4.6mm; padding-bottom: .4mm; }
.catatan { background-color: #fdebd3; background-image: radial-gradient(#ffffff 0.45mm, transparent 0.5mm); background-size: 5mm 5mm; border-radius: 2.5mm; min-height: 30mm; padding: 2.5mm 3mm; font-size: 8pt; white-space: pre-wrap; }
.legenda { display: flex; flex-wrap: wrap; gap: 1.5mm 3mm; font-size: 6.5pt; margin-top: 2.5mm; color: #374151; }
.legenda i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: .5mm; margin-right: .8mm; vertical-align: -0.4mm; }
</style></head><body>
<div class="halaman">
<header><h1>${esc(NAMA_BULAN[bulan - 1])}</h1><div class="unit">${opsi.namaTim ? `<div class="nama">${esc(opsi.namaTim)}</div>` : ''}<div class="tahun">${tahun}</div></div></header>
<div class="hari">${namaHari.map((h) => `<span>${h}</span>`).join('')}</div>
<div class="grid">${kotak}</div>
${opsi.komposisi ? legendaHtml() : ''}
<footer>
<div><h2>GOALS</h2>${goals
    .slice(0, 6)
    .map((g) => `<div class="goal"><span class="o"></span><span class="g">${esc(g)}</span></div>`)
    .join('')}</div>
<div><h2>CATATAN</h2><div class="catatan">${esc(opsi.catatan ?? '')}</div></div>
</footer>
</div>
</body></html>`
}

/* ------------------------------ rencana minggu ------------------------------ */

export interface OpsiRencanaMinggu {
  namaTim?: string
  seksi: (InfoSeksi & { dot?: string })[]
  target?: TargetNeraca | null
  label?: (type: string) => string
}

function jamDari(m: number | null): string {
  if (m == null) return '—'
  const t = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function menitJam(jam: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((jam ?? '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function tanggalPanjang(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${NAMA_HARI_PANJANG[hariSeninIso(iso)]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`
}

function chipRanah(jenis: string): string {
  const r = ranahDariJenis(jenis)
  return `<span class="chip" style="border-color:${WARNA_RANAH_HEX[r]}"><i style="background:${WARNA_RANAH_HEX[r]}"></i>${esc(
    LABEL_BLOK[jenis as keyof typeof LABEL_BLOK] ?? jenis,
  )}</span>`
}

const kecil = (a?: string, b?: string) => {
  const isi = [a, b].map((x) => (x ?? '').trim()).filter(Boolean)
  return isi.length ? `<small>${esc(isi.join(' · '))}</small>` : ''
}

/** Lembar rencana satu minggu (Senin `awal` … Minggu), A4 tegak. */
export function htmlRencanaMinggu(awal: string, sesi: Session[], opsi: OpsiRencanaMinggu): string {
  const akhir = tambahHari(awal, 6)
  const dalam = sesi
    .filter((s) => s.date >= awal && s.date <= akhir)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
  const ids = opsi.seksi.map((s) => s.id)
  const namaSeksi = (id: string) => opsi.seksi.find((s) => s.id === id)?.label ?? id
  const label = opsi.label ?? ((t: string) => t)

  const bagian = dalam
    .map((s) => {
      const blok = s.rencanaLatihan ?? []
      const k = komposisiRencana(blok, ids)
      const kepala = `<h2>${esc(tanggalPanjang(s.date))} · ${esc(s.startTime)}–${esc(s.endTime)}${s.place ? ` · ${esc(s.place)}` : ''}</h2>
<p class="j"><b>${esc(s.title)}</b> <span>${esc(label(s.type))}${k.total > 0 ? ` · ${esc(labelKomposisi(k.rataRata))}` : ''}</span></p>`
      if (!blok.length)
        return JENIS_BERENCANA.includes(s.type)
          ? `<section class="sesi">${kepala}<p class="kosong">Belum ada rencana isi sesi.</p></section>`
          : `<section class="sesi">${kepala}</section>`
      const paralel = k.adaParalel && ids.length > 1
      const kolom = paralel ? opsi.seksi : []
      const rencana = susunRencana(menitJam(s.startTime), blok)
      const isiBaris = rencana
        .map((r, i) => {
          const b = blok[i]
          const jam = `${jamDari(r.mulai)}–${jamDari(r.selesai)}<small>${r.menit} mnt</small>`
          const cabang = b.cabang?.filter(Boolean) ?? []
          if (!paralel || !cabang.length) {
            return `<tr><td class="jam">${jam}</td><td>${chipRanah(b.jenis)}</td><td colspan="${Math.max(1, kolom.length)}"><b>${esc(
              b.judul,
            )}</b>${kecil(b.pelatih, b.tempat)}${b.catatan ? `<small>${esc(b.catatan)}</small>` : ''}</td></tr>`
          }
          const sel = kolom
            .map((sk) => {
              const c = cabang.find((x) => x.seksi?.includes(sk.id))
              if (!c) return '<td class="nganggur">— tanpa kegiatan —</td>'
              const beda = c.jenis && c.jenis !== b.jenis ? `<small>${esc(LABEL_BLOK[c.jenis] ?? c.jenis)}</small>` : ''
              return `<td><b>${esc(c.judul)}</b>${beda}${kecil(c.pelatih, c.tempat)}</td>`
            })
            .join('')
          return `<tr><td class="jam">${jam}</td><td>${chipRanah(b.jenis)}<small>${esc(b.judul)}</small></td>${sel}</tr>`
        })
        .join('')
      const kepalaTabel = paralel
        ? `<tr><th class="jam">Jam</th><th class="ranah">Ranah</th>${kolom
            .map((sk) => `<th><i style="background:${esc(sk.dot ?? '#64748b')}"></i>${esc(sk.label)}</th>`)
            .join('')}</tr>`
        : '<tr><th class="jam">Jam</th><th class="ranah">Ranah</th><th>Kegiatan</th></tr>'
      return `<section class="sesi">${kepala}<table>${kepalaTabel}${isiBaris}</table><p class="komp">${bilahHtml(k.rataRata, '2mm')}${esc(
        teksKomposisi(k.rataRata),
      )}${k.adaParalel ? ' (rata-rata per seksi)' : ''}</p></section>`
    })
    .join('')

  const n = neracaSesi(dalam, ids, { target: opsi.target, label: namaSeksi })
  const target = opsi.target?.persen
  const baris = (nama: string, m: Menit, materi: number, persen: Record<string, number>) =>
    `<tr><th>${esc(nama)}</th>${RANAH_MATERI.map(
      (r) => `<td>${m[r] ? `${Math.round(m[r])}′<small>${persen[r]}%</small>` : '—'}</td>`,
    ).join('')}<td>${m.nonmateri ? `${Math.round(m.nonmateri)}′` : '—'}</td><td><b>${Math.round(materi)}′</b></td></tr>`
  const neraca = `<section class="neraca"><h2>Neraca ranah minggu ini</h2>
<table><tr><th></th>${RANAH_MATERI.map((r) => `<th><i style="background:${WARNA_RANAH_HEX[r]}"></i>${esc(LABEL_RANAH[r])}</th>`).join(
    '',
  )}<th>Non-materi</th><th>Materi</th></tr>
${n.perSeksi.map((b) => baris(b.seksi === '*' ? 'Semua' : namaSeksi(b.seksi), b.menit, b.materi, b.persen)).join('')}
${target ? `<tr class="target"><th>Target · ${esc(opsi.target!.nama)}</th>${RANAH_MATERI.map((r) => `<td>${target[r] ? `${target[r]}%` : '—'}</td>`).join('')}<td></td><td></td></tr>` : ''}
</table>
${n.selisih.length ? `<ul class="selisih">${n.selisih.map((x) => `<li>${esc(teksSelisih(x, namaSeksi, ids.length))}</li>`).join('')}</ul>` : ''}
${n.peringatan.length ? `<ul class="awas">${n.peringatan.map((p) => `<li>${esc(p.teks)}</li>`).join('')}</ul>` : ''}
</section>`

  const [y1, m1, d1] = awal.split('-').map(Number)
  const [y2, m2, d2] = akhir.split('-').map(Number)
  const rentang = `${d1} ${NAMA_BULAN[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ''} – ${d2} ${NAMA_BULAN[m2 - 1]} ${y2}`
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rencana latihan ${esc(rentang)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 9pt; }
h1 { font-size: 15pt; margin: 0; } p.tim { margin: 1mm 0 4mm; color: #475569; }
.sesi { break-inside: avoid; page-break-inside: avoid; margin-bottom: 5mm; }
h2 { font-size: 10.5pt; margin: 0 0 1mm; color: #0f172a; border-bottom: .4mm solid #0b93b0; padding-bottom: .8mm; }
p.j { margin: 0 0 1.5mm; } p.j span { color: #475569; }
p.kosong { color: #b91c1c; margin: 0; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: .25mm solid #cbd5e1; padding: 1.2mm 1.5mm; vertical-align: top; text-align: left; }
th { background: #334155; color: #ffffff; font-size: 8pt; }
th i, .legenda i { display: inline-block; width: 2.4mm; height: 2.4mm; border-radius: .5mm; margin-right: 1mm; vertical-align: -0.3mm; }
th.jam, td.jam { width: 19mm; } th.ranah { width: 31mm; }
td small { display: block; color: #475569; font-size: 7.4pt; margin-top: .4mm; }
td.nganggur { background: #fee2e2; color: #991b1b; font-size: 7.6pt; }
.chip { display: inline-block; border: .3mm solid #64748b; border-radius: 1mm; padding: 0 1.2mm; font-size: 7.6pt; }
.chip i { display: inline-block; width: 2mm; height: 2mm; border-radius: .4mm; margin-right: .8mm; }
p.komp { margin: 1.2mm 0 0; color: #334155; font-size: 8pt; }
.bilah { display: flex; width: 100%; border-radius: .6mm; overflow: hidden; margin-bottom: .8mm; }
.bilah i { display: block; height: 100%; }
.neraca { break-inside: avoid; page-break-inside: avoid; }
.neraca td { text-align: center; } .neraca td small { display: inline; margin-left: .8mm; }
.neraca tr.target th, .neraca tr.target td { background: #f1f5f9; color: #0f172a; }
ul { margin: 2mm 0 0; padding-left: 5mm; } ul.selisih li { color: #92400e; } ul.awas li { color: #b91c1c; }
</style></head><body>
<h1>Rencana Latihan · ${esc(rentang)}</h1>
<p class="tim">${esc(opsi.namaTim ?? '')}${dalam.length ? ` · ${dalam.length} sesi` : ''}</p>
${bagian || '<p>Tidak ada sesi di minggu ini.</p>'}
${dalam.length ? neraca : ''}
</body></html>`
}
