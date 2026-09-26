#!/usr/bin/env bash
# Rakit modul murni aplikasi menjadi .mjs di /tmp, supaya uji *-logika bisa
# mengimpornya langsung tanpa peramban.
#
# Uji logika mengimpor dari '/tmp/<modul>.mjs', bukan dari src — jadi tanpa
# skrip ini uji tersebut hanya jalan di mesin yang kebetulan pernah merakit
# berkasnya dengan tangan, dan `/tmp` kosong setiap kali kotak pasir
# dimulai ulang. Kegagalannya tidak kentara: impor gagal, bukan asersi.
#
# Pakai: bash /home/user/drillkit/qa/bangun-logika.sh
set -eu
# Mengapa tidak lagi `cd /home/user/drillkit`: alamat itu hanya benar di satu
# mesin. Skrip ini terletak di dalam folder `qa/`, jadi folder proyeknya
# selalu satu tingkat di atasnya — di mana pun proyeknya disalin.
cd "$(dirname "$0")/.."
ESBUILD=./node_modules/.bin/esbuild
[ -x "$ESBUILD" ] || { echo "esbuild tidak ketemu"; exit 1; }

rakit() {
  local src="$1" nama="$2"
  "$ESBUILD" "$src" --bundle --format=esm --platform=neutral \
    --outfile="/tmp/$nama.mjs" --log-level=warning
  printf "  %-24s <- %s\n" "$nama.mjs" "$src"
}

echo "== merakit modul untuk uji logika =="
rakit src/lib/modePerangkat.ts modePerangkat
rakit src/lib/bagikan.ts      bagikan
rakit src/lib/zip.ts          zip
rakit src/lib/metronome.ts    metronome
# N7 — birama & ulang ikut dirakit: hitungan waktu lagu kini menerima
# tempo per birama, dan satu-satunya cara mengujinya tanpa peramban adalah
# mengimpor modulnya langsung (uji-birama & uji-panjang-lagu juga butuhnya).
rakit src/lib/birama.ts       birama
rakit src/lib/ulang.ts        ulang
# N8 — uji-gabung-musik & uji-setlist mengimpor '/tmp/gabung.mjs' dan
# '/tmp/setlist.mjs'. Tanpa dua baris ini mereka mogok pada baris impornya
# (ERR_MODULE_NOT_FOUND) — kegagalan yang tampak seperti "uji ini tidak
# punya ringkasan", padahal modulnya yang belum dirakit.
rakit src/lib/gabungMusik.ts  gabung
rakit src/lib/setlist.ts      setlist
# N12 — pemeriksa situs: modul murni, diuji tanpa peramban.
rakit src/lib/situs.ts        situs
# N13 — pendeteksi rilis baru: modul murni, diuji tanpa peramban.
rakit src/lib/rilis.ts        rilis
# N15 — field.ts: modul terbesar aplikasi, baru sekarang punya uji logika.
rakit src/lib/field.ts        lapangan
# N14 — dua belas modul berikut punya rangkaian uji sendiri
# (*-logika) tetapi TIDAK PERNAH dirakit, sehingga uji itu mogok pada
# baris impornya (ERR_MODULE_NOT_FOUND) dan tidak pernah masuk daftar
# regresi. Rangkaian yang tidak dijalankan sama dengan tidak ada.
rakit src/lib/evaluasi.ts     evaluasi
rakit src/lib/analitik.ts     analitik
rakit src/lib/kemajuan.ts     kemajuan
rakit src/lib/kunciLayar.ts   kunciLayar
rakit src/lib/latihan.ts      latihan
rakit src/lib/lomba.ts        lomba
rakit src/lib/runsheet.ts     runsheet
rakit src/lib/pindah.ts       pindah
rakit src/lib/repertoar.ts    repertoar
rakit src/lib/sesi.ts         sesi
rakit src/lib/gerak.ts        gerak
# Nama berkasnya `csvk`, bukan `csvKoordinat` — mengikuti impor ujinya.
rakit src/lib/csvKoordinat.ts csvk
# 1a — riwayat formasi. Ujinya butuh DUA modul: mesin riwayatnya sendiri,
# dan `db` untuk menyiapkan drill & set yang akan difoto. Keduanya membuka
# basis data IndexedDB bernama sama, jadi tulisan dari yang satu terbaca
# oleh yang lain.
rakit src/lib/riwayat.ts    riwayat
rakit src/db/db.ts          dbk
# 1b — simpan otomatis ke berkas. Modulnya mengimpor `backup.ts`,
# jadi ikut terbawa ke dalam bundelnya.
rakit src/lib/simpanOtomatis.ts simpanOtomatis
# C2 — kuis/hafalan anggota: penyusunan soal, penilaian, acakan berbenih.
rakit src/lib/kuis.ts kuis
# C3 — pengingat jadwal: jendela sesi, ingatan harian, berkas .ics.
rakit src/lib/pengingat.ts pengingat
# J1 — polesan: transposisi penala, ambang predikat laporan, panduan anggota.
rakit src/lib/tuner.ts tuner
rakit src/lib/laporan.ts laporan
rakit src/lib/panduan.ts panduan
# Satu anggota, dua nama — pencocokan, penggabungan, panggilan.
rakit src/lib/namaAnggota.ts namaAnggota
# Terbitkan ke anggota — GitHub Contents, pemberitahuan, berkas grup.
rakit src/lib/terbit.ts terbit
echo "== selesai =="
