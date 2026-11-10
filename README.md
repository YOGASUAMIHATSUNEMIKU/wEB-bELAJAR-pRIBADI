# Catatan Belajar Progresif

Aplikasi web statis untuk membantu mahasiswa mengelola catatan belajar, flashcard, timer sesi, pengaturan profil, dan AI Q&A berbasis konten lokal.

## Fitur utama

- Hari Ini dashboard dengan ringkasan statistik
- Perpustakaan catatan dan file unggahan
- Detail catatan dan review materi
- Tanya Jawab AI berbasis catatan lokal
- Pengaturan profil, tema, dan target belajar
- Timer sesi fokus
- Flashcard kilat untuk review
- Dukungan tema terang/gelap dan penyimpanan lokal

## Jalankan secara lokal

```bash
cd "c:\NGODING\Porjek Porjek an\wEBSITE bELAJAR pRIBADI"
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/
```

## Struktur proyek

- `index.html` – shell aplikasi utama
- `styles.css` – desain UI dan tema
- `js/state.js` – state default dan penyimpanan lokal
- `js/render.js` – komponen render UI
- `js/app.js` – logika interaksi, timer, flashcard, AI Q&A, pengaturan

## Catatan

Aplikasi ini dibuat sebagai prototype front-end dan menyimpan data di browser dengan `localStorage`.
