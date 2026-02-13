// client/src/pages/Register.jsx - Registration page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', businessName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.businessName) {
      toast.error('Please fill in all fields');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.businessName);
      toast.success('Account created! Let\'s set up your business.');
      navigate('/onboarding');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
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
            Create your account
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Set up your business on CareOps
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="John Doe"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="label">Business Name</label>
            <input
              type="text"
              className="input"
              placeholder="My Awesome Salon"
              value={form.businessName}
              onChange={e => setForm({ ...form, businessName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@business.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Min 6 characters"
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
            {loading ? <div className="spinner" /> : <UserPlus size={18} />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', fontSize: '0.875rem',
          color: 'var(--text-secondary)', marginTop: '1.5rem'
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
