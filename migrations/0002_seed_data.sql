-- Migration: 0002_seed_data
-- Description: Seed data for Alkhaleej Travelindo Utama

-- Packages
INSERT INTO packages (id, slug, title_id, title_en, tagline_id, tagline_en, hero_image, package_type, about_text_id, about_text_en, whatsapp_number, status, created_at, updated_at)
VALUES
  ('pkg-haji-mujamalah', 'haji-mujamalah', 'Haji Mujamalah', 'Hajj Mujamalah', 'Ibadah haji dengan pelayanan terbaik', 'Hajj pilgrimage with premium service', '/assets/hero-haji.jpg', 'haji_mujamalah', 'PT Alkhaleej Travelindo Utama menyediakan paket Haji Mujamalah dengan akomodasi hotel bintang 5 di Makkah dan Madinah, pembimbing ibadah berpengalaman, dan pelayanan 24 jam selama di Tanah Suci.', 'PT Alkhaleej Travelindo Utama offers Hajj Mujamalah packages with 5-star hotel accommodation in Makkah and Madinah, experienced religious guides, and 24-hour service in the Holy Land.', '6281200000000', 'published', '2026-01-15 10:00:00', '2026-01-15 10:00:00'),
  ('pkg-umrah', 'umrah', 'Paket Umrah', 'Umrah Package', 'Umrah nyaman dan berkesan', 'Comfortable and memorable Umrah', '/assets/hero-umrah.jpg', 'umrah', 'Paket Umrah dengan berbagai pilihan hotel di depan Masjidil Haram dan Masjid Nabawi. Dilengkapi dengan pembimbing ibadah, ziarah menyeluruh, dan handling bandara.', 'Umrah packages with various hotel options near Masjidil Haram and Masjid Nabawi. Complete with religious guides, comprehensive ziyarah, and airport handling.', '6281200000000', 'published', '2026-02-01 10:00:00', '2026-02-01 10:00:00'),
  ('pkg-umrah-plus', 'umrah-plus', 'Umrah Plus Turki', 'Umrah Plus Turkey', 'Umrah + wisata Islami Turki', 'Umrah + Islamic tour of Turkey', '/assets/hero-umrah-plus.jpg', 'umrah_plus', 'Kombinasi ibadah Umrah dengan wisata Islami ke Turki. Mengunjungi Istanbul, Cappadocia, dan lokasi bersejarah Islam selain beribadah di Tanah Suci.', 'Combination of Umrah pilgrimage with Islamic tour of Turkey. Visit Istanbul, Cappadocia, and historic Islamic sites besides worshiping in the Holy Land.', '6281200000000', 'published', '2026-02-10 10:00:00', '2026-02-10 10:00:00'),
  ('pkg-tour-muslim', 'tour-muslim', 'Tour Muslim Eropa', 'Muslim Europe Tour', 'Jelajahi warisan Islam di Eropa', 'Explore Islamic heritage in Europe', '/assets/hero-europe.jpg', 'tour_muslim', 'Tur Muslim ke Eropa mengunjungi destinasi Islami di Spanyol (Andalusia), Turki, dan Bosnia. Makanan halal dijamin, hotel dekat masjid, dan panduan wisata Muslim.', 'Muslim tour to Europe visiting Islamic destinations in Spain (Andalusia), Turkey, and Bosnia. Halal food guaranteed, hotels near mosques, and Muslim tour guides.', '6281200000000', 'published', '2026-02-15 10:00:00', '2026-02-15 10:00:00');

-- Gallery images
INSERT INTO gallery_images (id, package_id, url, alt_id, alt_en, sort_order)
VALUES
  ('gal-haji-1', 'pkg-haji-mujamalah', '/assets/hero-haji.jpg', 'Ka''bah Masjidil Haram', 'Kaaba Masjidil Haram', 1),
  ('gal-haji-2', 'pkg-haji-mujamalah', '/assets/gallery/makkah.jpg', 'Makkah dari atas', 'Makkah aerial view', 2),
  ('gal-haji-3', 'pkg-haji-mujamalah', '/assets/gallery/madinah.jpg', 'Masjid Nabawi', 'Masjid Nabawi', 3),
  ('gal-umrah-1', 'pkg-umrah', '/assets/hero-umrah.jpg', 'Umrah di Masjidil Haram', 'Umrah at Masjidil Haram', 1),
  ('gal-umrah-2', 'pkg-umrah', '/assets/gallery/safa-marwah.jpg', 'Sa''i Safa dan Marwah', 'Sa''i Safa and Marwah', 2),
  ('gal-umrah-plus-1', 'pkg-umrah-plus', '/assets/hero-umrah-plus.jpg', 'Istanbul Turki', 'Istanbul Turkey', 1),
  ('gal-umrah-plus-2', 'pkg-umrah-plus', '/assets/gallery/cappadocia.jpg', 'Cappadocia', 'Cappadocia', 2),
  ('gal-europe-1', 'pkg-tour-muslim', '/assets/hero-europe.jpg', 'Alhambra Spanyol', 'Alhambra Spain', 1),
  ('gal-europe-2', 'pkg-tour-muslim', '/assets/gallery/istanbul.jpg', 'Masjid Biru Istanbul', 'Blue Mosque Istanbul', 2);

