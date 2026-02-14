// client/src/pages/FormPage.jsx - Public form filling page (sent after booking)
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, FileText, Loader, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { dm, dt, useDarkMode } from '../utils/darkMode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const FormPage = () => {
  useDarkMode();
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const contactId = searchParams.get('contactId');
  const submissionId = searchParams.get('submissionId');

  const [form, setForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/forms/${formId}/public`);
        setForm(data);
        // Initialize form data with empty values
        const initial = {};
        (data.fields || []).forEach(f => {
          initial[f.id] = f.type === 'checkbox' ? false : '';
        });
        setFormData(initial);
      } catch {
        setError('Form not found or is no longer active.');
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [formId]);

  const handleChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const missingRequired = (form.fields || []).filter(f => f.required && !formData[f.id] && formData[f.id] !== false);
    if (missingRequired.length > 0) {
      setError(`Please fill in: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/forms/${formId}/submit`, {
        contact_id: contactId,
        booking_id: bookingId,
        submission_id: submissionId,
        data: formData,
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.id];
    const baseStyle = {
      width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
      border: '1px solid #d1d5db', fontSize: '0.9375rem', outline: 'none',
      transition: 'border-color 0.2s',
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            style={{ ...baseStyle, minHeight: '100px', resize: 'vertical' }}
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={e => handleChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      case 'select':
        return (
          <select style={baseStyle} value={value || ''} onChange={e => handleChange(field.id, e.target.value)} required={field.required}>
            <option value="">Select...</option>
            {(field.options || []).map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => handleChange(field.id, e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', accentColor: '#4f46e5' }}
            />
            {field.placeholder || field.label}
          </label>
        );
      default:
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            style={baseStyle}
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={e => handleChange(field.id, e.target.value)}
            required={field.required}
          />
        );
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dm('#f8fafc') }}>
        <Loader size={32} className="animate-spin" style={{ color: '#4f46e5' }} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dm('#f8fafc') }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '3rem 2rem', background: dm('white'), borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Thank You!</h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>
            Your form has been submitted successfully. We'll review your responses before your appointment.
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dm('#f8fafc') }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '3rem 2rem' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Form Not Found</h1>
          <p style={{ color: '#64748b' }}>{error || 'This form is no longer available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: dm('#f8fafc'), padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: dm('#eef2ff'), color: '#4f46e5', padding: '0.375rem 1rem', borderRadius: '2rem', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '1rem' }}>
            <FileText size={14} /> Intake Form
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: dt('#0f172a') }}>{form.name}</h1>
          {form.description && <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.5rem' }}>{form.description}</p>}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: dm('white'), borderRadius: '1rem', padding: '2rem', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {error && (
            <div style={{ background: dm('#fef2f2'), border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          
          {(form.fields || []).map((field, idx) => (
            <div key={field.id || idx} style={{ marginBottom: '1.5rem' }}>
              {field.type !== 'checkbox' && (
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: dt('#374151') }}>
                  {field.label}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '0.75rem',
              background: submitting ? '#a5b4fc' : '#4f46e5', color: 'white',
              fontWeight: 700, fontSize: '1rem', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Form'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
          Powered by CareOps
        </p>
      </div>
    </div>
  );
};

export default FormPage;
