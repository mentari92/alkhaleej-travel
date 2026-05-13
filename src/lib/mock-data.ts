/**
 * Mock/seed data for development and preview.
 * PT Alkhaleej Travelindo Utama — Hajj & Umrah Travel.
 * Used when the database is empty or for static rendering.
 */

import type { TravelPackage, BlogArticle } from "./types";

export const mockPackages: TravelPackage[] = [
  {
    id: "pkg-haji-mujamalah",
    slug: "haji-mujamalah",
    title: { id: "Haji Mujamalah", en: "Hajj Mujamalah" },
    tagline: { id: "Ibadah haji dengan pelayanan terbaik", en: "Hajj pilgrimage with premium service" },
    heroImage: "/assets/hero-haji.jpg",
    packageType: "haji_mujamalah",
    aboutText: {
      id: "PT Alkhaleej Travelindo Utama menyediakan paket Haji Mujamalah dengan akomodasi hotel bintang 5 di Makkah dan Madinah, pembimbing ibadah berpengalaman, dan pelayanan 24 jam selama di Tanah Suci.",
      en: "PT Alkhaleej Travelindo Utama offers Hajj Mujamalah packages with 5-star hotel accommodation in Makkah and Madinah, experienced religious guides, and 24-hour service in the Holy Land.",
    },
    galleryImages: [
      { url: "/assets/hero-haji.jpg", alt: { id: "Ka'bah Masjidil Haram", en: "Kaaba Masjidil Haram" }, order: 1 },
    ],
    tiers: [
      {
        id: "tier-haji-silver",
        name: { id: "Paket Silver", en: "Silver Package" },
        description: { id: "Paket hemat dengan fasilitas standar", en: "Budget-friendly with standard facilities" },
        price: "USD 6.500",
        duration: { id: "40 Hari", en: "40 Days" },
        hotelRating: "3",
        airline: "Garuda Indonesia",
        features: [
          { id: "Hotel bintang 3", en: "3-star hotel" },
          { id: "Transport AC", en: "AC transport" },
          { id: "Makan 3x sehari", en: "3 meals/day" },
          { id: "Pembimbing ibadah", en: "Religious guide" },
          { id: "Manasik haji", en: "Hajj training" },
        ],
        order: 1,
      },
      {
        id: "tier-haji-gold",
        name: { id: "Paket Gold", en: "Gold Package" },
        description: { id: "Paket premium dengan hotel depan Haram", en: "Premium package with hotel facing Haram" },
        price: "USD 9.800",
        duration: { id: "40 Hari", en: "40 Days" },
        hotelRating: "5",
        airline: "Saudi Airlines",
        features: [
          { id: "Hotel bintang 5 depan Haram", en: "5-star hotel facing Haram" },
          { id: "Transport AC", en: "AC transport" },
          { id: "Full board meal", en: "Full board meal" },
          { id: "Pembimbing ibadah", en: "Religious guide" },
          { id: "Manasik haji", en: "Hajj training" },
          { id: "Ziarah khusus", en: "Special ziyarah" },
        ],
        order: 2,
      },
      {
        id: "tier-haji-platinum",
        name: { id: "Paket Platinum", en: "Platinum Package" },
        description: { id: "Paket VIP dengan layanan maksimal", en: "VIP package with maximum service" },
        price: "USD 14.500",
        duration: { id: "40 Hari", en: "40 Days" },
        hotelRating: "5",
        airline: "First Class",
        features: [
          { id: "Suite hotel bintang 5", en: "5-star suite hotel" },
          { id: "Private transport", en: "Private transport" },
          { id: "Full board meal", en: "Full board meal" },
          { id: "Pembimbing ibadah VIP", en: "VIP religious guide" },
          { id: "Ziarah eksklusif", en: "Exclusive ziyarah" },
          { id: "Laundry", en: "Laundry" },
          { id: "Medical support", en: "Medical support" },
        ],
        order: 3,
      },
    ],
    departureSchedules: [
      { id: "sched-1", departureDate: "2026-06-01", returnDate: "2026-07-10", departureCity: { id: "Jakarta", en: "Jakarta" }, availableSeats: 50, status: "open", notes: "Keberangkatan via Soekarno-Hatta", order: 1 },
      { id: "sched-2", departureDate: "2026-06-05", returnDate: "2026-07-14", departureCity: { id: "Surabaya", en: "Surabaya" }, availableSeats: 30, status: "open", notes: "Keberangkatan via Juanda", order: 2 },
    ],
    testimonials: [
      { id: "testi-1", author: "Hj. Fatimah", content: { id: "Alhamdulillah, ibadah haji saya sangat nyaman bersama Alkhaleej. Hotel dekat Haram, makanan enak, dan pembimbing sabar membimbing kami.", en: "Alhamdulillah, my Hajj was very comfortable with Alkhaleej." }, rating: 5, originCity: "Jakarta", year: "2025" },
      { id: "testi-2", author: "H. Ahmad Fauzi", content: { id: "Pelayanan luar biasa. Dari manasik hingga pulang, semuanya terkoordinasi dengan baik.", en: "Exceptional service. Everything was well-coordinated." }, rating: 5, originCity: "Surabaya", year: "2025" },
    ],
    faqEntries: [
      { id: "faq-1", question: { id: "Berapa lama proses pendaftaran Haji Mujamalah?", en: "How long is the Hajj Mujamalah registration process?" }, answer: { id: "Proses pendaftaran biasanya memakan waktu 1-3 bulan sebelum keberangkatan.", en: "Registration usually takes 1-3 months before departure." }, order: 1 },
    ],
    whatsappNumber: "966563317582",
    status: "published",
    createdAt: "2026-01-15 10:00:00",
    updatedAt: "2026-01-15 10:00:00",
  },
  {
    id: "pkg-umrah",
    slug: "umrah",
    title: { id: "Paket Umrah", en: "Umrah Package" },
    tagline: { id: "Umrah nyaman dan berkesan", en: "Comfortable and memorable Umrah" },
    heroImage: "/assets/hero-umrah.jpg",
    packageType: "umrah",
    aboutText: {
      id: "Paket Umrah dengan berbagai pilihan hotel di depan Masjidil Haram dan Masjid Nabawi. Dilengkapi dengan pembimbing ibadah, ziarah menyeluruh, dan handling bandara.",
      en: "Umrah packages with various hotel options near Masjidil Haram and Masjid Nabawi. Complete with religious guides and airport handling.",
    },
    galleryImages: [
      { url: "/assets/hero-umrah.jpg", alt: { id: "Umrah di Masjidil Haram", en: "Umrah at Masjidil Haram" }, order: 1 },
    ],
    tiers: [
      {
        id: "tier-umrah-silver",
        name: { id: "Paket Silver 9 Hari", en: "Silver Package 9 Days" },
        description: { id: "Umrah hemat 9 hari", en: "Budget Umrah 9 days" },
        price: "USD 2.200",
        duration: { id: "9 Hari", en: "9 Days" },
        hotelRating: "3",
        airline: "Lion Air",
        features: [
          { id: "Hotel bintang 3", en: "3-star hotel" },
          { id: "Makan 3x sehari", en: "3 meals/day" },
          { id: "Pembimbing ibadah", en: "Religious guide" },
          { id: "Ziarah Makkah & Madinah", en: "Makkah & Madinah ziyarah" },
        ],
        order: 1,
      },
      {
        id: "tier-umrah-gold",
        name: { id: "Paket Gold 9 Hari", en: "Gold Package 9 Days" },
        description: { id: "Umrah premium dengan hotel depan Haram", en: "Premium Umrah with hotel facing Haram" },
        price: "USD 3.500",
        duration: { id: "9 Hari", en: "9 Days" },
        hotelRating: "5",
        airline: "Garuda Indonesia",
        features: [
          { id: "Hotel bintang 5 depan Haram", en: "5-star hotel facing Haram" },
          { id: "Full board meal", en: "Full board meal" },
          { id: "Pembimbing ibadah", en: "Religious guide" },
          { id: "Ziarah menyeluruh", en: "Comprehensive ziyarah" },
          { id: "Welcome package", en: "Welcome package" },
        ],
        order: 2,
      },
    ],
    departureSchedules: [
      { id: "sched-3", departureDate: "2026-07-15", returnDate: "2026-07-23", departureCity: { id: "Jakarta", en: "Jakarta" }, availableSeats: 45, status: "open", notes: null, order: 1 },
      { id: "sched-4", departureDate: "2026-08-01", returnDate: "2026-08-09", departureCity: { id: "Surabaya", en: "Surabaya" }, availableSeats: 35, status: "open", notes: null, order: 2 },
      { id: "sched-5", departureDate: "2026-09-01", returnDate: "2026-09-09", departureCity: { id: "Bandung", en: "Bandung" }, availableSeats: 30, status: "open", notes: null, order: 3 },
    ],
    testimonials: [
      { id: "testi-3", author: "Siti Rahmawati", content: { id: "Umrah pertama saya dan sangat berkesan. Hotel bintang 5 depan Haram, tinggal jalan kaki.", en: "My first Umrah and it was memorable. 5-star hotel right in front of Haram." }, rating: 5, originCity: "Bandung", year: "2025" },
    ],
    faqEntries: [
      { id: "faq-3", question: { id: "Apakah ada pembimbing ibadah?", en: "Is there a religious guide?" }, answer: { id: "Ya, setiap rombongan didampingi pembimbing ibadah berpengalaman.", en: "Yes, every group is accompanied by an experienced religious guide." }, order: 1 },
    ],
    whatsappNumber: "966563317582",
    status: "published",
    createdAt: "2026-02-01 10:00:00",
    updatedAt: "2026-02-01 10:00:00",
  },
  {
    id: "pkg-umrah-plus",
    slug: "umrah-plus",
    title: { id: "Umrah Plus Turki", en: "Umrah Plus Turkey" },
    tagline: { id: "Umrah + wisata Islami Turki", en: "Umrah + Islamic tour of Turkey" },
    heroImage: "/assets/hero-umrah-plus.jpg",
    packageType: "umrah_plus",
    aboutText: {
      id: "Kombinasi ibadah Umrah dengan wisata Islami ke Turki. Mengunjungi Istanbul, Cappadocia, dan lokasi bersejarah Islam.",
      en: "Combination of Umrah with Islamic tour of Turkey. Visit Istanbul, Cappadocia, and historic Islamic sites.",
    },
    galleryImages: [
      { url: "/assets/hero-umrah-plus.jpg", alt: { id: "Istanbul Turki", en: "Istanbul Turkey" }, order: 1 },
    ],
    tiers: [
      {
        id: "tier-umrah-plus",
        name: { id: "Paket Umrah + Turki 12 Hari", en: "Umrah + Turkey 12 Days" },
        description: { id: "Umrah dan wisata Turki", en: "Umrah and Turkey tour" },
        price: "USD 4.800",
        duration: { id: "12 Hari", en: "12 Days" },
        hotelRating: "4",
        airline: "Turkish Airlines",
        features: [
          { id: "Hotel bintang 4", en: "4-star hotel" },
          { id: "Full board meal", en: "Full board meal" },
          { id: "Tur Istanbul", en: "Istanbul tour" },
          { id: "Tur Cappadocia", en: "Cappadocia tour" },
          { id: "Ziarah menyeluruh", en: "Comprehensive ziyarah" },
        ],
        order: 1,
      },
    ],
    departureSchedules: [
      { id: "sched-6", departureDate: "2026-08-10", returnDate: "2026-08-21", departureCity: { id: "Jakarta", en: "Jakarta" }, availableSeats: 25, status: "open", notes: null, order: 1 },
    ],
    testimonials: [
      { id: "testi-5", author: "dr. Muhammad Rizki", content: { id: "Paket Umrah Plus Turki sangat worth it. Selain ibadah, kami juga bisa menikmati keindahan Turki.", en: "The Umrah Plus Turkey package is so worth it." }, rating: 5, originCity: "Jakarta", year: "2025" },
    ],
    faqEntries: [],
    whatsappNumber: "966563317582",
    status: "published",
    createdAt: "2026-02-10 10:00:00",
    updatedAt: "2026-02-10 10:00:00",
  },
  {
    id: "pkg-tour-muslim",
    slug: "tour-muslim",
    title: { id: "Tour Muslim Eropa", en: "Muslim Europe Tour" },
    tagline: { id: "Jelajahi warisan Islam di Eropa", en: "Explore Islamic heritage in Europe" },
    heroImage: "/assets/hero-europe.jpg",
    packageType: "tour_muslim",
    aboutText: {
      id: "Tur Muslim ke Eropa mengunjungi destinasi Islami di Spanyol (Andalusia), Turki, dan Bosnia. Makanan halal dijamin.",
      en: "Muslim tour to Europe visiting Islamic destinations in Spain, Turkey, and Bosnia. Halal food guaranteed.",
    },
    galleryImages: [
      { url: "/assets/hero-europe.jpg", alt: { id: "Alhambra Spanyol", en: "Alhambra Spain" }, order: 1 },
    ],
    tiers: [
      {
        id: "tier-europe",
        name: { id: "Paket Andalusia & Istanbul 10 Hari", en: "Andalusia & Istanbul 10 Days" },
        description: { id: "Tur Muslim Eropa", en: "Muslim Europe tour" },
        price: "USD 3.800",
        duration: { id: "10 Hari", en: "10 Days" },
        hotelRating: "4",
        airline: "Turkish Airlines",
        features: [
          { id: "Hotel bintang 4", en: "4-star hotel" },
          { id: "Makan halal", en: "Halal meals" },
          { id: "Tur Granada", en: "Granada tour" },
          { id: "Tur Istanbul", en: "Istanbul tour" },
        ],
        order: 1,
      },
    ],
    departureSchedules: [
      { id: "sched-7", departureDate: "2026-09-01", returnDate: "2026-09-10", departureCity: { id: "Jakarta", en: "Jakarta" }, availableSeats: 20, status: "open", notes: null, order: 1 },
    ],
    testimonials: [],
    faqEntries: [],
    whatsappNumber: "966563317582",
    status: "published",
    createdAt: "2026-02-15 10:00:00",
    updatedAt: "2026-02-15 10:00:00",
  },
];

