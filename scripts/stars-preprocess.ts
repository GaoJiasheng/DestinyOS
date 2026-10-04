import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const url = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz';
/** BSC5 catalog fixed-width fields from CDS V/50 ReadMe, J2000 degrees and B−V. */
export function parseBsc5(text: string) {
  return text.split(/\r?\n/).flatMap((line) => {
    if (line.length < 109 || !line.slice(75, 77).trim()) return [];
    const ra =
      15 *
      (Number(line.slice(75, 77)) +
        Number(line.slice(77, 79)) / 60 +
        Number(line.slice(79, 83)) / 3600);
    const dec =
      (line[83] === '-' ? -1 : 1) *
      (Number(line.slice(84, 86)) +
        Number(line.slice(86, 88)) / 60 +
        Number(line.slice(88, 90)) / 3600);
    const mag = Number(line.slice(102, 107));
    // DESIGN-GAP: Missing B−V uses neutral white ci=0; rows without J2000 coordinates (14 nonstellar entries) are omitted.
    const ci = Number(line.slice(109, 114).trim() || '0');
    if (![ra, dec, mag, ci].every(Number.isFinite)) throw new Error('Invalid BSC5 numeric field');
    return [{ ra, dec, mag, ci }];
  });
}
if (process.argv[1]?.endsWith('stars-preprocess.ts')) {
  const bytes = process.argv[2]
    ? await readFile(process.argv[2])
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  const stars = parseBsc5(gunzipSync(bytes).toString('ascii'));
  if (stars.length !== 9096)
    throw new Error(`Expected 9096 stellar entries, received ${stars.length}`);
  const binary = Buffer.alloc(stars.length * 16);
  stars.forEach((star, i) =>
    [star.ra, star.dec, star.mag, star.ci].forEach((value, j) =>
      binary.writeFloatLE(value, i * 16 + j * 4),
    ),
  );
  await writeFile(new URL('../apps/web/public/stars.bin', import.meta.url), binary);
  await writeFile(
    new URL('../apps/web/public/stars-source.json', import.meta.url),
    JSON.stringify(
      {
        source: url,
        reference: 'https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe',
        title: 'Yale Bright Star Catalogue 5, Hoffleit & Warren (1991)',
        license: 'Public-domain astronomical data',
        records: stars.length,
        layout: 'little-endian Float32 ra(J2000 degrees), dec(degrees), mag(V), ci(B-V)',
        catalogSha256: createHash('sha256').update(bytes).digest('hex'),
        binarySha256: createHash('sha256').update(binary).digest('hex'),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Prepared ${stars.length} stars (${binary.length} bytes)`);
}
