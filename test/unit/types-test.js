import {it} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

it('type-checks consumers of the public package entry points', () => {
  const {status, stdout, stderr, error} = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../node_modules/typescript/bin/tsc', import.meta.url),
      ),
      '--project',
      fileURLToPath(new URL('../types/tsconfig.json', import.meta.url)),
    ],
    {encoding: 'utf8'},
  );

  assert.equal(status, 0, error?.message || stdout + stderr);
});
