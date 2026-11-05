/**
 * #28 — Studio Perkusi (Battery & Pit).
 *
 * Panel ringkas di Layar Partitur untuk membaca sticking yang **sudah ditulis
 * arranger** (MuseScore `<Sticking>`, lirik gaya Finale/Sibelius, atau
 * `<fingering>`) per birama, lalu — khusus pelatih — mencatat **revisi
 * lapangan** di atasnya (R/L/B, aksen, flam/drag, diddle, buzz).
 *
 * Berkas skor asli tidak pernah diubah: revisi disimpan terpisah di
 * `db.anotasiPartitur` dan hanya disuntikkan ke salinan XML saat render.
 * Panel ini bukan editor notasi — ritme, nada, dan alat tetap milik skor.
 */
import { useEffect, useMemo, useState } from 'react'
import { LABEL_TEKNIK_PERKUSI } from '../../lib/perkusiAlat'
import {
  WARNA_REVISI_PERKUSI,
  gabungLapisanRevisi,
  labelAlatPeristiwa,
  peristiwaDalamBirama,
  terapkanUbahRevisi,
  teksStickingBirama,
  type LapisanPerkusi,
  type PeristiwaEfektif,
  type RevisiPerkusiNot,
} from '../../lib/perkusiSticking'

const LABEL_PERAN: Record<string, string> = {
  snare: 'Snare',
  tenor: 'Tenor',
  bass: 'Bass',
  simbal: 'Simbal',
  pit: 'Pit',
  perkusi: 'Perkusi',
}

const PILIHAN_STICKING = ['R', 'L', 'B', 'RL', 'LR'] as const

function tandaHias(ev: Pick<PeristiwaEfektif, 'aksen' | 'flam' | 'diddle' | 'buzz'>): string {
  let t = ''
  if (ev.aksen === 2) t += '^'
  else if (ev.aksen === 1) t += '>'
  if (ev.flam === 2) t += 'ƒƒ'
  else if (ev.flam === 1) t += 'ƒ'
  if (ev.diddle) t += '≡'
  if (ev.buzz) t += 'z'
  return t
}

function formatKetuk(mulaiPerempat: number): string {
  const v = Math.round((mulaiPerempat + 1) * 100) / 100
  return String(v).replace('.', ',')
}