-- Package tiers
INSERT INTO package_tiers (id, package_id, name_id, name_en, description_id, description_en, price, duration_id, duration_en, hotel_rating, airline, features_id, features_en, sort_order)
VALUES
  -- Haji Mujamalah
  ('tier-haji-silver', 'pkg-haji-mujamalah', 'Paket Silver', 'Silver Package', 'Paket hemat dengan fasilitas standar', 'Budget-friendly with standard facilities', 'USD 6.500', '40 Hari', '40 Days', '3', 'Garuda Indonesia', '["Hotel bintang 3","Transport AC","Makan 3x sehari","Pembimbing ibadah","Manasik haji","Visa handling"]', '["3-star hotel","AC transport","3 meals/day","Religious guide","Hajj training","Visa handling"]', 1),
  ('tier-haji-gold', 'pkg-haji-mujamalah', 'Paket Gold', 'Gold Package', 'Paket premium dengan hotel depan Haram', 'Premium package with hotel facing Haram', 'USD 9.800', '40 Hari', '40 Days', '5', 'Saudi Airlines', '["Hotel bintang 5 depan Haram","Transport AC","Makan 3x sehari","Pembimbing ibadah","Manasik haji","Visa handling","Ziarah khusus","Laundry"]', '["5-star hotel facing Haram","AC transport","3 meals/day","Religious guide","Hajj training","Visa handling","Special ziyarah","Laundry"]', 2),
  ('tier-haji-platinum', 'pkg-haji-mujamalah', 'Paket Platinum', 'Platinum Package', 'Paket VIP dengan layanan maksimal', 'VIP package with maximum service', 'USD 14.500', '40 Hari', '40 Days', '5', 'First Class', '["Suite hotel bintang 5","Private transport","Full board meal","Pembimbing ibadah VIP","Manasik haji","Visa handling","Ziarah eksklusif","Laundry","Medical support","Porter service"]', '["5-star suite hotel","Private transport","Full board meal","VIP religious guide","Hajj training","Visa handling","Exclusive ziyarah","Laundry","Medical support","Porter service"]', 3),
  -- Umrah
  ('tier-umrah-silver', 'pkg-umrah', 'Paket Silver 9 Hari', 'Silver Package 9 Days', 'Umrah hemat 9 hari', 'Budget Umrah 9 days', 'USD 2.200', '9 Hari', '9 Days', '3', 'Lion Air', '["Hotel bintang 3","Transport AC","Makan 3x sehari","Pembimbing ibadah","Ziarah Makkah & Madinah","Handling bandara"]', '["3-star hotel","AC transport","3 meals/day","Religious guide","Makkah & Madinah ziyarah","Airport handling"]', 1),
  ('tier-umrah-gold', 'pkg-umrah', 'Paket Gold 9 Hari', 'Gold Package 9 Days', 'Umrah premium dengan hotel depan Haram', 'Premium Umrah with hotel facing Haram', 'USD 3.500', '9 Hari', '9 Days', '5', 'Garuda Indonesia', '["Hotel bintang 5 depan Haram","Transport AC","Full board meal","Pembimbing ibadah","Ziarah menyeluruh","Handling bandara","Welcome package"]', '["5-star hotel facing Haram","AC transport","Full board meal","Religious guide","Comprehensive ziyarah","Airport handling","Welcome package"]', 2),
  -- Umrah Plus Turki
  ('tier-umrah-plus', 'pkg-umrah-plus', 'Paket Umrah + Turki 12 Hari', 'Umrah + Turkey 12 Days', 'Umrah dan wisata Turki', 'Umrah and Turkey tour', 'USD 4.800', '12 Hari', '12 Days', '4', 'Turkish Airlines', '["Hotel bintang 4","Transport AC","Full board meal","Pembimbing ibadah","Tur Istanbul","Tur Cappadocia","Ziarah menyeluruh","Tiket masuk wisata"]', '["4-star hotel","AC transport","Full board meal","Religious guide","Istanbul tour","Cappadocia tour","Comprehensive ziyarah","Tour entrance tickets"]', 1),
  -- Tour Muslim Eropa
  ('tier-europe', 'pkg-tour-muslim', 'Paket Andalusia & Istanbul 10 Hari', 'Andalusia & Istanbul 10 Days', 'Tur Muslim Eropa', 'Muslim Europe tour', 'USD 3.800', '10 Hari', '10 Days', '4', 'Turkish Airlines', '["Hotel bintang 4","Transport AC","Makan halal","Pandai wisata Muslim","Tur Granada","Tur Cordoba","Tur Istanbul","Tiket masuk wisata"]', '["4-star hotel","AC transport","Halal meals","Muslim tour guide","Granada tour","Cordoba tour","Istanbul tour","Tour entrance tickets"]', 1);

