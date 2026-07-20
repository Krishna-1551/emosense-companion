# EmoSense Evolution Engine — Implementation Plan

Per your "preserve existing system" rule, this is **purely additive**. Nothing existing changes behavior; the Evolution Engine lives at `/admin/evolution` as a new module, reads from existing tables, and writes only to new tables. Fully disable-able by hiding the route.

Given scope, I'll ship this in **3 phases**. Please approve Phase 1 first; Phase 2/3 build on it.

---

## Phase 1 — Foundation + Recommendation Center + Dashboard (MVP)

Covers Modules 1 (Observation, read-only), 5 (Improvement Detector), 6 (Recommendation Center), 9 (Evolution Dashboard), 12 (Safe Evolution — enforced), 13 (Version History), 14 (Security).

### New DB tables (all admin-only via RLS + `has_role('admin')`)
- `evolution_recommendations` — title, description, problem, proposed_solution, benefits, difficulty, time_estimate, risk_level, dependencies (jsonb), implementation_plan (md), category, status (`pending|approved|rejected|archived|implemented`), source (`detector|research|advisor|manual`), metrics_snapshot (jsonb), created_at, decided_at, decided_by, decision_notes.
- `evolution_decisions` — full audit log of every approve/reject/archive with prior + new status, admin id, reason. Immutable by RLS.
- `evolution_observations` — hourly rollups: active_users, msg_count, avg_latency_ms, ai_error_rate, high_risk_count, avg_repetition, avg_questions, solution_mode_pct. Computed by scheduled function.
- `evolution_health_snapshots` — daily system health + evolution score, KPIs jsonb.

All follow the project's GRANT + RLS pattern. No changes to existing tables.

### New edge functions
- `evolution-observe` (scheduled hourly via pg_cron): aggregates from existing `messages`, `reply_analytics`, `mood_logs`, `profiles` → writes one row to `evolution_observations`. Read-only against production tables.
- `evolution-detect` (scheduled every 6h + manual trigger): scans recent observations + reply_analytics for anomalies (latency spikes, repetition rising, question-count creep, risk-handling gaps, unused features via zero-usage detection) and drafts `evolution_recommendations` rows in `pending` status. Reuses the existing `admin-suggestions` prompt style.
- `evolution-decide` (admin-only): approve / reject / archive a recommendation; writes to `evolution_decisions`.
- `evolution-health`: on-demand system health + evolution score computation, cached daily.

### New admin route & UI (`/admin/evolution`)
- Sub-tab in existing `Admin.tsx` (no route rename) — new nav entry only.
- **Evolution Dashboard**: glassmorphism cards for System Health, Evolution Score, Learning Progress (from `user_learning_profile` count), Suggestions Approved/Rejected, Avg Repetition, Latency Trends, Feature Usage, active users. Recharts line/area charts on `evolution_observations`.
- **Recommendation Center**: card grid with priority + area + effort chips (reuses `AdminSuggestionsPanel` styling), full expandable detail, Approve / Reject / Archive buttons → calls `evolution-decide`.
- **Version History**: chronological list from `evolution_decisions`.
- Dark theme + neon cyan/blue accents, respecting existing design tokens (no hardcoded colors).

### Safety guarantees
- Every function is read-only against existing tables.
- No auto-implementation anywhere — `evolution-decide` only mutates the recommendation's own status + audit log.
- Existing `admin-suggestions` panel stays untouched; Evolution Recommendation Center is a superset that can eventually replace it, but both coexist for now.

---

## Phase 2 — Research Agent + Model Comparison + AI Advisor
Modules 3, 4, 11. Adds:
- `evolution_research_findings` table + `evolution-research` function that uses Lovable AI + web fetch on the whitelisted public sources you listed, summarizes into recommendations.
- `evolution_model_registry` table (manually seeded + AI-enriched) with comparison view.
- Floating "AI Advisor" bubble on admin pages that surfaces the top pending high-priority recommendation with a proactive one-liner.

## Phase 3 — Learning Engine + Knowledge Base + Digital Memory
Modules 2, 8, 10. Adds:
- `evolution_knowledge` table (searchable, categorized, full-text index).
- `evolution_memory` table for long-term decision memory feeding future detector prompts (closes the learning loop — approved/rejected patterns bias future suggestions).

---

## What stays exactly the same
- Chat flow, `chat` edge function, prompts, language logic, solution engine, attachments, onboarding, auth, sidebar, MoodDashboard, existing `admin-suggestions` panel.
- No renames. No removed files. No modified existing migrations.
- All new UI is behind the admin role check that already exists.

---

## Approval requested
Reply **"approve phase 1"** and I'll ship Phase 1 in one pass. Or tell me which modules to reprioritize. If you want the entire thing (Phases 1–3) in one go, say **"ship all phases"** — it will be a large batch of files but same safety guarantees.
