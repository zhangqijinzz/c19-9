import { ELEMENT_SPECS, normalizeRotation } from './domain';
import type { DocumentIssue, ElementKind, ExpoElement, LayoutDocument } from './types';

const ELEMENT_KINDS: ElementKind[] = ['booth', 'stage', 'seating', 'entrance'];
const KIND_LABELS: Record<ElementKind, string> = {
  booth: '展位',
  stage: '舞台',
  seating: '座席',
  entrance: '入口',
};

const DEFAULT_TITLE = '未命名布局';
const DEFAULT_FIELD = { width: 28, height: 18 };
const MIN_FIELD_WIDTH = 12;
const MIN_FIELD_HEIGHT = 10;
const MAX_FIELD_SIDE = 200;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isElementKind = (value: unknown): value is ElementKind =>
  typeof value === 'string' && (ELEMENT_KINDS as string[]).includes(value);

export interface MigrationResult {
  document: LayoutDocument | null;
  issues: DocumentIssue[];
  /** 文档级致命错误：存在时整个存档无法打开 */
  fatal?: string;
}

const migrateField = (raw: unknown, issues: DocumentIssue[]): { width: number; height: number } => {
  const field = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!field) {
    issues.push({ scope: 'document', severity: 'repaired', message: '缺少场地尺寸信息，已按默认场地 28 × 18 m 补全' });
    return { ...DEFAULT_FIELD };
  }
  if (!isFiniteNumber(field.width)) {
    issues.push({ scope: 'document', severity: 'repaired', message: '场地宽度缺失或不是数字，已按默认值 28 m 补全' });
  }
  if (!isFiniteNumber(field.height)) {
    issues.push({ scope: 'document', severity: 'repaired', message: '场地深度缺失或不是数字，已按默认值 18 m 补全' });
  }
  let width = isFiniteNumber(field.width) ? field.width : DEFAULT_FIELD.width;
  let height = isFiniteNumber(field.height) ? field.height : DEFAULT_FIELD.height;
  if (width < MIN_FIELD_WIDTH) {
    issues.push({ scope: 'document', severity: 'repaired', message: `场地宽度 ${width} m 小于允许的最小值，已调整为 ${MIN_FIELD_WIDTH} m` });
    width = MIN_FIELD_WIDTH;
  }
  if (height < MIN_FIELD_HEIGHT) {
    issues.push({ scope: 'document', severity: 'repaired', message: `场地深度 ${height} m 小于允许的最小值，已调整为 ${MIN_FIELD_HEIGHT} m` });
    height = MIN_FIELD_HEIGHT;
  }
  if (width > MAX_FIELD_SIDE) {
    issues.push({ scope: 'document', severity: 'repaired', message: `场地宽度 ${width} m 超出上限，已调整为 ${MAX_FIELD_SIDE} m` });
    width = MAX_FIELD_SIDE;
  }
  if (height > MAX_FIELD_SIDE) {
    issues.push({ scope: 'document', severity: 'repaired', message: `场地深度 ${height} m 超出上限，已调整为 ${MAX_FIELD_SIDE} m` });
    height = MAX_FIELD_SIDE;
  }
  return { width, height };
};

const defaultName = (kind: ElementKind, index: number) => `${ELEMENT_SPECS[kind].label} ${index + 1}`;

