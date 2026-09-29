# WiV1

Standalone WiFi NFC + QR platform. This project is intentionally independent from the existing UlasanToko system.

## Current scope
- Supabase PostgreSQL + RLS
- Supabase Auth admin login + `admin_users` allowlist
- Business / location / WiFi card creation
- Card status: active, inactive, suspended
- AES-256-GCM encryption for WiFi passwords
- QR endpoint and shared public URL for NFC
- Mobile-first WiFi landing page
- QR / NFC / page-view / password-copy event tracking
- Admin dashboard with card activity metrics
- Card management and WiFi configuration editing

## Setup
1. Create a fresh Supabase project.
2. Run `supabase/001_initial_schema.sql` in Supabase SQL Editor.
3. Create a Supabase Auth user for the first admin.
4. Insert that Auth user's UUID into `public.admin_users`.
5. Copy `.env.example` to `.env.local` and fill the values.
6. Generate a 32-byte hex key for `WIV1_ENCRYPTION_KEY`.
7. Run `npm install`, then `npm run dev`.

## Public flow
QR and NFC should use the same URL:
`https://your-domain.com/wifi/<slug>`

For QR the app adds `?src=qr`. For NFC, write the clean URL or append `?src=nfc` if you want explicit source tracking.

## Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Never expose `encrypted_password` to public clients.
- WiFi passwords are decrypted only by the server secret endpoint after an active card lookup.
- Keep `.env.local` out of Git.

## V0.3 additions
- Per-card activity endpoint for admin users (latest 100 events).
- Card activity panel in admin card management.
- Public event ingestion now verifies the referenced card exists and is active before inserting an event.


## WiV1 V0.4

WiFi Connection Experience ditambahkan:
- Tombol Connect WiFi menggunakan WiFi URI standar browser/perangkat yang mendukung.
- Fallback aman ke Copy Password jika browser tidak mendukung pembukaan WiFi URI.
- Device-aware instructions untuk iOS, Android, dan perangkat lain.
- Event `wifi_connect` dicatat sebelum mencoba membuka koneksi.
- QR/NFC tetap menggunakan landing page WiV1 sebagai satu pintu tracking; tidak diarahkan langsung ke WiFi URI.

Catatan: browser/OS menentukan apakah WiFi URI dapat membuka dialog koneksi. WiV1 tidak mengklaim dapat melewati permission atau security OS.

## WiV1 V0.5
- Production-oriented card management UI
- Per-card analytics activity view
- Global analytics dashboard
- Print-ready WiFi card with QR/NFC URL
- Mobile-first public WiFi experience retained
- Standalone architecture; no dependency on UlasanToko
