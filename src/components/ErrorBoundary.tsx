import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0b1220] p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">⚠️ Algo deu errado</h1>
            <p className="text-white/70 mb-4">Desculpe, o aplicativo encontrou um erro.</p>
            <details className="bg-white/5 rounded-lg p-4 text-left mb-4">
              <summary className="cursor-pointer text-white font-semibold mb-2">
                Detalhes do erro
              </summary>
              <pre className="text-red-400 text-xs overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold transition"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
