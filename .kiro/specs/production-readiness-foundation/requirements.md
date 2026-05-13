# Requirements Document — Production Readiness Foundation

## Introduction

Dokumen ini mendefinisikan kebutuhan untuk fondasi kesiapan produksi (production readiness) dari proyek `infotour.id` — direktori wisata Indonesia berbasis Astro 6 + Cloudflare Pages + D1 dengan panel admin dan generator artikel blog bertenaga AI.

Hasil audit menemukan dua kelas masalah yang menghambat peluncuran:

1. **Bug kritis (P0)** yang menyebabkan kehilangan data, kerentanan keamanan, dan kegagalan build/deploy.
2. **Kesenjangan Single Source of Truth (SSOT)**: terlalu banyak konten (nomor WhatsApp, teks hero, statistik, email, URL sosial media, copyright, tag analytics) yang *hardcoded* di dalam komponen sehingga admin non-teknis tidak dapat mengelolanya dari panel admin.

Spesifikasi ini (Spec 1) menutup kedua kelas masalah tersebut sehingga situs dapat dirilis ke produksi dengan data asli, aman, dan dapat dikelola end-to-end oleh admin. Spesifikasi ini **tidak** mencakup: generator blog AI v2, field GTM per-destinasi, media library / R2, serta fitur affiliate products — semuanya didelegasikan ke spesifikasi terpisah.

Bahasa utama dokumen ini adalah Bahasa Indonesia. Istilah teknis (kata kunci EARS, nama field, path API, kata kunci SQL) tetap dalam Bahasa Inggris.

## Glossary

- **SSOT (Single Source of Truth)**: satu-satunya sumber kebenaran untuk sebuah data. Dalam konteks ini berarti konten seperti nomor WhatsApp, teks hero, dan statistik disimpan di tabel `site_settings` di D1 dan dibaca oleh komponen frontend — bukan ditulis ulang di kode.
- **P0**: prioritas tertinggi; bug yang memblokir peluncuran produksi.
- **XSS (Cross-Site Scripting)**: kerentanan di mana HTML atau skrip berbahaya yang disimpan/direfleksikan dapat dieksekusi di browser pengunjung.
- **CSRF (Cross-Site Request Forgery)**: serangan yang memaksa browser yang sudah terotentikasi untuk melakukan aksi yang tidak diinginkan.
- **EARS (Easy Approach to Requirements Syntax)**: format kebutuhan terstruktur (WHEN/WHILE/IF/WHERE/THE/SHALL).
- **hreflang**: atribut HTML yang menandai alternatif bahasa halaman untuk SEO.
- **D1**: database SQLite serverless milik Cloudflare.
- **KV (Workers KV)**: key-value store eventual-consistent milik Cloudflare.
- **Worker / Workers runtime**: lingkungan eksekusi JavaScript V8-isolate milik Cloudflare; tidak mendukung API Node.js seperti `node:fs` atau `node:crypto` asli.
- **WebCrypto**: API kriptografi berbasis standar W3C yang tersedia di Workers runtime.
- **PBKDF2**: algoritma password-based key derivation function berbasis hash berulang (iterations).
- **Argon2id**: memory-hard password hashing function pemenang Password Hashing Competition.
- **Sanitizer**: komponen yang menghapus tag/atribut berbahaya dari HTML dengan daftar whitelist.
- **oEmbed**: protokol untuk meng-embed konten pihak ketiga (YouTube, Vimeo) melalui URL kanonikal.
- **GTM (Google Tag Manager)**: wadah tag; container ID berpola `GTM-XXXXXXX`.
- **GA4 (Google Analytics 4)**: measurement ID berpola `G-XXXXXXXXXX`.
- **Migration (additive)**: migrasi SQL yang hanya menambah kolom/tabel tanpa menghapus atau mengubah semantik kolom lama, sehingga kompatibel mundur.
- **Slug**: identifier ramah URL yang unik (mis. `raja-ampat`).
- **Typed confirmation**: konfirmasi penghapusan dengan mengetikkan slug/judul persis ke input sebelum tombol destructive aktif.
- **Toast**: notifikasi non-blocking yang muncul sementara (umumnya di sudut layar) untuk feedback sukses/gagal.
- **Blog_API**: endpoint API di bawah `/api/blog/*`.
- **Destination_API**: endpoint API di bawah `/api/destinations/*`.
- **Destination_Repository**: modul `src/lib/db/destinations.ts` yang mengakses tabel `destinations` beserta tabel anak.
- **Site_Settings_Repository**: modul baru yang mengakses tabel `site_settings`.
- **Site_Settings_API**: endpoint admin untuk membaca/menulis site settings.
- **Admin_Settings_Page**: halaman `/admin/settings` dengan tab-tab (General, Contact, Homepage, SEO, Analytics).
- **Admin_Destination_List**: halaman `/admin/destinations` (daftar destinasi di panel admin).
- **Admin_Blog_List**: halaman `/admin/blog` (daftar artikel blog di panel admin).
- **Content_Sanitizer**: modul pembersih HTML berbasis whitelist.
- **Article_Renderer**: komponen `ArticleContent.astro` yang merender HTML artikel.
- **Password_Hasher**: modul `src/lib/auth/password.ts` untuk hashing & verifikasi password.
- **Login_Rate_Limiter**: modul yang membatasi percobaan login gagal per-IP.
- **Public_Page**: kumpulan halaman publik di `src/pages/**` (homepage, direktori, detail destinasi, blog) — baik locale `id` maupun `en`.
- **Homepage**: `src/pages/index.astro` dan `src/pages/en/index.astro`.
- **Footer**: `src/components/ui/Footer.astro`.
- **WhatsApp_FAB**: `src/components/ui/WhatsAppFAB.astro` (Floating Action Button).
- **Base_Layout**: `src/layouts/BaseLayout.astro`.
- **Error_Page**: halaman 503 yang dirender oleh middleware saat terjadi error runtime.
- **Deployment_Checklist**: dokumen dan/atau skrip yang memverifikasi prasyarat deploy.
- **Dependency_Manifest**: `package.json` + `package-lock.json`.

