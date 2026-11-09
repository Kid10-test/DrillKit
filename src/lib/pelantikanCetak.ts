/**
 * #36 — lembar A4 tegak Rekap Syarat Pelantikan: aturan, ringkasan status,
 * tabel per peserta dengan sel per sesi wajib, dan daftar pelantikan
 * susulan (camp). Warna hex murni supaya aman dicetak.
 */
import type { ProgramLatihan } from '../db/types'
import { NAMA_BULAN } from './kalender'
import {
  LABEL_KODE,
  LABEL_STATUS,
  SINGKAT_KODE,
  WARNA_KODE,
  WARNA_STATUS,
  tonggakCamp,
  urutkanRekap,
  type KodeKehadiran,
  type RekapPelantikan,
  type StatusPelantikan,
} from './programLatsar'

const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const tgl = (iso: string) => `${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`
const tglKecil = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`

const LEGENDA: KodeKehadiran[] = ['hadir', 'izin-sah', 'sakit-sah', 'izin-telat', 'sakit-telat', 'tanpa-cap', 'alpha', 'kosong']
const URUT: StatusPelantikan[] = ['lulus', 'berjalan', 'kritis', 'susulan']

export function htmlRekapPelantikan(
  p: ProgramLatihan,
  r: RekapPelantikan,
  opsi: { namaTim?: string; label: (section: string) => string; hariIni: string },
): string {
  const camp = tonggakCamp(p)
  const a = p.aturan
  const baris = urutkanRekap(r.baris)
  const susulan = baris.filter((b) => b.status === 'susulan')
  const sel = (k: KodeKehadiran | null) =>
    k == null
      ? '<td class="c na">—</td>'
      : k === 'mendatang'
        ? '<td class="c"></td>'
        : `<td class="c" style="background:${WARNA_KODE[k]};color:#ffffff" title="${esc(LABEL_KODE[k])}">${esc(SINGKAT_KODE[k])}</td>`
  const isi = baris
    .map(
      (b, i) => `<tr>
