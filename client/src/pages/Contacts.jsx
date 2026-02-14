// client/src/pages/Contacts.jsx - Contacts management with Customer Journey Timeline
import { useState, useEffect } from 'react';
import { Users, Plus, Search, X, ArrowLeft, Mail, Phone, Calendar, MessageSquare, FileText, CheckCircle, XCircle, AlertCircle, Bell, UserPlus, Reply, Clock, FileCheck, FileWarning, CalendarCheck, CalendarPlus } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

// Icon mapping for timeline events
const ICON_MAP = {
  'user-plus': UserPlus, 'calendar-plus': CalendarPlus, 'calendar-check': CalendarCheck,
  'check-circle': CheckCircle, 'x-circle': XCircle, 'alert-circle': AlertCircle,
  'message-square': MessageSquare, 'mail': Mail, 'reply': Reply,
  'bell': Bell, 'file-text': FileText, 'file-check': FileCheck, 'file-warning': FileWarning,
};

const Contacts = () => {
  useDarkMode();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Timeline / detail panel state
  const [selectedContact, setSelectedContact] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async (q = '') => {
    try {
      const { data } = await api.get(`/contacts${q ? `?search=${q}` : ''}`);
      setContacts(data || []);
    } catch (err) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    // Debounce search
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => fetchContacts(e.target.value), 300);
  };

  const openTimeline = async (contact) => {
    setSelectedContact(contact);
    setTimelineLoading(true);
    try {
      const { data } = await api.get(`/contacts/${contact.id}/timeline`);
      setTimeline(data.events || []);
    } catch (err) {
      toast.error('Failed to load timeline');
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name is required');
    setSaving(true);
    try {
      await api.post('/contacts', form);
      toast.success('Contact created');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', notes: '' });
      fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create contact');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Contacts</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{contacts.length} total contacts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '320px' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          className="input"
          placeholder="Search contacts..."
          value={search}
          onChange={handleSearch}
          style={{ paddingLeft: '2.25rem' }}
        />
      </div>

      {/* Add Contact Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px' }}>
            <div className="card-header">
              <h2 className="card-title">Add Contact</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="label">Name *</label>
                <input className="input" placeholder="Contact name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} placeholder="Any notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="card">
        {contacts.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} onClick={() => openTimeline(c)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                    <td><span className="badge badge-neutral">{c.source}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Users size={40} />
            <h3>No contacts yet</h3>
            <p>Contacts will appear as customers book or you add them manually</p>
          </div>
        )}
      </div>

      {/* Customer Journey Timeline Slide-over */}
      {selectedContact && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 200,
        }} onClick={(e) => e.target === e.currentTarget && setSelectedContact(null)}>
          <div style={{
            width: '100%', maxWidth: '520px', height: '100%',
            background: dm('white'), color: dt('#1e293b'),
            boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: `1px solid ${dm('#e2e8f0')}`,
              display: 'flex', alignItems: 'center', gap: '1rem',
              background: dm('#f8fafc'),
            }}>
              <button onClick={() => setSelectedContact(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: dt('#64748b'), padding: '0.25rem',
              }}><ArrowLeft size={20} /></button>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{selectedContact.name}</h2>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8125rem', color: dt('#64748b') }}>
                  {selectedContact.email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} /> {selectedContact.email}</span>}
                  {selectedContact.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {selectedContact.phone}</span>}
                </div>
              </div>
              <span className={`badge badge-${selectedContact.source === 'website_form' ? 'info' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>
                {selectedContact.source || 'manual'}
              </span>
            </div>

            {/* Timeline Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: dt('#64748b'), marginBottom: '1.25rem' }}>
                Customer Journey
              </h3>

              {timelineLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
                </div>
              ) : timeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: dt('#64748b') }}>
                  <Clock size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.875rem' }}>No interactions recorded yet</p>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                  {/* Vertical line */}
                  <div style={{
                    position: 'absolute', left: '1.6rem', top: '0.5rem', bottom: '0.5rem',
                    width: '2px', background: dm('#e2e8f0'), borderRadius: '1px',
                  }} />

                  {timeline.map((event, i) => {
                    const IconComp = ICON_MAP[event.icon] || CheckCircle;
                    const isLast = i === timeline.length - 1;
                    return (
                      <div key={i} style={{
                        position: 'relative', marginBottom: isLast ? 0 : '1.5rem',
                        paddingLeft: '1.25rem',
                      }}>
                        {/* Icon dot */}
                        <div style={{
                          position: 'absolute', left: '-1.2rem', top: '0.125rem',
                          width: '2rem', height: '2rem', borderRadius: '50%',
                          background: event.color + '18',
                          border: `2px solid ${event.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 1,
                        }}>
                          <IconComp size={13} color={event.color} />
                        </div>

                        {/* Content */}
                        <div style={{
                          background: dm('#f8fafc'),
                          borderRadius: '0.625rem',
                          padding: '0.75rem 1rem',
                          border: `1px solid ${dm('#e2e8f0')}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{event.title}</span>
                            <span style={{ fontSize: '0.75rem', color: dt('#64748b'), whiteSpace: 'nowrap' }}>
                              {formatTimelineDate(event.timestamp)}
                            </span>
                          </div>
                          {event.description && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: dt('#64748b'), lineHeight: 1.5 }}>
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer summary */}
            {!timelineLoading && timeline.length > 0 && (
              <div style={{
                padding: '0.75rem 1.5rem',
                borderTop: `1px solid ${dm('#e2e8f0')}`,
                background: dm('#f8fafc'),
                display: 'flex', justifyContent: 'space-around',
                fontSize: '0.75rem', color: dt('#64748b'),
              }}>
                <span style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '1.125rem', color: dt('#1e293b') }}>
                    {timeline.filter(e => e.type.startsWith('booking_')).length}
                  </strong>Bookings
                </span>
                <span style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '1.125rem', color: dt('#1e293b') }}>
                    {timeline.filter(e => e.type.startsWith('message_') || e.type === 'staff_replied').length}
                  </strong>Messages
                </span>
                <span style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '1.125rem', color: dt('#1e293b') }}>
                    {timeline.filter(e => e.type.startsWith('form_')).length}
                  </strong>Forms
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Format dates nicely
function formatTimelineDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default Contacts;