## Requirements

---

### Section 1 — Bug Fixes (P0)

#### Requirement 1: Persistensi Draft AI Blog ke D1 Sebelum Redirect

**User Story:** Sebagai Admin Website, saya ingin draft artikel yang dihasilkan generator AI tersimpan ke database sebelum saya diarahkan ke halaman edit, sehingga konten tidak hilang saat halaman edit memuat ulang.

**Catatan konteks:** Saat ini `POST /api/blog/generate` mengembalikan objek `Article` hanya di memori (lihat `src/pages/api/blog/generate.ts`); halaman edit kemudian mencoba memuat artikel berdasarkan ID dari DB dan gagal.

#### Acceptance Criteria

1. WHEN `POST /api/blog/generate` menyelesaikan generasi konten dengan sukses, THE Blog_API SHALL memanggil `createArticle` pada `Blog_Repository` dengan `status = 'draft'` sebelum mengembalikan response.
2. WHEN draft berhasil dipersist, THE Blog_API SHALL mengembalikan HTTP 201 dengan body `{ success: true, data: { id, slug, language, status: 'draft', ...article } }`.
3. IF penulisan draft ke D1 gagal, THEN THE Blog_API SHALL mengembalikan HTTP 500 dengan kode `PERSIST_FAILED` dan SHALL TIDAK mengembalikan konten artikel yang belum tersimpan.
4. WHEN draft berhasil dipersist, THE Admin_Blog_List SHALL menampilkan draft tersebut pada daftar artikel admin dalam request berikutnya tanpa intervensi manual.
5. THE Blog_API SHALL memastikan properti testable: untuk setiap request `/api/blog/generate` yang mengembalikan HTTP 201 dengan `data.id = X`, `SELECT COUNT(*) FROM blog_articles WHERE id = X` SHALL bernilai 1.
6. THE Blog_API SHALL memastikan properti round-trip testable: untuk setiap response sukses `/api/blog/generate`, `GET /api/blog/{data.id}` SHALL mengembalikan artikel dengan `title`, `content`, `excerpt`, `metaDescription`, dan `language` identik dengan body response generate.

---

#### Requirement 2: Update Destinasi Mempertahankan Koleksi Anak yang Tidak Dikirim

**User Story:** Sebagai Admin Website, saya ingin saat saya menyimpan destinasi tanpa menyentuh tab galeri/paket/testimoni/FAQ, data existing pada koleksi tersebut tidak terhapus, sehingga saya tidak kehilangan konten yang belum saya edit.

**Catatan konteks:** `updateDestination` pada `src/lib/db/destinations.ts` menginterpretasikan *semua* properti `input.galleryImages/services/testimonials/faqEntries` yang tidak `undefined` — termasuk array kosong `[]` — sebagai "hapus semua lalu insert ulang", dan form admin saat ini selalu mengirim array kosong untuk tab yang tidak aktif.

#### Acceptance Criteria

1. WHEN `PUT /api/destinations/{id}` menerima body tanpa field `galleryImages`, THE Destination_Repository SHALL mempertahankan seluruh row pada `gallery_images` dengan `destination_id = {id}` tanpa perubahan.
2. WHEN `PUT /api/destinations/{id}` menerima body tanpa field `services`, THE Destination_Repository SHALL mempertahankan seluruh row pada `service_packages` dengan `destination_id = {id}` tanpa perubahan.
3. WHEN `PUT /api/destinations/{id}` menerima body tanpa field `testimonials`, THE Destination_Repository SHALL mempertahankan seluruh row pada `testimonials` dengan `destination_id = {id}` tanpa perubahan.
4. WHEN `PUT /api/destinations/{id}` menerima body tanpa field `faqEntries`, THE Destination_Repository SHALL mempertahankan seluruh row pada `faq_entries` dengan `destination_id = {id}` tanpa perubahan.
5. WHEN `PUT /api/destinations/{id}` menerima body dengan `galleryImages = []` (array kosong eksplisit), THE Destination_Repository SHALL menghapus seluruh row pada `gallery_images` dengan `destination_id = {id}` (semantik "kosongkan" dibedakan dari "tidak dikirim").
6. THE Destination_Form (admin UI) SHALL mengirim hanya field yang diubah oleh admin (dirty fields) dan SHALL NOT menyertakan key `galleryImages`, `services`, `testimonials`, atau `faqEntries` bila admin tidak pernah membuka tab terkait dalam sesi edit.
7. THE Destination_Repository SHALL memastikan properti testable (invariant): untuk setiap panggilan `updateDestination(db, id, input)` dengan `input.galleryImages === undefined`, `SELECT COUNT(*) FROM gallery_images WHERE destination_id = id` SHALL menghasilkan nilai yang identik sebelum dan sesudah panggilan; properti serupa berlaku untuk `services`, `testimonials`, dan `faqEntries`.
8. THE Destination_Repository SHALL memastikan properti testable (idempotence): untuk setiap destinasi `D`, memanggil `updateDestination(db, D.id, {})` dua kali SHALL menghasilkan state tabel `destinations`, `gallery_images`, `service_packages`, `testimonials`, dan `faq_entries` yang identik dengan state sebelum pemanggilan (kecuali `updated_at`).

---

#### Requirement 3: Konfigurasi `wrangler.toml` Valid dan Prosedur Deploy Terdokumentasi