const migrateElement = (raw: unknown, index: number, usedIds: Set<string>, issues: DocumentIssue[]): ExpoElement | null => {
  const ordinal = `第 ${index + 1} 条`;
  if (!raw || typeof raw !== 'object') {
    issues.push({ scope: 'element', index: index + 1, severity: 'dropped', message: `${ordinal}内容不是有效的元素对象，无法读取，已跳过` });
    return null;
  }
  const source = raw as Record<string, unknown>;

  if (!isElementKind(source.kind)) {
    const shown = source.kind === undefined ? '（缺失）' : `「${String(source.kind)}」`;
    issues.push({ scope: 'element', index: index + 1, severity: 'dropped', message: `${ordinal}元素的类型 ${shown} 无法识别（当前支持：展位 / 舞台 / 座席 / 入口），已跳过` });
    return null;
  }
  const kind: ElementKind = source.kind;
  const spec = ELEMENT_SPECS[kind];

  let id = typeof source.id === 'string' && source.id.trim() ? source.id : null;
  if (!id) {
    id = `${kind}-restored-${index + 1}`;
    issues.push({ scope: 'element', index: index + 1, severity: 'repaired', message: `${ordinal}${KIND_LABELS[kind]}缺少 ID，已补为 ${id}` });
  }
  if (usedIds.has(id)) {
    const original = id;
    let suffix = 2;
    while (usedIds.has(`${original}-${suffix}`)) suffix += 1;
    id = `${original}-${suffix}`;
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}元素的 ID ${original} 与前面的元素重复，已改为 ${id}` });
  }
  usedIds.add(id);

  let name: string;
  if (typeof source.name !== 'string' || !source.name.trim()) {
    name = defaultName(kind, index);
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}${KIND_LABELS[kind]}（${id}）缺少名称，已按类型补为「${name}」` });
  } else {
    name = source.name.trim();
  }

  if (!isFiniteNumber(source.x)) {
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}「${name}」缺少横向位置，已补为 0.5 m` });
  }
  if (!isFiniteNumber(source.y)) {
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}「${name}」缺少纵向位置，已补为 0.5 m` });
  }
  const x = isFiniteNumber(source.x) ? source.x : 0.5;
  const y = isFiniteNumber(source.y) ? source.y : 0.5;

  if (!isFiniteNumber(source.width) || source.width <= 0) {
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}「${name}」的宽度缺失或无效，已按${spec.label}默认值 ${spec.width} m 补全` });
  }
  if (!isFiniteNumber(source.height) || source.height <= 0) {
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}「${name}」的深度缺失或无效，已按${spec.label}默认值 ${spec.height} m 补全` });
  }
  const width = isFiniteNumber(source.width) && source.width > 0 ? source.width : spec.width;
  const height = isFiniteNumber(source.height) && source.height > 0 ? source.height : spec.height;

  let rotation: number;
  if (!isFiniteNumber(source.rotation)) {
    issues.push({ scope: 'element', index: index + 1, elementId: id, severity: 'repaired', message: `${ordinal}「${name}」缺少旋转角度，已补为 0°` });
    rotation = 0;
  } else {
    rotation = normalizeRotation(source.rotation);
  }

  return { id, kind, name, x, y, width, height, rotation };
};

export function migrateDocument(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object') {
    return { document: null, issues: [], fatal: '存档内容不是一个有效的布局对象，可能来自其他软件或已被整体损坏。' };
  }
  const source = raw as Record<string, unknown>;
  const issues: DocumentIssue[] = [];

  if (source.version !== 1) {
    issues.push({
      scope: 'document',
      severity: 'repaired',
      message: source.version === undefined
        ? '存档缺少版本号，已按当前版本 v1 尝试读取'
        : `存档版本为 ${String(source.version)}，已按当前版本 v1 尝试读取`,
    });
  }

  if (!Array.isArray(source.elements)) {
    return { document: null, issues, fatal: '存档中缺少元素列表（elements 字段缺失或格式不是数组），无法识别为布局文件。' };
  }

  let title = DEFAULT_TITLE;
  if (typeof source.title !== 'string' || !source.title.trim()) {
    issues.push({ scope: 'document', severity: 'repaired', message: '存档缺少布局名称，已补为「未命名布局」' });
  } else {
    title = source.title.trim();
  }

  const field = migrateField(source.field, issues);

  const usedIds = new Set<string>();
  const elements: ExpoElement[] = [];
  source.elements.forEach((entry, index) => {
    const element = migrateElement(entry, index, usedIds, issues);
    if (element) elements.push(element);
  });

  if (source.elements.length > 0 && elements.length === 0) {
    return { document: null, issues, fatal: '存档中的元素全部无法识别（共 ' + source.elements.length + ' 条），没有可恢复的内容。' };
  }

  return { document: { version: 1, title, field, elements }, issues };
}