-- Departure schedules
INSERT INTO departure_schedules (id, package_id, departure_date, return_date, departure_city_id, departure_city_en, available_seats, status, notes, sort_order)
VALUES
  ('sched-haji-1', 'pkg-haji-mujamalah', '2026-06-01', '2026-07-10', 'Jakarta', 'Jakarta', 50, 'open', 'Keberangkatan via Soekarno-Hatta', 1),
  ('sched-haji-2', 'pkg-haji-mujamalah', '2026-06-05', '2026-07-14', 'Surabaya', 'Surabaya', 30, 'open', 'Keberangkatan via Juanda', 2),
  ('sched-haji-3', 'pkg-haji-mujamalah', '2026-06-08', '2026-07-17', 'Jakarta', 'Jakarta', 40, 'open', 'Keberangkatan via Soekarno-Hatta', 3),
  ('sched-umrah-1', 'pkg-umrah', '2026-07-15', '2026-07-23', 'Jakarta', 'Jakarta', 45, 'open', '', 1),
  ('sched-umrah-2', 'pkg-umrah', '2026-08-01', '2026-08-09', 'Surabaya', 'Surabaya', 35, 'open', '', 2),
  ('sched-umrah-3', 'pkg-umrah', '2026-08-15', '2026-08-23', 'Jakarta', 'Jakarta', 40, 'open', '', 3),
  ('sched-umrah-4', 'pkg-umrah', '2026-09-01', '2026-09-09', 'Bandung', 'Bandung', 30, 'open', '', 4),
  ('sched-umrah-5', 'pkg-umrah', '2026-10-01', '2026-10-09', 'Jakarta', 'Jakarta', 40, 'open', '', 5),
  ('sched-umrah-plus-1', 'pkg-umrah-plus', '2026-08-10', '2026-08-21', 'Jakarta', 'Jakarta', 25, 'open', '', 1),
  ('sched-umrah-plus-2', 'pkg-umrah-plus', '2026-09-15', '2026-09-26', 'Jakarta', 'Jakarta', 25, 'open', '', 2),
  ('sched-europe-1', 'pkg-tour-muslim', '2026-09-01', '2026-09-10', 'Jakarta', 'Jakarta', 20, 'open', '', 1),
  ('sched-europe-2', 'pkg-tour-muslim', '2026-10-15', '2026-10-24', 'Jakarta', 'Jakarta', 20, 'open', '', 2);

