import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>Something went wrong</h1>
            <p>
              We encountered an unexpected error while rendering this page.
              This can sometimes happen due to malformed data or connectivity issues.
            </p>
            {this.state.error && (
              <pre className="error-details">
                {this.state.error.message}
              </pre>
            )}
            <div className="error-actions">
              <button 
                className="btn-primary" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => window.location.href = "/"}
              >
                Return Home
              </button>
            </div>
          </div>
          <style>{`
            .error-boundary-container {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 60vh;
              padding: 2rem;
              text-align: center;
              background: transparent;
            }
            .error-boundary-content {
              max-width: 500px;
              width: 100%;
              padding: 3rem;
              border-radius: 24px;
              background: var(--card-bg, #ffffff);
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              border: 1px solid rgba(0,0,0,0.05);
              animation: slideUp 0.5s ease-out;
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .error-icon {
              font-size: 4rem;
              margin-bottom: 1.5rem;
            }
            h1 {
              font-size: 2rem;
              font-weight: 800;
              margin-bottom: 1rem;
              background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              color: var(--text-secondary, #666);
              line-height: 1.6;
              margin-bottom: 2rem;
            }
            .error-details {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 12px;
              font-family: 'Fira Code', monospace;
              font-size: 0.8rem;
              color: #d63384;
              margin-bottom: 2rem;
              white-space: pre-wrap;
              word-break: break-all;
              text-align: left;
            }
            .error-actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
            }
            .btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              padding: 0.8rem 1.5rem;
              border-radius: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 15px rgba(102, 126, 234, 0.4);
            }
            .btn-secondary {
              background: #eee;
              color: #333;
              border: none;
              padding: 0.8rem 1.5rem;
              border-radius: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: background 0.2s;
            }
            .btn-secondary:hover {
              background: #e0e0e0;
            }
            @media (prefers-color-scheme: dark) {
              .error-boundary-content {
                background: #1e1e1e;
                border-color: rgba(255,255,255,0.1);
              }
              .error-details {
                background: #121212;
              }
              .btn-secondary {
                background: #333;
                color: #eee;
              }
              .btn-secondary:hover {
                background: #444;
              }
            }
          `}</style>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
