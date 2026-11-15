# WiV1 verification — isolated staging flow

## Problem and diagnosis
The screenshot showed an email confirmation redirect to `localhost:3000/?code=...`,
which is not a deployed WiV1 application. Supabase can verify the email before the final
redirect, so a browser's `Cannot GET /` does not prove verification failed.

## Required Supabase STAGING URL Configuration
Dashboard: https://supabase.com/dashboard/project/fzzburisxfnyurkkcqbl/auth/url-configuration
1. Set **Site URL** to:
   `https://wi-v1-git-fix-wiv1-v06-security-stability-mjh10.vercel.app`
   (STAGING Supabase project only; do not reuse in unrelated Supabase projects).
2. Add this exact **Redirect URL**:
   `https://wi-v1-git-fix-wiv1-v06-security-stability-mjh10.vercel.app/auth/callback`
   and when needed the callback URL with `?next=%2Fauth%2Fverified`, or prefer redirect
   without query parameters.
3. Never redirect to `localhost:3000` outside local development. Remove old localhost
   redirect from staging when no developer needs it.
4. Publish the WiV1 branch and test a fresh throwaway account.

## New app behavior
- Sign-up sets `emailRedirectTo` to exact current-origin `/auth/callback`.
- GET `/auth/callback?code=...` exchanges the PKCE code server-side and redirects
  only to `/auth/verified?status=success` or safe error state.
- `/auth/verified` offers polished, accessible verification status and login link.
- Existing confirmed users can sign in; they do not need to sign up again.

## Optional Supabase Auth Email Template branding
Only edit STAGING Supabase Auth > Email Templates > Confirm signup.
Subject: `Verifikasi Akun WiV1 — Akses WiFi Bisnis`
Use Supabase template variable `{{ .ConfirmationURL }}` in the CTA. Do not hardcode a
verification URL, token, user-specific identifier, or localhost address.
A sample HTML template lives at `docs/wiv1-confirm-signup-email.html`.
The default Supabase sender name/domain stays unchanged until a dedicated verified
sending domain is configured. No YukReview email templates are modified.