-- Testimonials
INSERT INTO testimonials (id, package_id, author, content_id, content_en, rating, origin_city, year)
VALUES
  ('testi-1', 'pkg-haji-mujamalah', 'Hj. Fatimah', 'Alhamdulillah, ibadah haji saya sangat nyaman bersama Alkhaleej. Hotel dekat Haram, makanan enak, dan pembimbing sabar membimbing kami.', 'Alhamdulillah, my Hajj was very comfortable with Alkhaleej. Hotel close to Haram, delicious food, and patient guides.', 5, 'Jakarta', '2025'),
  ('testi-2', 'pkg-haji-mujamalah', 'H. Ahmad Fauzi', 'Pelayanan luar biasa. Dari manasik hingga pulang, semuanya terkoordinasi dengan baik. Terima kasih Alkhaleej!', 'Exceptional service. From training to return, everything was well-coordinated. Thank you Alkhaleej!', 5, 'Surabaya', '2025'),
  ('testi-3', 'pkg-umrah', 'Siti Rahmawati', 'Umrah pertama saya dan sangat berkesan. Hotel bintang 5 depan Haram, tinggal jalan kaki. Pembimbingnya juga sangat sabar.', 'My first Umrah and it was memorable. 5-star hotel right in front of Haram, just walking distance. Very patient guide.', 5, 'Bandung', '2025'),
  ('testi-4', 'pkg-umrah', 'Nur Hidayah', 'Sudah 3x umrah dengan Alkhaleej, selalu puas. Harga kompetitif dan pelayanan konsisten.', 'Already 3x Umrah with Alkhaleej, always satisfied. Competitive prices and consistent service.', 5, 'Jakarta', '2025'),
  ('testi-5', 'pkg-umrah-plus', 'dr. Muhammad Rizki', 'Paket Umrah Plus Turki sangat worth it. Selain ibadah, kami juga bisa menikmati keindahan Turki. All in one!', 'The Umrah Plus Turkey package is so worth it. Besides worshiping, we could enjoy Turkey''s beauty. All in one!', 5, 'Jakarta', '2025'),
  ('testi-6', 'pkg-haji-mujamalah', 'H. Abdul Karim', 'Haji Mujamalah dengan Alkhaleej sangat nyaman. Pelayanan terbaik, pembimbing sabar, dan akomodasi memuaskan. Recommended!', 'Hajj Mujamalah with Alkhaleej was very comfortable. Best service, patient guides, and satisfying accommodation. Recommended!', 5, 'Medan', '2025');

-- FAQ entries
INSERT INTO faq_entries (id, package_id, question_id, question_en, answer_id, answer_en, sort_order)
VALUES
  ('faq-1', 'pkg-haji-mujamalah', 'Berapa lama proses pendaftaran Haji Mujamalah?', 'How long is the Hajj Mujamalah registration process?', 'Proses pendaftaran Haji Mujamalah biasanya memakan waktu 1-3 bulan sebelum keberangkatan. Kami akan membantu semua persyaratan dokumen.', 'The Hajj Mujamalah registration process usually takes 1-3 months before departure. We will assist with all document requirements.', 1),
  ('faq-2', 'pkg-haji-mujamalah', 'Apa saja syarat dokumen untuk haji?', 'What documents are required for Hajj?', 'Paspor minimal 6 bulan, KTP, KK, surat keterangan sehat, pas foto, dan bukti setor tabungan haji.', 'Passport valid for at least 6 months, ID card, family card, health certificate, passport photos, and Hajj savings deposit proof.', 2),
  ('faq-3', 'pkg-umrah', 'Apakah ada pembimbing ibadah?', 'Is there a religious guide?', 'Ya, setiap rombongan didampingi pembimbing ibadah berpengalaman yang akan membantu kelancaran ibadah Anda selama di Tanah Suci.', 'Yes, every group is accompanied by an experienced religious guide who will help ensure smooth worship during your time in the Holy Land.', 1),
  ('faq-4', 'pkg-umrah', 'Bagaimana sistem pembayarannya?', 'What is the payment system?', 'DP 30% saat pendaftaran, pelunasan H-30 sebelum keberangkatan. Kami menerima transfer bank dan cicilan 0% dengan kartu kredit.', '30% down payment upon registration, full payment 30 days before departure. We accept bank transfers and 0% installments with credit cards.', 2),
  ('faq-5', 'pkg-umrah-plus', 'Apakah makanan halal tersedia selama di Turki?', 'Is halal food available in Turkey?', 'Ya, Turki merupakan negara Muslim sehingga mayoritas makanan halal. Kami juga memastikan semua restoran yang dikunjungi menyajikan makanan halal.', 'Yes, Turkey is a Muslim country so most food is halal. We also ensure all restaurants visited serve halal food.', 1),
  ('faq-6', 'pkg-haji-mujamalah', 'Apa itu Haji Mujamalah?', 'What is Hajj Mujamalah?', 'Haji Mujamalah adalah paket haji dengan pelayanan terorganisir dan terkoordinasi oleh PT Alkhaleej Travelindo Utama. Termasuk akomodasi, transportasi, pembimbing ibadah, dan manasik haji.', 'Hajj Mujamalah is an organized Hajj package coordinated by PT Alkhaleej Travelindo Utama. Including accommodation, transportation, religious guides, and Hajj training.', 1);