export const mockBlogArticles: BlogArticle[] = [
  {
    id: "blog-1-id",
    slug: "persiapan-haji-pertama-kali",
    title: "Persiapan Haji Pertama Kali: Panduan Lengkap",
    excerpt: "Semua yang perlu Anda ketahui sebelum berangkat haji untuk pertama kali.",
    content: "<h2>Persiapan Fisik</h2><p>Sebelum berangkat haji, pastikan kondisi fisik Anda prima.</p><h2>Persiapan Dokumen</h2><p>Paspor, KTP, KK, surat keterangan sehat, dan bukti setor tabungan haji.</p>",
    language: "id",
    thumbnailUrl: "/assets/blog/persiapan-haji.jpg",
    metaDescription: "Panduan lengkap persiapan haji pertama kali dari Alkhaleej Travelindo Utama",
    ogImage: "/assets/blog/persiapan-haji.jpg",
    relatedPackageIds: ["pkg-haji-mujamalah"],
    pairedArticleId: null,
    status: "published",
    publishedAt: "2026-01-20 10:00:00",
    createdAt: "2026-01-20 10:00:00",
    updatedAt: "2026-01-20 10:00:00",
  },
  {
    id: "blog-2-id",
    slug: "keutamaan-umrah-di-bulan-rajab",
    title: "Keutamaan Umrah di Bulan Rajab",
    excerpt: "Mengapa bulan Rajab menjadi waktu istimewa untuk menunaikan umrah.",
    content: "<h2>Keistimewaan Bulan Rajab</h2><p>Bulan Rajab termasuk bulan haram yang diagungkan dalam Islam.</p>",
    language: "id",
    thumbnailUrl: "/assets/blog/umrah-rajab.jpg",
    metaDescription: "Keutamaan umrah di bulan Rajab dan persiapannya",
    ogImage: "/assets/blog/umrah-rajab.jpg",
    relatedPackageIds: ["pkg-umrah"],
    pairedArticleId: null,
    status: "published",
    publishedAt: "2026-02-01 10:00:00",
    createdAt: "2026-02-01 10:00:00",
    updatedAt: "2026-02-01 10:00:00",
  },
  {
    id: "blog-3-id",
    slug: "tips-sehat-selama-di-tanah-suci",
    title: "Tips Sehat Selama di Tanah Suci",
    excerpt: "Menjaga kesehatan selama ibadah haji dan umrah agar ibadah lebih khusyuk.",
    content: "<h2>Persiapan Fisik</h2><p>Lakukan olahraga rutin jalan kaki minimal 3 km per hari sebelum berangkat.</p>",
    language: "id",
    thumbnailUrl: "/assets/blog/tips-sehat.jpg",
    metaDescription: "Tips menjaga kesehatan selama ibadah haji dan umrah",
    ogImage: "/assets/blog/tips-sehat.jpg",
    relatedPackageIds: ["pkg-haji-mujamalah", "pkg-umrah"],
    pairedArticleId: null,
    status: "published",
    publishedAt: "2026-03-01 10:00:00",
    createdAt: "2026-03-01 10:00:00",
    updatedAt: "2026-03-01 10:00:00",
  },
];

/**
 * Format number as Indonesian Rupiah.
 */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
