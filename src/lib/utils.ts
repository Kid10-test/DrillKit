/** Utilitas umum: id, format tanggal, file, CSV. */

import type { SectionDef } from '../db/types'

export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}${Date.now().toString(36)}${rand}`
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** "2026-09-15" -> "Selasa, 15 September 2026" */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`
}

/** "2026-09-15" -> "15 Sep" */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Jarak hari: negatif = sudah lewat, 0 = hari ini. */
export function daysFromToday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((target - t0) / 86_400_000)
}

export function relativeDay(iso: string): string {
  const diff = daysFromToday(iso)
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'
  if (diff === -1) return 'Kemarin'
  if (diff > 1) return `${diff} hari lagi`
  return `${Math.abs(diff)} hari lalu`
}

/** Unduh string sebagai file (JSON, CSV, SVG, dll). */
export function downloadFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Sama seperti `downloadFile`, tetapi untuk isi biner (mis. berkas ZIP). */
export function downloadBlob(filename: string, bita: Uint8Array, mime = 'application/zip') {
  // Salin ke Uint8Array baru: `subarray` bisa berupa pandangan ke buffer
  // yang lebih besar, dan sebagian isinya bukan milik berkas ini.
  const blob = new Blob([new Uint8Array(bita)], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsText(file)
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

/** Escape nilai CSV dengan aman (antisipasi koma & kutip). */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV(rows: (unknown)[][]): string {
  // BOM supaya Excel mengenali UTF-8 (penting untuk nama beraksen/Indonesia)
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

/* ------------------------------- Section ---------------------------------- */

/**
 * Section tidak dikunci: pelatih bisa menamai & mewarnai sesuai timnya
 * (mis. Battery, Pit, Color Guard, Brass, FC). Simpanannya ada di
 * pengaturan; `SECTION_META` di bawah adalah registry yang dipakai UI.
 */
export const BUILTIN_SECTIONS: SectionDef[] = [
  { id: 'brass', label: 'Brass', short: 'BR', dot: '#f59e0b' },
  { id: 'woodwind', label: 'Woodwind', short: 'WW', dot: '#38bdf8' },
  { id: 'percussion', label: 'Battery', short: 'PC', dot: '#fb7185' },
  { id: 'pit', label: 'Pit', short: 'PT', dot: '#a78bfa' },
  { id: 'guard', label: 'Color Guard', short: 'CG', dot: '#34d399' },
  { id: 'fc', label: 'FC', short: 'FC', dot: '#f472b6' },
  { id: 'other', label: 'Lainnya', short: 'OT', dot: '#94a3b8' },
]

/** Bawaan untuk tim baru — Woodwind disembunyikan, bisa dimunculkan lagi. */
export const DEFAULT_SECTIONS: SectionDef[] = BUILTIN_SECTIONS.map((s) => ({
  ...s,
  hidden: s.id === 'woodwind' ? 1 : 0,
}))

/** Registry aktif (diisi ulang oleh `applySectionConfig`). */
export const SECTION_META: Record<string, SectionDef> = {}

/** Terapkan daftar section dari pengaturan ke registry yang dipakai UI. */
export function applySectionConfig(list?: SectionDef[]) {
  const src = list && list.length ? list : DEFAULT_SECTIONS
  for (const k of Object.keys(SECTION_META)) delete SECTION_META[k]
  for (const s of src) SECTION_META[s.id] = { ...s, hidden: s.hidden ?? 0 }
}

/** Section yang tidak disembunyikan (untuk pilihan & statistik). */
export function visibleSections(): SectionDef[] {
  return Object.values(SECTION_META).filter((s) => !s.hidden)
}

/** Label section, dengan cadangan kalau id-nya tidak dikenal lagi. */
export function sectionLabel(id: string): string {
  return SECTION_META[id]?.label ?? id
}

/** Warna titik section, dengan cadangan abu-abu. */
export function sectionDot(id: string): string {
  return SECTION_META[id]?.dot ?? '#94a3b8'
}

applySectionConfig(DEFAULT_SECTIONS)

export const ROLE_LABEL: Record<string, string> = {
  member: 'Anggota',
  sectionLeader: 'Ketua Section',
  drumMajor: 'Drum Major',
  assistant: 'Asisten / Staff',
}

export const STATUS_META: Record<string, { label: string; color: string; short: string }> = {
  hadir: { label: 'Hadir', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', short: 'H' },
  izin: { label: 'Izin', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30', short: 'I' },
  sakit: { label: 'Sakit', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', short: 'S' },
  alpha: { label: 'Tanpa keterangan', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30', short: 'A' },
}

/** D3 — label & warna tiap jenis kegiatan. */
export const SESSION_META: Record<string, { label: string; color: string; singkat: string }> = {
  latihan: { label: 'Latihan rutin', singkat: 'Rutin', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  section: { label: 'Latihan section', singkat: 'Section', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  gabungan: { label: 'Latihan gabungan', singkat: 'Gabungan', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  penampilan: { label: 'Penampilan / konser', singkat: 'Konser', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  rapat: { label: 'Rapat', singkat: 'Rapat', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  lainnya: { label: 'Lainnya', singkat: 'Lain', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
}

/** D3 — urutan jenis kegiatan yang ditampilkan di pilihan & rekap. */
export const URUTAN_JENIS = ['latihan', 'section', 'gabungan', 'penampilan', 'rapat', 'lainnya']

/** D3 — aman dipanggil untuk jenis apa pun (jenis tak dikenal jadi 'Lainnya'). */
export function sesiMeta(type: string) {
  return SESSION_META[type] ?? SESSION_META.lainnya
}
