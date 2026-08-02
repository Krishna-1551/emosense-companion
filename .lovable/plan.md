# ESP32 + MAX30102 Biometric Integration

Add optional wearable support so EmoSense can fuse physiological stress signals (heart rate, HRV, SpO2) with its existing emotional analysis of text, voice, and images.

## What the user experiences

1. In settings/onboarding, tap "Pair a wearable". The app shows a 6-digit pairing code (valid 10 minutes) plus a device token.
2. They flash the documented ESP32 sketch, connect it to Wi-Fi via a captive portal, and enter the pairing code once. The device is then bound to their account.
3. While the device streams, a small pill appears next to the mood meter in chat: `HR 82 - HRV 45ms`.
4. If the body shows a stress signature while the words sound calm, EmoSense gently reflects it — never quoting numbers, never sounding clinical.
5. A "Pause biometrics" toggle and a "Delete all my biometric data" button live in the same settings panel.
6. Admins see only a "Wearable linked" indicator and aggregate trends — never raw streams. The therapist PDF gains an "Autonomic activity" section (average HR, HRV trend, correlation with self-reported mood).

## Build steps

### 1. Database (migration)

`biometric_devices` — `id`, `user_id`, `label`, `token_hash`, `pair_code`, `pair_code_expires_at`, `paired_at`, `last_seen_at`, `paused boolean default false`, `revoked_at`, `created_at`.

`biometric_samples` — `id`, `user_id`, `device_id`, `captured_at`, `bpm int`, `spo2 numeric`, `hrv_rmssd numeric`, `signal_quality smallint`, `source text default 'max30102'`, `created_at`.

`biometric_baselines` (rolling reference, refreshed by function) — `user_id`, `avg_bpm`, `avg_hrv`, `samples_count`, `updated_at`.

RLS: users read/write only their own rows (`auth.uid() = user_id`); `service_role` full access for the ingest function; admins get no row-level read on samples — they use aggregate RPCs only. Explicit GRANTs on all three tables.

New RPCs:
- `biometric_recent_context()` — returns the caller's last 2 minutes of aggregates plus baseline deltas.
- `admin_biometric_summary()` — security definer, admin-gated, returns per-user aggregates only (linked yes/no, avg HR, HRV trend, stress-episode count). No timestamps of individual samples.

### 2. Edge function `ingest-biometrics`

- Public endpoint (`verify_jwt = false`), authenticated by an `x-device-token` header hashed and matched against `biometric_devices`.
- Zod-validated body: `{ samples: [{ capturedAt, bpm, spo2, hrvRmssd, signalQuality }] }`, batch max 60.
- Drops samples with `signalQuality` below threshold (no finger on sensor). Skips inserts entirely when `paused` is true.
- Updates `last_seen_at`, refreshes the rolling baseline.
- Stress rule: if `hrv_rmssd` is more than 30% below baseline AND `bpm` is more than 15 above baseline, sustained across 3 consecutive windows, insert a `mood_logs` row with `risk_level = 'moderate'` (or `'high'` if the user also has a recent high-risk text signal) so all existing alerting, timeline, and admin surfaces light up with no extra wiring.

### 3. Edge function `pair-device`

JWT-authenticated. `POST { action: 'create' | 'redeem' | 'revoke' }` — creates a pairing code + token for the signed-in user, lets the ESP32 exchange the code for a long-lived token, and revokes devices.

### 4. Chat AI fusion (`supabase/functions/chat/index.ts`)

Fetch the caller's biometric context alongside the existing behavior signals and inject a block into the system prompt:

```text
BIOMETRIC CONTEXT (last 2 min, optional signal):
- Avg HR 96 bpm (baseline 72) - elevated
- HRV RMSSD 22 ms (baseline 48) - significantly reduced
- SpO2 98% - normal
- Interpretation: physiological stress signature
```

Prompt rules added:
- Never state numbers or medical conclusions to the user.
- Body stressed + words calm: gently name the mismatch in one sentence, still respecting the one-question-per-reply rule.
- Body stressed + words distressed: escalate to grounding and surface the crisis resource card sooner.
- Everything normal, or no device: do not mention the body at all.
- Log a `biometric_signal` field into `reply_analytics` so prompt quality stays reviewable.

### 5. Frontend

- `src/components/BiometricPairing.tsx` — pairing dialog with code, copy button, device list, pause toggle, delete-all action, and a "not a medical device" disclaimer.
- `src/components/BiometricPill.tsx` — the compact HR/HRV pill; renders nothing without an active device. Placed next to the existing mood meter in `src/pages/Index.tsx`.
- Realtime subscription on `biometric_samples` filtered to the current user, mounted in a `useEffect` with cleanup, matching the existing `MoodDashboard` pattern.
- `src/pages/Admin.tsx` — "Wearable" column driven by `admin_biometric_summary()`; optional HR/HRV overlay track in `AdminMoodTimeline.tsx`.
- `src/lib/therapistReport.ts` + `supabase/functions/therapist-report/index.ts` — add the "Autonomic activity" section, aggregates only.

### 6. Firmware documentation

`docs/esp32-max30102.md` containing a complete Arduino/PlatformIO sketch and the HTTP contract:
- Libraries: `Wire`, `SparkFun_MAX3010x`, `WiFi`, `HTTPClient`, `Preferences`.
- Sample the PPG at 100 Hz; compute BPM, SpO2, and RMSSD over a 10-second window; POST one aggregated sample per window.
- First-boot captive-portal provisioning (Wi-Fi credentials + pairing code) stored in NVS.
- Light sleep between windows for battery; exponential backoff and local buffering when offline.

## Technical notes

- Bandwidth stays tiny: one aggregated JSON sample per 10 seconds, no raw waveform ever leaves the device.
- Device tokens are stored hashed; the plaintext token is shown once at pairing.
- Reusing `mood_logs` for stress episodes means the panic flow, admin high-risk panel, and evolution engine pick up biometric signals with no changes to those systems.
- The MAX30102 is a consumer sensor, not a medical device — the disclaimer appears at pairing and in the therapist report footer.
