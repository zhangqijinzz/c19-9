import { createBlankDocument, createElement, createStarterDocument, analyzeLayout, findElement, getBoundingBox, normalizeRotation } from './domain';
import type { LayoutRepository } from './repository';
import type { Analysis, DocumentIssue, ElementKind, LayoutDocument, LayoutMode, Notice, RenderElement, ViewPhase } from './types';

export interface ExpoSketchState {
  phase: ViewPhase;
  document: LayoutDocument;
  renderElements: RenderElement[];
  selectedId: string | null;
  selectedElement: RenderElement | null;
  mode: LayoutMode;
  analysis: Analysis;
  notice: Notice;
  lastSavedAt: number | null;
  /** 旧存档被自动修复后，逐条展示的修复/丢弃记录 */
  loadIssues: DocumentIssue[];
  /** 存档彻底无法读取时的原因说明 */
  loadError: string | null;
}

const toRenderElements = (document: LayoutDocument): RenderElement[] => document.elements.map((element) => {
  const box = getBoundingBox(element);
  return { ...element, displayWidth: box.width, displayHeight: box.height, occupiedArea: Number((box.width * box.height).toFixed(1)) };
});

const starter = createStarterDocument();
const starterRenderElements = toRenderElements(starter);

type Listener = () => void;

export class ExpoSketchViewModel {
  private listeners = new Set<Listener>();
  private stateValue: ExpoSketchState = {
    phase: 'loading',
    document: starter,
    renderElements: starterRenderElements,
    selectedId: 'stage-1',
    selectedElement: starterRenderElements.find((element) => element.id === 'stage-1') ?? null,
    mode: 'edit',
    analysis: analyzeLayout(createStarterDocument()),
    notice: { tone: 'info', message: '正在恢复最近布局…' },
    lastSavedAt: null,
    loadIssues: [],
    loadError: null,
  };

  constructor(private readonly repository: LayoutRepository) {}

  get state() { return this.stateValue; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    let outcome;
    try {
      outcome = await this.repository.load();
    } catch {
      this.commit({
        phase: 'error',
        loadError: '读取本地存档时发生未预期的错误。',
        notice: { tone: 'error', message: '布局读取失败' },
      });
      return;
    }

    if (outcome.status === 'failed') {
      this.commit({
        phase: 'error',
        loadError: outcome.error,
        loadIssues: outcome.issues ?? [],
        notice: { tone: 'error', message: '布局读取失败' },
      });
      return;
    }

    const document = outcome.document;
    if (outcome.status === 'repaired') {
      const repaired = outcome.issues.filter((issue) => issue.severity === 'repaired').length;
      const dropped = outcome.issues.length - repaired;
      const detail = [`已自动修复 ${repaired} 项`, dropped > 0 ? `跳过 ${dropped} 条无法识别的元素` : null].filter(Boolean).join('，');
      this.commit({
        document,
        selectedId: document.elements[0]?.id ?? null,
        phase: 'ready',
        loadIssues: outcome.issues,
        notice: { tone: 'warning', message: `旧存档存在不完整内容，${detail}，可继续编辑` },
      });
      // 修复后的结构回写，避免下次打开再次出现同样的问题
      this.persistQuietly();
      return;
    }

    this.commit({ document, selectedId: document.elements[0]?.id ?? null, phase: 'ready', notice: { tone: 'success', message: '布局已就绪，可开始编辑' } });
  }

  dismissLoadIssues() {
    this.commit({ loadIssues: [] });
  }

  /** 存档彻底损坏时的入口：清掉坏数据，从空白场地重新开始 */
  async startBlank() {
    await this.restartWith(createBlankDocument(), '已清空损坏的存档，可从空白场地重新开始');
  }

  /** 存档彻底损坏时的入口：清掉坏数据，载入示例布局 */
  async startExample() {
    await this.restartWith(createStarterDocument(), '已清空损坏的存档，载入了示例布局');
  }

  private async restartWith(document: LayoutDocument, message: string) {
    try {
      await this.repository.clear();
    } catch {
      // 即使清理失败也继续：紧接着的保存会把坏存档覆盖掉
    }
    this.commit({
      document,
      selectedId: document.elements[0]?.id ?? null,
      mode: 'edit',
      phase: 'ready',
      loadError: null,
      loadIssues: [],
      notice: { tone: 'success', message },
    });
    this.persistQuietly();
  }

  selectElement(id: string) { this.commit({ selectedId: id }); }

  setMode(mode: LayoutMode) { this.commit({ mode, notice: { tone: 'info', message: mode === 'inspect' ? '检查模式已开启：拖动元素查看即时提示' : mode === 'path' ? '路径模式已开启：入口到重点区域的访问路线已生成' : '编辑模式已开启' } }); }

  addElement(kind: ElementKind) {
    const element = createElement(kind, this.stateValue.document.elements.length, this.stateValue.document.field);
    const document = { ...this.stateValue.document, elements: [...this.stateValue.document.elements, element] };
    this.commitAndPersist({ document, selectedId: element.id, notice: { tone: 'success', message: `${element.name} 已加入场地` } });
  }

  removeSelected() {
    if (!this.stateValue.selectedId) return;
    const removed = findElement(this.stateValue.document, this.stateValue.selectedId);
    const elements = this.stateValue.document.elements.filter((element) => element.id !== this.stateValue.selectedId);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, selectedId: elements[0]?.id ?? null, notice: { tone: 'info', message: `${removed?.name ?? '元素'} 已移除` } });
  }

  moveElement(id: string, x: number, y: number) {
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeSelected(width: number, height: number) {
    const id = this.stateValue.selectedId;
    if (!id || width <= 0 || height <= 0) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  rotateSelected() {
    const id = this.stateValue.selectedId;
    if (!id) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, rotation: normalizeRotation(element.rotation + 90) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'info', message: '方向已旋转 90°' } });
  }

  renameSelected(name: string) {
    const id = this.stateValue.selectedId;
    if (!id || !name.trim()) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, name: name.trim() } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeField(width: number, height: number) {
    if (width < 12 || height < 10) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, field: { width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } }, notice: { tone: 'success', message: '场地尺寸已更新' } });
  }

  renameProject(title: string) {
    if (!title.trim()) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, title: title.trim() } });
  }

  resetExample() {
    const document = createStarterDocument();
    this.commitAndPersist({ document, selectedId: 'stage-1', mode: 'edit', notice: { tone: 'success', message: '已恢复示例布局' } });
  }

  private commitAndPersist(patch: Partial<ExpoSketchState>) {
    this.commit(patch);
    void this.persist();
  }

  private async persistQuietly() {
    try {
      await this.repository.save(this.stateValue.document);
      this.commit({ lastSavedAt: Date.now() });
    } catch {
      // 静默回写失败不打断当前流程，下一次编辑保存时还会重试
    }
  }

  private async persist() {
    try {
      await this.repository.save(this.stateValue.document);
      this.commit({ lastSavedAt: Date.now() });
    } catch {
      this.commit({ notice: { tone: 'error', message: '本地保存失败，当前编辑仍保留在页面中' } });
    }
  }

  private commit(patch: Partial<ExpoSketchState>) {
    const next = { ...this.stateValue, ...patch };
    const renderElements = toRenderElements(next.document);
    this.stateValue = { ...next, renderElements, selectedElement: renderElements.find((element) => element.id === next.selectedId) ?? null, analysis: analyzeLayout(next.document) };
    this.listeners.forEach((listener) => listener());
  }
}
