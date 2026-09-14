// tests/mocks.test.js
import { describe, it, expect } from 'vitest';
import mockFs from '../js/mocks/fs-extra.js';

describe('mocks/fs-extra', () => {
  it('exports a proxy object', () => {
    expect(mockFs).toBeDefined();
    expect(typeof mockFs).toBe('object');
  });

  it('returns a noop function for any property access', async () => {
    expect(typeof mockFs.readFile).toBe('function');
    expect(typeof mockFs.writeFile).toBe('function');
    expect(typeof mockFs.ensureDir).toBe('function');
    expect(typeof mockFs.nonExistentMethod).toBe('function');

    const result = await mockFs.readFile('/path/to/file');
    expect(result).toBeUndefined();
  });

  it('resolves promises cleanly when calling arbitrary fs methods', async () => {
    await expect(mockFs.outputFile('test.txt', 'data')).resolves.toBeUndefined();
    await expect(mockFs.remove('test.txt')).resolves.toBeUndefined();
  });
});

