import { cn } from "@/lib/utils";
import { isChunkLoadError, tryChunkReload } from "@/lib/chunkLoadRecovery";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  chunkError: boolean;
  reloadAttempted: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      chunkError: false,
      reloadAttempted: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return;
    // A stale tab (old hashed chunks after a deploy) recovers with one reload.
    // tryChunkReload() refuses a second automatic reload within its window.
    const reloadAttempted = tryChunkReload();
    this.setState({ chunkError: true, reloadAttempted });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        chunkError: false,
        reloadAttempted: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.chunkError) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-background p-8">
            <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
              <RefreshCw
                size={40}
                className="text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="text-lg font-bold">
                {this.state.reloadAttempted
                  ? "جارٍ تحميل النسخة الجديدة من الصفحة..."
                  : "تعذّر تحميل جزء من الصفحة."}
              </h2>
              <p className="text-sm text-muted-foreground">
                نُزّلت نسخة جديدة من المتجر. أعد تحميل الصفحة للمتابعة بأحدث
                نسخة.
              </p>
              {!this.state.reloadAttempted ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2",
                    "bg-primary text-primary-foreground hover:opacity-90"
                  )}
                >
                  <RotateCcw size={16} />
                  إعادة تحميل الصفحة
                </button>
              ) : null}
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