**User Story:** Sebagai developer yang men-deploy pertama kali, saya ingin `wrangler.toml` mereferensikan `database_id` D1 yang sebenarnya dan `README.md` menuntun langkah deploy, sehingga `wrangler pages deploy` tidak gagal di CI.

#### Acceptance Criteria

1. THE `wrangler.toml` SHALL tidak mengandung string literal `placeholder-replace-with-actual-id` atau substring `placeholder` pada field `database_id`.
2. THE `wrangler.toml` SHALL memiliki `database_id` yang cocok dengan regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (UUID v4 dari `wrangler d1 create`).
3. THE `README.md` SHALL memiliki section `## Deployment` yang mendokumentasikan perintah berurutan: (a) `wrangler d1 create infotour-db`, (b) menyalin `database_id` ke `wrangler.toml`, (c) `wrangler d1 migrations apply infotour-db --remote`, (d) `npm run build`, (e) `wrangler pages deploy dist`.
4. THE `README.md` SHALL mendokumentasikan environment variables/secrets yang wajib di-set via `wrangler secret put`: minimal `DEEPSEEK_API_KEY`, `EXA_API_KEY`, `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_PASSWORD`.
5. IF `database_id` bernilai placeholder atau tidak cocok format UUID, THEN THE Deployment_Checklist SHALL gagal dengan pesan error yang menyebutkan nama field spesifik.

---

#### Requirement 4: `package.json` Menggunakan Versi Dependency yang Nyata dan Terkunci

**User Story:** Sebagai developer, saya ingin `npm install` berhasil di CI dan di mesin baru, sehingga build tidak terhambat oleh versi package fiktif.

**Catatan konteks:** `package.json` saat ini mencantumkan `typescript: ^6.0.3` (major 6 belum rilis), `lucide-react: ^1.14.0` (versi tidak ada; major saat ini 0.x), `astro: ^6.3.1` (perlu verifikasi ketersediaan).

#### Acceptance Criteria

1. THE Dependency_Manifest SHALL mencantumkan versi `typescript` yang nyata dan ter-publish ke npm registry (target: `^5.6.0` atau versi stabil terbaru pada seri 5.x yang sudah dirilis).
2. THE Dependency_Manifest SHALL mencantumkan versi `lucide-react` yang nyata dan ter-publish (target: seri `^0.4xx.x` stabil terbaru yang dirilis).
3. THE Dependency_Manifest SHALL mencantumkan versi `astro` yang nyata dan ter-publish; jika Astro 6.x belum dirilis saat implementasi, versi SHALL diturunkan ke Astro 5.x LTS terbaru dan `@astrojs/cloudflare`, `@astrojs/react`, `@astrojs/check` SHALL disesuaikan dengan range yang kompatibel.
4. WHEN `npm install` dijalankan pada direktori bersih, THE Dependency_Manifest SHALL menyelesaikan tanpa error `ETARGET` atau `npm ERR! No matching version found`.
5. WHEN `npm run build` dijalankan setelah `npm install`, THE Dependency_Manifest SHALL menghasilkan build sukses tanpa error TypeScript peering.
6. THE `package-lock.json` SHALL di-commit ulang setelah perubahan versi sehingga reproducible builds.

---

#### Requirement 5: Sanitasi HTML Konten Blog pada Simpan dan Render

**User Story:** Sebagai Admin Website, saya ingin konten blog yang disimpan dan ditampilkan tidak bisa mengandung skrip berbahaya, sehingga pengunjung website terlindung dari XSS.

**Catatan konteks:** `ArticleContent.astro` menggunakan `set:html={article.content}` pada konten dari DB; tidak ada sanitizer saat simpan maupun render.

#### Acceptance Criteria

1. WHEN `POST /api/blog` atau `PUT /api/blog/{id}` menerima field `content`, THE Content_Sanitizer SHALL memroses string tersebut sebelum dituliskan ke kolom `blog_articles.content`.
2. THE Content_Sanitizer SHALL mengizinkan hanya tag HTML pada whitelist berikut: `p, br, h1, h2, h3, h4, h5, h6, ul, ol, li, strong, em, b, i, u, s, a, img, blockquote, code, pre, table, thead, tbody, tr, th, td, figure, figcaption, hr, iframe`.
3. THE Content_Sanitizer SHALL menghapus seluruh tag `<script>`, `<style>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<link>`, `<meta>` beserta konten di dalamnya.
4. THE Content_Sanitizer SHALL menghapus semua atribut yang dimulai dengan `on` (event handlers), termasuk `onclick`, `onerror`, `onload`, `onmouseover`, dll., pada semua tag yang lolos whitelist.
5. IF sebuah atribut `href` atau `src` berisi URL dengan skema `javascript:`, `data:` (kecuali `data:image/*` untuk atribut `src` pada tag `img`), atau `vbscript:`, THEN THE Content_Sanitizer SHALL menghapus atribut tersebut.
6. WHERE konten memuat tag `<iframe>`, THE Content_Sanitizer SHALL mengizinkan `<iframe>` hanya bila atribut `src` cocok dengan daftar oEmbed yang di-whitelist: host `youtube.com`, `www.youtube.com`, `youtube-nocookie.com`, `www.youtube-nocookie.com`, `player.vimeo.com`.
7. THE Article_Renderer SHALL menjalankan `Content_Sanitizer` ulang pada konten sebelum memasukkannya ke `set:html`, sehingga artikel yang ter-persist sebelum sanitasi tetap aman saat dirender (defense in depth).
8. THE Content_Sanitizer SHALL memastikan properti testable (idempotence): `sanitize(sanitize(x)) === sanitize(x)` untuk seluruh input string `x`.
9. THE Content_Sanitizer SHALL memastikan properti testable (safety invariant): untuk seluruh input string `x`, `sanitize(x)` tidak mengandung substring case-insensitive `<script`, `javascript:`, ` on` (spasi diikuti `on`), dan tidak memuat tag `<iframe>` dengan `src` yang host-nya di luar whitelist oEmbed.
10. THE Content_Sanitizer SHALL memastikan properti testable (whitelist preservation): untuk konten yang seluruhnya terdiri dari tag whitelist tanpa atribut berbahaya, `sanitize(x)` secara semantik (setelah normalisasi whitespace) SHALL mempertahankan semua tag whitelist tanpa menghapusnya.

