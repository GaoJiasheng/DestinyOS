# CHAT-EVAL evidence

`questions.json` contains 40 cases (20 zh, 20 en); `tuned-*.json` contains the
160 Fixture A conversations across bazi, ziwei, tarot and astrology. Each
record preserves provider prose, the relevant supplied sections, localized
production delivery, refusal reason and objective checks. `batch-*.json` and
`batch-raw-*.json` preserve four real MiniMax response receipts and token usage.
No API key or original birth input is included.

`rubric.json` defines six equally weighted 0–2 dimensions. `scores.json`
contains final objective checks plus Codex's direct review. The final MiniMax
160-case self-review exhausted its completion cap; `batch-judge-failed.json`
records its returned usage. `model-self-review.json` preserves verified
aggregate self-review results from the earlier 160 individual requests;
those original per-case files were accidentally deleted when Playwright
cleared its default output directory. They have not been fabricated.

`summary.json` separates archived-batch review, prior MiniMax self-review,
actual shared-batch token counts, production conversation cost estimates and
unreturned usage. Confirmed requests: 198; conservative upper bound: 200,
including two uncertain earlier smoke attempts. Further real calls are blocked
by the ledger. All 56 adversarial delivered answers refuse; raw model behavior
is reported separately. The two language recovery answers are scored as
failures to answer, rather than as successful grounded interpretations.

Run `pnpm chat:eval` to verify/reuse the existing receipts without more calls.
For a separate new experiment, set `CHAT_EVAL_OUTPUT=test-results/chat-eval-new`
before running it; the script has its own persistent 200-request cap. Fresh
runs grade in groups of twenty. `pnpm chat:eval:individual` supports an
individual-request experiment in a separate output directory. Real smoke is
opt-in with `RUN_MINIMAX_SMOKE=1`; ordinary `pnpm test` makes no real LLM calls.

Production keeps at most two relevant chapters and three previous exchanges.
Known raw chapter labels are localized with next-intl. Short answers are
buffered until complete prose, length, language and identifiers are checked.
Tarot career/money questions now also retrieve the actual card chapter; this
last retrieval change was unit-tested after the paid receipts were collected.

List-price estimates use $0.30/M input and $1.20/M output for MiniMax-M2.5:
https://platform.minimax.io/docs/pricing/overview . Completion usage includes
reasoning. Cache discounts, taxes and calls with no returned usage are excluded.

`verification.json` records actual install/lint/typecheck/test/build and E2E
results, test counts and hashes of the excluded local logs.
