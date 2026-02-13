// client/src/pages/Forms.jsx - Intake form builder & management
import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, X, Eye, GripVertical, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, dt, dmc, dmGrad, useDarkMode } from '../utils/darkMode';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: 'Aa' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'select', label: 'Dropdown', icon: '▼' },
  { value: 'checkbox', label: 'Checkbox', icon: '☑' },
];

const Forms = () => {
  useDarkMode();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewSubmissions, setViewSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    try {
      const { data } = await api.get('/forms');
      setForms(data);
    } catch {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const addField = (type) => {
    setFields(prev => [...prev, {
      id: Date.now().toString(),
      type,
      label: '',
      placeholder: '',
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : []
    }]);
  };

  const updateField = (id, key, value) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const moveField = (index, direction) => {
    const newFields = [...fields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Form name required');
    if (fields.length === 0) return toast.error('Add at least one field');
    if (fields.some(f => !f.label.trim())) return toast.error('All fields need a label');

    setSaving(true);
    try {
      const payload = { name: formName, description: formDescription, fields };
      if (editingForm) {
        const { data } = await api.put(`/forms/${editingForm.id}`, payload);
        setForms(prev => prev.map(f => f.id === editingForm.id ? data : f));
        toast.success('Form updated');
      } else {
        const { data } = await api.post('/forms', payload);
        setForms(prev => [data, ...prev]);
        toast.success('Form created');
      }
      resetBuilder();
    } catch {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (form) => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/forms/${form.id}`);
      setForms(prev => prev.filter(f => f.id !== form.id));
      toast.success('Form deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleActive = async (form) => {
    try {
      const { data } = await api.put(`/forms/${form.id}`, { is_active: !form.is_active });
      setForms(prev => prev.map(f => f.id === form.id ? data : f));
      toast.success(form.is_active ? 'Form deactivated' : 'Form activated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const openEditor = (form = null) => {
    if (form) {
      setEditingForm(form);
      setFormName(form.name);
      setFormDescription(form.description || '');
      setFields(form.fields || []);
    } else {
      setEditingForm(null);
      setFormName('');
      setFormDescription('');
      setFields([]);
    }
    setShowBuilder(true);
    setPreviewMode(false);
  };

  const resetBuilder = () => {
    setShowBuilder(false);
    setEditingForm(null);
    setFormName('');
    setFormDescription('');
    setFields([]);
    setPreviewMode(false);
  };

  const loadSubmissions = async (form) => {
    try {
      const { data } = await api.get(`/forms/${form.id}/submissions`);
      setSubmissions(data);
      setViewSubmissions(form);
    } catch {
      toast.error('Failed to load submissions');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;
  }

  // Submissions viewer
  if (viewSubmissions) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setViewSubmissions(null)} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }}>← Back</button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Submissions: {viewSubmissions.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {submissions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Inbox size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)', opacity: 0.3 }} />
            <p>No submissions yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {submissions.map(sub => (
              <div key={sub.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{sub.contacts?.name || 'Anonymous'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(sub.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {Object.entries(sub.data || {}).map(([key, value]) => (
                    <div key={key} style={{ background: dm('#f8fafc'), padding: '0.5rem', borderRadius: '0.375rem' }}>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{key}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Form builder modal
  if (showBuilder) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editingForm ? 'Edit Form' : 'Create Form'}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setPreviewMode(!previewMode)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Eye size={15} /> {previewMode ? 'Edit' : 'Preview'}
            </button>
            <button onClick={resetBuilder} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Form'}
            </button>
          </div>
        </div>

        {previewMode ? (
          /* Preview Mode */
          <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>{formName || 'Untitled Form'}</h2>
            {formDescription && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{formDescription}</p>}
            {fields.map(field => (
              <div key={field.id} className="form-group">
                <label className="label">
                  {field.label || 'Untitled'} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea className="input" placeholder={field.placeholder} rows={3} disabled />
                ) : field.type === 'select' ? (
                  <select className="input" disabled>
                    <option>{field.placeholder || 'Select...'}</option>
                    {field.options?.map((opt, i) => <option key={i}>{opt}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <input type="checkbox" disabled /> {field.placeholder || field.label}
                  </label>
                ) : (
                  <input className="input" type={field.type} placeholder={field.placeholder} disabled />
                )}
              </div>
            ))}
            {fields.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No fields added yet</p>}
          </div>
        ) : (
          /* Edit Mode */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
            {/* Fields */}
            <div>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="label">Form Name *</label>
                  <input className="input" placeholder="e.g. Patient Intake Form" value={formName} onChange={e => setFormName(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Description</label>
                  <input className="input" placeholder="Optional description" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  <p style={{ fontWeight: 500 }}>No fields yet</p>
                  <p style={{ fontSize: '0.8125rem' }}>Click a field type on the right to add it</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {fields.map((field, idx) => (
                    <div key={field.id} className="card" style={{ padding: '0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button onClick={() => moveField(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#e2e8f0' : '#94a3b8', padding: '0', lineHeight: 1 }}>
                            <ChevronUp size={14} />
                          </button>
                          <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} style={{ background: 'none', border: 'none', cursor: idx === fields.length - 1 ? 'default' : 'pointer', color: idx === fields.length - 1 ? '#e2e8f0' : '#94a3b8', padding: '0', lineHeight: 1 }}>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6366f1', background: dm('#eef2ff'), padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                          {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                        </span>
                        <div style={{ flex: 1 }}>
                          <input
                            className="input"
                            placeholder="Field label"
                            value={field.label}
                            onChange={e => updateField(field.id, 'label', e.target.value)}
                            style={{ fontWeight: 500 }}
                          />
                        </div>
                        <button onClick={() => removeField(field.id)} style={{ background: dm('#fee2e2'), border: 'none', cursor: 'pointer', borderRadius: '0.25rem', padding: '0.25rem', color: '#dc2626' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '1.5rem' }}>
                        <input
                          className="input"
                          placeholder="Placeholder text"
                          value={field.placeholder}
                          onChange={e => updateField(field.id, 'placeholder', e.target.value)}
                          style={{ fontSize: '0.8125rem', flex: 1 }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} /> Required
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <div style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                          <label className="label" style={{ fontSize: '0.75rem' }}>Options (one per line)</label>
                          <textarea
                            className="input"
                            rows={3}
                            value={(field.options || []).join('\n')}
                            onChange={e => updateField(field.id, 'options', e.target.value.split('\n'))}
                            style={{ fontSize: '0.8125rem' }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Field Type Palette */}
            <div>
              <div className="card" style={{ position: 'sticky', top: '4.5rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>ADD FIELD</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {FIELD_TYPES.map(ft => (
                    <button
                      key={ft.value}
                      onClick={() => addField(ft.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                        border: '1px solid var(--border)', background: dm('white'),
                        cursor: 'pointer', fontSize: '0.8125rem', transition: 'all 0.15s',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>{ft.icon}</span>
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Forms list
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Intake Forms</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => openEditor()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Create Form
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {forms.map(form => (
          <div key={form.id} className="card" style={{ padding: '1rem 1.25rem', opacity: form.is_active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                background: dmGrad('linear-gradient(135deg, #eef2ff, #e0e7ff)', 'linear-gradient(135deg, #312e81, #4338ca)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6366f1', flexShrink: 0
              }}>
                <FileText size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{form.name}</span>
                  <span style={{
                    fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '1rem',
                    background: form.is_active ? dm('#ecfdf5') : dm('#fee2e2'),
                    color: form.is_active ? '#059669' : '#dc2626'
                  }}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0' }}>
                  {form.fields?.length || 0} field{(form.fields?.length || 0) !== 1 ? 's' : ''}
                  {form.description && ` · ${form.description}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => loadSubmissions(form)} title="Submissions" style={{ ...dmc('#f1f5f9', '#64748b'), border: 'none', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem' }}>
                  <Inbox size={15} />
                </button>
                <button onClick={() => openEditor(form)} title="Edit" style={{ background: dm('#eef2ff'), border: 'none', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem', color: '#6366f1' }}>
                  <FileText size={15} />
                </button>
                <button onClick={() => handleToggleActive(form)} title={form.is_active ? 'Deactivate' : 'Activate'} style={{ ...dmc('#f1f5f9', '#64748b'), border: 'none', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem' }}>
                  {form.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                </button>
                <button onClick={() => handleDelete(form)} title="Delete" style={{ background: dm('#fee2e2'), border: 'none', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem', color: '#dc2626' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {forms.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)', opacity: 0.3 }} />
            <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No intake forms yet</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Create forms to collect customer info before bookings</p>
            <button onClick={() => openEditor()} className="btn btn-primary"><Plus size={16} /> Create First Form</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forms;
