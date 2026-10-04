# T-13 / T-14 reference data

The production engines are pure browser-compatible TypeScript. Python and npm reference packages are development tools only; no runtime engine imports them.

## Reproduce the sources

1. Clone `https://github.com/freizl/yijing` and `https://github.com/Johnson-Jia/liuyao-divination`. Check out the commits recorded in `packages/content/iching/source-audit.json`.
2. Create a Python virtual environment. Install `ephem==4.2.1 sxtwl==2.0.6 opencc-python-reimplemented==0.1.7 PyYAML==6.0.3`, then `pip install kinqimen==0.0.6.6 --no-deps`.
3. Run `python scripts/engines/merge-hexagrams.py <yijing-checkout> <liuyao-divination-checkout>`.
4. Run `pnpm exec tsx scripts/engines/export-qimen-terms.ts > /tmp/destiny-terms.json`.
5. Run `python scripts/engines/qimen-baseline.py /tmp/destiny-terms.json`.
6. Run `pnpm exec tsx scripts/engines/evaluate-qimen.ts`, then format generated YAML/JSON/TS with Prettier.

The published kinqimen wheel imports `config` absolutely; the generator adds the wheel directory to Python's import path. Its pinned ephem 4.1.3 fails to compile with current macOS clang. The API-compatible MIT ephem 4.2.1 wheel is used, with exact versions recorded in every fixture. kinqimen/ephem are MIT, sxtwl is BSD, OpenCC is Apache-2.0, PyYAML is MIT; no GPL/AGPL dependency is introduced.

## Reference differences (do not erase)

- Every fixture retains the **unmodified** `kinqimen.Qimen(...).pan(1)` result in `raw`.
- `documented` is a separate, independently implemented Python projection of the normative repository specification. It uses the astronomical term instants only from the existing lunar ephemeris; all chart layer calculations are Python calculations, independent of the TypeScript implementation.
- kinqimen determines yuan from the day-pillar cycle; docs/qimen §3.2 determines it from elapsed term days. kinqimen also has different center-hosting/deity details. Consequently, claiming 30 raw-library matches would be incorrect. All 30 **documented** projections match; raw discrepancies remain inspectable.
- The 2026-10-04 15:30 example is documented yin 4, lower yuan, Xin-Hai day, Bing-Shen hour. Raw kinqimen reports yin 7, upper yuan.
- qimen-dunjia 3.1.0 is rotating by the eight-star ring invariant on all 30 cases. Only 3/30 complete five-layer comparisons match raw kinqimen (earth/sky-only comparisons match 16/30). See `qimen-npm-evaluation.json`; the task's direct-wrapper acceptance condition is not met, so the rotating engine is implemented from §3.
- Iching §9's Ding example has reversed body/use labels. §3.3 governs: first line moves in Xun below, so Li is body, Xun is use, use generates body.
- lunar-typescript's `getDayGanIndexExact/getDayZhiIndexExact` implements the specified 23:00 change. The sect mapping prose in 04 is reversed; tests enforce the actual day/hour behavior.

## Predicate references for unspecified details

The repository is the sole requirements source. Where §3.7 leaves conditions unspecified, explicit selected readings are recorded in the code: [奇門法竅 卷六](https://ctext.org/wiki.pl?chapter=600483&if=gb) for 玉女守门 (值使临地丁) and 三奇升殿 (乙震、丙离、丁兑); [奇門旨歸 卷四](https://ctext.org/wiki.pl?chapter=932278&if=en) for 伏干 (庚加日干) and 飞干 (日干加庚); and [奇門遁甲統宗](https://zh.wikisource.org/zh-hant/%E5%A5%87%E9%96%80%E9%81%81%E7%94%B2%E7%B5%B1%E5%AE%97) for the main named stem configurations. Nine-dun variants are fixed to one explicit condition each, not combined across schools.

## Content merge

Simplified gua/yao from Johnson-Jia is paired with complete freizl tuan/xiang/xiao-xiang. Freizl fills the incomplete six-line Shi entry. OpenCC converts traditional text, preserves classical 乾, removes pronunciation/editorial parentheses, normalizes 繋 to 系, and corrects 初噬告 to 初筮告. Both MIT notices and each text variant are retained. Numbered hexagram keys avoid homophones; bilingual generated prose, keywords and guidance remain empty for the later content pipeline.

`pnpm test` checks all 64 King Wen ordinals, all palace/NaJia/relative/Shi-Ying assignments against npm liuyao 0.5.1, 40 Qimen predicate positive/negative cases, all 18 earth layouts × 60 hour pillars, and the 30 independently projected fixtures. The browser test executes both engines with no IO, clock or unseeded randomness.
