import { spawn } from 'node:child_process';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { checkNativeScreenshot } from './launch-screenshots';

const targets: Record<string, { file: string; prefix: string; width: number; height: number }> = {
  M08: { file: 'M08/share-card-zh.png', prefix: 'daily-card', width: 1080, height: 1920 },
  'M08-share': { file: 'M08/share-card-en.png', prefix: 'daily-card', width: 1080, height: 1920 },
  M12: { file: 'M12/poster-portrait-en.png', prefix: 'report-card', width: 1080, height: 1920 },
  'M12-share': {
    file: 'M12/poster-landscape-zh.png',
    prefix: 'report-card',
    width: 1200,
    height: 630,
  },
};
const Artifact = z.object({
  file: z.string(),
  flow: z.string(),
  flowHash: z.string(),
  sha256: z.string(),
  capturedAt: z.string().datetime(),
});

/** Capture original native share exports without changing the app or their pixels. */
export async function withNativeExports(
  context: {
    root: string;
    directory: string;
    name: string;
    flowDevice: string;
    sourceHash: string;
    flowHash: string;
  },
  run: () => Promise<void>,
): Promise<{ file: string; sha256: string } | null> {
  const { root, directory, name, flowDevice, sourceHash, flowHash } = context;
  const target = targets[name];
  if (!target) {
    await run();
    return null;
  }
  const captureDirectory = resolve(directory, 'native-export');
  const child = spawn(
    '/usr/bin/python3',
    [
      'scripts/native-exports.py',
      flowDevice,
      target.prefix,
      String(target.width),
      String(target.height),
      captureDirectory,
    ],
    { cwd: root, env: process.env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  let spawnError: Error | undefined;
  child.on('error', (error) => {
    spawnError = error;
  });
  const stop = () => {
    child.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const completion = new Promise<number | null>((done) => child.once('close', done));
  let code: number | null;
  try {
    await run();
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      code = await completion;
    } finally {
      clearTimeout(timer);
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
    }
  }
  if (spawnError || code !== 0)
    throw spawnError ?? new Error(`Native export watcher exited ${code}`);
  const capture = z
    .object({ sha256: z.string(), capturedAt: z.string().datetime() })
    .parse(JSON.parse(await readFile(resolve(captureDirectory, 'capture.json'), 'utf8')));
  const file = `test-results/${target.file}`;
  await checkNativeScreenshot(await readFile(resolve(captureDirectory, 'original.png')), file);
  await copyFile(resolve(captureDirectory, 'original.png'), resolve(root, file));
  const receipt = resolve(root, 'test-results/M15/rendered-artifacts.json');
  const previous = await readFile(receipt, 'utf8')
    .then((text) =>
      z.object({ sourceHash: z.string(), artifacts: z.array(Artifact) }).parse(JSON.parse(text)),
    )
    .catch(() => null);
  const artifacts =
    previous?.sourceHash === sourceHash
      ? previous.artifacts.filter((artifact) => artifact.flow !== name)
      : [];
  artifacts.push({ file, flow: name, flowHash, ...capture });
  await mkdir(resolve(root, 'test-results/M15'), { recursive: true });
  await writeFile(receipt, JSON.stringify({ sourceHash, artifacts }, null, 2) + '\n');
  return { file, sha256: capture.sha256 };
}