---

#### Requirement 6: Halaman Publik Toleran terhadap DB Kosong atau Tidak Tersedia

**User Story:** Sebagai Pengunjung Website, saya ingin halaman apa pun tetap dapat dibuka meski database sedang belum ter-seed atau koneksi bermasalah, sehingga saya tidak melihat halaman 500.

#### Acceptance Criteria

1. WHEN sebuah Public_Page merender dan `getDB()` melempar exception, THE Public_Page SHALL menangkap exception tersebut dan SHALL merender halaman dengan fallback default (daftar kosong, copy default dari `site_settings` cached default, atau mock data dalam mode development).
2. WHEN sebuah Public_Page merender dan query D1 mengembalikan 0 row, THE Public_Page SHALL merender halaman dengan state kosong yang manusiawi (mis. pesan "Belum ada destinasi" / "No destinations yet") dan SHALL TIDAK melempar exception.
3. THE Public_Page SHALL memastikan bahwa rute `/`, `/destinations`, `/destinations/{slug}`, `/blog`, `/blog/{slug}`, `/en/`, `/en/destinations`, `/en/destinations/{slug}`, `/en/blog`, `/en/blog/{slug}` mengembalikan HTTP 200 saat semua tabel kosong setelah migrasi awal.
4. IF `getDestinationBySlug` atau `getArticleBySlug` mengembalikan `null` untuk slug yang diminta, THEN THE Public_Page SHALL mengembalikan HTTP 404 melalui `Astro.redirect` ke 404 page atau `return new Response(..., { status: 404 })`, bukan HTTP 500.
5. WHEN runtime error terjadi di dalam middleware atau page render, THE Base_Layout SHALL menampilkan Error_Page dengan branding dari `site_settings` dan tombol kembali ke homepage, dengan HTTP status 503.
6. THE Public_Page SHALL memastikan properti testable: untuk setiap rute publik pada daftar Kriteria 3, dengan seluruh tabel di-truncate, handler Astro SHALL mengembalikan Response dengan `status === 200`.

---

#### Requirement 7: Tombol Delete Fungsional dengan Konfirmasi Typed Slug

**User Story:** Sebagai Admin Website, saya ingin menghapus destinasi atau artikel blog yang salah dari panel admin dengan langkah konfirmasi yang mencegah salah klik, sehingga saya dapat mengelola konten tanpa takut menghapus item yang salah.

#### Acceptance Criteria

1. THE Admin_Destination_List SHALL menampilkan tombol "Hapus" pada setiap baris destinasi yang memicu dialog konfirmasi.
2. THE Admin_Blog_List SHALL menampilkan tombol "Hapus" pada setiap baris artikel yang memicu dialog konfirmasi.
3. WHEN admin menekan tombol "Hapus" pada destinasi, THE Admin_UI SHALL menampilkan dialog yang (a) menampilkan judul dan slug destinasi, (b) meminta admin mengetikkan slug persis ke dalam input, (c) menonaktifkan tombol konfirmasi hingga input cocok persis dengan slug.
4. WHEN admin menekan tombol "Hapus" pada artikel dengan `status = 'published'`, THE Admin_UI SHALL menerapkan konfirmasi typed slug yang sama seperti Kriteria 3.
5. WHERE artikel berstatus `draft`, THE Admin_UI MAY menggunakan konfirmasi dialog sederhana (Yes/No) tanpa typed slug.
6. WHEN admin mengonfirmasi hapus, THE Admin_UI SHALL mengirim `DELETE /api/destinations/{id}` atau `DELETE /api/blog/{id}` dan SHALL menampilkan loading state pada tombol konfirmasi hingga response tiba.
7. WHEN response hapus berhasil, THE Admin_UI SHALL menampilkan Toast sukses dengan teks "Destinasi / Artikel berhasil dihapus" dan SHALL menghapus baris dari daftar tanpa full page reload.
8. IF response hapus gagal, THEN THE Admin_UI SHALL menampilkan Toast error dengan pesan dari server dan SHALL mengembalikan tombol konfirmasi ke state aktif.

---

#### Requirement 8: Password Hashing dengan PBKDF2 ≥100k Iterasi atau Argon2id via WebCrypto

**User Story:** Sebagai Admin Website, saya ingin password akun admin disimpan menggunakan algoritma hashing modern dengan work factor tinggi, sehingga kredensial tetap aman meski database bocor.

**Catatan konteks:** `src/lib/auth/password.ts` saat ini sudah menggunakan PBKDF2 dengan 100_000 iterasi via WebCrypto; requirement ini mengunci nilai tersebut sebagai baseline dan menambahkan versioning untuk migrasi masa depan.

#### Acceptance Criteria

