# PT Alkhaleej Travelindo Utama — Website

Website resmi PT Alkhaleej Travelindo Utama — penyedia paket perjalanan Haji Mujamalah, Umrah, dan wisata Muslim terpercaya.

## 🚀 Tech Stack

- **Framework**: Astro 6 + React 18
- **Styling**: Tailwind CSS 3
- **Database**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Pages
- **Design**: Emas & Hijau Islam (brand colors dari logo)

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/          → Header, Footer, WhatsApp FAB, dll
│   ├── admin/       → Admin panel components
│   └── blog/        → Blog components
├── layouts/
│   ├── BaseLayout.astro
│   └── AdminLayout.astro
├── lib/
│   ├── db/          → Database schema, queries
│   ├── auth/        → Auth & session management
│   ├── ai/          → AI content generation
│   ├── i18n/        → Internationalization (ID/EN)
│   └── mock-data.ts → Development data
├── pages/
│   ├── index.astro          → Homepage
│   ├── packages/            → Paket listing & detail
│   ├── blog/                → Blog
│   ├── admin/               → Admin panel
│   └── api/                 → API endpoints
└── styles/
    └── globals.css          → Global styles + theme
```

## 🎨 Brand Colors

| Warna | Hex | Kegunaan |
|-------|-----|----------|
| Gold Primer | `#B47E2A` | Warna utama dari logo |
| Gold Light | `#D3B96B` | Aksen terang |
| Navy | `hsl(220 45% 12%)` | Background gelap |
| Emerald | `hsl(155 65% 32%)` | Hijau Islam |
| Cream | `hsl(40 50% 95%)` | Background terang |

## 📦 Paket yang Ditawarkan

- **Haji Mujamalah** — Paket haji dengan pelayanan premium
- **Paket Umrah** — Silver & Gold (9 hari)
- **Umrah Plus Turki** — Kombinasi ibadah + wisata Islami (12 hari)
- **Tour Muslim Eropa** — Andalusia & Istanbul (10 hari)

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

## 📋 Deployment (Cloudflare Pages)

1. Create D1 database:
   ```sh
   wrangler d1 create alkhaleej-db
   ```

2. Update `database_id` in `wrangler.toml`

3. Run migrations:
   ```sh
   wrangler d1 migrations apply alkhaleej-db --remote
   ```

4. Build & deploy:
   ```sh
   npm run build
   wrangler pages deploy dist
   ```

5. Set secrets:
   ```sh
   wrangler secret put DEEPSEEK_API_KEY
   wrangler secret put EXA_API_KEY
   wrangler secret put ADMIN_DEFAULT_USERNAME
   wrangler secret put ADMIN_DEFAULT_PASSWORD
   ```

## 📝 Catatan

- Logo resmi tersedia di `public/logo.png`
- Palet warna diambil langsung dari logo (emas/gold dominan)
- Website dikembangkan berdasarkan Infotour-id dengan modifikasi total untuk travel haji/umrah
