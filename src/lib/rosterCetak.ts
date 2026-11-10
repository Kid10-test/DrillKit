/**
 * v2.7.1 — Lembar Rekap Roster A4 (tegak) untuk rapat PSDA / pengurus.
 *
 * Halaman 1: tabel section × instrumen × kelompok roster. Lampiran: daftar
 * nama per kelompok (nonaktif ditandai). Dimuat malas dari modal Rekap
 * roster. Warna hex murni (aman untuk cetak & browser lama).
 */
import { esc, printShell } from './print'
import { type BarisRekapRoster, type RekapRoster, teksSelRekap } from './rosterAnggota'

export function buatLembarRekapRosterHtml(opsi: {
  namaTim: string
  tanggal: string
  rekap: RekapRoster
  /** Sertakan lampiran daftar nama per kelompok. */
  sertakanNama?: boolean
}): string {
  const { rekap } = opsi
  const kepala = `<tr><th class="kiri">Instrumen</th>${rekap.kelompok.map((k) => `<th>${esc(k)}</th>`).join('')}<th>Lainnya</th><th>Total aktif</th></tr>`
  const sel = (b: BarisRekapRoster, kelas = '') =>
    `<tr class="${kelas}"><td class="kiri">${esc(b.instrumen)}</td>${b.sel
      .map((s) => `<td>${esc(teksSelRekap(s))}</td>`)
      .join('')}<td>${b.lainnya || '–'}</td><td class="tebal">${b.totalAktif}</td></tr>`
  const tabel = rekap.seksi
    .map(
      (s) => `<tbody>
        <tr class="seksi"><td colspan="${rekap.kelompok.length + 3}">${esc(s.label)}</td></tr>
        ${s.baris.map((b) => sel(b)).join('')}
        ${sel({ ...s.jumlah, instrumen: `Jumlah ${s.label}` }, 'jumlah')}
      </tbody>`,
    )
    .join('')
  const kosong = `<tbody><tr><td colspan="${rekap.kelompok.length + 3}" class="kosong">Belum ada anggota.</td></tr></tbody>`

  const lampiran =
    opsi.sertakanNama && rekap.nama.some((n) => n.anggota.length)
      ? `<section class="lampiran">
          <h2>Daftar nama per kelompok</h2>
          ${rekap.nama
            .filter((n) => n.anggota.length)
            .map(
              (n) => `<div class="kel">
                <h3>${esc(n.kelompok)} <span>(${n.anggota.filter((a) => a.aktif).length} aktif${
                  n.anggota.some((a) => !a.aktif) ? ` · ${n.anggota.filter((a) => !a.aktif).length} nonaktif` : ''
                })</span></h3>
                <ol>${n.anggota
                  .map(
                    (a) =>
                      `<li${a.aktif ? '' : ' class="non"'}>${esc(a.name)} <span class="ins">${esc(a.instrumen)}</span>${a.aktif ? '' : ' <span class="tanda">nonaktif</span>'}</li>`,
                  )
                  .join('')}</ol>
              </div>`,
            )
            .join('')}
        </section>`
      : ''

  return printShell(
    `Rekap Roster — ${opsi.namaTim}`,
    `<section class="lembar" data-lembar-roster="1">
      <header>
        <div>
          <h1>Rekap Roster Anggota</h1>
          <p class="sub">${esc(opsi.namaTim)} · ${esc(opsi.tanggal)}</p>
        </div>
        <div class="angka">${rekap.total.totalAktif}<span>anggota aktif</span></div>
      </header>
      <table>
        <thead>${kepala}</thead>
        ${rekap.seksi.length ? tabel : kosong}
        <tfoot>${sel({ ...rekap.total, instrumen: 'Total semua section' }, 'total')}</tfoot>
      </table>
      <p class="kaki">Angka = anggota aktif · "+n" = anggota nonaktif di kelompok itu (mis. returner yang belum berkomitmen) · "Lainnya" = aktif tanpa kelompok roster · DrillKit</p>
      ${lampiran}
    </section>`,
    `@page { size: A4 portrait; margin: 12mm; }
     .lembar { font-size: 10.5px; color:#0f172a; }
     header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0f172a; padding-bottom:6px; margin-bottom:8px; }
     h1 { font-size:17px; margin:0; }
     .sub { margin:2px 0 0; color:#334155; }
     .angka { font-size:22px; font-weight:800; text-align:right; line-height:1; }
     .angka span { display:block; font-size:9px; font-weight:600; color:#475569; }
     table { width:100%; border-collapse:collapse; }
     th, td { border:1px solid #cbd5e1; padding:3px 5px; text-align:center; }
     th { background:#e2e8f0; font-size:10px; }
     .kiri { text-align:left; }
     tr.seksi td { background:#f1f5f9; font-weight:700; text-align:left; }
     tr.jumlah td { font-weight:700; background:#f8fafc; }
     tr.total td { font-weight:800; background:#e2e8f0; border-top:2px solid #0f172a; }
     .tebal { font-weight:700; }
     .kosong { color:#64748b; padding:12px; }
     .kaki { color:#475569; font-size:9px; margin-top:6px; }
     .lampiran { break-before: page; }
     .lampiran h2 { font-size:14px; margin:0 0 6px; border-bottom:1px solid #0f172a; }
     .kel { break-inside: avoid; margin-bottom:8px; }
     .kel h3 { font-size:11.5px; margin:0 0 2px; }
     .kel h3 span { font-weight:400; color:#475569; }
     .kel ol { columns: 3; column-gap: 14px; margin:0; padding-left:18px; }
     .kel li { break-inside: avoid; }
     .kel li.non { color:#64748b; }
     .ins { color:#64748b; font-size:9px; }
     .tanda { font-size:8.5px; border:1px solid #94a3b8; border-radius:3px; padding:0 2px; }`,
  )
}
