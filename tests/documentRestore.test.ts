import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { restoreDocument } from '../src/documentRestore';

describe('restoreDocument', () => {
  it('passes a healthy document through untouched', () => {
    const healthy = JSON.parse(JSON.stringify(createStarterDocument())) as unknown;
    const { document, report } = restoreDocument(healthy);
    expect(report.status).toBe('clean');
    expect(report.issues).toHaveLength(0);
    expect(document).toEqual(createStarterDocument());
  });

  it('fills missing element names with kind-based defaults', () => {
    const raw = { version: 1, title: '旧存档', field: { width: 20, height: 12 }, elements: [{ id: 'b1', kind: 'booth', x: 1, y: 2, width: 5, height: 3.5, rotation: 0 }] };
    const { document, report } = restoreDocument(raw);
    expect(report.status).toBe('repaired');
    expect(document?.elements[0].name).toBe('标准展位 1');
    expect(report.issues.some((issue) => issue.path === 'elements[0].name')).toBe(true);
  });

  it('drops elements with unknown kinds and says which one and why', () => {
    const raw = {
      version: 1,
      title: 'x',
      field: { width: 20, height: 12 },
      elements: [
        { id: 'ok', kind: 'stage', name: '舞台', x: 1, y: 1, width: 8, height: 4, rotation: 0 },
        { id: 'bad', kind: 'pillar', name: '立柱', x: 2, y: 2, width: 1, height: 1, rotation: 0 },
      ],
    };
    const { document, report } = restoreDocument(raw);
    expect(document?.elements).toHaveLength(1);
    expect(document?.elements[0].id).toBe('ok');
    const issue = report.issues.find((item) => item.path === 'elements[1].kind');
    expect(issue?.message).toContain('pillar');
    expect(issue?.message).toContain('第 2 个元素');
  });

  it('repairs invalid sizes, positions and rotations with defaults', () => {
    const raw = { version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ id: 'e', kind: 'seating', name: '座席', x: Number.NaN, y: 'three', width: -2, height: 0, rotation: 45 }] };
    const { document, report } = restoreDocument(raw);
    const element = document?.elements[0];
    expect(element?.width).toBe(6);
    expect(element?.height).toBe(3);
    expect(Number.isFinite(element?.x)).toBe(true);
    expect(Number.isFinite(element?.y)).toBe(true);
    expect(element?.rotation).toBe(90);
    expect(report.issues.filter((issue) => issue.path.startsWith('elements[0]')).length).toBeGreaterThanOrEqual(5);
  });

  it('deduplicates repeated element ids', () => {
    const make = (name: string) => ({ id: 'same', kind: 'booth', name, x: 1, y: 1, width: 5, height: 3.5, rotation: 0 });
    const { document, report } = restoreDocument({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [make('甲'), make('乙')] });
    const ids = document?.elements.map((element) => element.id);
    expect(new Set(ids).size).toBe(2);
    expect(report.issues.some((issue) => issue.message.includes('重复'))).toBe(true);
  });

  it('falls back to the default field when the field size is broken', () => {
    const { document, report } = restoreDocument({ version: 1, title: 'x', field: { width: 0, height: 'big' }, elements: [] });
    expect(document?.field).toEqual({ width: 28, height: 18 });
    expect(report.status).toBe('repaired');
  });

  it('repairs a missing version number instead of rejecting the save', () => {
    const raw = { title: '无版本存档', field: { width: 20, height: 12 }, elements: [] };
    const { document, report } = restoreDocument(raw);
    expect(document?.version).toBe(1);
    expect(report.issues.some((issue) => issue.path === 'version')).toBe(true);
  });

  it('flags an incompatible version as fatal with a clear message', () => {
    const { document, report } = restoreDocument({ version: 2, title: 'x', field: { width: 20, height: 12 }, elements: [] });
    expect(document).toBeNull();
    expect(report.status).toBe('fatal');
    expect(report.issues[0].message).toContain('版本');
  });

  it('flags non-object payloads as fatal', () => {
    const { document, report } = restoreDocument('not a document');
    expect(document).toBeNull();
    expect(report.status).toBe('fatal');
    expect(report.issues[0].message).toContain('无法恢复');
  });
});