export default function PanelStudioPerkusi({
  lapisan,
  revisi,
  bisaSunting,
  biramaAktif,
  idPartDisukai,
  tampilRevisi,
  onTampilRevisi,
  onSimpanRevisi,
  onLoncatBirama,
  onTutup,
}: {
  lapisan: LapisanPerkusi
  revisi: RevisiPerkusiNot[]
  /** Pelatih: boleh menyunting. Anggota: baca saja. */
  bisaSunting: boolean
  /** Birama 1-based yang sedang disorot partitur. */
  biramaAktif: number
  /** Part yang sedang disaring di partitur (dipakai sebagai pilihan awal). */
  idPartDisukai: string[] | null
  tampilRevisi: boolean
  onTampilRevisi: (v: boolean) => void
  onSimpanRevisi: (daftar: RevisiPerkusiNot[]) => void
  onLoncatBirama?: (birama: number) => void
  onTutup: () => void
}) {
  const parts = lapisan.parts
  const [idPart, setIdPart] = useState<string>(() => {
    const cocok = idPartDisukai ? parts.find((p) => idPartDisukai.includes(p.id)) : undefined
    return (cocok ?? parts[0])?.id ?? ''
  })
  useEffect(() => {
    if (!parts.some((p) => p.id === idPart)) setIdPart(parts[0]?.id ?? '')
  }, [parts, idPart])

  const partAktif = parts.find((p) => p.id === idPart) ?? null
  const totalBirama = useMemo(
    () => lapisan.peristiwa.reduce((m, e) => (e.idPart === idPart ? Math.max(m, e.birama) : m), 0),
    [lapisan.peristiwa, idPart],
  )

  const [birama, setBirama] = useState(() => Math.max(1, biramaAktif || 1))
  const [ikuti, setIkuti] = useState(true)
  useEffect(() => {
    if (ikuti && biramaAktif >= 1) setBirama(biramaAktif)
  }, [biramaAktif, ikuti])

  const gabung = useMemo(() => gabungLapisanRevisi(lapisan, revisi), [lapisan, revisi])
  const daftarBirama = useMemo(
    () => peristiwaDalamBirama(gabung.peristiwa, idPart, birama),
    [gabung.peristiwa, idPart, birama],
  )
  const jumlahRevisiPart = useMemo(() => revisi.filter((r) => r.idPart === idPart).length, [revisi, idPart])

  const [terpilih, setTerpilih] = useState<string | null>(null)
  useEffect(() => {
    setTerpilih(null)
  }, [idPart, birama])
  const evTerpilih = daftarBirama.find((e) => e.kunci === terpilih) ?? null
  const evAsli = evTerpilih ? lapisan.peristiwa.find((e) => e.kunci === evTerpilih.kunci) ?? null : null

  const totalSticking = parts.reduce((n, p) => n + p.jumlahSticking, 0)

  function geserBirama(d: number) {
    const maks = Math.max(1, totalBirama)
    const baru = Math.min(maks, Math.max(1, birama + d))
    setIkuti(false)
    setBirama(baru)
    onLoncatBirama?.(baru)
  }

  function ubah(u: Parameters<typeof terapkanUbahRevisi>[2]) {
    if (!evAsli) return
    onSimpanRevisi(terapkanUbahRevisi(revisi, evAsli, u))
  }

  const gayaTombol = (aktif: boolean) => ({
    borderColor: aktif ? '#f97316' : '#334155',
    backgroundColor: aktif ? '#7c2d12' : '#020617',
    color: aktif ? '#ffedd5' : '#cbd5e1',
  })

  return (
    <section
      data-testid="studio-perkusi"
      className="flex min-w-0 flex-col gap-2.5 rounded-xl border p-3 text-xs"
      style={{ borderColor: '#9a3412', backgroundColor: '#1c1917', color: '#e7e5e4' }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="font-semibold" style={{ color: '#fdba74' }}>
          🥁 Studio Perkusi · Battery &amp; Pit
        </p>
        <span data-testid="studio-perkusi-ringkas" className="text-[11px]" style={{ color: '#a8a29e' }}>
          {parts.length} part · {totalSticking} sticking terbaca dari skor
          {revisi.length > 0 ? ` · ${revisi.length} revisi lapangan` : ''}
        </span>
        <button
          type="button"
          data-testid="studio-perkusi-tutup"
          onClick={onTutup}
          className="ml-auto rounded-full border px-2.5 py-0.5 text-[11px]"
          style={{ borderColor: '#44403c', color: '#d6d3d1' }}
        >
          Tutup
        </button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="inline-flex min-w-0 items-center gap-1">
          Part
          <select
            data-testid="studio-perkusi-part"
            value={idPart}
            onChange={(e) => setIdPart(e.target.value)}
            className="max-w-[12rem] rounded-lg border px-1.5 py-0.5 outline-none"
            style={{ borderColor: '#44403c', backgroundColor: '#0c0a09', color: '#e7e5e4' }}
          >
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama || p.id} ({LABEL_PERAN[p.peran] ?? p.peran})
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            data-testid="studio-perkusi-birama-kurang"
            onClick={() => geserBirama(-1)}
            disabled={birama <= 1}
            className="rounded-lg border px-2 py-0.5 disabled:opacity-40"
            style={{ borderColor: '#44403c' }}
            aria-label="Birama sebelumnya"
          >
            ◀
          </button>
          <span data-testid="studio-perkusi-birama" className="tabular-nums">
            Birama {birama}
            {totalBirama > 0 ? ` / ${totalBirama}` : ''}
          </span>
          <button
            type="button"
            data-testid="studio-perkusi-birama-tambah"
            onClick={() => geserBirama(1)}
            disabled={totalBirama > 0 && birama >= totalBirama}
            className="rounded-lg border px-2 py-0.5 disabled:opacity-40"
            style={{ borderColor: '#44403c' }}
            aria-label="Birama berikutnya"
          >
            ▶
          </button>
        </div>
        <label className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#a8a29e' }}>
          <input
            type="checkbox"
            data-testid="studio-perkusi-ikuti"
            checked={ikuti}
            onChange={(e) => setIkuti(e.target.checked)}
          />
          Ikuti birama aktif
        </label>
      </div>

      {partAktif && partAktif.jumlahSticking === 0 && jumlahRevisiPart === 0 && (
        <p className="text-[11px]" style={{ color: '#a8a29e' }}>
          Skor belum menuliskan sticking untuk part ini.
          {bisaSunting ? ' Ketuk sebuah not di bawah untuk mencatat sticking lapangan.' : ''}
        </p>
      )}

      {daftarBirama.length === 0 ? (
        <p data-testid="studio-perkusi-kosong" className="text-[11px]" style={{ color: '#a8a29e' }}>
          Tidak ada not perkusi di birama ini.
        </p>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap gap-1.5" role="list">
            {daftarBirama.map((ev, i) => {
              const dipilih = ev.kunci === terpilih
              return (
                <button
                  key={ev.kunci}
                  type="button"
                  role="listitem"
                  data-testid={`studio-perkusi-sel-${i}`}
                  data-direvisi={ev.direvisi ? '1' : '0'}
                  onClick={() => setTerpilih(dipilih ? null : ev.kunci)}
                  title={`Ketuk ${formatKetuk(ev.mulaiPerempat)} · ${labelAlatPeristiwa(ev)}${
                    ev.teknik ? ` · ${LABEL_TEKNIK_PERKUSI[ev.teknik]}` : ''
                  }`}
                  className="flex w-12 flex-col items-center rounded-lg border px-1 py-1 leading-tight"
                  style={{
                    borderColor: ev.direvisi ? WARNA_REVISI_PERKUSI : dipilih ? '#e7e5e4' : '#44403c',
                    borderWidth: ev.direvisi || dipilih ? 2 : 1,
                    backgroundColor: dipilih ? '#292524' : '#0c0a09',
                  }}
                >
                  <span
                    className="text-base font-bold"
                    style={{ color: ev.direvisi ? '#fb923c' : '#fafaf9' }}
                  >
                    {ev.sticking ?? '·'}
                  </span>
                  <span className="h-3 text-[10px]" style={{ color: '#fdba74' }}>
                    {tandaHias(ev)}
                  </span>
                  <span className="truncate text-[9px]" style={{ color: '#a8a29e', maxWidth: '100%' }}>
                    {labelAlatPeristiwa(ev, true)}
                  </span>
                </button>
              )
            })}
          </div>
          <p data-testid="studio-perkusi-urutan" className="font-mono text-[11px]" style={{ color: '#d6d3d1' }}>
            {teksStickingBirama(daftarBirama)}
          </p>
        </>
      )}

      {bisaSunting && evTerpilih && evAsli && (
        <div
          data-testid="studio-perkusi-editor"
          className="flex min-w-0 flex-col gap-2 rounded-lg border p-2"
          style={{ borderColor: '#44403c', backgroundColor: '#0c0a09' }}
        >
          <p className="text-[11px]" style={{ color: '#a8a29e' }}>
            Ketuk {formatKetuk(evAsli.mulaiPerempat)} · {labelAlatPeristiwa(evAsli)}
            {evAsli.teknik ? ` · ${LABEL_TEKNIK_PERKUSI[evAsli.teknik]}` : ''} · di skor:{' '}
            <b style={{ color: '#e7e5e4' }}>{evAsli.sticking ?? '—'}</b>
            {tandaHias(evAsli) ? ` ${tandaHias(evAsli)}` : ''}
          </p>
          <div className="flex min-w-0 flex-wrap gap-1">
            {PILIHAN_STICKING.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`studio-perkusi-sticking-${s}`}
                onClick={() => ubah({ sticking: s })}
                className="min-w-[2.25rem] rounded-lg border px-2 py-1 font-bold"
                style={gayaTombol(evTerpilih.sticking === s)}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              data-testid="studio-perkusi-sticking-hapus"
              onClick={() => ubah({ sticking: null })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(false)}
              title="Kosongkan sticking pada not ini"
            >
              –
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-asli"
              onClick={() => ubah('asli')}
              disabled={!evTerpilih.direvisi}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
              style={gayaTombol(false)}
              title="Kembalikan not ini ke tulisan arranger"
            >
              ↺ Asli
            </button>
          </div>
          <div className="flex min-w-0 flex-wrap gap-1">
            <button
              type="button"
              data-testid="studio-perkusi-aksen"
              aria-pressed={evTerpilih.aksen === 1}
              onClick={() => ubah({ aksen: evTerpilih.aksen === 1 ? 0 : 1 })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.aksen === 1)}
            >
              &gt; Aksen
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-marcato"
              aria-pressed={evTerpilih.aksen === 2}
              onClick={() => ubah({ aksen: evTerpilih.aksen === 2 ? 0 : 2 })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.aksen === 2)}
            >
              ^ Marcato
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-flam"
              aria-pressed={evTerpilih.flam === 1}
              onClick={() => ubah({ flam: evTerpilih.flam === 1 ? 0 : 1 })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.flam === 1)}
            >
              Flam
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-drag"
              aria-pressed={evTerpilih.flam === 2}
              onClick={() => ubah({ flam: evTerpilih.flam === 2 ? 0 : 2 })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.flam === 2)}
            >
              Drag
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-diddle"
              aria-pressed={evTerpilih.diddle}
              onClick={() => ubah({ diddle: !evTerpilih.diddle })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.diddle)}
            >
              ≡ Diddle
            </button>
            <button
              type="button"
              data-testid="studio-perkusi-buzz"
              aria-pressed={evTerpilih.buzz}
              onClick={() => ubah({ buzz: !evTerpilih.buzz })}
              className="rounded-lg border px-2 py-1"
              style={gayaTombol(evTerpilih.buzz)}
            >
              z Buzz
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: '#292524' }}>
        <label className="inline-flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            data-testid="studio-perkusi-tampil-revisi"
            checked={tampilRevisi}
            onChange={(e) => onTampilRevisi(e.target.checked)}
          />
          Tampilkan revisi di partitur
        </label>
        <span
          data-testid="studio-perkusi-jumlah-revisi"
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={{ backgroundColor: revisi.length ? '#7c2d12' : '#292524', color: '#ffedd5' }}
        >
          {revisi.length} revisi
        </span>
        {gabung.yatim.length > 0 && (
          <span data-testid="studio-perkusi-yatim" className="text-[11px]" style={{ color: '#fbbf24' }}>
            {gabung.yatim.length} revisi tidak cocok dengan skor saat ini (skor diganti?)
            {bisaSunting && (
              <button
                type="button"
                data-testid="studio-perkusi-buang-yatim"
                onClick={() => {
                  const yatim = new Set(gabung.yatim.map((r) => r.kunci))
                  onSimpanRevisi(revisi.filter((r) => !yatim.has(r.kunci)))
                }}
                className="ml-1 underline"
              >
                Buang
              </button>
            )}
          </span>
        )}
        {bisaSunting && revisi.length > 0 && (
          <button
            type="button"
            data-testid="studio-perkusi-hapus-semua"
            onClick={() => {
              if (window.confirm('Hapus semua revisi sticking lagu ini? Sticking asli dari skor tetap ada.')) {
                onSimpanRevisi([])
              }
            }}
            className="ml-auto rounded-lg border px-2 py-0.5 text-[11px]"
            style={{ borderColor: '#7f1d1d', color: '#fecaca' }}
          >
            Hapus semua revisi
          </button>
        )}
      </div>
      <p className="text-[10px] leading-snug" style={{ color: '#78716c' }}>
        {bisaSunting
          ? 'Revisi lapangan ditandai oranye, tidak mengubah berkas skor, dan ikut paket anggota hanya untuk part perkusinya.'
          : 'Sticking dari skor arranger; tanda oranye adalah revisi dari pelatih seksi.'}
      </p>
    </section>
  )
}
