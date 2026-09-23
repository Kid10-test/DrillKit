#!/usr/bin/env bash
#
# Rakit folder yang siap diseret ke Netlify Drop.
#
# Mengapa skrip ini ada: berkas `paket.json` TIDAK pernah ikut di dalam
# hasil build — pelatih yang menaruhnya sendiri. Sementara sebuah unggahan
# pada layanan tarik-dan-lepas adalah PENGGANTIAN, bukan sinkronisasi:
# apa yang tidak ada di dalam folder akan ikut TERHAPUS dari situs.
#
# Jadi mengunggah ulang tanpa menyertakan paket.json akan MEMATIKAN tombol
# Perbarui di HP seluruh anggota, tanpa ada yang rusak di aplikasinya.
# Skrip ini menaruh pengingatnya tepat di sebelah index.html — persis di
# tempat paket.json seharusnya berada.
#
# Pakai:  bash scripts/siapkan-unggah.sh
# Hasil:  unggah/DrillKit/          <- seret folder INI ke Netlify Drop
#         unggah/PETUNJUK-UNGGAH.txt <- dibaca pelatih, JANGAN diunggah
#         drillkit-siap-unggah.zip
set -eu
cd "$(dirname "$0")/.."

[ -f dist/index.html ] || { echo "dist/ belum ada. Jalankan: npm run build"; exit 1; }

rm -rf unggah
mkdir -p unggah/DrillKit
cp -r dist/. unggah/DrillKit/
cp scripts/petunjuk-unggah.txt     unggah/PETUNJUK-UNGGAH.txt
cp scripts/pengingat-paket-json.txt unggah/DrillKit/TARUH-paket-json-di-sini.txt

rm -f drillkit-siap-unggah.zip
(cd unggah && zip -qr ../drillkit-siap-unggah.zip .)

echo "== siap =="
echo "  unggah/DrillKit/            <- seret folder ini ke Netlify Drop"
echo "  unggah/PETUNJUK-UNGGAH.txt  <- baca dulu, jangan ikut diunggah"
echo "  drillkit-siap-unggah.zip    <- bundel lengkapnya"
echo ""
echo "  Ingat: taruh paket.json di dalam unggah/DrillKit/ sebelum menyeret."
echo ""
echo "  Sudah terunggah? Periksa dengan satu perintah:"
echo "    bash scripts/periksa-situs.sh https://nama-situs-anda.netlify.app"
