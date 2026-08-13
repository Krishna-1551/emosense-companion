# EmoSense — Psychological Intelligence & Case Handling Engine

A modular layer between raw emotion detection and the reply engine. It recognises
patterns, assesses severity, selects a response strategy and decides escalation.
It is **not** diagnostic.

## Modules

| Module | Location | Purpose |
| --- | --- | --- |
| Case knowledge base | `psych_cases` table + `match_psych_cases()` RPC | Curated, versioned, searchable psychological cases (full-text ranked) |
| Retrieval | `_shared/psych.ts → retrievePsychCases()` | Top-N enabled cases for the current message |
| Context analysis | `analyseContext()` | Duration, functional impact, somatic, hopelessness and safety markers (EN / Hindi / Hinglish) plus continuity from prior assessments |
| Severity assessment | `assessSeverity()` | Levels 1–4 + uncertainty score + escalation flag |
| Response strategy | `buildPsychBlock()` | Injects level-specific shape, hedging rules, follow-ups and "avoid saying" into the system prompt |
| Emotional timeline | `psych_assessments` table | Per-message severity, patterns, matched case codes, uncertainty (no chat text) |
| Simulator + evaluator | `psych-simulate` function, `psych_simulations` table | Synthetic case runs scored on 9 dimensions |

## Severity model

1. Normal emotional distress — validation + one coping suggestion.
2. Significant distress — one contextual question, small step, gentle mention of support.
3. Possible mental-health concern — reflect the pattern, hedged language, suggest professional assessment. Never diagnose.
4. Safety-critical — safety overrides everything: direct safety check, trusted person nearby, India helplines (Tele-MANAS 14416, AASRA +91-9820466726, Vandrevala 1860-2662-345). Forces `risk_level = high` in `messages`.

Uncertainty rises with short messages, missing duration signals and weak case
matches. Above 0.5 the AI must ask exactly one clarifying question instead of
interpreting.

## Adding cases

Insert into `psych_cases` (admin only) with `case_code`, `category`,
`user_situation`, `severity_level`, `response_strategy`, plus optional
`follow_up_questions`, `avoid_saying`, `next_steps`, `escalation_criteria`,
`source`. `search_text` is maintained by a trigger, so new cases become
retrievable immediately. Set `enabled = false` to retire a case without deleting
it; bump `version` when revising wording.

## Privacy

Assessments store patterns and severity only — never message content.
Simulations use synthetic personas. The admin case library and simulator never
surface real user conversations.

## Reasoning before response

Every meaningful turn now runs:

```text
message → signal extraction → conversation context → pattern update
        → severity re-assessment → uncertainty → highest-value missing info
        → empathetic reply → ONE targeted follow-up question
```

`extractSignals()` maps the message onto observable dimensions (duration,
functional impact, sleep, energy, interest, concentration, appetite, social
withdrawal, stressors, protective factors, risk indicators). `mergeSignalState()`
keeps a running per-conversation state, persisted as `psych_assessments.signal_state`.
`planNextProbe()` picks the single highest-value unknown dimension (safety first at
level 4; functioning once two or more symptom signals are known; duration when the
picture is thin) and stores it as `psych_assessments.next_probe`, so the model never
re-asks a known dimension or fires a questionnaire.

The core contract also bans settled causal explanations ("this is definitely
burnout", "your system is craving a break") and intimate pet names ("hon",
"sweetie"), keeping the tone warm but professional.
