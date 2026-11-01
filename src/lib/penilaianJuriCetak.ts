import type { PenilaianLomba } from '../db/types'
import {
  LABEL_KELOMPOK_CAPTION,
  LABEL_SKEMA_CAPTION,
  formatWaktuDetik,
  hitungRekapPenilaian,
  urutkanCatatanJudgeTape,
} from './penilaianJuri'
import { downloadHtmlFile, printHtml } from './print'

/**
 * Pembangun HTML Cetak A4 Resmi **Caption Recap Sheet & Transkrip Judge Tape** (#20).
 *
 * Seluruh palet memakai **hex murni (`#rrggbb`)** — tanpa `oklch()`, `color-mix()`,
 * atau `rgba()` — aman untuk mesin cetak maupun ekspor PDF di semua peramban.
 */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt2(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

export interface DataCetakPenilaianJuri {
  namaTim: string
  penilaian: PenilaianLomba
  namaDrill?: string
  namaLagu?: string
  namaSesi?: string
}

export function bangunHtmlRekapPenilaian(data: DataCetakPenilaianJuri): string {
  const { penilaian } = data
  const rekap = hitungRekapPenilaian(penilaian)
  const catatanUrut = urutkanCatatanJudgeTape(penilaian.catatanWaktu)

  const warnaBox =
    rekap.predikatBox === 'Box 5'
      ? { bg: '#dcfce7', border: '#16a34a', text: '#14532d' }
      : rekap.predikatBox === 'Box 4'
        ? { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e' }
        : rekap.predikatBox === 'Box 3'
          ? { bg: '#fef3c7', border: '#d97706', text: '#78350f' }
          : { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' }

  const barisKelompok = rekap.perKelompok
    .map(
      (k) => `<div class="kotak">
        <div class="lbl">${esc(k.label)}</div>
        <div class="val">${fmt2(k.terbobot)} <span class="ket">/ ${fmt2(k.maksTerbobot)}</span></div>
        <div class="ket">${fmt2(k.persen)}% capaian</div>
      </div>`,
    )
    .join('')

  const barisTabel = rekap.baris
    .map(
      (b) => `<tr>
        <td>
          <strong>${esc(b.label)}</strong>
          ${b.namaJuri ? `<div class="sub">Juri: ${esc(b.namaJuri)}</div>` : ''}
          ${b.catatan ? `<div class="sub">${esc(b.catatan)}</div>` : ''}
        </td>
        <td style="text-align:center;">${esc(LABEL_KELOMPOK_CAPTION[b.kelompok])}</td>
        <td class="angka">${fmt2(b.komposisi)} / ${fmt2(b.maksKomposisi)}</td>
        <td class="angka">${fmt2(b.eksekusi)} / ${fmt2(b.maksEksekusi)}</td>
        <td class="angka">${b.pengaliBobot === 1 ? '1,0×' : `${String(b.pengaliBobot).replace('.', ',')}×`}</td>
        <td class="angka"><strong>${fmt2(b.terbobot)}</strong> <span class="sub">/ ${fmt2(b.maksTerbobot)}</span></td>
      </tr>`,
    )
    .join('')

  const htmlPenalti =
    penilaian.penalti.length === 0
      ? ''
      : `<div class="kotak-penalti">
          <strong>Pengurangan Penalti (−${fmt2(rekap.totalPenalti)} poin):</strong>
          <ul>
            ${penilaian.penalti.map((p) => `<li>${esc(p.alasan)} — <strong>−${fmt2(p.poin)}</strong></li>`).join('')}
          </ul>
        </div>`

  const htmlJudgeTape =
    catatanUrut.length === 0
      ? `<p class="kosong">Tidak ada catatan berpenanda waktu pada evaluasi ini.</p>`
      : `<table>
          <thead>
            <tr>
              <th style="width:68px;">Waktu</th>
              <th style="width:135px;">Set &amp; Birama</th>
              <th style="width:92px;">Fokus</th>
              <th>Komentar Juri / Evaluasi Staf</th>
            </tr>
          </thead>
          <tbody>
            ${catatanUrut
              .map((c) => {
                const tautan = [
                  c.labelSet ? `${c.labelSet}${c.hitunganSet ? ` (Cnt ${c.hitunganSet})` : ''}` : '',
                  c.birama ? `Birama ${c.birama}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
                const fokusLbl =
                  c.fokus === 'umum' ? 'Umum' : LABEL_KELOMPOK_CAPTION[c.fokus]
                return `<tr>
                  <td class="angka"><strong>${formatWaktuDetik(c.detik)}</strong></td>
                  <td>${tautan ? esc(tautan) : '<span class="sub">—</span>'}</td>
                  <td style="text-align:center;">${esc(fokusLbl)}</td>
                  <td>${c.tingkat === 'penting' ? '<strong>[PRIORITAS]</strong> ' : c.tingkat === 'pujian' ? '<strong>[APRESIASI]</strong> ' : ''}${esc(c.teks)}</td>
                </tr>`
              })
              .join('')}
          </tbody>
        </table>`

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Caption Recap Sheet — ${esc(penilaian.judul)}</title>
<style>
  @page { size: A4 portrait; margin: 11mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.42;
  }
  .kop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .kop h1 { margin: 0; font-size: 16px; color: #0f172a; }
  .kop .meta { font-size: 10.5px; color: #475569; margin-top: 2px; }
  .skor-utama {
    text-align: right;
  }
  .skor-utama .nilai {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }
  .lencana-box {
    display: inline-block;
    margin-top: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: ${warnaBox.bg};
    border: 1px solid ${warnaBox.border};
    color: ${warnaBox.text};
  }
  .grid-klp {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .kotak {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    background: #f8fafc;
  }
  .kotak .lbl { font-size: 9.5px; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
  .kotak .val { font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .kotak .ket { font-size: 9.5px; color: #64748b; font-weight: 400; }
  h2 {
    margin: 11px 0 6px;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1e293b;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.3px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
  }
  th {
    background: #1e293b;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
  }
  td.angka, th.angka {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  tfoot td {
    background: #f1f5f9;
    font-weight: 700;
  }
  .sub { font-size: 9.2px; color: #475569; margin-top: 1px; }
  .kotak-penalti {
    margin-top: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid #dc2626;
    background: #fef2f2;
    color: #7f1d1d;
    font-size: 10.5px;
  }
  .kotak-penalti ul { margin: 4px 0 0 18px; padding: 0; }
  .catatan-umum {
    margin-top: 10px;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid #94a3b8;
    background: #f8fafc;
    color: #1e293b;
  }
  .kosong { color: #64748b; font-style: italic; margin: 4px 0; }
  .kaki-rahasia {
    margin-top: 12px;
    border-top: 1px solid #cbd5e1;
    padding-top: 5px;
    font-size: 9px;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="kop">
    <div>
      <h1>CAPTION RECAP SHEET &amp; EVALUASI JURI</h1>
      <div class="meta">
        <strong>${esc(data.namaTim)}</strong> · ${esc(penilaian.judul)} · Tanggal: <strong>${esc(penilaian.tanggal)}</strong>
      </div>
      <div class="meta">
        Skema: ${esc(LABEL_SKEMA_CAPTION[penilaian.skema])}
        ${penilaian.juriUtama ? ` · Koordinator/Juri: <strong>${esc(penilaian.juriUtama)}</strong>` : ''}
        ${data.namaDrill ? ` · Drill: ${esc(data.namaDrill)}` : ''}
        ${data.namaLagu ? ` · Lagu: ${esc(data.namaLagu)}` : ''}
      </div>
    </div>
    <div class="skor-utama">
      <div class="nilai">${fmt2(rekap.skorAkhir)}</div>
      <div class="lencana-box">${esc(rekap.predikatBox)} (${fmt2(rekap.persenAkhir)}%)</div>
    </div>
  </div>

  <div class="grid-klp">
    ${barisKelompok}
  </div>

  <h2>Rincian Nilai Sub-Caption</h2>
  <table>
    <thead>
      <tr>
        <th>Sub-Caption &amp; Juri</th>
        <th style="text-align:center;">Kelompok</th>
        <th class="angka">Komposisi / Rep</th>
        <th class="angka">Eksekusi / Achv</th>
        <th class="angka">Bobot</th>
        <th class="angka">Nilai Terbobot</th>
      </tr>
    </thead>
    <tbody>
      ${barisTabel}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5">Subtotal Sebelum Penalti</td>
        <td class="angka">${fmt2(rekap.subtotal)} / ${fmt2(rekap.maksSubtotal)}</td>
      </tr>
      <tr>
        <td colspan="5">Pengurangan Penalti</td>
        <td class="angka">−${fmt2(rekap.totalPenalti)}</td>
      </tr>
      <tr>
        <td colspan="5">SKOR AKHIR BERSIH (${esc(rekap.predikatBox)})</td>
        <td class="angka">${fmt2(rekap.skorAkhir)}</td>
      </tr>
    </tfoot>
  </table>

  ${htmlPenalti}

  ${
    penilaian.catatanUmum
      ? `<div class="catatan-umum"><strong>Catatan Umum Evaluasi:</strong> ${esc(penilaian.catatanUmum)}</div>`
      : ''
  }

  <h2>Transkrip Komentar Judge Tape Tertaut Set &amp; Birama (${catatanUrut.length} catatan)</h2>
  ${htmlJudgeTape}

  <div class="kaki-rahasia">
    Dokumen internal staf pelatih &amp; juri — tidak disertakan ke dalam paket anggota DrillKit.
  </div>
</body>
</html>`
}

export function cetakAtauUnduhRekapPenilaian(data: DataCetakPenilaianJuri): 'cetak' | 'unduh' {
  const html = bangunHtmlRekapPenilaian(data)
  if (printHtml(html)) return 'cetak'
  const slug =
    penilaianSlug(data.penilaian.judul) || `rekap-juri-${data.penilaian.tanggal}`
  downloadHtmlFile(`caption-recap-${slug}.html`, html)
  return 'unduh'
}

function penilaianSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
