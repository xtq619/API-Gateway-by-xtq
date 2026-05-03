import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

export default function ProtectedRoute() {
  const { user, setAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(!user);
  const [authorized, setAuthorized] = useState(!!user);

  useEffect(() => {
    if (user) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then(res => {
        if (res.ok) {
          res.json().then(u => { setAuth(u, token); setAuthorized(true); });
        } else {
          logout();
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!authorized) return <Navigate to="/login" replace />;
  return <Outlet />;
}
