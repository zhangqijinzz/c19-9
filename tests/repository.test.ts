import { describe, expect, it } from 'vitest';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

const STORAGE_KEY = 'exposketch.document.v1';

describe('LocalLayoutRepository', () => {
  it('reports a failed outcome with a clear reason when persisted JSON is damaged', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const outcome = await repository.load();
    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.error.length).toBeGreaterThan(0);
    }
    window.localStorage.clear();
  });

  it('returns a repaired outcome for documents whose element names are missing', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      title: '旧同事的布局',
      field: { width: 28, height: 18 },
      elements: [{ id: 'b1', kind: 'booth', x: 2, y: 2, width: 5, height: 3.5, rotation: 0 }],
    }));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const outcome = await repository.load();
    expect(outcome.status).toBe('repaired');
    if (outcome.status === 'repaired') {
      expect(outcome.document.elements[0].name).toBe('标准展位 1');
      expect(outcome.issues[0].message).toContain('缺少名称');
    }
    window.localStorage.clear();
  });

  it('returns a repaired outcome and keeps good elements when one element has an unknown kind', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      title: '混合存档',
      field: { width: 28, height: 18 },
      elements: [
        { id: 'legacy', kind: 'foodtruck', name: '旧元素', x: 1, y: 1, width: 3, height: 3, rotation: 0 },
        { id: 'b1', kind: 'booth', name: '标准展位 1', x: 4, y: 4, width: 4, height: 3, rotation: 0 },
      ],
    }));
    const outcome = await new LocalLayoutRepository(new BrowserStorageService()).load();
    expect(outcome.status).toBe('repaired');
    if (outcome.status === 'repaired') {
      expect(outcome.document.elements.map((element) => element.id)).toEqual(['b1']);
      expect(outcome.issues.some((issue) => issue.message.includes('第 1 条'))).toBe(true);
    }
    window.localStorage.clear();
  });

  it('starts from the starter document when nothing is stored', async () => {
    window.localStorage.clear();
    const outcome = await new LocalLayoutRepository(new BrowserStorageService()).load();
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.document.title).toContain('春日创意市集');
    }
  });

  it('clears the persisted document through the storage service', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, title: 'x' }));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    await repository.clear();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