1. THE Password_Hasher SHALL menggunakan WebCrypto API (`crypto.subtle`) dan SHALL TIDAK mengimpor modul Node.js (`node:crypto`, `bcrypt`, `argon2` native).
2. WHERE algoritma yang digunakan adalah PBKDF2, THE Password_Hasher SHALL menggunakan hash SHA-256, salt acak 16 byte dari `crypto.getRandomValues`, dan minimum 100_000 iterasi.
3. WHERE algoritma yang digunakan adalah Argon2id (via library pure-JS atau WASM yang kompatibel Workers), THE Password_Hasher SHALL menggunakan parameter minimum `t=3, m=65536 KiB, p=1`.
4. THE Password_Hasher SHALL menyimpan hash dalam format ber-versi `{algo}${params}${salt_hex}${hash_hex}` (mis. `pbkdf2-sha256$i=100000$<salt>$<hash>`) sehingga verifier dapat mendeteksi algoritma dan parameter tanpa asumsi implicit.
5. WHEN `verifyPassword` menerima hash tanpa prefix algoritma (format legacy `{salt}:{hash}` yang ada saat ini), THE Password_Hasher SHALL menginterpretasikannya sebagai `pbkdf2-sha256$i=100000` untuk kompatibilitas mundur.
6. WHEN `verifyPassword` sukses untuk hash legacy, THE Login_Endpoint SHALL melakukan rehash password yang baru divalidasi menggunakan format ber-versi terbaru dan SHALL meng-update `admin_users.password_hash` dalam transaksi yang sama.
7. THE Password_Hasher SHALL melakukan perbandingan hash menggunakan algoritma constant-time (seperti sudah ada pada implementasi saat ini).
8. THE Password_Hasher SHALL memastikan properti testable: untuk seluruh string password `p`, `verifyPassword(p, hashPassword(p)) === true` dan `verifyPassword(p + 'x', hashPassword(p)) === false`.
9. THE Password_Hasher SHALL memastikan properti testable: `hashPassword(p)` untuk password `p` yang sama SHALL menghasilkan hash string yang berbeda (salt acak) pada setiap pemanggilan.

---

#### Requirement 9: Rate Limit Login 5 Gagal / 15 Menit / IP dengan Lockout 1 Jam

**User Story:** Sebagai Admin Website, saya ingin endpoint login dilindungi dari brute force, sehingga attacker tidak dapat menguji kombinasi password tanpa batas.

#### Acceptance Criteria

1. WHEN `POST /api/auth/login` menerima request, THE Login_Rate_Limiter SHALL mengidentifikasi klien menggunakan header `CF-Connecting-IP` (fallback ke `X-Forwarded-For` field pertama, fallback terakhir string `unknown`).
2. THE Login_Rate_Limiter SHALL menyimpan counter percobaan gagal di D1 (tabel baru `login_attempts`) atau Workers KV, dengan keterkaitan pada IP dan window waktu.
3. WHEN sebuah IP mengakumulasi 5 percobaan login gagal dalam window 15 menit, THE Login_Rate_Limiter SHALL menolak request login berikutnya dari IP tersebut dengan HTTP 429 dan header `Retry-After` selama 60 menit, tanpa melakukan pencarian user di `admin_users`.
4. WHILE sebuah IP dalam status terkunci (locked out), THE Login_Rate_Limiter SHALL mengembalikan HTTP 429 dengan body `{ success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Coba lagi dalam {mins} menit.' } }` untuk setiap request login dari IP tersebut.
5. WHEN login berhasil (HTTP 200), THE Login_Rate_Limiter SHALL mereset counter percobaan gagal untuk IP tersebut ke 0.
6. IF kredensial salah (password tidak cocok atau user tidak ditemukan), THEN THE Login_Endpoint SHALL mengembalikan HTTP 401 dengan body `{ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }` — pesan yang sama untuk kedua kasus, sehingga tidak membocorkan keberadaan username.
7. THE Login_Endpoint SHALL memastikan timing response untuk "user tidak ditemukan" dan "password salah" berada dalam orde magnitudo yang sama, dengan melakukan dummy `verifyPassword` terhadap hash konstanta saat user tidak ditemukan.
8. THE Login_Rate_Limiter SHALL mengekspos fungsi `recordFailedAttempt(ip)`, `isLockedOut(ip)`, `resetAttempts(ip)` yang testable secara independen dari endpoint.
9. THE Login_Rate_Limiter SHALL memastikan properti testable: untuk IP `X` dengan state bersih, memanggil `recordFailedAttempt(X)` sebanyak 5 kali dalam window SHALL membuat `isLockedOut(X)` bernilai `true`, dan memanggil 4 kali SHALL membuat `isLockedOut(X)` bernilai `false`.
10. THE Login_Rate_Limiter SHALL memastikan properti testable: untuk IP `X` yang terkunci, `resetAttempts(X)` SHALL membuat `isLockedOut(X)` bernilai `false`.

---

### Section 2 — Site Settings Data (SSOT)

#### Requirement 10: Tabel `site_settings` dengan Field Lengkap Branding, Kontak, Hero, SEO, Analytics

**User Story:** Sebagai Admin Website, saya ingin satu sumber data terpusat untuk nama brand, kontak, teks hero, default SEO, dan tag analytics, sehingga perubahan konten global tidak memerlukan deploy ulang.

#### Acceptance Criteria

