# Taiwanese 16-tile Mahjong Score Keeper

One phone, one scorekeeper, 4 players. Mobile-first PWA (TypeScript, React, Vite), Vitest + fast-check, browser storage, fully offline. Plan: `~/.claude/plans/swift-tickling-lecun.md`.

## Ground rules
- Nothing is hardcoded: every tai value comes from the session's rule snapshot (`src/rules/`).
- Every number shown must have a line-by-line breakdown. Nothing may block entering the next hand.
- Don't invent rules, tai values or library behaviour. Ask the user instead.
- Use small diffs and run only the tests that matter. Commit at the end of each phase.

## Commands
- `npx vitest run src/engine`: engine tests (golden hands, edge cases, fast-check zero-sum).
- `npx vitest run src/session`: rotation, scripted 將, undo and edit, snapshots, settlement, session zero-sum.
- `npx tsc --noEmit`: type-check.

## Layout
- `src/rules/catalogue.ts`: every rule item with its zh/en name, condition, default and source note.
- `src/rules/ruleset.ts`: RuleSet, validation, hashing and snapshot.
- `src/engine/`: pure scoring, no UI.
  - `tiles.ts`: tile notation.
  - `validate.ts`: legality checks.
  - `decompose.ts`: hand splits.
  - `waits.ts`: winning tiles.
  - `score.ts`: `scoreHand` and `scoreFalseWin`.
  - `payments.ts`: dice and per-payer amounts.
- `src/engine/testkit.ts`: `hand()`, `ctx()` and `rules()` helpers for synthetic tests.
- `src/session/`
  - `events.ts`: the append-only log. Edits and undos are appended too, and `effectiveEvents` applies them.
  - `rotation.ts`: dealer, streak, round wind and the end of the 將, plus the seat-redraw check.
  - `replay.ts`: recomputes every hand, total and next step from the log, using that session's own rule snapshot.
  - `settle.ts`: the fewest transfers.
- `src/storage/store.ts`: localStorage save after every event. A failed write is reported, never thrown.

## Glossary
| Code | Chinese | English |
|---|---|---|
| `1m`–`9m` | 萬 | characters |
| `1p`–`9p` | 筒 | dots |
| `1s`–`9s` | 條 | bamboo |
| `1z` `2z` `3z` `4z` | 東 南 西 北 | winds |
| `5z` `6z` `7z` | 中 發 白 | dragons |
| `f1`–`f4` | 春 夏 秋 冬 | seasons |
| `f5`–`f8` | 梅 蘭 菊 竹 | plants |
| `chi` / `pon` / `minkan` / `ankan` | 吃 / 碰 / 明槓 / 暗槓 | chow / pung / exposed kong / concealed kong |
| zimo / from seat | 自摸 / 放槍 | self-draw / discard win |
| `dealer`, `streak` N | 莊家, 連N拉N | dealer, dealer streak |
| `roundWind` | 圈風 | round wind |
| seat wind | 門風 | seat wind (dealer = 東, then turn order) |
| 流局 | 流局 | drawn hand |
| 詐胡 | 詐胡 | false win |
| 門骰 | 門骰 | dealer's dice bonus |
| 將 | 將 | a full set of 4 rounds (東→北) |

- Tile groups are written as digits plus a suit letter: `123m 456p 11z f1`.
- Seat flowers (正花): 東 = f1, f5; 南 = f2, f6; 西 = f3, f7; 北 = f4, f8.

## Phase status
- [x] **(a) Rule catalogue, scoring engine and tests** (branch `phase-a/scoring-engine`): 75 tests pass, made up of 59 golden hands, a count check, 7 illegal-hand checks, 4 詐胡 checks, 3 edge cases and a fast-check zero-sum test over 2,000 random hands and rule sets.
- [x] **(b) Rotation, dice and session state** (branch `phase-b/session-state`, based on phase a): 120 tests pass in total. Phase b adds a scripted 24-hand 將 (streaks, 流局 including a triple-roll 流局, a 詐胡, all four round winds, the redraw prompt), undo and edit, rule snapshots, storage, settlement, and a fast-check session zero-sum test over 500 random logs.
- [ ] (c) Interview, seating, hand entry, scoreboard and settlement.
- [ ] (d) Table polish: tap targets, wake lock, undo and edit, PWA.

## Open questions (from phase a)
**Catalogue values that differ from zh.wikibooks「臺灣麻將」** (brief values kept, source noted per item):
- 天胡: brief 24, WB 32.
- 地聽: brief 4, WB 8.
- 天聽: brief Off, WB 16.
- 地胡: WB defines it as winning on the dealer's first discard. The engine uses "non-dealer self-draws on first draw", with 人胡 = "non-dealer wins off a discard in the first go-around". 人胡 isn't in WB.
- 槓上開花: WB also counts a win on a flower replacement. The engine counts kong replacement only, per the brief.

**My interpretations, to confirm:**
1. 門風 / 正花 are counted from the dealer (= 東). WB agrees: counted from the 開門 position.
2. Tai cap, when on, caps the hand tai only, not dealer tai or dice.
3. 見花見台 replaces 正花. 見風見台 only counts wind triplets that earn no 圈風 / 門風. 無字無花 replaces 無花 and stacks with 平胡.
4. 嚦咕嚦咕:
   - Four of a kind is not two pairs.
   - These are skipped with it: 平胡, 碰碰胡, 暗刻 tiers and 全求人.
   - Everything else still counts.
5. 七搶一 / 八仙過海 score only their own tai (+ 自摸 for 八仙), plus dealer tai and dice. 正花 and 花槓 are not added.
6. A hand with 0 tai is legal and pays the base (3).
7. Eight flowers entered with a tile hand are scored as entered: 正花 + 花槓. Should the app suggest 八仙過海 instead?
8. 天聽 / 地聽 Off: a declared-ready hand falls back to 報聽.
9. 「閒家自摸只莊家付莊台」= No means all three payers include dealer tai.
10. 全求人 by self-draw (半求) scores no 全求人.
11. The 一發 item needs a "won within one go-around" toggle at hand entry. It is only shown when 一發 is on.

## Open questions (from phase b)
1. **Bonus carries over after a 流局** (default No). When it's Yes, the drawn hand's roll is used only if the next hand's own roll gives no bonus. Should both bonuses stack instead?
2. **詐胡 with "dealer stays":** the streak doesn't change. Should it add 1, like a 流局?
3. **"Seating came out the same"** means every player is in the same seat as last 將. Should a rotation of the same order (everyone moved one seat) also count as the same?
4. **The first seat entered** (seats[0]) is 東 and deals first in each new 將.
5. **Totals are kept per player name,** so a player can swap in at a redraw. Names must be unique.
6. **An edit that leaves a later redraw out of place** (the 將 hadn't ended yet) is flagged on the scoreboard, never blocked. The redraw still restarts at 東風東.