<td class="n">${i + 1}</td>
<td class="nm">${esc(b.anggota?.name ?? '(anggota terhapus)')}</td>
<td class="sk">${esc(b.anggota ? opsi.label(b.anggota.section) : '')}</td>
${b.rincian.map(sel).join('')}
<td class="num"><b>${b.hadir}</b>/${b.butuh}</td>
<td class="num">${b.izinSah + b.sakitSah}</td>
<td class="num">${b.tidakSah + b.alpha + b.kosong}</td>
<td class="st"><span style="background:${WARNA_STATUS[b.status]}">${esc(LABEL_STATUS[b.status])}</span></td>
</tr>`,
    )
    .join('\n')
  const perSeksi = new Map<string, typeof susulan>()
  for (const b of susulan) {
    const k = b.anggota ? opsi.label(b.anggota.section) : 'Lainnya'
    perSeksi.set(k, [...(perSeksi.get(k) ?? []), b])
  }
  const daftarSusulan = susulan.length
    ? [...perSeksi.entries()]
        .map(
          ([seksi, xs]) =>
            `<p class="grp"><b>${esc(seksi)}</b> (${xs.length})</p><ol>${xs
              .map((b) => `<li>${esc(b.anggota?.name ?? '(anggota terhapus)')} — <span class="al">${esc(b.alasan)}</span></li>`)
              .join('')}</ol>`,
        )
        .join('')
    : '<p class="al">Tidak ada peserta yang harus mengikuti pelantikan susulan.</p>'

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap Syarat Pelantikan — ${esc(p.nama)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111827; background: #ffffff; margin: 0; font-size: 8.5pt; }
h1 { font-size: 14pt; margin: 0; }
.sub { color: #4b5563; margin: 1mm 0 2mm; }
.aturan { border: .3mm solid #d1d5db; border-radius: 1.5mm; padding: 2mm 3mm; background: #f9fafb; margin-bottom: 2mm; }
.ring { display: flex; gap: 2mm; margin-bottom: 2mm; }
.ring div { flex: 1; border-radius: 1.5mm; padding: 1.5mm 2mm; color: #ffffff; }
.ring b { font-size: 13pt; display: block; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: .2mm solid #d1d5db; padding: .6mm .8mm; }
th { background: #1f2937; color: #ffffff; font-weight: 600; font-size: 7pt; }
th.c { width: 6mm; font-size: 6pt; padding: .4mm 0; }
td.c { text-align: center; font-weight: 700; font-size: 6.5pt; padding: .4mm 0; }
td.na { color: #9ca3af; }
td.n, th.n { width: 6mm; text-align: right; color: #6b7280; }
th.nm { width: 38mm; } td.nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
th.sk { width: 17mm; } td.sk { color: #4b5563; white-space: nowrap; overflow: hidden; }
th.num { width: 10mm; } td.num { text-align: center; }
th.st { width: 17mm; } td.st span { display: inline-block; color: #ffffff; border-radius: 1mm; padding: .2mm 1.2mm; font-size: 7pt; font-weight: 600; }
tr:nth-child(even) td.nm, tr:nth-child(even) td.sk, tr:nth-child(even) td.n, tr:nth-child(even) td.num { background: #f9fafb; }
.leg { margin: 1.5mm 0 3mm; color: #374151; font-size: 7pt; }
.leg i { display: inline-block; min-width: 4mm; text-align: center; color: #ffffff; font-style: normal; font-weight: 700; border-radius: .6mm; margin: 0 .8mm 0 2.5mm; }
h2 { font-size: 11pt; margin: 3mm 0 1mm; border-bottom: .4mm solid #e11d48; padding-bottom: .8mm; }
.grp { margin: 1.5mm 0 .5mm; } ol { margin: 0 0 1mm 5mm; padding: 0; } .al { color: #4b5563; }
.ttd { margin-top: 6mm; display: flex; justify-content: flex-end; } .ttd div { width: 55mm; text-align: center; } .ttd .gar { margin-top: 16mm; border-top: .3mm solid #111827; }
</style></head><body>
<h1>Rekap Syarat Pelantikan — ${esc(p.nama)}</h1>
<p class="sub">${esc(opsi.namaTim ?? '')}${opsi.namaTim ? ' · ' : ''}${r.wajib.length} sesi wajib · ${p.peserta.length} peserta · per ${esc(tgl(opsi.hariIni))}</p>
<div class="aturan">Lulus bila hadir ≥ <b>${a.persenMin}%</b> dari sesi wajib setelah dikurangi izin/sakit sah, dan minimal <b>${a.hadirMin}×</b> hadir fisik.
Izin sah bila tertulis sebelum jam mulai sesi; sakit sah bila dilaporkan paling lambat ${a.sakitMaksJam} jam sesudahnya; selain itu dihitung tanpa keterangan.${
    a.batasGabung ? ` Bergabung sesudah <b>${esc(tgl(a.batasGabung))}</b> → pelantikan susulan.` : ''
  }</div>
<div class="ring">${URUT.map((s) => `<div style="background:${WARNA_STATUS[s]}"><b>${r.jumlah[s]}</b>${esc(LABEL_STATUS[s])}</div>`).join('')}</div>
<table>
<thead><tr><th class="n">No</th><th class="nm">Nama</th><th class="sk">Seksi</th>${r.wajib
    .map((s) => `<th class="c">${esc(tglKecil(s.date))}</th>`)
    .join('')}<th class="num">Hadir</th><th class="num">Sah</th><th class="num">Absen</th><th class="st">Status</th></tr></thead>
<tbody>
${isi}
</tbody></table>
<p class="leg">${LEGENDA.map((k) => `<i style="background:${WARNA_KODE[k]}">${esc(SINGKAT_KODE[k])}</i>${esc(LABEL_KODE[k])}`).join('')} · — sebelum bergabung · Hadir = hadir/dibutuhkan</p>
<h2>Pelantikan susulan${camp ? ` — ${esc(camp.nama)}${camp.dari ? ` ${esc(tgl(camp.dari))}` : ' (tanggal belum ditentukan)'}` : ''} · ${susulan.length} orang</h2>
${daftarSusulan}
<div class="ttd"><div>Pelatih<div class="gar"></div></div></div>
</body></html>`
}
