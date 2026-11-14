import { Component } from 'react'

// Keeps one broken screen from blanking the whole app (catches render errors only).
export default class ScreenErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <p role="alert" className="text-red-400">This screen failed to load: {this.state.error.message}</p>
  }
}
