import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { resolveInputArchivePaths } from './extract.js';

const execFileAsync = promisify(execFile);

describe('resolveInputArchivePaths', () => {
  it('expands zip inputs and collects nested tgz archives alongside direct inputs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cpe-extract-'));

    try {
      const zipSourceRoot = path.join(root, 'zip-source');
      await fs.mkdir(path.join(zipSourceRoot, 'nested'), { recursive: true });
      await fs.writeFile(path.join(zipSourceRoot, 'nested', 'from-zip.tgz'), 'zip-tgz', 'utf8');

      const zipPath = path.join(root, 'archives.zip');
      await execFileAsync('/usr/bin/zip', ['-rq', zipPath, '.'], { cwd: zipSourceRoot });

      const folderRoot = path.join(root, 'folder-input');
      await fs.mkdir(folderRoot, { recursive: true });
      const folderArchivePath = path.join(folderRoot, 'from-folder.tgz');
      await fs.writeFile(folderArchivePath, 'folder-tgz', 'utf8');

      const directArchivePath = path.join(root, 'direct.tgz');
      await fs.writeFile(directArchivePath, 'direct-tgz', 'utf8');

      const archivePaths = await resolveInputArchivePaths(
        [zipPath, folderRoot, directArchivePath],
        path.join(root, 'expanded-inputs'),
      );

      expect(archivePaths).toContain(path.resolve(directArchivePath));
      expect(archivePaths).toContain(path.resolve(folderArchivePath));
      expect(archivePaths.some((archivePath) => archivePath.endsWith(path.join('nested', 'from-zip.tgz')))).toBe(
        true,
      );
      expect(archivePaths).toHaveLength(3);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
