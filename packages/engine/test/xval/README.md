# Independent engine cross-validation

All oracles run in a disposable Python environment **outside the repository**.
They neither import the engine nor consume its output. Committed JSON is sufficient
for offline Vitest/CI; Python, Swiss Ephemeris, and its license are never included
in the npm dependency graph or browser bundle.

```sh
python3 -m venv /tmp/destiny-xval-venv
/tmp/destiny-xval-venv/bin/pip install --upgrade pip wheel
/tmp/destiny-xval-venv/bin/pip install --no-deps -r packages/engine/test/xval/requirements.txt
/tmp/destiny-xval-venv/bin/python packages/engine/test/xval/generate.py
pnpm exec prettier --write packages/engine/test/fixtures/xval
pnpm exec vitest run packages/engine/test/xval.test.ts
pnpm exec tsx packages/engine/test/xval/audit.ts
```

Python 3.9+ is required. The seed is `0xD3571`; package versions are pinned.
`--no-deps` is intentional: kinqimen pins ephem 4.1.3, whose C extension does not
compile on current macOS. The independently exercised version is ephem 4.2.1.
Generation uses `zoneinfo` (host IANA tzdb); overlap picks fold=0 and nonexistent
random civil clocks are rejected, matching Temporal's earlier-overlap choice.

- `births.json`: exactly 300 random legal Gregorian inputs, 1900–2030, 12 places,
  both hemispheres/longitude signs, historical offsets, DST, late Zi, unknown time.
- `term-edges.json`: 192 samples ±2 minutes around all 24 terms in 1900, 1988,
  2000 and 2030, including west longitude/DST, plus exact independent term JDs.
- `casts.json`: exactly 60 clocks, each with sxtwl calendar, independently derived
  Meihua numbers, documented ju/yuan and **unmodified** kinqimen `pan(1)` results.
  A second result explicitly forces only the documented ju into kinqimen.
  Fu-tou yuan differs from docs/qimen §3.2 elapsed-day yuan; this is never reported
  as an unmodified match. `schoolUsed.yuanBasis` identifies the runtime rule.
- `nakshatra-edges.json`: all 108 Pada boundaries, exact and ±1e-7 degrees, with
  independent Dasha first-period balance arithmetic (365.25-day year).
- `manifest.json`: seed, counts, versions, backend and scope limitations.

Acceptance: planets ±0.1°, ASC/MC ±0.3°, cusps ±0.5° (docs/astrology §9);
solar terms ≤60 s; Lahiri ≤1′; solar-clock offset <0.1 min. Mansion/Pada identifiers
and Zi schools are exact. Dasha balance allows only propagated ±0.1° Moon error;
synthetic boundary arithmetic agrees within 1e-6 day. Polar Placidus uses the
documented Whole Sign fallback, with the applied school and warning asserted.

Swiss uses its self-contained Moshier backend, no downloaded ephemeris files.
Chiron is not supported by this backend and remains an explicitly approximate
runtime body, excluded from this independent corpus. All other western bodies,
including true/mean nodes and mean Lilith, are compared. iztro-py is pure Python;
it shares iztro's algorithm design and lunar_python ancestry, so its agreement is
independent execution, not independent historical-school evidence. Natal Ziwei
checks evaluate `now` at birth+30 years within its 12-decade horoscope horizon.

Two kinqimen 0.0.6.6 `pan_sky` center-hour faults (1906-02-03, 2009-07-27) are
retained, counted and strictly asserted: each has eight incorrect sky stems while
all independent earth/star/gate/deity layers agree. Docs §3.5's star-carried earth
stem invariant verifies those sky stems. No new differences may use this exception.

Primary reference API provenance: [sxtwl](https://github.com/yuangu/sxtwl_cpp),
[Swiss Ephemeris](https://www.astro.com/swisseph/),
[kinqimen](https://pypi.org/project/kinqimen/),
[iztro-py](https://pypi.org/project/iztro-py/).
Mean Lilith uses independently implemented inclined-orbit projection of Meeus's
mean apogee; no Swiss source code is included in the engine.
