# EmoSense Expert-System Upgrade Plan

## Product position

EmoSense is an evidence-informed emotional-support and pattern-recognition
companion. It must never claim to be a psychologist, diagnose a condition,
prescribe treatment, or replace qualified care. Its advantage should come from
contextual reasoning, cultural and language adaptation, consistent safety,
measurable quality, and a clear bridge to human help.

## Audit findings

| Priority | Shortcoming | Product risk | Planned control |
| --- | --- | --- | --- |
| Critical | Crisis behavior partly depended on model output | A fluent but incomplete response could miss immediate safety actions | Deterministic safety classifier and model-independent urgent response |
| Critical | Broad distress terms were treated like explicit intent | False escalations can feel alarming and reduce trust | Separate `concern` from `urgent`; test negated intent |
| High | Fresh wording could still be generic or ungrounded | Replies feel polished but not personally useful | Pre-delivery response-quality gate with forced rewrite |
| High | A model could make diagnostic, medication, or dependency-forming claims | Clinical and relational harm | Reject these patterns before delivery; retain non-diagnostic contract |
| High | Current evaluation set is too small | Regressions can ship unnoticed | Expand synthetic English/Hindi/Hinglish scenarios and adversarial cases |
| High | One prompt contains many overlapping instructions | Conflicts reduce consistency and make changes hard to validate | Move toward a staged policy/orchestrator with smaller response contracts |
| Medium | Case retrieval uses lexical full-text matching | Misses semantic equivalents and can retrieve weak matches | Hybrid curated retrieval with source/version/confidence filters |
| Medium | Feedback is learned from implicitly inferred outcomes | Wrong inference can reinforce an unsuitable style | Weight explicit feedback higher; require aggregate evidence before policy change |
| Medium | User-facing explanation of memory and deletion is limited | Sensitive-data trust barrier | Add granular memory controls, retention explanation, export/delete pathway |
| Medium | App bundle and logo are heavy | Slower first use on mobile networks | Route splitting implemented; optimize media and reporting dependencies next |
| Medium | Repository-wide lint has substantial legacy debt | Harder maintenance and weaker CI signal | Establish a clean changed-files gate, then burn down legacy errors by module |

## Target response architecture

1. **Input safety gate** — distinguish ordinary distress, concern, explicit
   self-harm intent, danger from others, and medical emergency cues.
2. **Context model** — current message, conversation-only signals, stated user
   preferences, recent actions, and uncertainty; never infer a diagnosis.
3. **Goal and stage router** — vent, explore, clarify, stabilise, plan, or close.
4. **Curated intervention selector** — choose one proportionate technique and
   one small next action from reviewed material.
5. **Response generator** — match English/Hindi/Hinglish and user-preferred tone.
6. **Quality gate** — reject repetition, generic replies, unsupported certainty,
   unsafe authority, dependency language, excessive questioning, and poor grounding.
7. **Safety override** — deterministic urgent response supersedes model prose.
8. **Outcome loop** — store minimal structured feedback; promote changes only
   after evaluation and human approval.

## Delivery roadmap

### Phase 1 — Safety and reliability (implemented in this change)

- Repair reproducible dependency installation.
- Lazy-load routes to reduce initial JavaScript.
- Add concern/urgent separation, negated-intent tests and deterministic India response.
- Add response-quality rejection for unsafe authority, dependency, genericness,
  excessive questions and lack of grounding.

### Phase 2 — Response intelligence

- [x] Add a dedicated deterministic response-planning module before prose generation.
- [x] Add semantic intervention novelty—not wording comparison alone.
- [x] Improve explicit preference controls through opt-in adaptive memory.
- [ ] Continue extracting legacy language examples from the monolithic prompt into versioned policy modules.

### Phase 3 — Evidence and evaluation

- [x] Enforce source, human review date, confidence threshold and versioned cases.
- [x] Add at least 100 synthetic scenarios across students, work, relationships,
  grief, panic, ambiguity, abuse, mania/psychosis-like content and crisis.
- Score safety recall, false escalation, specificity, helpfulness, language match,
  non-diagnosis, actionability and repetition.
- [x] Require passing tests and production build in GitHub CI before merge.

### Phase 4 — Trust and professional readiness

- [x] Add opt-in adaptive memory, export and deletion controls.
- Add clinician review workflow for content—not access to private chats by default.
- Add incident review, model/version traceability and safe rollback.
- Conduct a supervised pilot; measure helpfulness, return use, escalation quality
  and harms before making clinical-sounding claims.

## Evidence baseline

- WHO, *Ethics and governance of artificial intelligence for health*:
  autonomy, safety, transparency, accountability and privacy.
- WHO guidance for large multimodal models: expert oversight and rigorous evaluation.
- NIMH, *5 Action Steps for Helping Someone in Emotional Pain*: Ask, Be There,
  Help Keep Them Safe, Help Them Connect, Follow Up.
- Government of India DGHS/MoHFW: Tele-MANAS is available 24×7 at `14416` and
  `1800-89-14416`.
- APA health advisory on generative chatbots and wellness apps: do not overstate
  evidence or position a chatbot as a replacement for qualified care.
