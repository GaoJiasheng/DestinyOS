import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat, unlink, readdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get, head, put, del } from '@vercel/blob';
import { EXPORT_TTL } from '../report-export-schema';
const directory = join(tmpdir(), 'destinyos-report-export');
const blobPath = (key: string) => `report-exports/${key}`;
/** Read only unexpired private artifacts; local temporary storage is used without a Blob token. */
export async function readExport(key: string): Promise<Uint8Array | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const metadata = await head(blobPath(key));
      if (Date.now() - metadata.uploadedAt.getTime() > EXPORT_TTL * 1000) {
        await del(metadata.url);
        return null;
      }
      const result = await get(metadata.url, { access: 'private' });
      if (!result || result.statusCode !== 200) return null;
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    } catch (error) {
      if (error instanceof Error && error.name === 'BlobNotFoundError') return null;
      throw error;
    }
  }
  try {
    const path = join(directory, key);
    const metadata = await stat(path);
    if (Date.now() - metadata.mtimeMs > EXPORT_TTL * 1000) {
      await unlink(path);
      return null;
    }
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
/** Persist private artifacts atomically and opportunistically remove expired local exports. */
// DESIGN-GAP: Without private Blob credentials, local artifacts use owner-process-only files, UUID temporary writes and opportunistic expiry cleanup.
export async function writeExport(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(blobPath(key), Buffer.from(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    try {
      if (Date.now() - (await stat(path)).mtimeMs > EXPORT_TTL * 1000) await unlink(path);
    } catch {
      /* Concurrent cleanup can remove a stale file first. */
    }
  }
  const path = join(directory, key),
    temporary = path + `.${randomUUID()}.tmp`;
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, path);
}
