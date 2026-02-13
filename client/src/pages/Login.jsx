// client/src/pages/Login.jsx - Login page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      toast.success('Welcome back!');
      // If onboarding not completed, redirect to onboarding
      if (!data.workspace?.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'white',
        borderRadius: '1rem',
        padding: '2.5rem',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '0.75rem',
            background: 'var(--primary)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '1.25rem',
            marginBottom: '0.75rem'
          }}>C</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Sign in to your CareOps account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@business.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? <div className="spinner" /> : <LogIn size={18} />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', fontSize: '0.875rem',
          color: 'var(--text-secondary)', marginTop: '1.5rem'
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