-- Blog articles
INSERT INTO blog_articles (id, slug, language, title, excerpt, content, thumbnail_url, meta_description, og_image, paired_article_id, status, published_at, created_at, updated_at)
VALUES
  ('blog-1-id', 'persiapan-haji-pertama-kali', 'id', 'Persiapan Haji Pertama Kali: Panduan Lengkap', 'Semua yang perlu Anda ketahui sebelum berangkat haji untuk pertama kali.', '<h2>Persiapan Fisik</h2><p>Sebelum berangkat haji, pastikan kondisi fisik Anda prima. Lakukan olahraga rutin jalan kaki minimal 3 km per hari.</p><h2>Persiapan Mental</h2><p>Ibadah haji membutuhkan kesabaran dan kesiapan mental. Persiapkan diri Anda dengan memperbanyak ibadah dan doa.</p><h2>Persiapan Dokumen</h2><p>Paspor, KTP, KK, surat keterangan sehat, dan bukti setor tabungan haji adalah dokumen wajib yang harus disiapkan.</p>', '/assets/blog/persiapan-haji.jpg', 'Panduan lengkap persiapan haji pertama kali dari Alkhaleej Travelindo Utama', '/assets/blog/persiapan-haji.jpg', 'blog-1-en', 'published', '2026-01-20 10:00:00', '2026-01-20 10:00:00', '2026-01-20 10:00:00'),
  ('blog-1-en', 'first-time-hajj-preparation', 'en', 'First-Time Hajj Preparation: Complete Guide', 'Everything you need to know before going on Hajj for the first time.', '<h2>Physical Preparation</h2><p>Before departing for Hajj, make sure you are physically fit. Walk at least 3 km daily as regular exercise.</p><h2>Mental Preparation</h2><p>Hajj requires patience and mental readiness. Prepare yourself with increased worship and prayer.</p><h2>Document Preparation</h2><p>Passport, ID card, family card, health certificate, and Hajj savings deposit proof are mandatory documents.</p>', '/assets/blog/persiapan-haji.jpg', 'Complete guide for first-time Hajj preparation from Alkhaleej Travelindo Utama', '/assets/blog/persiapan-haji.jpg', 'blog-1-id', 'published', '2026-01-20 10:00:00', '2026-01-20 10:00:00', '2026-01-20 10:00:00'),
  ('blog-2-id', 'keutamaan-umrah-di-bulan-rajab', 'id', 'Keutamaan Umrah di Bulan Rajab', 'Mengapa bulan Rajab menjadi waktu istimewa untuk menunaikan umrah.', '<h2>Keistimewaan Bulan Rajab</h2><p>Bulan Rajab termasuk bulan haram yang diagungkan dalam Islam. Beribadah di bulan ini memiliki keutamaan tersendiri.</p><h2>Persiapan Umrah Rajab</h2><p>Persiapkan umrah Anda dengan memilih paket yang tepat dan membawa perlengkapan yang cukup.</p>', '/assets/blog/umrah-rajab.jpg', 'Keutamaan umrah di bulan Rajab dan persiapannya', '/assets/blog/umrah-rajab.jpg', 'blog-2-en', 'published', '2026-02-01 10:00:00', '2026-02-01 10:00:00', '2026-02-01 10:00:00'),
  ('blog-2-en', 'virtues-of-umrah-in-rajab', 'en', 'Virtues of Umrah in the Month of Rajab', 'Why Rajab is a special time to perform Umrah.', '<h2>The Significance of Rajab</h2><p>Rajab is one of the sacred months revered in Islam. Worshiping during this month has special virtues.</p><h2>Preparing for Rajab Umrah</h2><p>Prepare your Umrah by choosing the right package and bringing sufficient supplies.</p>', '/assets/blog/umrah-rajab.jpg', 'Virtues of performing Umrah in Rajab and how to prepare', '/assets/blog/umrah-rajab.jpg', 'blog-2-id', 'published', '2026-02-01 10:00:00', '2026-02-01 10:00:00', '2026-02-01 10:00:00');

-- Blog-package links
INSERT INTO blog_package_links (blog_id, package_id)
VALUES
  ('blog-1-id', 'pkg-haji-mujamalah'),
  ('blog-1-en', 'pkg-haji-mujamalah'),
  ('blog-2-id', 'pkg-umrah'),
  ('blog-2-en', 'pkg-umrah');

-- Admin user (default password: admin123 - change on first login)
-- Password hash will be generated at runtime
