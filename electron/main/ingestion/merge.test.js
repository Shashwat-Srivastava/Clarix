import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveOutputFilename, mergeAllComponents } from './merge.js';

const tempRoots = [];

async function createTempDir(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('deriveOutputFilename', () => {
  it('removes timestamp-prefixed filenames', () => {
    expect(deriveOutputFilename('2026-02-05-23-46-22_telemetry2_0.txt')).toBe('telemetry2_0.txt');
  });

  it('keeps untouched filenames without timestamp prefix', () => {
    expect(deriveOutputFilename('wanmanager.txt')).toBe('wanmanager.txt');
  });
});

describe('mergeAllComponents', () => {
  it('appends component files in archive order with merge markers', async () => {
    const root = await createTempDir('cpe-merge-');
    const archiveA = path.join(root, 'archive-a');
    const archiveB = path.join(root, 'archive-b');
    const output = path.join(root, 'merged');

    await fs.mkdir(archiveA, { recursive: true });
    await fs.mkdir(archiveB, { recursive: true });

    await fs.writeFile(path.join(archiveA, 'wanmanager.txt'), 'A1\n', 'utf8');
    await fs.writeFile(path.join(archiveB, 'wanmanager.txt'), 'B1\n', 'utf8');
    await fs.writeFile(path.join(archiveA, '2026-02-05-23-46-22_telemetry2_0.txt'), '{"a":1}', 'utf8');
    await fs.writeFile(path.join(archiveB, '2026-02-05-23-46-22_telemetry2_0.txt'), '{"a":2}', 'utf8');

    await mergeAllComponents(
      [
        { archivePath: 'archive-a.tgz', archiveName: 'archive-a.tgz', logPath: archiveA },
        { archivePath: 'archive-b.tgz', archiveName: 'archive-b.tgz', logPath: archiveB },
      ],
      output,
    );

    const mergedWan = await fs.readFile(path.join(output, 'wanmanager.txt'), 'utf8');
    const mergedTelemetry = await fs.readFile(path.join(output, 'telemetry2_0.txt'), 'utf8');

    expect(mergedWan).toContain('****Merging');
    expect(mergedWan).toContain('A1');
    expect(mergedWan).toContain('B1');

    expect(mergedTelemetry).toContain('{"a":1}');
    expect(mergedTelemetry).toContain('{"a":2}');
  });
});
