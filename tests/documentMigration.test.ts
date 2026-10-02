import { describe, expect, it } from 'vitest';
import { migrateDocument } from '../src/documentMigration';
import type { LayoutDocument } from '../src/types';

const validDocument = (): LayoutDocument => ({
  version: 1,
  title: '测试布局',
  field: { width: 28, height: 18 },
  elements: [
    { id: 'b1', kind: 'booth', name: '展位一', x: 2, y: 2, width: 5, height: 3.5, rotation: 0 },
  ],
});

describe('migrateDocument', () => {
  it('passes through a complete document without issues', () => {
    const result = migrateDocument(validDocument());
    expect(result.fatal).toBeUndefined();
    expect(result.issues).toEqual([]);
    expect(result.document).toEqual(validDocument());
  });

  it('fills a missing element name with a default based on its kind', () => {
    const source = validDocument();
    delete (source.elements[0] as Partial<{ name: string }>).name;
    const result = migrateDocument(source);
    expect(result.document?.elements[0].name).toBe('标准展位 1');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('repaired');
    expect(result.issues[0].message).toContain('缺少名称');
    expect(result.issues[0].index).toBe(1);
  });

  it('fills other missing element fields (id, position, size, rotation) with defaults', () => {
    const source = {
      version: 1,
      title: 'x',
      field: { width: 28, height: 18 },
      elements: [{ kind: 'stage', name: '舞台' }],
    };
    const result = migrateDocument(source);
    const element = result.document?.elements[0];
    expect(element).toMatchObject({ kind: 'stage', name: '舞台', x: 0.5, y: 0.5, width: 8, height: 4, rotation: 0 });
    expect(element?.id).toMatch(/^stage-restored-1$/);
    expect(result.issues.filter((issue) => issue.scope === 'element')).toHaveLength(6);
  });

  it('drops a single element with an unknown kind but keeps the rest usable', () => {
    const source = {
      version: 1,
      title: 'x',
      field: { width: 28, height: 18 },
      elements: [
        { id: 'old-1', kind: 'foodtruck', name: '旧版餐车', x: 1, y: 1, width: 4, height: 4, rotation: 0 },
        { id: 'b1', kind: 'booth', name: '展位', x: 3, y: 3, width: 4, height: 3, rotation: 0 },
      ],
    };
    const result = migrateDocument(source);
    expect(result.document?.elements).toHaveLength(1);
    expect(result.document?.elements[0].id).toBe('b1');
    const dropped = result.issues.filter((issue) => issue.severity === 'dropped');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].message).toContain('第 1 条');
    expect(dropped[0].message).toContain('foodtruck');
  });

  it('reports the precise ordinal of each unreadable entry', () => {
    const source = {
      version: 1,
      title: 'x',
      field: { width: 28, height: 18 },
      elements: [
        { id: 'b1', kind: 'booth', name: '好的', x: 1, y: 1, width: 4, height: 3, rotation: 0 },
        null,
        'not-an-element',
      ],
    };
    const result = migrateDocument(source);
    expect(result.document?.elements).toHaveLength(1);
    const dropped = result.issues.filter((issue) => issue.severity === 'dropped');
    expect(dropped.map((issue) => issue.index)).toEqual([2, 3]);
    expect(dropped[0].message).toContain('第 2 条');
  });

  it('repairs missing title and field instead of discarding the archive', () => {
    const result = migrateDocument({ version: 1, elements: validDocument().elements });
    expect(result.document?.title).toBe('未命名布局');
    expect(result.document?.field).toEqual({ width: 28, height: 18 });
    expect(result.issues.some((issue) => issue.message.includes('布局名称'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('场地尺寸'))).toBe(true);
  });

  it('clamps field dimensions below the allowed minimum', () => {
    const result = migrateDocument({ version: 1, title: 'x', field: { width: 2, height: 3 }, elements: [] });
    expect(result.document?.field).toEqual({ width: 12, height: 10 });
  });

  it('normalises an unknown version but still attempts the migration', () => {
    const result = migrateDocument({ ...validDocument(), version: 9 });
    expect(result.document?.version).toBe(1);
    expect(result.issues[0].message).toContain('版本为 9');
  });

  it('de-duplicates repeated element ids', () => {
    const elements = [
      { id: 'dup', kind: 'booth', name: '甲', x: 1, y: 1, width: 3, height: 3, rotation: 0 },
      { id: 'dup', kind: 'stage', name: '乙', x: 6, y: 6, width: 4, height: 4, rotation: 0 },
    ];
    const result = migrateDocument({ version: 1, title: 'x', field: { width: 28, height: 18 }, elements });
    expect(result.document?.elements.map((element) => element.id)).toEqual(['dup', 'dup-2']);
    expect(result.issues.some((issue) => issue.message.includes('重复'))).toBe(true);
  });

  it('is fatal when the root value is not an object', () => {
    const result = migrateDocument('just a string');
    expect(result.document).toBeNull();
    expect(result.fatal).toBeTruthy();
  });

  it('is fatal when the elements list is missing entirely', () => {
    const result = migrateDocument({ version: 1, title: 'x', field: { width: 28, height: 18 } });
    expect(result.document).toBeNull();
    expect(result.fatal).toContain('elements');
  });

  it('is fatal with a clear reason when every element fails to read', () => {
    const result = migrateDocument({
      version: 1,
      title: 'x',
      field: { width: 28, height: 18 },
      elements: [{ id: 'a', kind: 'ufo' }, 42],
    });
    expect(result.document).toBeNull();
    expect(result.fatal).toContain('全部无法识别');
    expect(result.issues.filter((issue) => issue.severity === 'dropped')).toHaveLength(2);
  });

  it('treats an empty elements list as a valid blank layout', () => {
    const result = migrateDocument({ version: 1, title: '空白', field: { width: 20, height: 12 }, elements: [] });
    expect(result.fatal).toBeUndefined();
    expect(result.document?.elements).toEqual([]);
  });
});
