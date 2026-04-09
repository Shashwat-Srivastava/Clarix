import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { dedupeLogFile, restoreLogFile } from './log-reader.js';

const tempRoots = [];

async function createTempDir(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('dedupeLogFile', () => {
  it('removes duplicate lines and creates a .bak backup', async () => {
    const dir = await createTempDir('cpe-dedupe-');
    const filePath = path.join(dir, 'test.log');

    await fs.writeFile(
      filePath,
      [
        '2026-04-09T10:00:00 INFO line one',
        '2026-04-09T10:00:01 INFO line two',
        '2026-04-09T10:00:00 INFO line one',
        '2026-04-09T10:00:02 INFO line three',
        '2026-04-09T10:00:01 INFO line two',
      ].join('\n'),
      'utf8',
    );

    const stats = await dedupeLogFile(filePath);

    expect(stats.duplicatesRemoved).toBe(2);
    expect(stats.totalLines).toBe(5);

    const deduped = await fs.readFile(filePath, 'utf8');
    expect(deduped.split('\n')).toEqual([
      '2026-04-09T10:00:00 INFO line one',
      '2026-04-09T10:00:01 INFO line two',
      '2026-04-09T10:00:02 INFO line three',
    ]);

    // Backup should exist
    const backup = await fs.readFile(`${filePath}.bak`, 'utf8');
    expect(backup.split('\n')).toHaveLength(5);
  });

  it('does not create a backup when there are no duplicates', async () => {
    const dir = await createTempDir('cpe-dedupe-');
    const filePath = path.join(dir, 'unique.log');

    await fs.writeFile(
      filePath,
      ['2026-04-09T10:00:00 INFO a', '2026-04-09T10:00:01 INFO b'].join('\n'),
      'utf8',
    );

    const stats = await dedupeLogFile(filePath);

    expect(stats.duplicatesRemoved).toBe(0);

    // No .bak file should be created
    await expect(fs.access(`${filePath}.bak`)).rejects.toThrow();
  });

  it('treats lines with different thread IDs as distinct', async () => {
    const dir = await createTempDir('cpe-dedupe-');
    const filePath = path.join(dir, 'threads.log');

    await fs.writeFile(
      filePath,
      [
        '2026-03-26T05:10:57 telekom: A006 PARODUS.ERROR [tid=36044] PARODUS: The connection lost',
        '2026-03-26T05:10:57 telekom: A006 PARODUS.ERROR [tid=99999] PARODUS: The connection lost',
      ].join('\n'),
      'utf8',
    );

    const stats = await dedupeLogFile(filePath);

    expect(stats.duplicatesRemoved).toBe(0);

    const content = await fs.readFile(filePath, 'utf8');
    expect(content.split('\n')).toHaveLength(2);
  });

  it('treats lines with different timestamps as distinct', async () => {
    const dir = await createTempDir('cpe-dedupe-');
    const filePath = path.join(dir, 'timestamps.log');

    await fs.writeFile(
      filePath,
      [
        '2026-04-09T10:00:00 INFO same message',
        '2026-04-09T10:00:01 INFO same message',
      ].join('\n'),
      'utf8',
    );

    const stats = await dedupeLogFile(filePath);

    expect(stats.duplicatesRemoved).toBe(0);
  });
});

describe('restoreLogFile', () => {
  it('restores the original file from .bak and removes the backup', async () => {
    const dir = await createTempDir('cpe-restore-');
    const filePath = path.join(dir, 'test.log');

    const originalContent = 'line1\nline1\nline2';
    await fs.writeFile(filePath, originalContent, 'utf8');

    // Dedupe first to create backup
    await dedupeLogFile(filePath);
    const dedupedContent = await fs.readFile(filePath, 'utf8');
    expect(dedupedContent).toBe('line1\nline2');

    // Restore
    const restored = await restoreLogFile(filePath);

    expect(restored).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toBe(originalContent);

    // Backup should be removed
    await expect(fs.access(`${filePath}.bak`)).rejects.toThrow();
  });

  it('returns false when no backup exists', async () => {
    const dir = await createTempDir('cpe-restore-');
    const filePath = path.join(dir, 'no-backup.log');

    await fs.writeFile(filePath, 'content', 'utf8');

    const restored = await restoreLogFile(filePath);
    expect(restored).toBe(false);
  });
});
