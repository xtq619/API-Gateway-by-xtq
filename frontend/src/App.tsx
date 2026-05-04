import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import Battle from './pages/Battle';
import PublicFeedback from './pages/PublicFeedback';
import AiNews from './pages/AiNews';
import Digest from './pages/Digest';
import MusicPlayer from './components/MusicPlayer';

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

          <Route path="/feedback" element={<ProtectedRoute />}>
            <Route index element={<Feedback />} />
          </Route>

          <Route path="/battle" element={<ProtectedRoute />}>
            <Route index element={<Battle />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/keys" element={<Keys />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/models" element={<Models />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/news" element={<AiNews />} />
              <Route path="/digest" element={<Digest />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
