#!/usr/bin/env bash
# Beberapa blok supaya satu blok tidak melewati batas waktu satu perintah.
# Daftarnya sama persis dengan regresi-penuh.sh (123 rangkaian) — bila menambah
# rangkaian di sana, tambahkan juga di sini.
# Hasilnya ditulis ke berkas supaya bisa dipantau selagi berjalan.
set -u
cd "$(dirname "$0")" || exit 1
BASE="${1:-http://localhost:4173}"
LOG=hasil-regresi.txt
: > "$LOG"
bash bangun-logika.sh >> "$LOG" 2>&1

echo "== BLOK 1: rangkaian logika murni ==" >> "$LOG"
bash regresi.sh "$BASE" \
  mode-logika bagikan-logika perubahan-tempo-logika tempo-map-logika segmen-drill-logika grid-patok-logika uji-situs uji-rilis uji-lapangan \
  buka-berkas-logika evaluasi-logika jarak-logika kemajuan-logika kunci-layar-logika latihan-logika lomba-logika pindah-logika repertoar-logika runsheet-logika sesi-logika uji-ambang-gerak uji-csvkoordinat uji-putar-jalan \
  uji-birama uji-panjang-lagu uji-ulang uji-gabung-musik uji-setlist uji-riwayat \
  uji-simpan-otomatis uji-kuis uji-pengingat \
  uji-transposisi uji-predikat uji-panduan-anggota \
  nama-anggota-logika terbit-logika terbit-kunci-logika kalender-logika tempo-latihan-logika rekaman-lagu-logika pin-pelatih-logika pyware-logika partitur-logika partitur-zip-logika mxl-logika partitur-bagian-logika partitur-frasa-logika partitur-paket-bunyi-logika setoran-logika kolaborasi-perubahan-logika \
  >> "$LOG" 2>&1

echo "== BLOK 2: mode anggota, kios, & situs ==" >> "$LOG"
bash regresi.sh "$BASE" \
  sambutan-mode buka-paket tab-absensi formasi-anggota perbarui-materi \
  musik-anggota kuis-anggota pengingat-jadwal lebar-hp luring mikrofon-ditolak tim-besar cap-rilis \
  perubahan-tempo \
  darurat-muat periksa-situs situs-ui \
  kunci-otomatis mode-terkunci berbagi-anggota \
  kunci-layar-presenter penanda-sesi evaluasi-anggota \
  j1-polesan kalender-jadwal kalender-anggota \
  >> "$LOG" 2>&1

echo "== BLOK 3: berkas, jadwal, lomba, Pyware, partitur, & portabel ==" >> "$LOG"
bash regresi.sh "$BASE" \
  backup-lengkap buka-berkas latihan-jadwal pacu-latihan mode-lomba runsheet-lomba \
  kemajuan-presenter tukar-repertoar dasar-jarak csv-gabung pusat-data \
  pyware-impor partitur-impor partitur-render partitur-cetak partitur-frasa portabel-rilis polesan-v101 partitur-paket-bunyi setoran-hafalan kolaborasi-perubahan \
  >> "$LOG" 2>&1

echo "== BLOK 4: musik, metronom, tempo latihan, & rekaman ==" >> "$LOG"
bash regresi.sh "$BASE" \
  m1-birama m1-sukat-segmen m1-mode-lagu m1-tempo-lagu-drill m1-penggaris-drill \
  m2-ulang-bagian m3-setlist m5-panjang-lagu m5-panjang-lagu-ui tempo-latihan m6-klik-rekaman m6-drill-rekaman \
  >> "$LOG" 2>&1

echo "== BLOK 5: analitik drill, lapangan, & buku saku ==" >> "$LOG"
bash regresi.sh "$BASE" \
  ambang-gerak asisten-seksi asisten-urutan putar-jalan backup-setlist lapangan-ui \
  dd8 dd8b dd9-kompas dd10b-kartu dd10b-mode dd10b-override kartu-lipat \
  >> "$LOG" 2>&1

echo "== SELESAI ==" >> "$LOG"
