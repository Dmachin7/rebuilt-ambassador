import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('rebuilt_token');
    const storedUser = localStorage.getItem('rebuilt_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (tokenValue, userData) => {
    localStorage.setItem('rebuilt_token', tokenValue);
    localStorage.setItem('rebuilt_user', JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('rebuilt_token');
    localStorage.removeItem('rebuilt_user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isEventCoordinator = user?.role === 'EVENT_COORDINATOR';
  const isAdminOrCoord = isAdmin || isEventCoordinator;
  const isAmbassador = user?.role === 'AMBASSADOR';

  return (
    <AuthContext.Provider value={{
      user, token, login, logout, loading,
      isAdmin, isEventCoordinator, isAdminOrCoord, isAmbassador,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
