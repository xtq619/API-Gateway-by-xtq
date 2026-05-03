import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Hub from './pages/Hub';
import Dashboard from './pages/Dashboard';
import Keys from './pages/Keys';
import Usage from './pages/Usage';
import Billing from './pages/Billing';
import Models from './pages/Models';
import Admin from './pages/Admin';
import Feedback from './pages/Feedback';
import PublicFeedback from './pages/PublicFeedback';
import AiNews from './pages/AiNews';
import MusicPlayer from './components/MusicPlayer';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err: any) { return { error: String(err?.message || err) }; }
  render() {
    if (this.state.error) return <div style={{color:'red',padding:'40px',fontSize:'18px',whiteSpace:'pre-wrap'}}>ERROR: {this.state.error}</div>;
    return this.props.children;
  }
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MusicPlayer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/feedback/wall" element={<PublicFeedback />} />

          <Route path="/hub" element={<ProtectedRoute />}>
            <Route index element={<Hub />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/keys" element={<Keys />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/models" element={<Models />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/news" element={<AiNews />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
