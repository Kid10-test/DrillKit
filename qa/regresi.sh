#!/usr/bin/env bash
# Menjalankan sekumpulan skrip uji lalu melaporkan ringkasannya saja.
# Pakai: bash regresi.sh [BASE_URL] [skrip...]
#
# 2a — bawaannya versi jadi (:4173), sama dengan regresi-penuh.sh. Dulu :5173,
# server pengembangan yang tidak sanggup memikul regresi (N14).
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
for f in "${DAFTAR[@]}"; do
  [ -f "$f.mjs" ] || continue
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
  sleep 10
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
    fi
    continue
  fi
  # Skrip bergaya probe (keluaran JSON): laporkan ada/tidaknya error.
  err=$(printf '%s' "$out" | grep -oE '"(error|errors)": \[[^]]*\]' | tail -1)
  x=$(printf '%s' "$out" | grep -c '✗')
  if [ -n "$err" ]; then
    printf "%-24s %s | tanda ✗: %s\n" "$f" "$err" "$x"
  else
    printf "%-24s (tanpa ringkasan) baris: %s | tanda ✗: %s\n" \
      "$f" "$(printf '%s' "$out" | grep -c .)" "$x"
  fi
done
