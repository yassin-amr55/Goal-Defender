# Goal Defender — Documentation Index

All project documentation lives in this folder. Source-of-truth files that
already existed in the repo root were **moved** here, not copied, so there is
only ever one version of each.

| File | What it is for |
|---|---|
| **DESCRIPTION.md** | What the game is, how it plays, every feature, every ball and ability. Start here. |
| **HANDOVER.md** | The briefing for whoever (or whatever) picks this up next. Read this second. |
| **STATE.md** | Exact current state of the working tree: what is committed, what is not, what must not be pushed. |
| **PROGRESS.md** | Chronological work log — what was done, in what order, and what it replaced. |
| **IMPORTANT.md** | Hard rules that must never be broken. Read before touching anything. |
| **ARCHITECTURE.md** | File map, module responsibilities, data flow, save keys, Firebase shape. |
| **TESTING.md** | The 14 test suites, what each proves, how to run them, and the traps that produced false passes. |
| **DESIGN-IMPROVMENTS.md** | **Visual audit from screenshots of 13 screens.** 10 bugs, 10 must-do fixes, 17 polish items. |
| **DESIGN.md** | Measured design audit (font sizes, text counts, contrast). Superseded by DESIGN-IMPROVMENTS. |
| **KNOWN-ISSUES.md** | Every known defect and deliberate non-fix, with the reason. |
| **DESIGN-RULES.md** | Asset, colour and UI conventions. |
| **TOURNAMENT.md** | Tournament modes, brackets, cups, streaks. *(moved from repo root)* |
| **TEST-RESULTS.md** | Full test log with measurements. *(moved from repo root)* |
| **update-plan.md** | Long-range plan, parts 1–8 shipped, parts 9/9.2 proposals. *(moved from repo root)* |
| **To-Do.md** | The task list that drove the current phase. *(moved from repo root)* |
| **v2.1.md** | v2.1 release notes. *(moved from repo root)* |
| **BETTER.md** | Improvement backlog. *(moved from repo root)* |

## Ground rules

1. **`IMPORTANT.md` is not optional.** It contains the rules that have already
   cost real time — a leaderboard filter that was never wanted, a file that was
   committed as binary, a test that passed while proving nothing.
2. **Update every dependent the moment you change something.** Adding a ball
   means: shop list, `BALL_COUNT`, the achievement that counts balls, the
   texture load, and the audit that checks they agree.
3. **Never push without being told.** The working tree is deliberately dirty.
