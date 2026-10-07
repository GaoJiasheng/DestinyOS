import { spawn, execFileSync } from 'node:child_process';
import { readdir, mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { launchNativeSourceHash } from '../../../scripts/launch-source-hash.ts';
import { checkNativeScreenshot } from '../../../scripts/launch-screenshots.ts';
import { withNativeExports } from '../../../scripts/launch-native-exports.ts';
// DESIGN-GAP: All native flows run serially on an explicitly selected disposable simulator;
// record each flow and screenshot hash so the M01 smoke cannot stand in for full acceptance.
const root = resolve(import.meta.dirname, '..');
const device = process.env.MAESTRO_DEVICE;
if (!device) throw new Error('Set MAESTRO_DEVICE to a dedicated iPhone 17 Pro simulator UDID.');
const maestro = execFileSync('/usr/bin/which', ['maestro'], { encoding: 'utf8' }).trim();
const nativeEnv = {
  ...process.env,
  PATH: [
    dirname(maestro),
    ...(process.env.JAVA_HOME ? [`${process.env.JAVA_HOME}/bin`] : []),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ].join(':'),
};
const startedAt = new Date().toISOString();
const evidence = resolve(root, 'test-results/launch');
await mkdir(evidence, { recursive: true });
const runRoot = resolve(evidence, `run-${Date.now()}`);
await mkdir(runRoot);
const flows = (await readdir(resolve(root, 'maestro')))
  .filter((name) => name.endsWith('.yaml'))
  .sort((a, b) => {
    const groupA = a.slice(0, 3),
      groupB = b.slice(0, 3);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const rank = (name: string) =>
      name === `${groupA}.yaml`
        ? 0
        : name === 'M05-age.yaml'
          ? 2
          : name === 'M11-widget-gallery.yaml'
            ? 2
            : name === 'M11-lock-widgets.yaml'
              ? 3
              : 1;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
const resume = process.argv.includes('--resume');
const selected = process.argv.slice(2).filter((value) => value !== '--resume');
for (const name of selected)
  if (!flows.includes(`${name}.yaml`)) throw new Error(`Unknown Maestro flow: ${name}`);
// DESIGN-GAP: Resume reuses only successful flows with unchanged tracked runtime/corpus/catalog
// and unchanged YAML; every reused receipt keeps its original timestamp and artifact location.
const sourceHash = await launchNativeSourceHash();
const ReceiptSchema = z.object({
  flow: z.string(),
  passed: z.boolean(),
  flowHash: z.string(),
  checkedAt: z.string(),
  artifacts: z.string(),
  screenshots: z.array(z.object({ file: z.string(), sha256: z.string() })),
});
type Receipt = z.infer<typeof ReceiptSchema>;
const results: Receipt[] = [];
if (resume) {
  const previous = await readFile(resolve(evidence, 'results.json'), 'utf8')
    .then((text) =>
      z.object({ sourceHash: z.string(), results: z.array(ReceiptSchema) }).parse(JSON.parse(text)),
    )
    .catch(() => null);
  if (previous?.sourceHash === sourceHash)
    for (const result of previous.results) {
      const yaml = await readFile(resolve(root, 'maestro', `${result.flow}.yaml`)).catch(
        () => null,
      );
      if (
        result.passed &&
        yaml &&
        result.flowHash === createHash('sha256').update(yaml).digest('hex')
      ) {
        const intact = await Promise.all(
          result.screenshots.map(async (screenshot) => {
            if (!screenshot.file.startsWith('test-results/') || screenshot.file.includes('..'))
              return false;
            const bytes = await readFile(resolve(root, screenshot.file)).catch(() => null);
            return (
              bytes !== null &&
              createHash('sha256').update(bytes).digest('hex') === screenshot.sha256 &&
              (await checkNativeScreenshot(bytes, screenshot.file).then(
                () => true,
                () => false,
              ))
            );
          }),
        );
        if (intact.every(Boolean)) results.push(result);
      }
    }
}
// DESIGN-GAP: M11's fresh install removes pinned widgets; its gallery/lock flows
// must recreate that native system state whenever the notification fixture reruns.
if (resume && !results.some((result) => result.flow === 'M11' && result.passed))
  for (let i = results.length - 1; i >= 0; i--)
    if (['M11-widget-gallery', 'M11-lock-widgets'].includes(results[i]!.flow)) results.splice(i, 1);
async function run(command: string, args: string[], env = process.env): Promise<void> {
  // DESIGN-GAP: Bound native tools and stop an uncaught Maestro main-thread exception;
  // its remaining JVM service threads can otherwise keep a failed flow alive forever.
  const child = spawn(command, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    detached: process.platform !== 'win32',
  });
  let stopping = false;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  function signal(signal: 'SIGINT' | 'SIGTERM') {
    if (!child.pid) return;
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    } catch {
      // The command has already exited.
    }
  }
  function stop() {
    if (stopping) return;
    stopping = true;
    // DESIGN-GAP: simctl recording requires SIGINT to finalize and release its host
    // recorder; reserve SIGTERM for a tool that cannot finish graceful teardown.
    signal('SIGINT');
    forceTimer = setTimeout(() => signal('SIGTERM'), 5000);
  }
  let tail = '';
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    tail = (tail + chunk.toString()).slice(-4000);
    if (tail.includes('Exception in thread "main"')) stop();
  });
  const timer = setTimeout(stop, 20 * 60 * 1000);
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    stop();
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let code: number | null;
  try {
    code = await new Promise<number | null>((done, reject) => {
      child.on('error', reject);
      child.on('close', done);
    });
  } finally {
    clearTimeout(timer);
    if (forceTimer) clearTimeout(forceTimer);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  if (interrupted) process.exit(130);
  if (stopping || code !== 0)
    throw new Error(`${command} ${stopping ? 'was stopped; ' : ''}exited ${code}`);
}
function requireInstalled(active: string) {
  if (process.platform !== 'darwin') return;
  try {
    execFileSync(
      '/usr/bin/xcrun',
      ['simctl', 'get_app_container', active, 'pub.gavin.tianji', 'app'],
      { stdio: 'ignore' },
    );
  } catch {
    throw new Error(
      `Install the native app on the booted dedicated simulator ${active} before running acceptance.`,
    );
  }
}
// DESIGN-GAP: Dedicated development simulators disable Fast Refresh using RN's installed
// RCTDevMenu preference. The global default survives clearState and keeps SDK refresh
// banners out of real screenshots without altering or cropping their pixels.
function prepareDevelopmentSimulator(active: string) {
  for (const domain of ['NSGlobalDomain', 'pub.gavin.tianji'])
    execFileSync('/usr/bin/xcrun', [
      'simctl',
      'spawn',
      active,
      'defaults',
      'write',
      domain,
      'RCTDevMenu',
      '-dict-add',
      'hotLoadingEnabled',
      '-bool',
      'false',
    ]);
}
// DESIGN-GAP: Suspend other dedicated apps during UI flows; shut down their simulators before timed acceptance to exclude SpringBoard/Widget rendering contention.
function quietOthers(active: string, stopSimulators = false) {
  if (process.platform !== 'darwin') return;
  for (const other of new Set([
    device,
    process.env.MAESTRO_AUDIT_DEVICE,
    process.env.MAESTRO_IPHONE_69,
    process.env.MAESTRO_IPHONE_65,
  ])) {
    if (!other || other === active) continue;
    try {
      const args = ['simctl', 'terminate', other, 'pub.gavin.tianji'];
      if (stopSimulators) args.splice(1, 3, 'shutdown', other);
      execFileSync('/usr/bin/xcrun', args, { stdio: 'ignore' });
    } catch {
      // Teardown is already complete if the dedicated simulator or app is stopped.
    }
  }
}
for (const flow of flows) {
  if (selected.length && !selected.includes(flow.replace('.yaml', ''))) continue;
  const name = flow.replace('.yaml', '');
  if (resume && results.some((result) => result.flow === name && result.passed)) {
    console.log(`REUSE ${name}`);
    continue;
  }
  const flowHash = createHash('sha256')
    .update(await readFile(resolve(root, 'maestro', flow)))
    .digest('hex');
  const group = name.split('-')[0]!;
  const flowDevice = ['M02', 'M02-en', 'M14', 'M14-accessibility'].includes(name)
    ? process.env.MAESTRO_AUDIT_DEVICE
    : device;
  if (!flowDevice)
    throw new Error(
      'Set MAESTRO_AUDIT_DEVICE to a simulator with the Release audit build installed.',
    );
  const directory = resolve(runRoot, name);
  await mkdir(directory);
  const screenshots: { file: string; sha256: string }[] = [];
  let passed = false;
  try {
    console.log(`START ${name}`);
    quietOthers(flowDevice);
    requireInstalled(flowDevice);
    if (flowDevice !== process.env.MAESTRO_AUDIT_DEVICE) prepareDevelopmentSimulator(flowDevice);
    // DESIGN-GAP: Restart only the dedicated app process so a failed diagnostic screen
    // cannot leak in-memory navigation into the next flow; encrypted data remains intact.
    try {
      execFileSync('/usr/bin/xcrun', ['simctl', 'terminate', flowDevice, 'pub.gavin.tianji'], {
        stdio: 'ignore',
      });
    } catch {
      // A stopped app already has the required clean process state.
    }
    if (name === 'M14-accessibility')
      await run('/usr/bin/xcrun', [
        'simctl',
        'ui',
        flowDevice,
        'content_size',
        'accessibility-extra-extra-extra-large',
      ]);
    const exportContext = { root, directory, name, flowDevice, sourceHash, flowHash };
    const exported = await withNativeExports(exportContext, async () => {
      if (name === 'M02' || name === 'M04') {
        await run(
          '/bin/bash',
          [`scripts/${name.toLowerCase()}-simulator.sh`, flowDevice],
          nativeEnv,
        );
        if (name === 'M02') await run('/usr/bin/python3', ['scripts/m02-delivery.py', flowDevice]);
      } else if (name === 'M14' || name === 'M14-accessibility') {
        await run('/bin/bash', ['scripts/m14-simulator.sh', flowDevice, name], nativeEnv);
      } else if (name === 'M15') {
        // DESIGN-GAP: Store baselines cover both documented iPhone sizes and every catalog locale.
        for (const [size, udid] of [
          ['iphone-6.9', process.env.MAESTRO_IPHONE_69],
          ['iphone-6.5', process.env.MAESTRO_IPHONE_65],
        ] as const) {
          if (!udid) throw new Error(`Missing simulator for ${size}`);
          for (const locale of ['zh', 'en', 'zh-TW']) {
            quietOthers(udid);
            requireInstalled(udid);
            prepareDevelopmentSimulator(udid);
            await run('/bin/bash', ['scripts/m15-simulator.sh', udid, size, locale], nativeEnv);
          }
        }
      } else {
        await run(
          maestro,
          [
            '--device',
            flowDevice,
            'test',
            `maestro/${flow}`,
            '-e',
            'M05_DEV=1',
            '--test-output-dir',
            directory,
            '--no-ansi',
          ],
          nativeEnv,
        );
      }
    });
    if (exported) screenshots.push(exported);
    const baselineDirectory = resolve(root, 'test-results', group);
    await mkdir(baselineDirectory, { recursive: true });
    for (const file of await readdir(directory, { recursive: true })) {
      if (!file.endsWith('.png') || !file.includes('takeScreenshot/')) continue;
      const bytes = await readFile(resolve(directory, file));
      await checkNativeScreenshot(bytes, file);
      const target = resolve(baselineDirectory, file.split('/').at(-1)!);
      await copyFile(resolve(directory, file), target);
      screenshots.push({
        file: target.slice(root.length + 1),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    if (['M02', 'M04', 'M14', 'M14-accessibility', 'M15'].includes(name)) {
      const names = new Set(
        [
          ...(await readFile(resolve(root, 'maestro', flow), 'utf8')).matchAll(
            /takeScreenshot:\s*([^\s]+)/g,
          ),
        ].map((match) => `${match[1]}.png`),
      );
      for (const file of await readdir(baselineDirectory, { recursive: true })) {
        if (
          !file.endsWith('.png') ||
          !names.has(file.split('/').at(-1)!) ||
          (name !== 'M15' && file.includes('/')) ||
          (name === 'M15' && !file.startsWith('raw/'))
        )
          continue;
        const target = resolve(baselineDirectory, file);
        await checkNativeScreenshot(await readFile(target), file);
        screenshots.push({
          file: target.slice(root.length + 1),
          sha256: createHash('sha256')
            .update(await readFile(target))
            .digest('hex'),
        });
      }
    }
    if (!screenshots.length) throw new Error(`No screenshots published by ${name}`);
    passed = true;
  } catch (error) {
    console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (name === 'M14-accessibility')
      execFileSync('/usr/bin/xcrun', ['simctl', 'ui', flowDevice, 'content_size', 'large']);
  }
  results.push({
    flow: name,
    passed,
    screenshots,
    flowHash,
    checkedAt: new Date().toISOString(),
    artifacts: directory.slice(root.length + 1),
  });
  await writeReceipt();
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) {
    process.exitCode = 1;
  }
}
// DESIGN-GAP: A full resume may reuse every flow; finalize its receipt even when
// no new flow ran, while a selected diagnostic run remains explicitly incomplete.
if (
  !selected.length &&
  results.length === flows.length &&
  results.every((result) => result.passed)
) {
  const auditDevice = process.env.MAESTRO_AUDIT_DEVICE!;
  quietOthers(auditDevice, true);
  for (const script of ['m14-cold-start', 'm14-performance'])
    await run('/usr/bin/python3', [`scripts/${script}.py`, auditDevice, 'test-results/M14']);
}
await writeReceipt();
if (!selected.length && results.every((result) => result.passed))
  await copyFile(
    resolve(evidence, 'results.json'),
    resolve(root, 'test-results/M15/launch-verification.json'),
  );
if (results.some((result) => !result.passed)) process.exitCode = 1;
async function writeReceipt() {
  await writeFile(
    resolve(evidence, 'results.json'),
    JSON.stringify(
      {
        startedAt,
        checkedAt: new Date().toISOString(),
        device,
        sourceHash,
        complete: selected.length === 0 && results.length === flows.length,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
