import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  onReset: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ExpoSketch 渲染失败：', error, info.componentStack);
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  override render() {
    if (this.state.error) {
      return <div className="loading-screen" role="alert">
        <div className="loading-mark error-mark">!</div>
        <strong>页面渲染出现异常</strong>
        <span>{this.state.error.message || '未知错误'}</span>
        <button type="button" className="reset-button" onClick={this.handleReset}>恢复示例布局并重新开始</button>
      </div>;
    }
    return this.props.children;
  }
}
