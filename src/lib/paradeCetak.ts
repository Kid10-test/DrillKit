import type { DrillPoint, FieldConfig, Member } from '../db/types'
import { YD_TO_M, paradeOf } from './field'
import type { HasilKalkulatorParade } from './parade'
import { posisiSafBanjarAnggota } from './parade'
import { downloadHtmlFile, printHtml } from './print'

/**
 * Pembangun HTML Cetak A4 **Lembar Komando & Peta Barisan Kirab / Street Parade** (#19).
 *
 * Seluruh palet memakai **hex murni (`#rrggbb`)** — tanpa `oklch()`, `color-mix()`,
 * atau `rgba()` — aman untuk mesin cetak browser lama maupun simpan ke PDF.
 */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface DataCetakParade {
  namaTim: string
  judulDrill: string
  namaSet: string
  field: FieldConfig
  points: Record<string, DrillPoint>
  members: Member[]
  rute: HasilKalkulatorParade
  namaLagu?: string
}

export function bangunHtmlLembarParade(data: DataCetakParade): string {
  const p = paradeOf(data.field)
  const lebarJalanM = (data.field.widthYd * YD_TO_M).toFixed(1).replace('.', ',')
  const panjangSegmenM = (data.field.lengthYd * YD_TO_M).toFixed(0)
  const petaMember = new Map(data.members.map((m) => [m.id, m]))

  // Susun tabel Saf demi Saf dari susunan titik aktif.
  const barisSaf = new Map<number, { banjar: number; id: string; kode: string; nama: string; seksi: string }[]>()
  let maksBanjar = 1
  for (const id of Object.keys(data.points)) {
    const info = posisiSafBanjarAnggota(data.points, id, data.field)
    if (!info) continue
    const m = petaMember.get(id)
    const daftar = barisSaf.get(info.nomorSaf) ?? []
    daftar.push({
      banjar: info.nomorBanjar,
      id,
      kode: m?.code || id.slice(0, 4).toUpperCase(),
      nama: m?.name || 'Anggota',
      seksi: m?.role === 'drumMajor' ? 'Gitapati' : (m?.section ?? '-'),
    })
    if (info.nomorBanjar > maksBanjar) maksBanjar = info.nomorBanjar
    barisSaf.set(info.nomorSaf, daftar)
  }

  const nomorSafUrut = [...barisSaf.keys()].sort((a, b) => a - b)
  const warnaStatus =
    data.rute.statusKetahanan === 'nyaman'
      ? { bg: '#dcfce7', border: '#16a34a', text: '#14532d', label: 'NYAMAN' }
      : data.rute.statusKetahanan === 'padat'
        ? { bg: '#fef3c7', border: '#d97706', text: '#78350f', label: 'PADAT' }
        : { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d', label: 'RAWAN LELAH' }

  const headerBanjar = Array.from({ length: maksBanjar }, (_, i) => `<th>Banjar ${i + 1}</th>`).join('')
  const htmlBarisSaf =
    nomorSafUrut.length === 0
      ? `<tr><td colspan="${maksBanjar + 1}" style="text-align:center;color:#64748b;padding:12px;">Belum ada titik pemain di set ini.</td></tr>`
      : nomorSafUrut
          .map((noSaf) => {
            const isi = (barisSaf.get(noSaf) ?? []).sort((a, b) => a.banjar - b.banjar)
            const selPerBanjar = Array.from({ length: maksBanjar }, (_, idx) => {
              const targetBanjar = idx + 1
              // Bila saf hanya berisi 1 Gitapati di tengah, taruh di kolom tengah agar mudah dibaca.
              if (isi.length === 1 && maksBanjar > 1) {
                const kolomTengah = Math.ceil(maksBanjar / 2)
                if (targetBanjar !== kolomTengah) return `<td class="kosong">—</td>`
                const s = isi[0]
                return `<td><strong>${esc(s.kode)}</strong><div class="sub">${esc(s.nama)}</div></td>`
              }
              const s = isi.find((x) => x.banjar === targetBanjar)
              if (!s) return `<td class="kosong">—</td>`
              return `<td><strong>${esc(s.kode)}</strong><div class="sub">${esc(s.nama)}</div></td>`
            }).join('')
            return `<tr><td class="saf">Saf ${noSaf}</td>${selPerBanjar}</tr>`
          })
          .join('')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Lembar Komando Kirab — ${esc(data.judulDrill)}</title>
<style>
  @page { size: A4 portrait; margin: 11mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.4;
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
  .lencana {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: ${warnaStatus.bg};
    border: 1px solid ${warnaStatus.border};
    color: ${warnaStatus.text};
  }
  .grid4 {
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
  .kotak .ket { font-size: 9.5px; color: #64748b; }
  .kotak-vip {
    border: 1px solid #f59e0b;
    background: #fffbeb;
    border-radius: 6px;
    padding: 7px 10px;
    margin-bottom: 10px;
    color: #78350f;
  }
  h2 {
    margin: 10px 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1e293b;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    text-align: center;
    vertical-align: top;
  }
  th {
    background: #1e293b;
    color: #ffffff;
    font-weight: 700;
  }
  td.saf {
    background: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    width: 58px;
  }
  td.kosong { color: #94a3b8; background: #f8fafc; }
  td .sub { font-size: 9px; color: #475569; margin-top: 1px; }
  .catatan {
    margin-top: 10px;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid ${warnaStatus.border};
    background: ${warnaStatus.bg};
    color: ${warnaStatus.text};
    font-size: 10.5px;
  }
</style>
</head>
<body>
  <div class="kop">
    <div>
      <h1>LEMBAR KOMANDO KIRAB / STREET PARADE</h1>
      <div class="meta">${esc(data.namaTim)} · Drill: <strong>${esc(data.judulDrill)}</strong> (${esc(data.namaSet)})${data.namaLagu ? ` · Lagu: ${esc(data.namaLagu)}` : ''}</div>
    </div>
    <div class="lencana">KETAHANAN: ${warnaStatus.label}</div>
  </div>

  <div class="grid4">
    <div class="kotak">
      <div class="lbl">Koridor Jalan</div>
      <div class="val">Lebar ${lebarJalanM} m</div>
      <div class="ket">Segmen ${panjangSegmenM} m · Bahu ${String(p.bahuJalanM).replace('.', ',')} m</div>
    </div>
    <div class="kotak">
      <div class="lbl">Rute & Waktu Tempuh</div>
      <div class="val">${String(data.rute.panjangRuteKm).replace('.', ',')} km · ${String(data.rute.totalWaktuTempuhMenit).replace('.', ',')} mnt</div>
      <div class="ket">${data.rute.totalLangkah.toLocaleString('id-ID')} langkah (${String(data.rute.kecepatanKmPerJam).replace('.', ',')} km/jam)</div>
    </div>
    <div class="kotak">
      <div class="lbl">Tempo & Langkah</div>
      <div class="val">${data.rute.bpm} BPM · ${String(data.rute.panjangLangkahCm).replace('.', ',')} cm</div>
      <div class="ket">${String(data.rute.kecepatanMPerMenit).replace('.', ',')} meter / menit</div>
    </div>
    <div class="kotak">
      <div class="lbl">Siklus Lagu & Napas</div>
      <div class="val">${data.rute.jumlahPengulanganLagu}× putaran</div>
      <div class="ket">Lagu ${Math.round(data.rute.jarakLaguM)} m + Street beat ${Math.round(data.rute.jarakStreetBeatM)} m</div>
    </div>
  </div>

  ${
    p.panggungAktif === 1
      ? `<div class="kotak-vip">
          <strong>${esc(p.labelPanggung)}:</strong> bentang <strong>${p.panjangPanggungM} m</strong> di sisi <strong>${p.sisiPanggung === 'belakang' ? 'Tepi Belakang (Atas)' : 'Tepi Depan (Penonton)'}</strong> · Arah defile: <strong>${p.arahDefile === 'kanan-ke-kiri' ? 'Kanan → Kiri' : 'Kiri → Kanan'}</strong>.
        </div>`
      : ''
  }

  <h2>Peta Susunan Barisan Defile (Kepala Saf 1 → Ekor Saf ${nomorSafUrut.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Saf</th>
        ${headerBanjar}
      </tr>
    </thead>
    <tbody>
      ${htmlBarisSaf}
    </tbody>
  </table>

  <div class="catatan">
    <strong>Evaluasi Cadangan Napas (${String(data.rute.rasioCadanganNapasPersen).replace('.', ',')}%):</strong>
    ${esc(data.rute.rekomendasiNapas)}
  </div>
</body>
</html>`
}

export function cetakAtauUnduhLembarParade(data: DataCetakParade): 'cetak' | 'unduh' {
  const html = bangunHtmlLembarParade(data)
  if (printHtml(html)) return 'cetak'
  const slug = data.judulDrill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'parade'
  downloadHtmlFile(`komando-kirab-${slug}.html`, html)
  return 'unduh'
}
