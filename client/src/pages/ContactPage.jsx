// client/src/pages/ContactPage.jsx - Public contact page
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, Phone, Send, CheckCircle, MapPin, Globe, MessageSquare, Loader } from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ContactPage = () => {
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  
  const [form, setForm] = useState({
    name: '', email: '', phone: '', message: ''
  });

  useEffect(() => {
    fetchWorkspace();
  }, [slug]);

  const fetchWorkspace = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/workspaces/public/${slug}`);
      setWorkspace(data);
    } catch (err) {
      setError('Contact page not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || (!form.email && !form.phone)) {
      return toast.error('Name and contact info (email or phone) required');
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/contacts/public`, {
        workspace_slug: slug,
        ...form
      });
      setSubmitted(true);
      toast.success('Message sent!');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        <MessageSquare size={48} style={{ color: '#cbd5e1' }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b' }}>{error}</h1>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
      padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Toaster position="top-center" />
      
      <div className="contact-page-grid" style={{ maxWidth: '900px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'start' }}>
        {/* Info Side */}
        <div style={{ color: 'white' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
            background: 'rgba(255,255,255,0.15)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.5rem', marginBottom: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>C</div>
          
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1 }}>
            Contact<br/>{workspace.name}
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.8, marginBottom: '2.5rem', lineHeight: 1.6, maxWidth: '400px' }}>
            Have a question or want to work together? Fill out the form and we'll get back to you shortly.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {workspace.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={20} />
                </div>
                <div>
                  <p style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</p>
                  <p style={{ fontWeight: 500 }}>{workspace.email}</p>
                </div>
              </div>
            )}
            {workspace.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={20} />
                </div>
                <div>
                  <p style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</p>
                  <p style={{ fontWeight: 500 }}>{workspace.phone}</p>
                </div>
              </div>
            )}
            {workspace.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <p style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Office</p>
                  <p style={{ fontWeight: 500 }}>{workspace.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Side */}
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ width: '5rem', height: '5rem', background: '#ecfdf5', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <CheckCircle size={40} color="#059669" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', marginBottom: '0.75rem' }}>Message Sent!</h2>
              <p style={{ color: '#64748b', fontSize: '1.125rem', lineHeight: 1.6 }}>
                Thanks for reaching out, <strong>{form.name}</strong>.<br/>
                We'll get back to you at <strong>{form.email || form.phone}</strong> shortly.
              </p>
              <button 
                onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', message: '' }); }}
                style={{ marginTop: '2rem', background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e293b' }}>
                Send a Message
              </h2>
              
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Your name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>

              <div className="contact-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Email *</label>
                  <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label">Phone</label>
                  <input className="input" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Message</label>
                <textarea 
                  className="input" 
                  rows={4} 
                  placeholder="How can we help you?" 
                  value={form.message} 
                  onChange={e => setForm({...form, message: e.target.value})} 
                  style={{ resize: 'none' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-lg" 
                style={{ width: '100%', gap: '0.75rem' }}
                disabled={submitting}
              >
                {submitting ? <Loader className="spin" size={20} /> : <Send size={20} />}
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
              
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                By sending this message, you agree to our privacy policy.
              </p>
            </form>
          )}
        </div>
      </div>
      
      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 800px) {
          .contact-page-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
          .contact-form-row {
            grid-template-columns: 1fr !important;
          }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ContactPage;
