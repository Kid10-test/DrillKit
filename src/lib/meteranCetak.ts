/**
 * v2.9 — Lembar Meteran Patok (A4 tegak) untuk tim perlengkapan.
 *
 * Satu grid: patok dipasang dalam **langkah**, lalu diukur dengan pita
 * meteran yang diberi tanda tiap 4 langkah. Lembar ini mendaftar jarak tiap
 * patok huruf dari A, tiap patok T dari T0 (tepi depan), dan tanda pita
 * meteran — dalam langkah dan meter. Dimuat malas dari editor lapangan.
 * Warna hex murni (aman untuk cetak & browser lama).
 */
import type { BarisMeteran, TabelMeteran } from './field'
import { esc, printShell } from './print'

function fmtM(m: number): string {
  return (Math.round(m * 100) / 100).toFixed(2).replace('.', ',')
}

function fmtLk(lk: number): string {
  const r = Math.round(lk * 100) / 100
  return String(r).replace('.', ',')
}

function tabel(judul: string, acuan: string, baris: BarisMeteran[]): string {
  const isi = baris.length
    ? baris
        .map(
          (b) =>
            `<tr${b.langkah === 0 ? ' class="nol"' : ''}><td class="lbl">${esc(b.label)}</td><td>${fmtLk(b.langkah)}</td><td class="m">${fmtM(b.meter)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="kosong">Tidak ada patok.</td></tr>'
  return `<table>
    <caption>${esc(judul)}</caption>
    <thead><tr><th>Patok</th><th>Langkah dari ${esc(acuan)}</th><th>Meter dari ${esc(acuan)}</th></tr></thead>
    <tbody>${isi}</tbody>
  </table>`
}

export function buatLembarMeteranHtml(opsi: {
  tabel: TabelMeteran
  /** Urutan patok huruf, mis. `C' # B' # A # B # C`. */
  pola?: string
  /** Label ukuran langkah, mis. `8-to-5 (22,5")`. */
  langkah?: string
}): string {
  const t = opsi.tabel
  const t0 = t.t[0]?.label ?? 'T0'
  const jauh = Math.max(t.huruf.at(-1)?.langkah ?? 0, t.t.at(-1)?.langkah ?? 0)
  const meterPerLk = t.langkahCm / 100
  const tanda: string[] = []
  const jarak = t.jarakTandaLangkah > 0 ? t.jarakTandaLangkah : 4
  for (let lk = jarak; lk <= jauh + 1e-9 && tanda.length < 40; lk += jarak) {
    tanda.push(`<span><b>${fmtLk(lk)} lk</b> ${fmtM(lk * meterPerLk)} m</span>`)
  }
  return printShell(
    'Lembar Meteran Patok — DrillKit',
    `<section class="lembar" data-lembar-meteran="1">
      <header>
        <div>
          <h1>Lembar Meteran Patok</h1>
          <p class="sub">1 langkah = ${fmtLk(t.langkahCm)} cm${opsi.langkah ? ` · ${esc(opsi.langkah)}` : ''}${
            opsi.pola ? ` · urutan: ${esc(opsi.pola)}` : ''
          }</p>
        </div>
      </header>
      <div class="kolom">
        ${tabel(t.duaSisi ? 'Patok huruf — dari A ke dua sisi (B dan B′ sama jauh)' : 'Patok huruf — dari A', 'A', t.huruf)}
        ${tabel(`Patok angka — dari ${t0} (tepi depan, sejajar patok huruf) ke belakang`, t0, t.t)}
      </div>
      <h2>Tanda pita meteran (tiap ${fmtLk(jarak)} langkah)</h2>
      <p class="tanda">${tanda.join('') || '—'}</p>
      <ol class="cara">
        <li>Bentangkan pita dari <b>A</b> sepanjang tepi depan; pasang patok huruf di tiap tanda (${t.duaSisi ? 'ulangi ke sisi seberang' : 'lurus ke seberang'}). Deretan ini adalah <b>${esc(t0)}</b>.</li>
        <li>Dari tiap patok huruf (atau minimal di A dan kedua ujung), ukur tegak lurus ke belakang untuk ${esc(t.t[1]?.label ?? 'T1')}, ${esc(t.t[2]?.label ?? 'T2')}, … memakai kolom kanan.</li>
        <li>Koordinat di buku saku memakai patok yang sama, mis. <b>B +2 · ${esc(t.t[3]?.label ?? 'T3')}</b> = 2 langkah dari B (menjauhi A), tepat di ${esc(t.t[3]?.label ?? 'T3')}.</li>
      </ol>
      <p class="kaki">Jarak dihitung dari ukuran langkah tim; meter dibulatkan ke cm. Bila ukuran langkah diubah, cetak ulang lembar ini · DrillKit</p>
    </section>`,
    `@page { size: A4 portrait; margin: 12mm; }
     .lembar { font-size: 10.5px; color:#0f172a; }
     header { border-bottom:2px solid #0f172a; padding-bottom:6px; margin-bottom:8px; }
     h1 { font-size:17px; margin:0; }
     h2 { font-size:12px; margin:10px 0 4px; border-bottom:1px solid #94a3b8; }
     .sub { margin:2px 0 0; color:#334155; }
     .kolom { display:flex; gap:12px; align-items:flex-start; }
     .kolom table { flex:1; }
     table { width:100%; border-collapse:collapse; }
     caption { text-align:left; font-weight:700; font-size:11px; padding:0 0 3px; }
     th, td { border:1px solid #cbd5e1; padding:2px 5px; text-align:center; }
     th { background:#e2e8f0; font-size:9.5px; }
     td.lbl { font-weight:700; }
     td.m { font-weight:700; font-variant-numeric: tabular-nums; }
     tr.nol td { background:#f1f5f9; }
     .kosong { color:#64748b; }
     .tanda { display:flex; flex-wrap:wrap; gap:3px 10px; margin:0; }
     .tanda span { white-space:nowrap; }
     .cara { margin:8px 0 0; padding-left:18px; }
     .cara li { margin-bottom:2px; }
     .kaki { color:#475569; font-size:9px; margin-top:6px; }`,
  )
}
