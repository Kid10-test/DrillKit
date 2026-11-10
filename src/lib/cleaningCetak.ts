/**
 * #26 (`v2.2.4`) — Lembar Fokus *Cleaning* Harian (A4 potret, 1 halaman).
 *
 * Dimuat malas (`import()`) dari panel cleaning supaya tidak menambah bundel
 * awal. Seluruh warna `#hex` murni — tanpa `oklch()`, `color-mix()`, `rgba()`.
 * Baris yang melebihi kapasitas satu halaman diringkas "+n catatan lain".
 */
import type { SectionDef, TindakLanjut } from '../db/types'
import { esc, printShell } from './print'
import {
  LABEL_STATUS_TL,
  LABEL_SUMBER_TL,
  WARNA_STATUS_TL_HEX,
  hitungStatusTL,
  konteksTL,
  urutkanTindakLanjut,
} from './tindakLanjut'

/** Kapasitas baris per halaman A4 (diukur Chromium 96 dpi, ±10% cadangan). */
export const KAP_BARIS_LEMBAR_CLEANING = 22

export function buatLembarFokusCleaningHtml(opsi: {
  namaTim: string
  namaDrill: string
  tanggal: string
  /** #34a — judul lembar; Papan Staf memakai "Lembar Fokus Latihan & Cleaning". */
  judul?: string
  /** #34a — tampilkan lencana asal (Juri/Staf) di kolom temuan. */
  tandaiSumber?: boolean
  daftar: TindakLanjut[]
  sections?: SectionDef[]
  /** Sertakan catatan yang sudah beres (bawaan: hanya yang beres hari ini). */
  sertakanBeres?: boolean
  sekarang?: number
}): string {
  const sekarang = opsi.sekarang ?? Date.now()
  const awalHari = new Date(sekarang)
  awalHari.setHours(0, 0, 0, 0)
  const labelSeksi = (k?: string) =>
    k ? (opsi.sections ?? []).find((s) => s.id === k)?.label ?? k : 'Semua seksi'
  const terurut = urutkanTindakLanjut(opsi.daftar).filter(
    (t) => t.status !== 'beres' || opsi.sertakanBeres || (t.beresAt ?? 0) >= awalHari.getTime(),
  )
  const tampil = terurut.slice(0, KAP_BARIS_LEMBAR_CLEANING)
  const sisa = terurut.length - tampil.length
  const jml = hitungStatusTL(opsi.daftar)

  const baris = tampil
    .map((t, i) => {
      const w = WARNA_STATUS_TL_HEX[t.status]
      const ktx = konteksTL(t)
      return `<tr data-status="${t.status}">
        <td class="no">${i + 1}</td>
        <td><span class="lencana" style="color:${w.teks};background:${w.latar};border-color:${w.garis}">${LABEL_STATUS_TL[t.status]}</span>${t.prioritas === 'tinggi' ? ' <b class="prio">!</b>' : ''}</td>
        <td class="ktx">${esc(ktx || '—')}</td>
        <td>${esc(labelSeksi(t.seksi))}</td>
        <td class="judul">${opsi.tandaiSumber && t.sumber !== 'cleaning' ? `<span class="sumber">${LABEL_SUMBER_TL[t.sumber]}</span> ` : ''}${esc(t.judul)}${t.catatan ? `<div class="cat">${esc(t.catatan)}</div>` : ''}</td>
        <td class="cek"><span class="kotak"></span></td>
      </tr>`
    })
    .join('')

  const kosong = `<tr><td colspan="6" class="kosong">Belum ada temuan terbuka — lapangan bersih hari ini.</td></tr>`

  return printShell(
    `${opsi.judul ?? 'Lembar Fokus Cleaning'} — ${opsi.namaDrill}`,
    `<section class="lembar" data-lembar-cleaning="1">
      <header>
        <div>
          <h1>${esc(opsi.judul ?? 'Lembar Fokus Cleaning Harian')}</h1>
          <p class="sub">${esc(opsi.namaTim)} · ${esc(opsi.namaDrill)}</p>
        </div>
        <div class="kanan">
          <p class="sub">${esc(opsi.tanggal)}</p>
          <p class="ringkas">
            <span style="color:${WARNA_STATUS_TL_HEX.fokus.teks}">Fokus ${jml.fokus}</span> ·
            <span style="color:${WARNA_STATUS_TL_HEX.temuan.teks}">Temuan ${jml.temuan}</span> ·
            <span style="color:${WARNA_STATUS_TL_HEX.beres.teks}">Beres ${jml.beres}</span>
          </p>
        </div>
      </header>
      <table>
        <colgroup><col style="width:5%"><col style="width:11%"><col style="width:17%"><col style="width:14%"><col style="width:46%"><col style="width:7%"></colgroup>
        <thead><tr><th>#</th><th>Status</th><th>Set / Birama</th><th>Seksi</th><th>Temuan &amp; perbaikan</th><th>Cek</th></tr></thead>
        <tbody>${baris || kosong}</tbody>
      </table>
      ${sisa > 0 ? `<p class="sisa">+${sisa} catatan lain tidak muat di satu halaman — lihat aplikasi.</p>` : ''}
      <p class="kaki">Urutan: Fokus → Temuan → Beres hari ini · centang kolom Cek saat sudah diulang bersih di lapangan · DrillKit</p>
    </section>`,
    `@page { size: A4 portrait; margin: 12mm; }
     .lembar { width: 186mm; }
     header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5px solid #0f172a; padding-bottom:6px; margin-bottom:8px; }
     h1 { font-size:16px; margin:0 0 2px; color:#0f172a; }
     .sub { font-size:10.5px; color:#475569; margin:0; }
     .kanan { text-align:right; }
     .ringkas { font-size:10.5px; font-weight:700; margin:2px 0 0; }
     table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10.5px; }
     th, td { border:1px solid #94a3b8; padding:4px 5px; text-align:left; vertical-align:top; }
     th { background:#f1f5f9; color:#0f172a; text-transform:uppercase; font-size:9px; letter-spacing:.03em; }
     td.no { text-align:center; color:#475569; }
     td.judul { font-weight:600; color:#0f172a; }
     td.ktx { font-family: ui-monospace, monospace; font-size:9.5px; }
     .cat { font-weight:400; color:#334155; font-size:9.5px; margin-top:1px; }
     .lencana { display:inline-block; border:1px solid; border-radius:3px; padding:0 4px; font-size:9px; font-weight:700; }
     .prio { color:#b91c1c; }
     .sumber { display:inline-block; border:1px solid #64748b; border-radius:3px; padding:0 3px; font-size:8.5px; font-weight:700; color:#334155; }
     td.cek { text-align:center; }
     .kotak { display:inline-block; width:10px; height:10px; border:1.2px solid #0f172a; }
     .kosong { text-align:center; color:#64748b; padding:14px; }
     .sisa { font-size:9.5px; color:#9a3412; margin:6px 0 0; }
     .kaki { font-size:8.5px; color:#64748b; margin:8px 0 0; }`,
  )
}
