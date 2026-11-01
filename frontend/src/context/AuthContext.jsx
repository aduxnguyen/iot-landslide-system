import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Khôi phục session khi mở trang
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Thử refresh token
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('token', data.token);
          } else {
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
          }
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch (networkErr) {
      throw new Error('Không thể kết nối tới máy chủ (Network Error). Hãy đảm bảo Backend cổng 5000 đang chạy!');
    }

    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      throw new Error(`Máy chủ Backend (cổng 5000) không phản hồi đúng dữ liệu (HTTP ${res.status}). Vui lòng kiểm tra lại server!`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Đăng nhập thất bại (HTTP ${res.status})`);
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('token', data.token);
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isAuthenticated: Boolean(user)
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
