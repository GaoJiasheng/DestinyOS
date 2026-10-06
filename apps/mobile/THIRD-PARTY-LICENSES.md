# Additional mobile license choices

All five embedded font subsets use SIL OFL 1.1. Copyright and license texts are in
`assets/fonts/OFL-*.txt`; derivative font names use the TianjiMobile prefix.

Expo CLI indirectly uses `node-forge@1.4.0`, which offers a choice of BSD-3-Clause
or GPL-2.0. DestinyOS elects **BSD-3-Clause** exclusively, as permitted by its
upstream LICENSE. The original dependency distribution retains the BSD copyright
and conditions. `scripts/license-check.ts` approves this exact reviewed package
and declaration; other unapproved or copyleft declarations continue to fail.

M04 uses MIT-licensed expo-sqlite, expo-secure-store, expo-crypto, Zod, Ajv, fflate,
@noble/curves and @noble/hashes. The bundled SQLCipher implementation is BSD-3-Clause;
its copyright, redistribution conditions and disclaimer are retained in
`assets/licenses/SQLCipher.txt`. No GPL/AGPL dependency is introduced.
