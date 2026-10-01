# Hasil uji lokal — tempo map custom dan ramp

**Tanggal:** 1 Oktober 2026  
**Lingkungan:** tes logika lokal; GitHub Actions/regresi penuh tidak dijalankan.

## Kontrak ramp yang diuji

Tempo map menerima posisi birama/ketuk/subdivisi 1-based dan durasi ramp
berupa jumlah hitungan eksplisit. Semantik yang dikunci: count 0 adalah tempo
sebelum ramp, count 1 sudah berubah, dan count N tepat mencapai target.

- Accelerando 160 → 180 selama 8 hitungan: **162,5; 165; 167,5; 170;
  172,5; 175; 177,5; 180 BPM**.
- Ritardando 172 → 140 selama 6 hitungan: hitungan 1 sudah berubah dan
  hitungan 6 tepat 140 BPM.

Uji tambahan mencakup perubahan pada subdivisi triplet, durasi terintegrasi,
perubahan meter, kompatibilitas ramp tempo map lama, offset waktu MP3, durasi
dan klik drill, serta BPM partitur vs BPM setelah tempo latihan.

## Rangkaian yang dijalankan

| Rangkaian | Hasil |
|---|---:|
| `qa/tempo-map-logika.mjs` | 25 lulus, 0 gagal |
| `qa/perubahan-tempo-logika.mjs` | 90 lulus, 0 gagal |
| `qa/uji-gabung-musik.mjs` | 51 lulus, 0 gagal |
| `qa/uji-setlist.mjs` | 107 lulus, 0 gagal |
| **Total** | **273 lulus, 0 gagal** |

Selain itu, `npm run typecheck`, `npm run build`, dan `git diff --check` lulus.

## Batas verifikasi

Ini adalah pengujian evaluator dan integrasi logika, bukan uji audio terhadap
berkas yang diekspor oleh Sibelius maupun pengujian manual di perangkat.
Semantik ramp sesuai kontrak hitungan di atas; pemeriksaan dengar dan
perbandingan dengan partitur nyata tetap disarankan sebelum pemakaian pada
repertoar penting.
