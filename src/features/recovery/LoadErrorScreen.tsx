import type { DocumentIssue } from '../../types';

interface LoadErrorScreenProps {
  error: string;
  issues: DocumentIssue[];
  onStartBlank: () => void;
  onStartExample: () => void;
}

export function LoadErrorScreen({ error, issues, onStartBlank, onStartExample }: LoadErrorScreenProps) {
  const dropped = issues.filter((issue) => issue.severity === 'dropped');
  return <div className="load-failure-screen">
    <div className="load-failure-card">
      <div className="load-failure-mark">!</div>
      <span className="section-kicker">LAYOUT CANNOT BE OPENED</span>
      <h1>这份布局存档无法打开</h1>
      <p className="load-failure-reason">{error}</p>
      <p className="load-failure-advice">本地保存的内容可能来自旧版本、在拷贝时损坏，或被其他软件改写。可以从新场地重新开始，旧的损坏存档会被自动清掉。</p>
      {dropped.length > 0 ? <div className="load-failure-issues">
        <strong>读取过程中逐条发现的问题：</strong>
        <ul>
          {dropped.map((issue, index) => <li key={index}>{issue.message}</li>)}
        </ul>
      </div> : null}
      <div className="load-failure-actions">
        <button type="button" className="primary-action" onClick={onStartBlank}>清空坏数据，从空白场地开始</button>
        <button type="button" className="ghost-action" onClick={onStartExample}>载入示例布局重新开始</button>
      </div>
    </div>
  </div>;
}
