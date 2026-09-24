#!/usr/bin/env bash
# Beberapa blok supaya satu blok tidak melewati batas waktu satu perintah.
# Daftarnya harus sama dengan regresi-penuh.sh — bila menambah rangkaian di
# sana, tambahkan juga di sini.
# Hasilnya ditulis ke berkas supaya bisa dipantau selagi berjalan.
set -u
cd "$(dirname "$0")" || exit 1
BASE="${1:-http://localhost:4173}"
LOG=hasil-regresi.txt
: > "$LOG"
bash bangun-logika.sh >> "$LOG" 2>&1

echo "== BLOK 1: rangkaian yang sudah ada ==" >> "$LOG"
bash regresi.sh "$BASE" \
  mode-logika bagikan-logika perubahan-tempo-logika uji-situs uji-rilis uji-lapangan \
  sambutan-mode buka-paket tab-absensi formasi-anggota perbarui-materi \
  musik-anggota lebar-hp luring mikrofon-ditolak tim-besar cap-rilis \
  perubahan-tempo \
  darurat-muat periksa-situs situs-ui \
  kunci-otomatis mode-terkunci berbagi-anggota \
  kunci-layar-presenter penanda-sesi evaluasi-anggota \
  backup-lengkap latihan-jadwal pacu-latihan mode-lomba runsheet-lomba \
  kemajuan-presenter tukar-repertoar dasar-jarak csv-gabung pusat-data \
  >> "$LOG" 2>&1

echo "== BLOK 2: rangkaian yang dihidupkan kembali ==" >> "$LOG"
bash regresi.sh "$BASE" \
  uji-birama uji-panjang-lagu uji-ulang uji-gabung-musik uji-setlist \
  m1-birama m1-sukat-segmen m1-mode-lagu m1-tempo-lagu-drill \
  m2-ulang-bagian m3-setlist m5-panjang-lagu m5-panjang-lagu-ui \
  >> "$LOG" 2>&1

echo "== BLOK 3: rangkaian logika yang dihidupkan kembali (N14) ==" >> "$LOG"
bash regresi.sh "$BASE" \
  evaluasi-logika jarak-logika kemajuan-logika kunci-layar-logika latihan-logika lomba-logika pindah-logika repertoar-logika runsheet-logika sesi-logika uji-ambang-gerak uji-csvkoordinat uji-putar-jalan \
  >> "$LOG" 2>&1

echo "== BLOK 4: rangkaian peramban yang dihidupkan kembali (N14) ==" >> "$LOG"
bash regresi.sh "$BASE" \
  ambang-gerak asisten-seksi asisten-urutan putar-jalan backup-setlist lapangan-ui \
  >> "$LOG" 2>&1

echo "== BLOK 5: 1a/1b & rangkaian buku saku yang dihidupkan kembali (2a) ==" >> "$LOG"
bash regresi.sh "$BASE" \
  uji-riwayat uji-simpan-otomatis \
  dd8 dd8b dd9-kompas dd10b-kartu dd10b-mode dd10b-override \
  >> "$LOG" 2>&1

echo "== SELESAI ==" >> "$LOG"
