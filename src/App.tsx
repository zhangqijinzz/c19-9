import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AnalysisPanel } from './features/analysis-preview/AnalysisPanel';
import { StatusBar } from './features/analysis-preview/StatusBar';
import { ElementPalette } from './features/element-library/ElementPalette';
import { FieldSettingsPanel } from './features/field-setup/FieldSettingsPanel';
import { FieldCanvas } from './features/layout-editor/FieldCanvas';
import { InspectorPanel } from './features/layout-editor/InspectorPanel';
import { useExpoSketchViewModel } from './hooks/useExpoSketchViewModel';

function App() {
  const { state, vm } = useExpoSketchViewModel();
  const [projectTitle, setProjectTitle] = useState('');
  const [reportDismissed, setReportDismissed] = useState(false);

  if (state.phase === 'loading') return <div className="loading-screen"><div className="loading-mark">✦</div><strong>正在打开 ExpoSketch</strong><span>恢复最近一次场地布局…</span></div>;

  if (state.phase === 'error') {
    return <div className="loading-screen" role="alert">
      <div className="loading-mark error-mark">!</div>
      <strong>本地存档无法打开</strong>
      <span>检测到以下问题，原始存档未做改动：</span>
      <ul className="load-issue-list">{state.loadReport.issues.map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>)}</ul>
      <button type="button" className="reset-button" onClick={() => vm.resetExample()}>清除损坏存档，从示例布局重新开始</button>
    </div>;
  }

  return <ErrorBoundary onReset={() => vm.resetExample()}>
    <div className="app-shell">
    <aside className="left-rail">
      <div className="brand"><div className="brand-mark">✦</div><div><strong>ExpoSketch</strong><span>SPACE PLANNER</span></div></div>
      <div className="project-heading"><span className="section-kicker">CURRENT PROJECT</span><input aria-label="项目名称" value={projectTitle || state.document.title} onChange={(event) => setProjectTitle(event.target.value)} onBlur={() => { if (projectTitle.trim()) { vm.renameProject(projectTitle); setProjectTitle(''); } }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></div>
      <div className="rail-divider" />
      <ElementPalette onAdd={vm.addElement.bind(vm)} />
      <div className="tips-card"><span className="tips-icon">⌘</span><div><strong>快速提示</strong><p>拖动元素调整位置<br />检查模式查看通行风险</p></div></div>
      <div className="rail-footer"><span className="online-dot" />本地工作区 <span className="version">v0.1</span></div>
    </aside>
    <main className="main-stage">
      {state.loadReport.status === 'repaired' && !reportDismissed ? <div className="repair-banner" role="status">
        <span className="repair-icon">⚠</span>
        <div className="repair-detail">
          <strong>存档不完整，已按缺省值自动修复 {state.loadReport.issues.length} 处</strong>
          <ul>{state.loadReport.issues.slice(0, 3).map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>)}</ul>
          {state.loadReport.issues.length > 3 ? <small>另有 {state.loadReport.issues.length - 3} 处修复，详见状态栏提示</small> : null}
        </div>
        <button type="button" className="repair-dismiss" onClick={() => setReportDismissed(true)}>知道了</button>
      </div> : null}
      <header className="topbar"><div className="breadcrumb"><span>我的项目</span><b>/</b><strong>{state.document.title}</strong></div><div className="top-actions"><span className="autosave-label"><i /> 自动保存已开启</span><button type="button" className="share-button">导出布局 <span>↗</span></button><button type="button" className="avatar-button">Z</button></div></header>
      <div className="workspace-heading"><div><span className="section-kicker">LAYOUT EDITOR / A-01</span><h1>场地布局编辑器</h1><p>用拖放方式规划区域，保持主要通道畅通。</p></div><div className="heading-stats"><div><strong>{state.document.elements.length}</strong><span>元素</span></div><div><strong>{state.document.field.width}×{state.document.field.height}</strong><span>场地尺寸</span></div></div></div>
      <div className="editor-grid">
        <section className="canvas-panel"><div className="canvas-toolbar"><div className="toolbar-title"><span className="tool-grid">▦</span><div><strong>展厅平面图</strong><small>比例 1 : 100 · 单位：米</small></div></div><div className="toolbar-actions"><span className="zoom-label">⌕ 100%</span><button type="button" aria-label="更多布局选项">•••</button></div></div><FieldCanvas field={state.document.field} elements={state.renderElements} selectedId={state.selectedId} mode={state.mode} overlaps={state.analysis.overlaps} bounds={state.analysis.bounds} channels={state.analysis.channels} path={state.analysis.path} onSelect={vm.selectElement.bind(vm)} onMove={vm.moveElement.bind(vm)} /></section>
        <aside className="inspector"><InspectorPanel selectedElement={state.selectedElement} onRename={vm.renameSelected.bind(vm)} onResize={vm.resizeSelected.bind(vm)} onRotate={vm.rotateSelected.bind(vm)} onDelete={vm.removeSelected.bind(vm)} /><FieldSettingsPanel document={state.document} onResizeField={vm.resizeField.bind(vm)} onReset={vm.resetExample.bind(vm)} /></aside>
      </div>
      <AnalysisPanel analysis={state.analysis} mode={state.mode} elementCount={state.document.elements.length} />
      <StatusBar mode={state.mode} analysis={state.analysis} notice={state.notice} elementCount={state.document.elements.length} lastSavedAt={state.lastSavedAt} onModeChange={vm.setMode.bind(vm)} />
    </main>
    </div>
  </ErrorBoundary>;
}

export default App;
