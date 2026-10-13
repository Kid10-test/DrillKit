#!/usr/bin/env bash
# Satu perintah untuk seluruh regresi DrillKit.
#
# Dua hal yang membuat ini perlu, karena keduanya pernah luput:
#
#   1. Uji *-logika mengimpor modul dari /tmp, yang hilang setiap kali
#      kotak pasir dimulai ulang — jadi mereka harus dirakit lebih dulu
#      (bangun-logika.sh). Tanpa itu uji logika gagal pada baris impor,
#      bukan pada asersinya, dan kegagalannya mudah salah dibaca.
#   2. regresi.sh butuh daftar rangkaian yang dijalankan. Daftarnya ada di
#      sini supaya tidak ada yang ketinggalan diam-diam.
#
# Tiga belas rangkaian terakhir dalam daftar (uji-* dan m1/m2/m3/m5) pernah
# MATI berbulan-bulan tanpa ada yang tahu: mereka mogok sebelum periksaannya
# yang pertama — ada yang tertutup layar sambutan, ada yang menyisipkan
# modul `/src/db/db.ts` yang hanya ada di server pengembangan, ada yang
# mengimpor modul dari /tmp yang tidak ikut dirakit. Karena mogoknya tidak
# menghasilkan baris "N lulus, M gagal", ringkasannya tampak kosong dan
# mudah dilewatkan begitu saja. Jangan keluarkan mereka lagi dari daftar
# ini tanpa mencatat alasannya di IDE-PENGEMBANGAN.md.
#
# N14 — delapan belas rangkaian berikut (13 *-logika & uji-*, 5 peramban)
# menyusul dengan cara yang berbeda: mereka tidak pernah DIRAKIT modulnya,
# atau masih menunjuk ke server pengembangan (:5173) yang tidak sanggup
# memikul regresi. Keduanya membuat rangkaian itu mogok sebelum asersi
# pertamanya — tanpa pernah menghasilkan baris "N lulus, M gagal".
# Jangan keluarkan lagi tanpa mencatat alasannya.
#
# 2a — enam rangkaian buku saku (dd8 dd8b dd9-kompas dd10b-kartu dd10b-mode
# dd10b-override) menyusul dengan kegagalan yang PALING sunyi: mereka tidak
# mogok, mereka tidak bisa gagal. Isinya skrip pengintai yang mencetak JSON
# tanpa satu asersi pun — tertutup layar sambutan pun mereka keluar dengan
# kode 0 dan `regresi.sh` melaporkan `"error": [] | tanda ✗: 0`, yang
# terbaca bersih. Kini mereka punya asersi (alat bersama: alat-buku-saku.mjs)
# dan SELALU mencetak "N lulus, M gagal". Jangan keluarkan lagi tanpa
# mencatat alasannya.
#
# Pakai: bash /home/user/DrillKit/qa/regresi-penuh.sh [BASE_URL]
#   bawaan BASE_URL = http://localhost:4173 (versi jadi).
#   Jangan arahkan ke server dev Vite (:5173): ia menyajikan ratusan modul
#   per muat dan kehabisan sumber daya di kotak pasir bermemori 2 GB,
#   sehingga gagalnya acak dan menyesatkan.
set -u
cd "$(dirname "$0")" || exit 1
BASE="${1:-http://localhost:4173}"

bash bangun-logika.sh || exit 1

# #10 — `pyware-logika` (impor drill Pyware) menyusul di daftar: pengurai
# lembar koordinat, konversi satuan, pratinjau titik di luar lapangan,
# interpolasi antar set, pencocokan anggota yang diingat, dan tulis+undo lewat
# riwayat. Modulnya dirakit bangun-logika.sh sebagai /tmp/pyware.mjs &
# /tmp/pywareTulis.mjs. Jangan keluarkan lagi tanpa mencatat alasannya.
#
# #6 — dua rangkaian yang menyusul dengan alasan yang sama seperti catatan
# N14 di atas: `rekaman-lagu-logika` sudah ada sejak #6 tetapi modulnya tidak
# pernah dirakit ke /tmp, sehingga mogok pada baris impornya; dan
# `m6-klik-rekaman` (klik harus seiring rekaman, termasuk saat tempo latihan
# mode BPM melambatkan kliknya) memang belum pernah ada. Keduanya sekarang
# dirakit/dijalankan. Jangan keluarkan lagi tanpa mencatat alasannya di
# IDE-PENGEMBANGAN.md.
#
# #11a — `partitur-logika` (partitur MusicXML/PDF: deteksi, ringkasan, D1 &
# D4). Modulnya direkat oleh bangun-logika.sh sebagai /tmp/partitur.mjs dan
# ujinya murni node — tidak butuh peramban, sama seperti #10. Rangkaian
# perambannya (`partitur-impor`) menyusul di tahap 6 #11a. Jangan keluarkan
# lagi tanpa mencatat alasannya.

bash regresi.sh "$BASE" \
  mode-logika bagikan-logika perubahan-tempo-logika tempo-map-logika segmen-drill-logika uji-situs uji-rilis uji-lapangan \
  buka-berkas-logika evaluasi-logika jarak-logika kemajuan-logika kunci-layar-logika latihan-logika lomba-logika pindah-logika repertoar-logika runsheet-logika sesi-logika uji-ambang-gerak uji-csvkoordinat uji-putar-jalan \
  sambutan-mode buka-paket tab-absensi formasi-anggota perbarui-materi \
  musik-anggota kuis-anggota pengingat-jadwal lebar-hp luring mikrofon-ditolak tim-besar cap-rilis \
  perubahan-tempo \
  darurat-muat periksa-situs situs-ui \
  kunci-otomatis mode-terkunci berbagi-anggota \
  kunci-layar-presenter penanda-sesi evaluasi-anggota \
  backup-lengkap buka-berkas latihan-jadwal pacu-latihan mode-lomba runsheet-lomba \
  kemajuan-presenter tukar-repertoar dasar-jarak csv-gabung pusat-data pyware-impor \
  uji-birama uji-panjang-lagu uji-ulang uji-gabung-musik uji-setlist uji-riwayat \
  uji-simpan-otomatis uji-kuis uji-pengingat \
  uji-transposisi uji-predikat uji-panduan-anggota j1-polesan \
  nama-anggota-logika terbit-logika terbit-kunci-logika kalender-logika kalender-jadwal kalender-anggota tempo-latihan-logika rekaman-lagu-logika pin-pelatih-logika pyware-logika partitur-logika \
  m1-birama m1-sukat-segmen m1-mode-lagu m1-tempo-lagu-drill m1-penggaris-drill \
  m2-ulang-bagian m3-setlist m5-panjang-lagu m5-panjang-lagu-ui tempo-latihan m6-klik-rekaman \
  ambang-gerak asisten-seksi asisten-urutan putar-jalan backup-setlist lapangan-ui \
  dd8 dd8b dd9-kompas dd10b-kartu dd10b-mode dd10b-override kartu-lipat
