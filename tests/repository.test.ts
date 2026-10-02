import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

describe('LocalLayoutRepository', () => {
  it('reports damaged JSON as fatal instead of silently resetting', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const result = await repository.load();
    expect(result.document).toEqual(createStarterDocument());
    expect(result.report.status).toBe('fatal');
    expect(result.report.issues[0].message).toContain('无法解析');
    window.localStorage.clear();
  });

  it('repairs an incomplete legacy save and keeps it usable', async () => {
    window.localStorage.setItem('exposketch.document.v1', JSON.stringify({
      version: 1,
      title: '旧同事的存档',
      field: { width: 30, height: 20 },
      elements: [
        { id: 'a', kind: 'booth', x: 1, y: 1, width: 5, height: 3.5, rotation: 0 },
        { id: 'b', kind: 'pillar', name: '立柱', x: 2, y: 2, width: 1, height: 1, rotation: 0 },
      ],
    }));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const result = await repository.load();
    expect(result.report.status).toBe('repaired');
    expect(result.document.title).toBe('旧同事的存档');
    expect(result.document.elements).toHaveLength(1);
    expect(result.document.elements[0].name).toBe('标准展位 1');
    expect(result.report.issues.some((issue) => issue.message.includes('pillar'))).toBe(true);
    window.localStorage.clear();
  });

  it('returns a clean starter document when nothing is stored', async () => {
    window.localStorage.clear();
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const result = await repository.load();
    expect(result.report.status).toBe('clean');
    expect(result.document).toEqual(createStarterDocument());
  });
});
