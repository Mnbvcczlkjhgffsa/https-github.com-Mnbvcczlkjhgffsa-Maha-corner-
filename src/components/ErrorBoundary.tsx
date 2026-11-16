import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Tool render error caught by boundary:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 rounded-3xl bg-white border border-amber-300 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              तात्पुरती तांत्रिक अडचण आली (Temporary Error)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              कृपया खालील बटणावर क्लिक करून हा विभाग पुन्हा सुरू करा किंवा दुसरी फाइल निवडून प्रयत्न करा.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>पुन्हा सुरू करा (Retry)</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
