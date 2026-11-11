# WiV1 V0.6 — Safe Preview Verification

Scope: standalone WiV1 only. Do not use YukReview, UlasanToko, or other projects.

## Deployment blocker
GitHub's Vercel status is failing, but the wi-v1 project is not accessible using the currently connected Vercel team API. Its root cause is unconfirmed. Do not merge or deploy to production.

## Verify deployment
1. Open the latest Vercel deployment URL in the GitHub commit status.
2. Confirm team mjh10, exact WiV1 project, and branch fix/wiv1-v0.6-security-stability.
3. Read the first real error in build logs, and check the configured Root Directory.
4. Verify Preview environment *names and scopes*, not values: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, WIV1_ENCRYPTION_KEY, WIV1_BASE_URL, NEXT_PUBLIC_WIV1_BASE_URL.
5. Preview environment must use isolated WiV1 staging credentials, never production or other projects.
6. Prepare isolated WiV1 staging PostgreSQL with migrations 001 and 002 in order and verify RPC privileges.

## Read-only staging HTTP smoke test
After preview is READY, run: 

    WIV1_STAGING_BASE_URL=https://your-wiv1-preview.vercel.app node scripts/staging-smoke.mjs

The smoke test checks homepage, missing-card status, unauthorized admin status, and the secret cache policy. It makes no mutations and rejects non-vercel domains.

## Release gate
- GitHub CI must pass on the final head SHA.
- Staging admin login/allowlist and WPA2/Open card flow must be tested.
- Scan QR/NFC on actual Android and iPhone devices.
- Check clipboard-denied fallback and suspended-card credential denial.
- Review concurrent rate limiting and runtime logs.
- Confirm a matching Vercel preview and dedicated staging Supabase project.
- Do not merge PR #1 or migrate production without explicit release approval.
