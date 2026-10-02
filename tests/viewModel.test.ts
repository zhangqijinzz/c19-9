import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { DocumentReport, LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const CLEAN_REPORT: DocumentReport = { status: 'clean', issues: [] };

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => ({ document: initial ?? createStarterDocument(), report: CLEAN_REPORT })),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('enters the error phase with details when the stored document is unreadable', async () => {
    const report: DocumentReport = { status: 'fatal', issues: [{ path: 'version', message: '存档版本（2）与当前版本（v1）不兼容，无法打开' }] };
    const repository: LayoutRepository = { load: vi.fn(async () => ({ document: createStarterDocument(), report })), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.loadReport.issues[0].message).toContain('版本');
  });

  it('offers a working restart from the error state', async () => {
    const report: DocumentReport = { status: 'fatal', issues: [{ path: 'storage', message: '存档数据损坏，无法解析（不是有效的 JSON）' }] };
    const repository: LayoutRepository = { load: vi.fn(async () => ({ document: createStarterDocument(), report })), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    vm.resetExample();
    expect(vm.state.phase).toBe('ready');
    expect(vm.state.loadReport.status).toBe('clean');
    expect(repository.save).toHaveBeenCalled();
  });

  it('keeps editing possible after repairing an incomplete save', async () => {
    const report: DocumentReport = { status: 'repaired', issues: [{ path: 'elements[0].name', message: '第 1 个元素（标准展位）缺少名称，已命名为「标准展位 1」' }] };
    const repository: LayoutRepository = { load: vi.fn(async () => ({ document: createStarterDocument(), report })), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    expect(vm.state.notice.tone).toBe('warning');
    expect(vm.state.loadReport.issues).toHaveLength(1);
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => ({ document: createStarterDocument(), report: CLEAN_REPORT })), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });
});
