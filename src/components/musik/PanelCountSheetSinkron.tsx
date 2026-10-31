import { useEffect, useMemo, useState } from 'react'
import type {
  CountSheet,
  Drill,
  DrillSet,
  Member,
  SectionDef,
  Song,
} from '../../db/types'
import {
  LABEL_ARAH_HADAP_GUARD,
  LABEL_PENDEK_ALAT_GUARD,
  WARNA_ALAT_GUARD_HEX,
  bangunHtmlCetakCountSheet,
  hitungSorotCountSheet,
  urutkanBlokCountSheet,
} from '../../lib/countSheet'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, slugify } from '../../lib/utils'
import { IconDownload, IconPrinter } from '../Icons'
import { Badge, Button, Card, Select, useToast } from '../ui'

/**
 * #17.3 — Panel Count Sheet Color Guard Sinkron (dipakai di Tab Musik & Halaman Musik).
 */
export function PanelCountSheetMusik({
  sheets,
  song,
  biramaAktif,
  ketukDalamBirama,
  ketukPerBirama,
  beatsPerCount = 1,
  sedangMain,
  sedangHitungMundur,
  hanyaPutar = false,
  onLoncatBirama,
  onBukaEditor,
}: {
  sheets: CountSheet[]
  song: Song | null
  biramaAktif: number
  ketukDalamBirama: number
  ketukPerBirama: number
  beatsPerCount?: number
  sedangMain: boolean
  sedangHitungMundur?: boolean
  hanyaPutar?: boolean
  onLoncatBirama?: (dari: number, sampai: number, label: string) => void
  onBukaEditor?: () => void
}) {
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? '')
  const [tampilkanSemua, setTampilkanSemua] = useState(false)

  useEffect(() => {
    if (sheets.length > 0 && !sheets.some((s) => s.id === sheetId)) {
      setSheetId(sheets[0].id)
    }
  }, [sheets, sheetId])

  const aktifSheet = sheets.find((s) => s.id === sheetId) ?? sheets[0] ?? null
  const daftarBlok = useMemo(
    () => (aktifSheet ? urutkanBlokCountSheet(aktifSheet.blok) : []),
    [aktifSheet],
  )

  const sorot = useMemo(
    () =>
      hitungSorotCountSheet(aktifSheet, {
        mode: 'musik',
        biramaAktif,
        ketukDalamBirama,
        ketukPerBirama,
        beatsPerCount,
        sedangHitungMundur,
      }),
    [aktifSheet, biramaAktif, ketukDalamBirama, ketukPerBirama, beatsPerCount, sedangHitungMundur],
  )

  if (sheets.length === 0) {
    if (hanyaPutar || !song || !onBukaEditor) return null
    return (
      <Card data-testid="panel-count-sheet-musik" className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Lembar Hitungan Color Guard (Count Sheet)
            </h3>
            <p className="text-[11px] text-slate-400">
              Susun hitungan kerja alat per 8-count mengikuti birama lagu <b>{song.title}</b>.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            data-testid="buka-editor-cs-musik"
            onClick={onBukaEditor}
          >
            Kelola Count Sheet
          </Button>
        </div>
      </Card>
    )
  }

  const blokTampil = tampilkanSemua ? daftarBlok : daftarBlok.slice(0, 8)

  return (
    <Card
      data-testid="panel-count-sheet-musik"
      data-kiosk-allow
      className="mt-4 border-pink-900/40 bg-slate-900/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-pink-200">
            Count Sheet Color Guard
          </h3>
          <p className="text-[11px] text-slate-400">
            Hitungan kerja alat tersorot otomatis mengikuti ketukan metronom &amp; rekaman lagu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {sheets.length > 1 && (
            <Select
              data-testid="pilih-cs-musik"
              value={aktifSheet?.id ?? ''}
              onChange={(e) => setSheetId(e.target.value)}
              className="text-xs"
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.judul}
                </option>
              ))}
            </Select>
          )}
          {!hanyaPutar && onBukaEditor && (
            <Button
              size="sm"
              variant="ghost"
              data-testid="buka-editor-cs-musik"
              onClick={onBukaEditor}
            >
              Sunting Count Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Pita Sorotan Hitungan Aktif Waktu Nyata */}
      {sorot && (
        <div
          data-testid="count-aktif-musik"
          className={cx(
            'mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 transition',
            sorot.adalahTangkap
              ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
              : sorot.adalahAksen
                ? 'border-amber-500/60 bg-amber-950/40 text-amber-100'
                : 'border-pink-800/50 bg-slate-950/70 text-slate-100',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge className="bg-pink-500/20 text-pink-200">
                {LABEL_PENDEK_ALAT_GUARD[sorot.blok.alat]}
              </Badge>
              <b>{sorot.blok.labelBagian}</b>
              {sorot.blok.biramaDari && (
                <span className="text-slate-400">
                  (Bar {sorot.blok.biramaDari}
                  {sorot.blok.biramaSampai && sorot.blok.biramaSampai !== sorot.blok.biramaDari
                    ? `–${sorot.blok.biramaSampai}`
                    : ''}
                  )
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-200">
              {sorot.blok.teknik || 'Ikuti pola hitungan'}
              {sorot.teksDetail ? ` — [${sorot.countAktif}] ${sorot.teksDetail}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sorot.adalahTangkap && (
              <span
                data-testid="lencana-catch-aktif"
                className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-xs font-extrabold text-emerald-200"
              >
                ★ CATCH!
              </span>
            )}
            {sorot.adalahAksen && (
              <span
                data-testid="lencana-aksen-aktif"
                className="rounded-full bg-amber-500/30 px-2 py-0.5 text-xs font-extrabold text-amber-200"
              >
                ▲ AKSEN
              </span>
            )}
            <span
              data-testid="angka-count-aktif-musik"
              className={cx(
                'rounded-lg px-2.5 py-1 font-mono text-lg font-extrabold tabular-nums',
                sedangMain ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-200',
              )}
            >
              {sorot.countAktif}/{sorot.blok.counts}
            </span>
          </div>
        </div>
      )}

      {/* Daftar Blok Count Sheet */}
      <div className="mt-3 space-y-2">
        {blokTampil.map((bl, idx) => {
          const sedangDisorot = sorot?.blok.id === bl.id
          const palet = WARNA_ALAT_GUARD_HEX[bl.alat] ?? WARNA_ALAT_GUARD_HEX.flag
          return (
            <div
              key={bl.id}
              data-testid={`baris-cs-musik-${idx}`}
              className={cx(
                'rounded-lg border p-2.5 text-xs transition',
                sedangDisorot
                  ? 'border-pink-500/60 bg-pink-950/20'
                  : 'border-slate-800 bg-slate-950/50',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      borderColor: palet.titikGelap,
                      color: palet.titikGelap,
                    }}
                  >
                    {LABEL_PENDEK_ALAT_GUARD[bl.alat]}
                  </span>
                  <b className="text-slate-100">{bl.labelBagian}</b>
                  <span className="text-slate-400">· {bl.counts} count</span>
                  {bl.biramaDari && (
                    <span className="text-slate-500">
                      · Bar {bl.biramaDari}
                      {bl.biramaSampai && bl.biramaSampai !== bl.biramaDari
                        ? `–${bl.biramaSampai}`
                        : ''}
                    </span>
                  )}
                </div>
                {onLoncatBirama && bl.biramaDari && (
                  <button
                    type="button"
                    data-testid={`latih-blok-cs-${idx}`}
                    onClick={() =>
                      onLoncatBirama(
                        bl.biramaDari!,
                        bl.biramaSampai ?? bl.biramaDari!,
                        bl.labelBagian,
                      )
                    }
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:border-sky-500/50"
                  >
                    Latih Bar {bl.biramaDari}
                    {bl.biramaSampai && bl.biramaSampai !== bl.biramaDari
                      ? `–${bl.biramaSampai}`
                      : ''}
                  </button>
                )}
              </div>

              {bl.teknik && <p className="mt-1 font-medium text-slate-200">{bl.teknik}</p>}

              <div className="mt-1.5 flex flex-wrap gap-1">
                {Array.from({ length: Math.min(24, bl.counts) }, (_, i) => i + 1).map((c) => {
                  const aktifIni = sedangDisorot && sorot?.countAktif === c
                  const ak = (bl.aksenCount ?? []).includes(c)
                  const tk = (bl.tangkapCount ?? []).includes(c)
                  return (
                    <span
                      key={c}
                      data-testid={aktifIni ? 'pil-count-sedang-aktif' : undefined}
                      className={cx(
                        'inline-flex min-w-[22px] items-center justify-center rounded border px-1 py-0.5 font-mono text-[10px] font-bold tabular-nums',
                        aktifIni
                          ? 'border-pink-400 bg-pink-600 text-white ring-2 ring-pink-400/60'
                          : tk
                            ? 'border-emerald-600/60 bg-emerald-950/50 text-emerald-300'
                            : ak
                              ? 'border-amber-600/60 bg-amber-950/50 text-amber-300'
                              : 'border-slate-800 bg-slate-900 text-slate-500',
                      )}
                    >
                      {c}
                      {tk ? '★' : ak ? '▲' : ''}
                    </span>
                  )
                })}
              </div>

              {(bl.posisiTangan || bl.arahHadap || bl.catatan) && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {[
                    bl.arahHadap ? LABEL_ARAH_HADAP_GUARD[bl.arahHadap] : '',
                    bl.posisiTangan ? `Tangan: ${bl.posisiTangan}` : '',
                    bl.catatan ?? '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {daftarBlok.length > 8 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTampilkanSemua((v) => !v)}
          className="mt-2 w-full"
        >
          {tampilkanSemua
            ? 'Ringkas daftar blok'
            : `Tampilkan semua ${daftarBlok.length} blok`}
        </Button>
      )}
    </Card>
  )
}

/**
 * #17.2 & #17.3 — Kartu Count Sheet Sinkron di Tab Formasi (`MemberDrill`) Mode Anggota.
 */
export function KartuCountSheetFormasiAnggota({
  sheets,
  drill,
  sets,
  setAktif,
  progresSet,
  sedangMain,
  me,
  namaTim,
  sections,
  song,
}: {
  sheets: CountSheet[]
  drill: Drill
  sets: DrillSet[]
  setAktif: DrillSet | undefined
  progresSet: number
  sedangMain: boolean
  me: Member
  namaTim?: string
  sections?: SectionDef[]
  song?: Song | null
}) {
  const toast = useToast()
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? '')

  useEffect(() => {
    if (sheets.length > 0 && !sheets.some((s) => s.id === sheetId)) {
      setSheetId(sheets[0].id)
    }
  }, [sheets, sheetId])

  const aktifSheet = sheets.find((s) => s.id === sheetId) ?? sheets[0] ?? null
  if (!aktifSheet || !setAktif) return null

  const blokSetIni = urutkanBlokCountSheet(aktifSheet.blok).filter((b) => b.setId === setAktif.id)
  const sorot = hitungSorotCountSheet(aktifSheet, {
    mode: 'set',
    setIdAktif: setAktif.id,
    progresSet: sedangMain ? progresSet : 0,
    countsSet: setAktif.counts || 8,
  })

  function cetakAtauUnduh(format: 'a4' | 'buku-saku', langsungUnduh: boolean) {
    if (!aktifSheet) return
    const html = bangunHtmlCetakCountSheet({
      sheet: aktifSheet,
      format,
      namaTim,
      drill,
      sets,
      song,
      daftarAnggota: [me],
      sections,
    })
    const namaFile = `${slugify(me.code || me.name)}-${slugify(aktifSheet.judul)}-${format}.html`
    if (langsungUnduh || !printHtml(html)) {
      downloadHtmlFile(html, namaFile)
      toast.push('Buku saku / Count Sheet Guard diunduh (HTML siap cetak)', 'info')
    }
  }

  return (
    <Card
      data-testid="kartu-count-sheet-anggota"
      className="border-pink-900/40 bg-slate-900/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-pink-200">
            Kerja Alat Guard — {setAktif.name}
          </h3>
          <p className="text-[11px] text-slate-400">{aktifSheet.judul}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {sheets.length > 1 && (
            <Select
              value={aktifSheet.id}
              onChange={(e) => setSheetId(e.target.value)}
              className="text-xs"
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.judul}
                </option>
              ))}
            </Select>
          )}
          <Button
            size="sm"
            variant="ghost"
            data-testid="unduh-buku-saku-guard-anggota"
            onClick={() => cetakAtauUnduh('buku-saku', true)}
            title="Unduh Buku Saku Lipat Guard (A5)"
          >
            <IconDownload size={13} /> Buku Saku
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="cetak-a4-guard-anggota"
            onClick={() => cetakAtauUnduh('a4', false)}
            title="Cetak Lembar Count Sheet A4 Gabungan"
          >
            <IconPrinter size={13} /> A4
          </Button>
        </div>
      </div>

      {blokSetIni.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Belum ada blok kerja alat khusus yang ditautkan ke {setAktif.name}.
        </p>
      ) : (
        <div className="mt-2.5 space-y-2">
          {blokSetIni.map((bl, idx) => {
            const sedangDisorot = sorot?.blok.id === bl.id
            return (
              <div
                key={bl.id}
                data-testid={`blok-cs-anggota-${idx}`}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-pink-500/20 text-pink-200">
                      {LABEL_PENDEK_ALAT_GUARD[bl.alat]}
                    </Badge>
                    <b className="text-slate-100">{bl.labelBagian}</b>
                    <span className="text-slate-400">({bl.counts} count)</span>
                  </div>
                  {sedangMain && sedangDisorot && sorot && (
                    <span
                      data-testid="count-aktif-formasi"
                      className="rounded bg-pink-600 px-2 py-0.5 font-mono text-xs font-bold text-white"
                    >
                      Hit. {sorot.countAktif}/{bl.counts}
                    </span>
                  )}
                </div>

                <p className="mt-1 font-medium text-slate-200">
                  {bl.teknik || 'Ikuti pola hitungan'}
                </p>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(24, bl.counts) }, (_, i) => i + 1).map((c) => {
                    const aktifIni = sedangMain && sedangDisorot && sorot?.countAktif === c
                    const ak = (bl.aksenCount ?? []).includes(c)
                    const tk = (bl.tangkapCount ?? []).includes(c)
                    return (
                      <span
                        key={c}
                        className={cx(
                          'inline-flex min-w-[22px] items-center justify-center rounded border px-1 py-0.5 font-mono text-[10px] font-bold',
                          aktifIni
                            ? 'border-pink-400 bg-pink-600 text-white'
                            : tk
                              ? 'border-emerald-600/60 bg-emerald-950/50 text-emerald-300'
                              : ak
                                ? 'border-amber-600/60 bg-amber-950/50 text-amber-300'
                                : 'border-slate-800 bg-slate-900 text-slate-400',
                        )}
                      >
                        {c}
                        {tk ? '★' : ak ? '▲' : ''}
                      </span>
                    )
                  })}
                </div>

                {(bl.posisiTangan || bl.arahHadap || bl.catatan) && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {[
                      bl.arahHadap ? LABEL_ARAH_HADAP_GUARD[bl.arahHadap] : '',
                      bl.posisiTangan ? `Tangan: ${bl.posisiTangan}` : '',
                      bl.catatan ?? '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
