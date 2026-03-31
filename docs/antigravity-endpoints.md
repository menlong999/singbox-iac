# Antigravity Endpoint Notes

These notes were derived from the installed macOS app bundle at `/Applications/Antigravity.app` and local logs under `/Users/lvyuanfang/Library/Application Support/Antigravity/logs`.

## App Identity

- Bundle identifier: `com.google.antigravity`
- Product links in `product.json`:
  - `https://antigravity.google/docs`
  - `https://antigravity.google/docs/rules`
  - `https://antigravity.google/docs/mcp`
  - `https://antigravity.google/support`

## Observed Or Referenced Google Endpoints

The installed app and local logs reference these Google-hosted domains that are relevant for routing verification:

- `antigravity.google`
- `accounts.google.com`
- `oauth2.googleapis.com`
- `clients2.google.com`
- `android.clients.google.com`
- `apis.google.com`
- `aiplatform.googleapis.com`
- `cloud.google.com`
- `daily-cloudcode-pa.googleapis.com`
- `firebase.googleapis.com`
- `fonts.googleapis.com`
- `fonts.gstatic.com`
- `lh3.googleusercontent.com`
- `play.googleapis.com`
- `antigravity-unleash.goog`
- `www.googleapis.com`
- `www.gstatic.com`

## Why These Matter

- `accounts.google.com` is a good auth-path verification target for `in-proxifier`.
- `oauth2.googleapis.com` is a good OAuth metadata verification target for `in-proxifier`.
- `antigravity.google` is a good product-surface verification target for `in-proxifier`.
- `www.googleapis.com` is a stable Google API surface that appeared in real runtime logs and is suitable for verification.
- `daily-cloudcode-pa.googleapis.com` appears during real model streaming, but it is less stable as a browser verification target and is better tracked as an observed runtime dependency.
- `play.googleapis.com`, `antigravity-unleash.goog`, `lh3.googleusercontent.com`, `clients2.google.com`, `android.clients.google.com`, `fonts.googleapis.com`, and `www.gstatic.com` regularly appear as supporting traffic during a real Antigravity session.

## User Journey Buckets

### Product Surfaces

- `https://antigravity.google/docs`
- `https://antigravity.google/docs/rules`
- `https://antigravity.google/docs/mcp`

### Auth And Session Bootstrap

- `https://accounts.google.com/favicon.ico`
- `https://oauth2.googleapis.com/.well-known/openid-configuration`

### Control And API Surfaces

- `https://www.googleapis.com/discovery/v1/apis`
- Observed at runtime, but not used as fixed browser probes:
  - `daily-cloudcode-pa.googleapis.com`
  - `play.googleapis.com`
  - `antigravity-unleash.goog`

## Current Verification Usage

The current verification harness uses:

- `https://accounts.google.com/favicon.ico`
- `https://oauth2.googleapis.com/.well-known/openid-configuration`
- `https://antigravity.google/docs`
- `https://antigravity.google/docs/rules`
- `https://antigravity.google/docs/mcp`
- `https://www.googleapis.com/discovery/v1/apis`

All of these are routed through `in-proxifier` and must land on the fixed US `OnlyAI` node.
