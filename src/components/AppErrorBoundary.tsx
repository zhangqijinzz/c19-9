import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onRestart: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 渲染期兜底：任何组件抛出错误时显示恢复页，避免整页白屏 */
export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留现场到控制台，便于把问题反馈给开发排查具体是哪一份存档
    console.error('ExpoSketch 渲染失败：', error, info.componentStack);
  }

  private handleRestart = () => {
    this.setState({ error: null });
    this.props.onRestart();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <div className="load-failure-screen">
      <div className="load-failure-card">
        <div className="load-failure-mark">!</div>
        <span className="section-kicker">UNEXPECTED ERROR</span>
        <h1>页面渲染时出了问题</h1>
        <p className="load-failure-reason">{error.message || '发生了未预期的错误。'}</p>
        <p className="load-failure-advice">为了避免一直停在空白页，可以清掉当前本地布局后重新进入；详细错误已经输出到浏览器控制台。</p>
        <div className="load-failure-actions">
          <button type="button" className="primary-action" onClick={this.handleRestart}>清掉本地布局，重新开始</button>
        </div>
      </div>
    </div>;
  }
}
