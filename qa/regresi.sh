#!/usr/bin/env bash
# Menjalankan sekumpulan skrip uji lalu melaporkan ringkasannya saja.
# Pakai: bash regresi.sh [BASE_URL] [skrip...]
#
# 2a — bawaannya versi jadi (:4173), sama dengan regresi-penuh.sh. Dulu :5173,
# server pengembangan yang tidak sanggup memikul regresi (N14).
#
# N18 — skrip ini **gagal** kalau ada rangkaian yang gagal.
#
# Sebelumnya tidak. Selama ini skrip ini hanya MENCETAK ringkasan; kode
# keluarnya selalu 0, jadi langkah "Regresi penuh" di CI hijau apa pun yang
# terjadi — 82 rangkaian boleh semuanya merah, lampunya tetap hijau. Itu
# persis penyakit yang berkali-kali dicatat di `regresi-penuh.sh` (rangkaian
# yang mati tanpa ada yang tahu, rangkaian yang "tidak bisa gagal"), hanya
# satu tingkat lebih tinggi: bukan rangkaiannya yang tidak bisa gagal,
# melainkan **seluruh regresinya**.
#
# Sekarang tiga hal dihitung sebagai kegagalan:
#   1. ringkasan berbunyi selain "0 gagal";
#   2. berkas rangkaiannya tidak ada (dulu: `continue` diam-diam — nama yang
#      salah ketik atau rangkaian yang di-rename membuat barisnya lenyap dari
#      laporan, dan laporannya tetap tampak rapi);
#   3. rangkaian mogok — tidak ada ringkasan sama sekali, atau keluarannya
#      bergaya probe dengan daftar error yang tidak kosong.
#
# Di GitHub Actions alasannya juga dicetak sebagai anotasi `::error::`, supaya
# rangkaian yang gagal terbaca dari API run tanpa harus mengunduh log-nya.
cd "$(dirname "$0")" || exit 1
BASE="${1:-http://localhost:4173}"
shift || true
DAFTAR=("$@")
if [ ${#DAFTAR[@]} -eq 0 ]; then
  DAFTAR=(m1-birama m1-sukat-segmen m1-mode-lagu m1-tempo-lagu-drill uji-birama uji-gabung-musik tempo-map-logika m6-klik-rekaman
    e3 e4 f3 f3b f4 d4 smoke-drill
    dd2 dd2b dd3 dd4 dd4b dd4c dd5-busur dd5b dd6 dd8 dd8b
    dd9-kompas dd9-scrub-tapak dd10b-kartu dd10b-mode dd10b-override
    dd7-tukar-csv uji-csvkoordinat)
fi

GAGAL=()
# N19 — argumen ketiga (opsional): nama asersi yang gagal. Dulu hanya jumlahnya
# yang dicatat, sehingga dari anotasi CI terbaca "79 lulus, 2 gagal" tanpa
# menyebut yang mana — dan satu-satunya cara mengetahuinya adalah mengunduh log
# mentah. Sekarang nama asersinya ikut, jadi kegagalan bisa dijelaskan dari API.
catat_gagal() {
  GAGAL+=("$1|$2|${3:-}")
}

for f in "${DAFTAR[@]}"; do
  if [ ! -f "$f.mjs" ]; then
    printf "%-24s TIDAK ADA BERKAS %s.mjs\n" "$f" "$f"
    catat_gagal "$f" "berkas $f.mjs tidak ada"
    continue
  fi
  # Jeda antar-rangkaian. Kotak pasir ini bermemori 2 GB; tanpa jeda Chrome
  # dari rangkaian sebelumnya kadang belum selesai melepaskan memorinya, dan
  # rangkaian berikutnya kehabisan sumber daya di tengah jalan — gagalnya
  # acak dan tidak ada sangkut pautnya dengan yang diuji.
  #
  # N15 — jedanya DIPERPANJANG dari 6 menjadi 10 detik. Pada regresi 66
  # rangkaian, satu rangkaian pernah gagal sekali lalu lulus lima kali
  # berturut-turut saat dijalankan sendiri: kegagalannya sesaat, bukan
  # cacat. Jeda yang terlalu pendek membuat regresi berbohong sesekali,
  # dan regresi yang berbohong sesekali lambat laun tidak dipercaya.
  #
  # `JEDA` hanya untuk menguji skrip ini sendiri (mis. `JEDA=0 bash
  # regresi.sh … ` saat memeriksa kode keluarnya). Regresi sungguhan —
  # termasuk di CI — memakai 10 detik.
  sleep "${JEDA:-10}"
  # BASE dikirim lewat lingkungan, bukan argumen: skrip uji membacanya dari
  # `process.env.BASE`. Pernah dikirim sebagai argumen — diabaikan begitu
  # saja, dan seluruh rangkaian diam-diam berlari ke bawaan :5173.
  out=$(BASE="$BASE" timeout 600 node "$f.mjs" 2>&1)
  ringkas=$(printf '%s' "$out" | grep -oE "[0-9]+ lulus, [0-9]+ gagal" | tail -1)
  if [ -n "$ringkas" ]; then
    printf "%-24s %s\n" "$f" "$ringkas"
    #
    # N15 — bila ada yang gagal, TAMPILKAN asersinya juga.
    #
    # Ringkasan yang hanya berbunyi "33 lulus, 1 gagal" memaksa
    # menjalankan ulang seluruh rangkaian untuk mengetahui yang mana.
    # Itu mahal (regresi penuh hampir satu jam) dan sering sia-sia:
    # kegagalan sesaat karena waktu biasanya tidak muncul lagi saat
    # diulang — sehingga yang tersisa hanya "tadi ada yang gagal",
    # tanpa pernah diketahui apa.
    #
    # Kegagalan yang tidak bisa dijelaskan akan diabaikan. Maka
    # jelaskan, sekali jalan, tepat di bawah ringkasannya.
    if ! printf '%s' "$ringkas" | grep -q " 0 gagal"; then
      printf '%s' "$out" | grep -E '✗' | sed 's/^/      ↳ /' | head -20
      rincian=$(printf '%s' "$out" | grep -E '✗' | sed 's/^[[:space:]]*//' | head -5 | paste -sd ';' - | sed 's/;/; /g')
      catat_gagal "$f" "$ringkas" "$rincian"
    fi
    continue
  fi
  # Skrip bergaya probe (keluaran JSON): laporkan ada/tidaknya error.
  #
  # N18 — jarak setelah titik dua dibuat lentur (`[[:space:]]*`). Bentuk
  # bakuunya `"errors": []`, tetapi `JSON.stringify` tidak pernah memberi
  # spasi — jadi pola lama tidak pernah cocok dengan keluaran sungguhan, dan
  # rangkaian bergaya probe selalu jatuh ke cabang "tanpa ringkasan" yang
  # (dulu) berarti lolos diam-diam.
  err=$(printf '%s' "$out" | grep -oE '"(error|errors)":[[:space:]]*\[[^]]*\]' | tail -1)
  x=$(printf '%s' "$out" | grep -c '✗')
  if [ -n "$err" ]; then
    printf "%-24s %s | tanda ✗: %s\n" "$f" "$err" "$x"
    isi=$(printf '%s' "$err" | sed -E 's/^"(error|errors)":[[:space:]]*\[//; s/\]$//' | tr -d '[:space:]')
    if [ -n "$isi" ]; then
      catat_gagal "$f" "$err"
    elif [ "$x" != "0" ]; then
      catat_gagal "$f" "$x tanda ✗ tanpa daftar error"
    fi
    continue
  fi
  # Tidak ada ringkasan & tidak ada JSON: rangkaiannya mogok sebelum
  # sempat menilai apa pun (layar sambutan, impor modul, alamat salah, …).
  # Inilah yang dulu tampak sebagai "tanpa ringkasan" lalu dilewatkan.
  printf "%-24s MOGOK — tanpa ringkasan, %s baris keluaran\n" \
    "$f" "$(printf '%s' "$out" | grep -c .)"
  printf '%s' "$out" | tail -12 | sed 's/^/      ↳ /'
  catat_gagal "$f" "mogok tanpa ringkasan" \
    "$(printf '%s' "$out" | grep -v '^[[:space:]]*$' | tail -3 | paste -sd ';' - | sed 's/;/; /g')"
done

echo
if [ ${#GAGAL[@]} -gt 0 ]; then
  echo "RANGKAIAN GAGAL (${#GAGAL[@]} dari ${#DAFTAR[@]}):"
  for g in "${GAGAL[@]}"; do
    nama="${g%%|*}"
    sisa="${g#*|}"
    alasan="${sisa%%|*}"
    rincian="${sisa#*|}"
    [ "$rincian" = "$sisa" ] && rincian=""
    printf "  ✗ %-22s %s\n" "$nama" "$alasan"
    if [ -n "$rincian" ]; then
      printf "      ↳ %s\n" "$rincian"
    fi
    # Di CI, jadikan anotasi supaya terbaca dari API tanpa unduh log.
    # Anotasi GitHub hanya satu baris: pemisah '; ' dipakai apa adanya, dan
    # `%`/`\r`/`\n` tidak muncul karena asersi dicetak di satu baris.
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
      if [ -n "$rincian" ]; then
        echo "::error title=Rangkaian uji gagal::$nama — $alasan — $rincian"
      else
        echo "::error title=Rangkaian uji gagal::$nama — $alasan"
      fi
    fi
  done
  exit 1
fi
echo "Semua ${#DAFTAR[@]} rangkaian lulus."
