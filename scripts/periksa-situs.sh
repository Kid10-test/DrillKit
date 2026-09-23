#!/usr/bin/env bash
#
# Periksa kesehatan DrillKit yang SUDAH diterbitkan.
#
# Mengapa skrip ini ada: satu-satunya gejala yang pernah dilaporkan
# berbunyi "link rusak" — padahal yang terjadi adalah perambah meminta
# berkas ber-hash yang sudah terhapus oleh unggahan terakhir. Gejala itu
# tidak bisa ditebak dari dalam aplikasi, dan memeriksanya dengan mata
# butuh membuka jaringan perambah. Skrip ini menjawabnya dalam satu
# perintah, dengan berkas mana yang bermasalah disebut satu per satu.
#
# Butuh: curl (ada di macOS, Linux, dan Git Bash di Windows).
#
# Pakai:  bash scripts/periksa-situs.sh https://nama-situs.netlify.app
#
# Keluar dengan kode 1 bila ada yang GAGAL, jadi skrip ini bisa
# dijalankan otomatis setelah mengunggah.

set -u

SITUS="${1:-}"
SITUS="${SITUS%/}"

if [ -z "$SITUS" ]; then
  echo "Pakai: bash scripts/periksa-situs.sh https://nama-situs.netlify.app"
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Butuh curl, tapi tidak ketemu. Pasang dulu, lalu jalankan ulang."
  exit 2
fi

lulus=0
gagal=0
peringatan=0

lapor() {
  case "$1" in
    ok)   lulus=$((lulus + 1));      printf '  \xe2\x9c\x93 %s\n' "$2" ;;
    gagal) gagal=$((gagal + 1));     printf '  \xe2\x9c\x97 %s\n' "$2" ;;
    *)    peringatan=$((peringatan + 1)); printf '  ! %s\n' "$2" ;;
  esac
  [ -n "${3:-}" ] && printf '      %s\n' "$3"
  return 0
}

# Ambil satu baris kepala balasan, tanpa \r yang kadang menyertainya.
kepala() {
  curl -sSI "$1" 2>/dev/null | tr -d '\r' |
    awk -F': ' -v k="$2" 'tolower($1)==tolower(k){print $2}' | tail -1
}

kode() {
  curl -sS -o /dev/null -w '%{http_code}' "$1" 2>/dev/null
}

echo ""
echo "== Memeriksa $SITUS =="

# ------------------------------------------------------------------
echo ""
echo "— Halaman utama —"
{
  k=$(kode "$SITUS/")
  if [ "$k" = "200" ]; then
    lapor ok "halaman utama menjawab 200"
  else
    lapor gagal "halaman utama menjawab $k, bukan 200" \
      "Situsnya tidak menjawab. Pastikan alamatnya benar dan publikasinya sudah selesai."
  fi

  ct=$(kepala "$SITUS/" content-type)
  case "$ct" in
    *text/html*) lapor ok "halaman utama berupa HTML" ;;
    *) lapor gagal "halaman utama bukan HTML ($ct)" \
      "Biasanya berarti folder yang terunggah salah tingkat: index.html-nya ada di dalam subfolder." ;;
  esac
}

# ------------------------------------------------------------------
echo ""
echo "— Aturan cache (pencegah 'link rusak') —"
#
# Dua berkas ini TIDAK ber-hash namanya. Kalau perambah atau jaringan
# pengirim menyimpannya, perambah akan meminta berkas lama yang sudah
# dihapus unggahan baru — dan itulah halaman "link rusak".
#
{
  for berkas in index.html sw.js; do
    cc=$(kepala "$SITUS/$berkas" cache-control)
    case "$cc" in
      *no-store*|*no-cache*)
        lapor ok "$berkas tidak disimpan oleh perambah ($cc)" ;;
      *)
        lapor peringatan "$berkas boleh disimpan perambah ($cc)" \
          "Berkas _headers belum berlaku. Unggah ulang folder yang berisi _headers, lalu periksa lagi."
        ;;
    esac
  done
}

