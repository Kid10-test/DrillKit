/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** DD6 — Detail gerak per pemain di semua set. */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type {
  Drill,
  DrillSet,
  Member,
  ModeLangkah,
  SetelanLangkah,
} from '../db/types'
import {
  Button,
  Field,
  Input,
  Modal,
  useToast,
} from './ui'
import {
  IconCheck,
} from './Icons'

import {
  stepYd,
} from '../lib/field'
import {
  AMBANG,
  TINGKAT_LABEL,
  TINGKAT_WARNA,
  type MetrikPemain,
  analisisPerpindahan,
} from '../lib/analitik'
import {
  cx,
  sectionLabel,
} from '../lib/utils'
import { useSettings } from '../hooks/useSettings'

/* ========================================================================== */
/*  DD6 — Detail per pemain                                                   */
/* ========================================================================== */

/**
 * Riwayat gerak satu pemain di semua set, plus perlengkapan yang dibawanya.
 *
 * Kegunaan utamanya menjawab dua pertanyaan yang selama ini harus dilihat
 * set demi set: **seberapa berat** perpindahan pemain ini, dan **di set mana**
 * yang paling berat.
 */
export function PerformerDetailModal({
  open,
  onClose,
  drill,
  sets,
  member,
  onKeSet,
}: {
  open: boolean
  onClose: () => void
  drill: Drill
  sets: DrillSet[]
  member: Member | undefined
  onKeSet?: (urutan: number) => void
}) {
  const toast = useToast()
  /** Ambang kesulitan punya tim — supaya angkanya sama dengan panel DD3. */
  const settings = useSettings()
  /**
   * Mengedit field `instrument` — yang memang sudah mencakup perlengkapan
   * (labelnya "Instrumen / perlengkapan" di halaman anggota). Sengaja tidak
   * menambah field baru supaya tidak ada dua tempat untuk hal yang sama.
   */
  const [instrumen, setInstrumen] = useState('')
  useEffect(() => {
    setInstrumen(member?.instrument ?? '')
  }, [member?.id, member?.instrument, open])

  const sYd = stepYd(drill.field)
  const ordered = useMemo(() => [...sets].sort((a, b) => a.order - b.order), [sets])

  /** Satu baris per perpindahan, memakai modul analitik yang sama dengan panel DD3. */
  const baris = useMemo(() => {
    if (!member) return []
    return ordered.slice(0, -1).map((s, i) => {
      const h = analisisPerpindahan(
        s,
        ordered[i + 1],
        [member],
        sYd,
        drill.tempo,
        drill.beatsPerCount,
        undefined,
        s.langkah?.[member.id] ?? drill.setelanLangkah,
        settings?.ambangGerak,
        drill.setelanJarak,
      )
      const m = h.daftar[0]
      return m ? { dari: s, ke: ordered[i + 1], m } : null
    })
  }, [
    ordered,
    member,
    sYd,
    drill.tempo,
    drill.beatsPerCount,
    drill.setelanLangkah,
    drill.setelanJarak,
    settings?.ambangGerak,
  ])

  const ada = baris.filter(Boolean) as { dari: DrillSet; ke: DrillSet; m: MetrikPemain }[]
  const totalLangkah = ada.reduce((a, b) => a + b.m.jarakLangkah, 0)
  const rataLpm = ada.length ? ada.reduce((a, b) => a + b.m.langkahPerMenit, 0) / ada.length : 0
  const terberat = ada.reduce<(typeof ada)[number] | null>(
    (a, b) => (!a || b.m.langkahPerMenit > a.m.langkahPerMenit ? b : a),
    null,
  )

  function simpanInstrumen() {
    if (!member) return
    db.members.update(member.id, { instrument: instrumen.trim() })
    toast.push(`Instrumen/perlengkapan ${member.name} disimpan`, 'info')
  }

  /**
   * DD10b — timpa cara langkah **untuk pemain ini, pada perpindahan ini**.
   *
   * Siklusnya: ikut drill → tetap → menyesuaikan → ikut drill. Dipilih
   * per baris supaya satu gerakan bisa dikecualikan tanpa mengubah show
   * lainnya — misalnya blok yang jalannya pendek dipaksa "ikut hitungan"
   * sementara seisi show memakai ukuran langkah tetap.
   */
  async function gantiModeLangkah(s: DrillSet) {
    if (!member) return
    const urut: (ModeLangkah | undefined)[] = [undefined, 'tetap', 'menyesuaikan']
    const sekarang = s.langkah?.[member.id]?.mode
    const berikut = urut[(urut.indexOf(sekarang) + 1) % urut.length]
    const langkah: Record<string, SetelanLangkah> = { ...(s.langkah ?? {}) }
    if (berikut) {
      langkah[member.id] = {
        mode: berikut,
        langkahPerCount: drill.setelanLangkah?.langkahPerCount ?? 1,
      }
    } else {
      delete langkah[member.id]
    }
    await db.sets.put({ ...s, langkah })
    toast.push(
      berikut
        ? `${s.name} — langkah ${member.name}: ${berikut === 'tetap' ? 'ukuran tetap' : 'ikut hitungan'}`
        : `${s.name} — langkah ${member.name} dikembalikan ke bawaan drill`,
      'info',
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detail — ${member?.name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={simpanInstrumen}>
            <IconCheck size={14} /> Simpan
          </Button>
        </>
      }
    >
      {member && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
            <span>
              <b className="text-slate-200">{member.code}</b> · {sectionLabel(member.section)}
            </span>
            <span>{member.instrument || '-'}</span>
          </div>

          <Field
            label="Instrumen / perlengkapan"
            hint="field yang sama dengan halaman Anggota — mis. Trumpet, Snare, Flag"
          >
            <Input
              value={instrumen}
              onChange={(e) => setInstrumen(e.target.value)}
              placeholder="mis. Trumpet, Snare, Flag"
            />
          </Field>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-slate-800/60 p-2">
              <div className="text-[15px] font-semibold text-slate-100">{Math.round(totalLangkah)}</div>
              <div className="text-[10px] leading-tight text-slate-500">total langkah</div>
            </div>
            <div className="rounded bg-slate-800/60 p-2">
              <div className="text-[15px] font-semibold text-slate-100">{Math.round(rataLpm)}</div>
              <div className="text-[10px] leading-tight text-slate-500">rata² langkah/menit</div>
            </div>
            <div className="rounded bg-slate-800/60 p-2">
              <div
                className="text-[15px] font-semibold"
                style={{ color: TINGKAT_WARNA[terberat?.m.tingkat ?? 'nyaman'] }}
              >
                {Math.round(terberat?.m.langkahPerMenit ?? 0)}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">gerakan terberat</div>
            </div>
          </div>

          {terberat && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Gerakan terberat: <b className="text-slate-200">{terberat.dari.name}</b> →{' '}
              {terberat.ke.name} — {Math.round(terberat.m.jarakLangkah)} langkah dalam{' '}
              {terberat.dari.counts} count ({TINGKAT_LABEL[terberat.m.tingkat]}).
              {onKeSet && (
                <>
                  {' '}
                  <button
                    className="text-sky-400 underline"
                    onClick={() => {
                      onKeSet(ordered.indexOf(terberat.dari))
                      onClose()
                    }}
                  >
                    Buka set itu
                  </button>
                </>
              )}
            </p>
          )}

          <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="text-slate-500">
                  <th className="px-2 py-1.5 text-left font-medium">Perpindahan</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cnt</th>
                  <th className="px-2 py-1.5 text-right font-medium">Langkah</th>
                  <th className="px-2 py-1.5 text-right font-medium">Lk/cnt</th>
                  <th className="px-2 py-1.5 text-right font-medium">Lk/mnt</th>
                  <th className="px-2 py-1.5 text-right font-medium">Ukuran</th>
                  <th className="px-2 py-1.5 text-center font-medium">Mode langkah</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r, i) =>
                  r ? (
                    <tr key={r.dari.id} className="border-t border-slate-800/70">
                      <td className="px-2 py-1.5">
                        <button
                          className="text-left text-slate-300 hover:text-sky-400"
                          onClick={() => {
                            onKeSet?.(i)
                            onClose()
                          }}
                          title="Buka set ini"
                        >
                          {r.dari.name} → {r.ke.name}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-400">{r.dari.counts}</td>
                      <td className="px-2 py-1.5 text-right text-slate-300">
                        {Math.round(r.m.jarakLangkah)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-300">
                        {Math.round(r.m.langkahPerCount * 100) / 100}
                      </td>
                      <td
                        className="px-2 py-1.5 text-right font-semibold"
                        style={{ color: TINGKAT_WARNA[r.m.tingkat] }}
                      >
                        {Math.round(r.m.langkahPerMenit)}
                      </td>
                      <td
                        className="px-2 py-1.5 text-right"
                        style={{
                          color:
                            r.m.tingkatLangkah === 'berat' || r.m.tingkatLangkah === 'mustahil'
                              ? TINGKAT_WARNA[r.m.tingkatLangkah]
                              : undefined,
                          fontWeight:
                            r.m.tingkatLangkah === 'berat' || r.m.tingkatLangkah === 'mustahil'
                              ? 700
                              : undefined,
                        }}
                      >
                        {Number.isFinite(r.m.ukuranLangkahInci)
                          ? `${Math.round(r.m.ukuranLangkahInci * 10) / 10}\u2033`
                          : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          className={cx(
                            'rounded px-1.5 py-0.5 text-[10px]',
                            r.dari.langkah?.[member.id]
                              ? 'bg-sky-500/20 font-semibold text-sky-300'
                              : 'text-slate-500 hover:text-slate-300',
                          )}
                          onClick={() => gantiModeLangkah(r.dari)}
                          title="Cara langkah dihitung untuk perpindahan ini — klik untuk mengubah (ikut drill / ukuran tetap / ikut hitungan)"
                        >
                          {r.dari.langkah?.[member.id]?.mode === 'menyesuaikan'
                            ? 'hitungan'
                            : r.dari.langkah?.[member.id]?.mode === 'tetap'
                              ? 'tetap'
                              : 'drill'}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ordered[i]?.id ?? i} className="border-t border-slate-800/70">
                      <td className="px-2 py-1.5 text-slate-600">
                        {ordered[i]?.name} → {ordered[i + 1]?.name}
                      </td>
                      <td colSpan={6} className="px-2 py-1.5 text-right text-slate-600">
                        tidak di lapangan
                      </td>
                    </tr>
                  ),
                )}
                {!baris.length && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-slate-600">
                      Belum ada perpindahan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Ambang: nyaman ≤ {AMBANG.padat} · padat ≤ {AMBANG.berat} · berat ≤ {AMBANG.mustahil} ·
            mustahil &gt; {AMBANG.mustahil} langkah/menit, pada {drill.tempo} BPM dan{' '}
            {drill.beatsPerCount} ketuk/hitungan.
          </p>
        </div>
      )}
    </Modal>
  )
}
