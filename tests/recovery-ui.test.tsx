import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FieldCanvas } from '../src/features/layout-editor/FieldCanvas';
import { LoadErrorScreen } from '../src/features/recovery/LoadErrorScreen';
import type { RenderElement } from '../src/types';

const baseElement = (overrides: Partial<RenderElement>): RenderElement => ({
  id: 'b1',
  kind: 'booth',
  name: '展位',
  x: 2,
  y: 2,
  width: 5,
  height: 3.5,
  rotation: 0,
  displayWidth: 5,
  displayHeight: 3.5,
  occupiedArea: 17.5,
  ...overrides,
});

const noop = () => {};

describe('recovery rendering', () => {
  it('still renders the canvas instead of throwing when an element kind is unknown', () => {
    const elements = [baseElement({ id: 'legacy', kind: 'foodtruck' as RenderElement['kind'], name: '旧版元素' })];
    const html = renderToStaticMarkup(
      <FieldCanvas
        field={{ width: 28, height: 18 }}
        elements={elements}
        selectedId={null}
        mode="edit"
        overlaps={[]}
        bounds={[]}
        channels={[]}
        path={null}
        onSelect={noop}
        onMove={noop}
      />,
    );
    expect(html).toContain('旧版元素');
    expect(html).toContain('field-canvas');
  });

  it('renders an element with a missing name fallback without crashing', () => {
    const elements = [baseElement({ name: '' })];
    const html = renderToStaticMarkup(
      <FieldCanvas
        field={{ width: 28, height: 18 }}
        elements={elements}
        selectedId={null}
        mode="edit"
        overlaps={[]}
        bounds={[]}
        channels={[]}
        path={null}
        onSelect={noop}
        onMove={noop}
      />,
    );
    expect(html).toContain('field-canvas');
  });

  it('explains which entry failed and offers restart entry points', () => {
    const html = renderToStaticMarkup(
      <LoadErrorScreen
        error="存档中的元素全部无法识别（共 2 条），没有可恢复的内容。"
        issues={[
          { scope: 'element', index: 1, severity: 'dropped', message: '第 1 条元素的类型 「foodtruck」 无法识别，已跳过' },
          { scope: 'element', index: 2, severity: 'dropped', message: '第 2 条内容不是有效的元素对象，无法读取，已跳过' },
        ]}
        onStartBlank={noop}
        onStartExample={noop}
      />,
    );
    expect(html).toContain('这份布局存档无法打开');
    expect(html).toContain('第 1 条');
    expect(html).toContain('第 2 条');
    expect(html).toContain('从空白场地开始');
    expect(html).toContain('示例布局');
  });
});