1. THE Migration SHALL menambahkan tabel `site_settings` dengan struktur single-row: `id INTEGER PRIMARY KEY CHECK(id = 1)` sehingga hanya satu row yang valid.
2. THE `site_settings` SHALL memiliki kolom branding: `brand_name_id TEXT NOT NULL`, `brand_name_en TEXT NOT NULL`, `tagline_id TEXT NOT NULL`, `tagline_en TEXT NOT NULL`, `logo_url TEXT`, `favicon_url TEXT`.
3. THE `site_settings` SHALL memiliki kolom kontak: `primary_whatsapp_number TEXT NOT NULL`, `support_email TEXT NOT NULL`, `address TEXT`, `social_instagram_url TEXT`, `social_youtube_url TEXT`, `social_facebook_url TEXT`, `social_tiktok_url TEXT`.
4. THE `site_settings` SHALL memiliki kolom hero: `hero_image_url TEXT NOT NULL`, `hero_title_id TEXT NOT NULL`, `hero_title_en TEXT NOT NULL`, `hero_subtitle_id TEXT NOT NULL`, `hero_subtitle_en TEXT NOT NULL`, `hero_cta_text_id TEXT NOT NULL`, `hero_cta_text_en TEXT NOT NULL`.
5. THE `site_settings` SHALL memiliki kolom stats: `destinations_count_override INTEGER` (nullable), `destinations_count_auto INTEGER NOT NULL DEFAULT 1` (boolean 0/1; bila 1 gunakan count live dari DB), `partners_count INTEGER NOT NULL DEFAULT 0`, `happy_tourists_count INTEGER NOT NULL DEFAULT 0`, `average_rating REAL NOT NULL DEFAULT 0`.
6. THE `site_settings` SHALL memiliki kolom SEO: `default_og_image TEXT`, `default_meta_description_template_id TEXT NOT NULL`, `default_meta_description_template_en TEXT NOT NULL`.
7. THE `site_settings` SHALL memiliki kolom footer: `copyright_text TEXT NOT NULL`, `footer_tagline_id TEXT`, `footer_tagline_en TEXT`.
8. THE `site_settings` SHALL memiliki kolom analytics: `gtm_container_id TEXT` (nullable), `ga4_measurement_id TEXT` (nullable), `custom_head_html TEXT` (nullable).
9. THE `site_settings` SHALL memiliki kolom audit: `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`.
10. THE Site_Settings_Repository SHALL mengekspos `getSiteSettings(db): Promise<SiteSettings>` yang SHALL mengembalikan objek bertipe kuat dengan default sane (bukan `null`) bila row belum ada.
11. THE Site_Settings_Repository SHALL mengekspos `updateSiteSettings(db, patch: Partial<SiteSettings>): Promise<SiteSettings>` yang SHALL menerapkan patch parsial (field `undefined` dipertahankan, field bernilai dipakai).
12. THE Site_Settings_Repository SHALL memastikan properti testable (patch invariant): untuk setiap `SiteSettings` awal `S` dan patch `P`, setelah `updateSiteSettings(db, P)`, `getSiteSettings(db)` SHALL mengembalikan objek `S'` dengan `S'[k] === P[k]` untuk setiap `k` yang didefinisikan di `P`, dan `S'[k] === S[k]` untuk setiap `k` yang `undefined` di `P`.
13. THE Site_Settings_Repository SHALL memastikan properti testable (idempotence): `updateSiteSettings(db, P)` dua kali berturut-turut dengan `P` yang sama SHALL menghasilkan state `site_settings` yang identik.

---

#### Requirement 11: Halaman `/admin/settings` dengan Tab dan Validasi Inline

**User Story:** Sebagai Admin Website, saya ingin mengelola semua site settings dari satu halaman admin dengan tab yang terorganisir dan validasi inline, sehingga saya tidak perlu mengetahui struktur DB.

#### Acceptance Criteria

1. THE Admin_Settings_Page SHALL tersedia pada rute `/admin/settings` di belakang session middleware yang sudah ada.
2. THE Admin_Settings_Page SHALL memiliki lima tab: "General", "Contact", "Homepage", "SEO", "Analytics".
3. THE Admin_Settings_Page SHALL memuat seluruh field pada Requirement 10 ke tab yang sesuai: (General: branding, logo, favicon, copyright, footer_tagline) (Contact: whatsapp, email, address, social_*) (Homepage: hero_*, stats_*) (SEO: default_og_image, default_meta_description_template_*) (Analytics: gtm_container_id, ga4_measurement_id, custom_head_html).
4. WHEN admin menyimpan form, THE Admin_Settings_Page SHALL mengirim `PUT /api/site-settings` dengan body hanya field dirty, dan SHALL menampilkan Toast sukses atau error sesuai response.
5. THE Admin_Settings_Page SHALL memvalidasi `primary_whatsapp_number` cocok dengan regex `^62[0-9]{8,13}$` (WA Indonesia tanpa `+`, tanpa spasi) dan SHALL menampilkan pesan inline Bahasa Indonesia "Nomor WhatsApp harus diawali 62 dan berisi 10–15 digit" saat invalid.
6. THE Admin_Settings_Page SHALL memvalidasi `support_email` cocok dengan regex email standar dan SHALL menampilkan "Format email tidak valid" saat invalid.
7. THE Admin_Settings_Page SHALL memvalidasi setiap field `social_*_url` yang terisi cocok dengan skema `https://` dan host yang sesuai platform (mis. `instagram.com`, `youtube.com` atau `youtu.be`, `facebook.com` atau `fb.com`, `tiktok.com`), dengan pesan inline yang menyebutkan platform.
8. THE Admin_Settings_Page SHALL memvalidasi `gtm_container_id` bila terisi cocok dengan regex `^GTM-[A-Z0-9]{4,10}$` dan SHALL menampilkan "GTM Container ID harus berpola GTM-XXXXXXX" saat invalid.
9. THE Admin_Settings_Page SHALL memvalidasi `ga4_measurement_id` bila terisi cocok dengan regex `^G-[A-Z0-9]{6,12}$` dan SHALL menampilkan "GA4 Measurement ID harus berpola G-XXXXXXXXXX" saat invalid.
10. THE Admin_Settings_Page SHALL memvalidasi `custom_head_html` melalui whitelist analytics: SHALL menolak konten yang memuat tag di luar `<script>` (dengan atribut `src` dari host yang di-whitelist: `googletagmanager.com`, `google-analytics.com`, `clarity.ms`, `hotjar.com`) atau `<noscript>`; SHALL menampilkan "Hanya snippet analytics yang diizinkan" saat invalid.
11. THE Admin_Settings_Page SHALL memiliki toggle "Gunakan jumlah destinasi otomatis" yang mengontrol `destinations_count_auto`; saat aktif, input `destinations_count_override` SHALL dinonaktifkan.
12. WHEN admin mengubah salah satu field dan mencoba meninggalkan halaman tanpa menyimpan, THE Admin_Settings_Page SHALL menampilkan prompt konfirmasi "Ada perubahan yang belum disimpan. Yakin keluar?" via `beforeunload` dan in-app navigation guard.
13. WHEN admin menekan tombol Simpan, THE Admin_Settings_Page SHALL menampilkan loading state pada tombol (disabled + spinner) hingga response API tiba.

