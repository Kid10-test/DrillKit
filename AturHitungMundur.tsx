/**
 * M1 — Pengatur hitung mundur (count-off) sebelum lagu mulai.
 *
 * Hitung mundur **selalu mengikuti tanda birama birama pertama** yang akan
 * dimainkan — jadi kalau lagu mulai di birama yang meternya 7/8, hitung
 * mundurnya juga 7/8.
 *
 * Pilihan suara termasuk **suara manusia** (Web Speech). Perlu diingat:
 * ucapan tidak bisa dijadwalkan sepresisi Web Audio, jadi ucapan hanya jadi
 * lapisan di atas ketukan — ketukan pertama lagu tetap presisi.
 */

import { useEffect, useState } from 'react'
import type { HitungMundur, TandaBirama } from '../db/types'
import { posisiHitungMundur, ucapHitungMundur, normalisasiBirama } from '../lib/birama'
import { bisaUcap, daftarSuara, ucap } from '../lib/ucap'
import { Button, Field, Input, Select, Toggle } from './ui'

interface Props {
  nilai: HitungMundur
  onChange: (h: HitungMundur) => void
  /** Tanda birama birama pertama yang akan dimainkan. */
  birama: TandaBirama
}

const PILIHAN_SUARA: { nilai: HitungMundur['suara']; label: string }[] = [
  { nilai: 'klik', label: 'Klik' },
  { nilai: 'kayu', label: 'Kayu (woodblock)' },
  { nilai: 'bel', label: 'Bel (cowbell)' },
  { nilai: 'suara', label: 'Suara manusia' },
]

export default function AturHitungMundur({ nilai, onChange, birama }: Props) {
  const [suaraTersedia, setSuaraTersedia] = useState<SpeechSynthesisVoice[]>([])
  const [suaraKe, setSuaraKe] = useState(-1)

  // Daftar suara di beberapa browser baru terisi setelah panggilan pertama,
  // atau setelah event voiceschanged — jadi keduanya dipasang.
  useEffect(() => {
    if (!bisaUcap()) return
    const muat = () => setSuaraTersedia(daftarSuara())
    muat()
    window.speechSynthesis.addEventListener?.('voiceschanged', muat)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', muat)
  }, [])

  const t = normalisasiBirama(birama)
  const ucapan = ucapHitungMundur(t, nilai)
  const posisi = posisiHitungMundur(t, nilai)

  function set(patch: Partial<HitungMundur>) {
    onChange({ ...nilai, ...patch })
  }

  return (
    <div className="space-y-3" data-testid="atur-hitung-mundur">
      <Toggle
        checked={nilai.on}
        onChange={(v) => set({ on: v })}
        label="Hitung mundur sebelum mulai"
        testId="hm-aktif"
      />

      {nilai.on && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Diulang">
              <Input
                type="number"
                min={1}
                max={8}
                value={nilai.ulang}
                onChange={(e) => set({ ulang: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })}
                data-testid="hm-ulang"
              />
            </Field>
            <Field label="Yang dihitung">
              <Select value={nilai.tiapNot ? '1' : '0'} onChange={(e) => set({ tiapNot: e.target.value === '1' })} data-testid="hm-tiapnot">
                <option value="0">Tiap pulsa ({t.kelompok.length} ketuk)</option>
                <option value="1">Tiap not ({t.pembilang} ketuk)</option>
              </Select>
            </Field>
            <Field label="Bunyi">
              <Select value={nilai.suara} onChange={(e) => set({ suara: e.target.value as HitungMundur['suara'] })} data-testid="hm-suara">
                {PILIHAN_SUARA.map((s) => (
                  <option key={s.nilai} value={s.nilai}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {nilai.suara === 'suara' && (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              {!bisaUcap() ? (
                <p className="text-[11px] text-amber-300" data-testid="hm-tanpa-suara">
                  Browser ini tidak punya suara ucapan. Ketukan hitung mundur tetap berbunyi seperti biasa.
                </p>
              ) : (
                <>
                  <Field label="Suara">
                    <Select
                      value={String(suaraKe)}
                      onChange={(e) => setSuaraKe(Number(e.target.value))}
                      data-testid="hm-pilih-suara"
                    >
                      <option value={-1}>Bawaan browser</option>
                      {suaraTersedia.map((v, i) => (
                        <option key={i} value={i}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Yang diucapkan (pisahkan koma — kosongkan untuk angka otomatis)">
                    <Input
                      value={(nilai.ucap ?? []).join(', ')}
                      placeholder="mis. siap, 1, 2"
                      onChange={(e) =>
                        set({
                          ucap: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      data-testid="hm-ucap"
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const v = suaraKe >= 0 ? suaraTersedia[suaraKe] : null
                        if (v) {
                          import('../lib/ucap').then((m) => {
                            m.pilihSuara(v)
                            ucapan.forEach((u, i) => window.setTimeout(() => m.ucap(u), i * 350))
                          })
                        } else {
                          ucapan.forEach((u, i) => window.setTimeout(() => ucap(u), i * 350))
                        }
                      }}
                      data-testid="hm-coba"
                    >
                      Coba dengar
                    </Button>
                    <span className="text-[11px] text-slate-500" data-testid="hm-pratinjau">
                      Akan diucapkan: {ucapan.join(' · ')}
                      {nilai.ulang > 1 ? ` (diulang ${nilai.ulang}×)` : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ucapan hanya lapisan — ketukan tetap dijadwalkan oleh metronom, jadi ketukan pertama lagu
                    tetap tepat meski suaranya sedikit telat.
                  </p>
                </>
              )}
            </div>
          )}

          {nilai.suara !== 'suara' && (
            <p className="text-[11px] text-slate-500" data-testid="hm-info">
              {nilai.ulang}× · {posisi.length} ketuk tiap putaran · mengikuti {t.pembilang}/{t.penyebut} birama pertama
            </p>
          )}
        </>
      )}
    </div>
  )
}
