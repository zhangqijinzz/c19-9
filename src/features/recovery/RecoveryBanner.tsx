import { useState } from 'react';
import type { DocumentIssue } from '../../types';

interface RecoveryBannerProps {
  issues: DocumentIssue[];
  onDismiss: () => void;
}

export function RecoveryBanner({ issues, onDismiss }: RecoveryBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const repaired = issues.filter((issue) => issue.severity === 'repaired').length;
  const dropped = issues.length - repaired;
  if (issues.length === 0) return null;

  return <section className={`recovery-banner${expanded ? ' is-expanded' : ''}`}>
    <div className="recovery-summary">
      <span className="recovery-icon">⚠</span>
      <div className="recovery-copy">
        <strong>这份存档不完整，已按默认值修复后打开</strong>
        <small>
          {repaired > 0 ? `自动补全 ${repaired} 项` : ''}
          {repaired > 0 && dropped > 0 ? '，' : ''}
          {dropped > 0 ? `跳过 ${dropped} 条无法识别的元素` : ''}
          ，修复结果已保存，可继续编辑
        </small>
      </div>
      <div className="recovery-actions">
        <button type="button" className="recovery-details-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起明细' : '查看明细'}
        </button>
        <button type="button" className="recovery-close" aria-label="关闭修复提示" onClick={onDismiss}>×</button>
      </div>
    </div>
    {expanded ? <ul className="recovery-issue-list">
      {issues.map((issue, index) => <li key={index} className={`recovery-issue recovery-${issue.severity}`}>
        <span className="recovery-tag">{issue.severity === 'dropped' ? '已跳过' : '已补全'}</span>
        {issue.message}
      </li>)}
    </ul> : null}
  </section>;
}
