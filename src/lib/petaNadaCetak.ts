/**
 * #29 — Kartu saku **Peta Kecenderungan Nada** (A6 atau A5, 1 halaman).
 *
 * Dimuat malas (`import()`) dari Studio Intonasi supaya tidak menambah bundel
 * awal. Seluruh warna `#hex` murni — tanpa `oklch()`, `color-mix()`, `rgba()`.
 * Kartu diselipkan di lyre/stand partitur: tiap nada tangga dengan selisih
 * sennya, arah koreksi, dan batang mini (merah = tinggi, biru = rendah).
 */
import { cariTransposisi } from './tuner'
import { esc, printShell } from './print'
import { cariTanggaPeta, labelNadaPeta, ringkasPeta, saranKecenderungan, type PetaKecenderungan } from './intonasi'

export type UkuranKartuPeta = 'a6' | 'a5'

/** Kapasitas baris per kartu (15 nada = tangga 2 oktaf muat di A6). */
export const KAP_BARIS_PETA: Record<UkuranKartuPeta, number> = { a6: 15, a5: 26 }

const WARNA = {
  tinggi: '#dc2626',
  rendah: '#2563eb',
  aman: '#059669',
  garis: '#cbd5e1',
  redup: '#475569',
}

export function bangunHtmlKartuPeta(p: PetaKecenderungan, ukuran: UkuranKartuPeta = 'a6', namaTim = ''): string {
  const tr = cariTransposisi(p.transposisi)
  const tangga = cariTanggaPeta(p.tangga)
  const kap = KAP_BARIS_PETA[ukuran]
  const tampil = p.nada.slice(0, kap)
  const sisa = p.nada.length - tampil.length
  const r = ringkasPeta(p)
  const kecil = ukuran === 'a6'
  const baris = tampil
    .map((n) => {
      const l = labelNadaPeta(n.midi, p.transposisi)
      const s = saranKecenderungan(n.sen)
      const warna = WARNA[s.arah]
      const lebar = Math.min(50, Math.abs(n.sen))
      const batang =
        n.sen >= 0
          ? `<span style="position:absolute;left:50%;width:${lebar}%;top:2px;bottom:2px;background:${warna}"></span>`
          : `<span style="position:absolute;right:50%;width:${lebar}%;top:2px;bottom:2px;background:${warna}"></span>`
      return `<tr>
        <td class="nd"><b>${esc(l.tertulis)}</b>${tr.geser ? `<span class="ks"> ${esc(l.konser)}</span>` : ''}</td>
        <td class="sn" style="color:${warna}">${n.sen > 0 ? '+' : n.sen < 0 ? '−' : '±'}${Math.abs(n.sen)}¢</td>
        <td class="bt"><span class="trk">${batang}<span class="nol"></span></span></td>
        <td class="sr">${esc(s.teks)}</td>
      </tr>`
    })
    .join('')
  const tanggal = p.dibuat ? new Date(p.dibuat).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const css = `
    @page { size: ${ukuran === 'a6' ? 'A6' : 'A5'} portrait; margin: ${kecil ? '6mm' : '9mm'}; }
    body { font-size: ${kecil ? '8.4pt' : '10pt'}; }
    .kartu { border: 1.5px solid #0f172a; border-radius: 6px; padding: ${kecil ? '2.5mm' : '4mm'}; }
    h1 { font-size: ${kecil ? '11pt' : '14pt'}; margin: 0 0 1mm; }
    .meta { color: ${WARNA.redup}; margin: 0 0 2mm; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: ${kecil ? '7pt' : '8.4pt'}; color: ${WARNA.redup}; border-bottom: 1px solid ${WARNA.garis}; padding: 0.6mm 0.8mm; }
    td { border-bottom: 1px solid ${WARNA.garis}; padding: ${kecil ? '0.7mm' : '1.1mm'} 0.8mm; vertical-align: middle; }
    .nd { white-space: nowrap; width: 18%; }
    .ks { color: ${WARNA.redup}; font-size: 0.85em; }
    .sn { font-weight: 700; white-space: nowrap; width: 11%; text-align: right; }
    .bt { width: 24%; }
    .trk { position: relative; display: block; height: ${kecil ? '7px' : '9px'}; background: #f1f5f9; border-radius: 2px; }
    .nol { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #0f172a; }
    .sr { font-size: 0.9em; }
    .ring { margin-top: 2mm; display: flex; gap: 3mm; flex-wrap: wrap; }
    .ring span { border: 1px solid ${WARNA.garis}; border-radius: 4px; padding: 0.6mm 1.6mm; }
    .kaki { margin-top: 1.5mm; color: ${WARNA.redup}; font-size: 0.85em; }
    .no-print { margin: 8px 0; font-family: system-ui; }
  `
  const body = `
  <div class="kartu" data-kartu-peta="${ukuran}">
    <h1>Peta Kecenderungan Nada — ${esc(p.nama)}</h1>
    <p class="meta">${esc(tr.label)} · ${esc(tangga.label)} · A4 = ${p.a4} Hz${tanggal ? ` · ${esc(tanggal)}` : ''}${namaTim ? ` · ${esc(namaTim)}` : ''}</p>
    <table>
      <thead><tr><th>Nada${tr.geser ? ' (tertulis · konser)' : ''}</th><th style="text-align:right">Sen</th><th>Arah</th><th>Saran</th></tr></thead>
      <tbody>${baris}</tbody>
    </table>
    ${sisa > 0 ? `<p class="kaki">+${sisa} nada lain tidak muat — cetak ukuran A5.</p>` : ''}
    <div class="ring">
      <span>Rata-rata meleset <b>${r.rataAbs}¢</b></span>
      ${r.tertinggi ? `<span style="color:${WARNA.tinggi}">Paling tinggi: <b>${esc(labelNadaPeta(r.tertinggi.midi, p.transposisi).tertulis)} +${r.tertinggi.sen}¢</b></span>` : ''}
      ${r.terendah ? `<span style="color:${WARNA.rendah}">Paling rendah: <b>${esc(labelNadaPeta(r.terendah.midi, p.transposisi).tertulis)} −${Math.abs(r.terendah.sen)}¢</b></span>` : ''}
    </div>
    <p class="kaki">Merah = cenderung tinggi · biru = cenderung rendah · hijau = aman (&lt; 5¢). Ukur ulang tiap ganti mouthpiece / cuaca ekstrem.</p>
  </div>`
  return printShell(`Peta nada ${p.nama}`, body, css)
}