---

### Section 3 — Frontend Integration (SSOT Consumer)

#### Requirement 12: Komponen Global Membaca dari `site_settings`, Tanpa Hardcode Konten

**User Story:** Sebagai Admin Website, saya ingin perubahan nomor WhatsApp, teks hero, email, atau social URLs tercermin di semua halaman publik segera setelah saya simpan, sehingga tidak ada informasi stale di frontend.

#### Acceptance Criteria

1. THE Footer SHALL membaca `primary_whatsapp_number`, `support_email`, `address`, `social_instagram_url`, `social_youtube_url`, `social_facebook_url`, `social_tiktok_url`, `copyright_text`, `brand_name_{locale}`, `footer_tagline_{locale}` dari `site_settings` dan SHALL TIDAK memuat string literal nomor WA, email, atau social URL.
2. THE WhatsApp_FAB SHALL membaca `primary_whatsapp_number` dari `site_settings` dan SHALL TIDAK memuat default `6281200000000` di kode.
3. THE Homepage SHALL membaca `hero_image_url`, `hero_title_{locale}`, `hero_subtitle_{locale}`, `hero_cta_text_{locale}` dari `site_settings` dan SHALL TIDAK memuat copy hero hardcoded.
4. THE Base_Layout SHALL membaca `brand_name_{locale}`, `default_og_image`, `default_meta_description_template_{locale}`, `favicon_url`, `gtm_container_id`, `ga4_measurement_id`, `custom_head_html` dari `site_settings` untuk default meta, OG image, favicon, dan injeksi analytics.
5. WHERE `gtm_container_id` terisi, THE Base_Layout SHALL menyuntikkan snippet GTM standar di `<head>` dengan ID tersebut.
6. WHERE `ga4_measurement_id` terisi dan `gtm_container_id` tidak terisi, THE Base_Layout SHALL menyuntikkan snippet GA4 langsung (`gtag.js`) dengan ID tersebut.
7. WHERE `custom_head_html` terisi, THE Base_Layout SHALL menyuntikkan string tersebut apa adanya di akhir `<head>` setelah validasi whitelist ulang sisi render.
8. THE Error_Page SHALL menampilkan `brand_name_{locale}` dan `support_email` dari `site_settings` dan SHALL TIDAK memuat branding hardcoded.
9. IF pembacaan `site_settings` gagal pada render publik, THEN komponen SHALL menggunakan konstanta default dari modul `SiteSettingsDefaults` (bukan string literal tersebar) dan halaman SHALL tetap mengembalikan HTTP 200.
10. THE Site_Settings_Repository SHALL menyediakan memoization per-request (module-scoped cache yang dibangun ulang pada setiap Worker request) sehingga satu request tidak melakukan lebih dari satu query `SELECT * FROM site_settings`.
11. THE Public_Page SHALL memastikan properti testable: untuk setiap rute publik, saat `site_settings` di-update dari `S` ke `S'` lalu halaman di-request ulang, response HTML SHALL memuat nilai baru dari `S'` untuk field yang terobservasi (mis. nomor WhatsApp di link `wa.me/`).
12. THE codebase SHALL memastikan properti statis testable: pencarian literal terhadap pola `6281200000000`, `halo@infotour.id`, dan nomor WA Indonesia lain di dalam `src/**` (kecuali `src/lib/site-settings/defaults.ts`, seed migration, dan file test) SHALL menghasilkan 0 hasil.

---

#### Requirement 13: Seed Default `site_settings` via Migration

**User Story:** Sebagai developer yang men-deploy pertama kali, saya ingin situs merender dengan benar tanpa intervensi manual tambahan, sehingga deploy pertama tidak menghasilkan halaman kosong.

#### Acceptance Criteria

1. THE Migration SHALL menyertakan migration file terpisah (mis. `0004_site_settings.sql`) yang membuat tabel `site_settings` dan menyeed 1 row default dengan `id = 1`.
2. THE seeded row SHALL memiliki `brand_name_id = 'infotour.id'`, `brand_name_en = 'infotour.id'`, `tagline_id = 'Direktori wisata Indonesia terkurasi'`, `tagline_en = 'Curated Indonesia travel directory'`, `primary_whatsapp_number = '6281200000000'`, `support_email = 'halo@infotour.id'`, `hero_image_url = '/assets/hero-bali.jpg'`, `destinations_count_auto = 1`, `copyright_text = '© infotour.id. Semua hak dilindungi.'`.
3. THE Migration SHALL bersifat additive: SHALL TIDAK mengubah skema tabel `destinations`, `blog_articles`, `admin_users`, `admin_sessions` yang sudah ada.
4. WHEN `wrangler d1 migrations apply` dijalankan ulang (idempotent), THE Migration SHALL TIDAK melempar error duplicate key; migration SHALL menggunakan `INSERT OR IGNORE` atau `CREATE TABLE IF NOT EXISTS` + `INSERT ... WHERE NOT EXISTS`.
5. THE Migration SHALL memastikan properti testable: setelah menjalankan migration pada D1 kosong, `SELECT COUNT(*) FROM site_settings` SHALL mengembalikan 1.
6. THE Migration SHALL memastikan properti testable (idempotence): menjalankan migration dua kali SHALL menghasilkan `SELECT COUNT(*) FROM site_settings = 1` dan isi row yang identik dengan run pertama.