# ------------------------------------------------------------------
echo ""
echo "— Berkas aplikasi (yang paling sering hilang) —"
#
# Ini pemeriksaan yang paling menentukan. Ambil index.html yang
# MELAYANI, lalu periksa satu per satu berkas yang disebut di
# dalamnya. Bila ada yang 404, perambah lama akan menampilkan
# "link rusak" persis seperti yang dilaporkan.
#
{
  daftar=$(curl -sS "$SITUS/index.html" 2>/dev/null |
    grep -oE '(\./|/)?assets/[A-Za-z0-9_.@-]+\.(js|css)' |
    sed 's|^\./|/|' | sort -u)

  if [ -z "$daftar" ]; then
    lapor peringatan "tidak ada berkas assets/ yang terbaca dari index.html" \
      "Bisa jadi struktur berkasnya berubah. Periksa sendiri: curl -s $SITUS/index.html"
  else
    jumlah=0
    hilang=0
    for f in $daftar; do
      jumlah=$((jumlah + 1))
      k=$(kode "$SITUS$f")
      if [ "$k" != "200" ]; then
        hilang=$((hilang + 1))
        echo "      berkas hilang: $f (menjawab $k)"
      fi
    done
    if [ "$hilang" -eq 0 ]; then
      lapor ok "semua $jumlah berkas aplikasi ada"
    else
      lapor gagal "$hilang dari $jumlah berkas aplikasi HILANG" \
        "Pemakai yang menyimpan versi lama akan melihat 'link rusak'. Unggah ulang SELURUH folder (bukan sebagian)."
    fi
  fi
}

# ------------------------------------------------------------------
echo ""
echo "— Berkas materi (paket.json) —"
#
# paket.json TIDAK pernah ikut di dalam hasil build. Setiap unggahan
# adalah penggantian, jadi berkas ini mudah sekali ikut terhapus.
# Tanpa berkasnya tombol "Perbarui" di HP seluruh anggota mati —
# tanpa ada yang rusak di aplikasinya.
#
{
  k=$(kode "$SITUS/paket.json")
  ct=$(kepala "$SITUS/paket.json" content-type)
  if [ "$k" != "200" ]; then
    lapor peringatan "paket.json tidak ada (menjawab $k)" \
      "Tombol Perbarui di HP anggota belum akan jalan. Salin paket.json ke dalam folder unggahan, lalu seret ulang."
  elif printf '%s' "$ct" | grep -qi 'text/html'; then
    lapor peringatan "paket.json menjawab HTML, bukan berkas materi" \
      "Berkasnya ikut terhapus saat unggahan terakhir. Taruh kembali paket.json di sebelah index.html, lalu unggah ulang."
  else
    lapor ok "paket.json ada dan berbentuk berkas materi ($ct)"
  fi
}

# ------------------------------------------------------------------
echo ""
echo "— Pengalih untuk alamat yang tidak ada —"
#
# Aplikasi memakai HashRouter, jadi aturan ini bukan untuk routing.
# Gunanya: bila perambah meminta berkas lama yang sudah tiada, ia
# menerima index.html dan bisa menampilkan panel daruratnya — bukan
# halaman 404 yang tidak bisa dijelaskan kepada anak-anak.
#
{
  k=$(kode "$SITUS/alamat-yang-pasti-tidak-ada-drillkit")
  if [ "$k" = "200" ]; then
    lapor ok "alamat yang tidak ada dikembalikan ke aplikasi"
  else
    lapor peringatan "alamat yang tidak ada menjawab $k, bukan 200" \
      "Berkas _redirects belum berlaku. Tanpanya, perambah lama akan melihat halaman 'link rusak'."
  fi
}

# ------------------------------------------------------------------
echo ""
echo "== Ringkasan: $lulus baik, $peringatan peringatan, $gagal gagal =="
if [ "$gagal" -gt 0 ]; then
  echo ""
  echo "   Ada yang GAGAL. Unggah ulang SELURUH folder unggah/DrillKit/"
  echo "   (bukan sebagian berkas), lalu jalankan pemeriksaan ini lagi."
  echo "   Ingat: sekali unggah adalah PENGGANTIAN — taruh kembali"
  echo "   paket.json di sebelah index.html sebelum menyeret."
  exit 1
fi
if [ "$peringatan" -gt 0 ]; then
  echo ""
  echo "   Tidak ada yang gagal, tapi ada yang perlu dirapikan."
  echo "   Bila ada pemakai yang masih melapor 'link rusak', perbaiki"
  echo "   peringatan di atas lalu unggah ulang."
fi
exit 0
