import { ELEMENT_SPECS, normalizeRotation } from './domain';
import type { DocumentIssue, DocumentReport, ElementKind, ExpoElement, FieldSize, LayoutDocument } from './types';

export interface RestoreResult {
  document: LayoutDocument | null;
  report: DocumentReport;
}

const ELEMENT_KINDS: readonly ElementKind[] = ['booth', 'stage', 'seating', 'entrance'];

const DEFAULT_FIELD: FieldSize = { width: 28, height: 18 };
const DEFAULT_TITLE = '未命名项目';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const fallbackPosition = (index: number) => Number((0.5 + (index % 5) * 0.8).toFixed(1));

const fatal = (path: string, message: string): RestoreResult => ({ document: null, report: { status: 'fatal', issues: [{ path, message }] } });

export const restoreDocument = (raw: unknown): RestoreResult => {
  if (!isRecord(raw)) return fatal('root', '存档内容不是有效的布局数据，无法恢复');

  const issues: DocumentIssue[] = [];

  if (raw.version === undefined || raw.version === null) {
    issues.push({ path: 'version', message: '缺少版本号，已按 v1 格式处理' });
  } else if (raw.version !== 1) {
    return fatal('version', `存档版本（${String(raw.version)}）与当前版本（v1）不兼容，无法打开`);
  }

  let title = DEFAULT_TITLE;
  if (typeof raw.title === 'string' && raw.title.trim()) {
    title = raw.title;
  } else {
    issues.push({ path: 'title', message: `项目名称缺失或无效，已使用默认名称「${DEFAULT_TITLE}」` });
  }

  const field = restoreField(raw.field, issues);
  const elements = restoreElements(raw.elements, issues);

  return {
    document: { version: 1, title, field, elements },
    report: { status: issues.length > 0 ? 'repaired' : 'clean', issues },
  };
};

const restoreField = (rawField: unknown, issues: DocumentIssue[]): FieldSize => {
  if (!isRecord(rawField)) {
    issues.push({ path: 'field', message: `场地尺寸缺失或无效，已使用默认场地 ${DEFAULT_FIELD.width} × ${DEFAULT_FIELD.height} m` });
    return { ...DEFAULT_FIELD };
  }
  let { width, height } = DEFAULT_FIELD;
  if (isFiniteNumber(rawField.width) && rawField.width > 0) {
    width = rawField.width;
  } else {
    issues.push({ path: 'field.width', message: `场地宽度无效，已使用默认值 ${DEFAULT_FIELD.width} m` });
  }
  if (isFiniteNumber(rawField.height) && rawField.height > 0) {
    height = rawField.height;
  } else {
    issues.push({ path: 'field.height', message: `场地深度无效，已使用默认值 ${DEFAULT_FIELD.height} m` });
  }
  return { width, height };
};

const restoreElements = (rawElements: unknown, issues: DocumentIssue[]): ExpoElement[] => {
  if (rawElements === undefined || rawElements === null) {
    issues.push({ path: 'elements', message: '缺少元素列表，已按空场地处理' });
    return [];
  }
  if (!Array.isArray(rawElements)) {
    issues.push({ path: 'elements', message: '元素列表数据无效，已按空场地处理' });
    return [];
  }
  const elements: ExpoElement[] = [];
  const usedIds = new Set<string>();
  rawElements.forEach((rawElement, index) => {
    const element = restoreElement(rawElement, index, usedIds, issues);
    if (element) elements.push(element);
  });
  return elements;
};

const restoreElement = (rawElement: unknown, index: number, usedIds: Set<string>, issues: DocumentIssue[]): ExpoElement | null => {
  const label = `第 ${index + 1} 个元素`;
  const at = (key: string) => `elements[${index}].${key}`;

  if (!isRecord(rawElement)) {
    issues.push({ path: `elements[${index}]`, message: `${label}的数据损坏，已跳过` });
    return null;
  }

  const kind = ELEMENT_KINDS.find((candidate) => candidate === rawElement.kind);
  if (!kind) {
    const reason = rawElement.kind === undefined || rawElement.kind === null ? '缺少类型' : `类型「${String(rawElement.kind)}」无法识别`;
    issues.push({ path: at('kind'), message: `${label}${reason}，已跳过该元素` });
    return null;
  }

  const spec = ELEMENT_SPECS[kind];
  const tag = `${label}（${spec.label}）`;

  let id = typeof rawElement.id === 'string' && rawElement.id.trim() ? rawElement.id : '';
  if (!id) {
    id = `restored-${index + 1}`;
    issues.push({ path: at('id'), message: `${tag}缺少 ID，已自动生成「${id}」` });
  }
  if (usedIds.has(id)) {
    const deduped = `${id}-copy-${index + 1}`;
    issues.push({ path: at('id'), message: `${tag}的 ID「${id}」重复，已改为「${deduped}」` });
    id = deduped;
  }
  usedIds.add(id);

  let name = typeof rawElement.name === 'string' && rawElement.name.trim() ? rawElement.name : '';
  if (!name) {
    name = `${spec.label} ${index + 1}`;
    issues.push({ path: at('name'), message: `${tag}缺少名称，已命名为「${name}」` });
  }

  let x = fallbackPosition(index);
  if (isFiniteNumber(rawElement.x)) {
    x = rawElement.x;
  } else {
    issues.push({ path: at('x'), message: `${tag}的横坐标缺失或无效，已移回场地内` });
  }

  let y = fallbackPosition(index);
  if (isFiniteNumber(rawElement.y)) {
    y = rawElement.y;
  } else {
    issues.push({ path: at('y'), message: `${tag}的纵坐标缺失或无效，已移回场地内` });
  }

  let width = spec.width;
  if (isFiniteNumber(rawElement.width) && rawElement.width > 0) {
    width = rawElement.width;
  } else {
    issues.push({ path: at('width'), message: `${tag}的宽度无效，已按「${spec.label}」默认尺寸修复` });
  }

  let height = spec.height;
  if (isFiniteNumber(rawElement.height) && rawElement.height > 0) {
    height = rawElement.height;
  } else {
    issues.push({ path: at('height'), message: `${tag}的深度无效，已按「${spec.label}」默认尺寸修复` });
  }

  let rotation = 0;
  if (isFiniteNumber(rawElement.rotation)) {
    rotation = normalizeRotation(rawElement.rotation);
    if (rotation !== rawElement.rotation) {
      issues.push({ path: at('rotation'), message: `${tag}的旋转角度（${rawElement.rotation}°）不是 90° 的倍数，已校正为 ${rotation}°` });
    }
  } else if (rawElement.rotation !== undefined) {
    issues.push({ path: at('rotation'), message: `${tag}的旋转角度无效，已重置为 0°` });
  }

  return { id, kind, name, x, y, width, height, rotation };
};