---

#### Requirement 14: Stats Mencerminkan Data Nyata dengan Auto/Manual Toggle

**User Story:** Sebagai Admin Website, saya ingin statistik yang ditampilkan di homepage mencerminkan data aktual (jumlah destinasi terbit) atau nilai manual yang saya tentukan, sehingga angka yang ditampilkan selalu kredibel.

#### Acceptance Criteria

1. WHEN Homepage merender dan `destinations_count_auto = 1`, THE Homepage SHALL menghitung `destinations_count` dari `SELECT COUNT(*) FROM destinations WHERE status = 'published'`.
2. WHEN Homepage merender dan `destinations_count_auto = 0`, THE Homepage SHALL menggunakan nilai `destinations_count_override` dari `site_settings` (yang tidak boleh `null` saat mode manual aktif).
3. IF `destinations_count_auto = 0` dan `destinations_count_override IS NULL`, THEN THE Admin_Settings_Page SHALL menolak simpan form dengan pesan inline "Masukkan jumlah destinasi manual atau aktifkan auto".
4. THE Homepage SHALL membaca `partners_count`, `happy_tourists_count`, `average_rating` langsung dari `site_settings` (tidak ada mode otomatis untuk ketiganya pada Spec 1).
5. WHERE stat bernilai 0 (kecuali `average_rating`), THE Homepage SHALL TIDAK menampilkan kartu stat tersebut untuk menghindari angka "0" yang kontra-produktif.
6. THE Site_Settings_Repository SHALL memastikan properti testable: setelah `createDestination` dengan `status = 'published'`, `getDestinationsCount(db)` SHALL bertambah 1; setelah `deleteDestination`, SHALL berkurang 1.
7. THE Admin_Settings_Page SHALL menampilkan nilai live `destinations_count` (yang akan dipakai) di samping toggle auto/manual sebagai feedback visual.

---

### Section 4 — Security (Cross-Cutting)

#### Requirement 15: Admin Endpoints di Belakang Session Middleware dengan CSRF Safeguards

**User Story:** Sebagai Admin Website, saya ingin semua endpoint tulis admin memerlukan session valid dan kebal terhadap CSRF dasar, sehingga request lintas-situs tidak dapat memodifikasi data.

#### Acceptance Criteria

1. THE Site_Settings_API SHALL memverifikasi session via `validateSession` dengan pola yang sama seperti `PUT /api/destinations/{id}` sebelum memproses request.
2. THE Blog_API endpoint `generate`, `POST /api/blog`, `PUT /api/blog/{id}`, `DELETE /api/blog/{id}` SHALL memverifikasi session.
3. THE Destination_API endpoint `POST /api/destinations`, `PUT /api/destinations/{id}`, `DELETE /api/destinations/{id}` SHALL memverifikasi session.
4. THE Admin_UI SHALL mengirim header `Origin` yang cocok dengan host request pada semua fetch mutasi; server SHALL memverifikasi `Origin` atau `Referer` cocok dengan `SITE_URL` env var dan SHALL menolak dengan HTTP 403 `CSRF_ORIGIN_MISMATCH` bila tidak cocok pada endpoint mutasi admin.
5. THE session cookie `session_id` SHALL tetap di-set dengan `httpOnly = true`, `secure = true`, `sameSite = 'strict'`, `path = '/'`.

---

### Section 5 — UX (Cross-Cutting)

#### Requirement 16: Inline Validation, Unsaved Changes, Toast, Loading States Seragam

**User Story:** Sebagai Admin Website, saya ingin pengalaman admin yang konsisten dengan feedback yang jelas, sehingga saya percaya bahwa aksi saya sukses atau tahu persis apa yang salah.

#### Acceptance Criteria

1. THE Admin_UI SHALL menampilkan pesan validasi inline (di bawah field atau di samping field) dalam Bahasa Indonesia untuk seluruh form admin (destinasi, blog, settings, login).
2. WHEN admin menyentuh field lalu blur tanpa nilai valid, THE Admin_UI SHALL menampilkan pesan validasi tanpa menunggu submit.
3. WHEN admin mencoba navigasi keluar dari halaman form dengan perubahan tidak tersimpan (destinasi, blog editor, settings), THE Admin_UI SHALL menampilkan konfirmasi "Ada perubahan yang belum disimpan. Yakin keluar?" baik untuk navigasi `<a>` internal maupun `beforeunload`.
4. WHEN sebuah mutation button (Simpan, Hapus, Publish, Generate) ditekan, THE Admin_UI SHALL menonaktifkan tombol dan menampilkan spinner atau state "Menyimpan..." hingga response API tiba.
5. WHEN mutation berhasil, THE Admin_UI SHALL menampilkan Toast sukses berwarna hijau dengan auto-dismiss 3 detik dan teks kontekstual dalam Bahasa Indonesia.
6. WHEN mutation gagal, THE Admin_UI SHALL menampilkan Toast error berwarna merah dengan auto-dismiss 6 detik dan memuat pesan dari `response.error.message` server; bila tidak ada, menampilkan "Terjadi kesalahan. Silakan coba lagi."
7. THE Admin_UI SHALL memastikan hanya satu Toast dengan pesan identik yang ditampilkan bersamaan (deduplication) untuk mencegah stacking saat user men-klik tombol berulang.
8. THE Admin_UI SHALL memastikan properti testable (idempotence toast): memanggil fungsi `showToast({id: 'x', message: 'm'})` dua kali berturut-turut SHALL menghasilkan hanya satu entri aktif pada queue toast.
