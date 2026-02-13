// client/src/context/AuthContext.jsx - Authentication state management
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('careops_token');
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
          setWorkspace(data.workspace);
        } catch (err) {
          console.error('Auth init failed:', err);
          localStorage.removeItem('careops_token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('careops_token', data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    return data;
  };

  const register = async (name, email, password, businessName) => {
    const { data } = await api.post('/auth/register', { 
      name, email, password, businessName 
    });
    localStorage.setItem('careops_token', data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('careops_token');
    setUser(null);
    setWorkspace(null);
  };

  const updateWorkspace = (updates) => {
    setWorkspace(prev => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{
      user, workspace, loading,
      login, register, logout, updateWorkspace,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};
