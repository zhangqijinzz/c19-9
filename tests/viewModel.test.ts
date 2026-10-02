import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument, LoadOutcome } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const okOutcome = (document: LayoutDocument): LoadOutcome => ({ status: 'ok', document });

const fakeRepository = (outcome: LoadOutcome = okOutcome(createStarterDocument())): LayoutRepository => ({
  load: vi.fn(async () => outcome),
  save: vi.fn(async (_document) => {}),
  clear: vi.fn(async () => {}),
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

  it('updates analysis immediately after moving an element into an overlap', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('enters the error phase with a reason when loading fails', async () => {
    const repository: LayoutRepository = {
      load: vi.fn(async (): Promise<LoadOutcome> => ({ status: 'failed', error: '存档中缺少元素列表（elements 字段缺失或格式不是数组），无法识别为布局文件。' })),
      save: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.loadError).toContain('elements');
  });

  it('opens a repaired document, exposes per-issue messages and rewrites it', async () => {
    const repaired: LoadOutcome = {
      status: 'repaired',
      document: {
        version: 1,
        title: '旧同事的布局',
        field: { width: 28, height: 18 },
        elements: [{ id: 'b1', kind: 'booth', name: '标准展位 1', x: 2, y: 2, width: 5, height: 3.5, rotation: 0 }],
      },
      issues: [{ scope: 'element', index: 1, elementId: 'b1', severity: 'repaired', message: '第 1 条展位（b1）缺少名称，已按类型补为「标准展位 1」' }],
    };
    const save = vi.fn(async () => {});
    const repository: LayoutRepository = { load: vi.fn(async () => repaired), save, clear: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    expect(vm.state.document.elements[0].name).toBe('标准展位 1');
    expect(vm.state.loadIssues).toHaveLength(1);
    expect(vm.state.notice.tone).toBe('warning');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(save).toHaveBeenCalledTimes(1);
    vm.dismissLoadIssues();
    expect(vm.state.loadIssues).toEqual([]);
  });

  it('offers a fresh start from the error phase by clearing storage and loading a blank document', async () => {
    const clear = vi.fn(async () => {});
    const repository: LayoutRepository = {
      load: vi.fn(async (): Promise<LoadOutcome> => ({ status: 'failed', error: '坏了' })),
      save: vi.fn(async () => {}),
      clear,
    };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    await vm.startBlank();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(vm.state.phase).toBe('ready');
    expect(vm.state.document.elements).toEqual([]);
    expect(vm.state.loadError).toBeNull();
  });

  it('also offers the example layout as a restart entry point', async () => {
    const clear = vi.fn(async () => {});
    const repository: LayoutRepository = {
      load: vi.fn(async (): Promise<LoadOutcome> => ({ status: 'failed', error: '坏了' })),
      save: vi.fn(async () => {}),
      clear,
    };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    await vm.startExample();
    expect(vm.state.phase).toBe('ready');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = {
      load: vi.fn(async () => okOutcome(createStarterDocument())),
      save: vi.fn(async () => { throw new Error('quota'); }),
      clear: vi.fn(async () => {}),
    };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });
});
