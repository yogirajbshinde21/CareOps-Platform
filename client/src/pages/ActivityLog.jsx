// client/src/pages/ActivityLog.jsx - Unified activity timeline
import { useState, useEffect } from 'react';
import { 
  Calendar, Users, MessageSquare, FileText, Package, 
  Clock, AlertTriangle, CheckCircle, XCircle, Plus, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, useDarkMode } from '../utils/darkMode';

const TYPE_CONFIG = {
  booking: { icon: Calendar, color: '#6366f1', bg: '#eef2ff', label: 'Booking' },
  contact: { icon: Users, color: '#10b981', bg: '#ecfdf5', label: 'Contact' },
  conversation: { icon: MessageSquare, color: '#3b82f6', bg: '#eff6ff', label: 'Message' },
  form: { icon: FileText, color: '#f59e0b', bg: '#fffbeb', label: 'Form' },
  form_submission: { icon: FileText, color: '#8b5cf6', bg: '#f5f3ff', label: 'Submission' },
  inventory: { icon: Package, color: '#14b8a6', bg: '#f0fdfa', label: 'Inventory' },
};

const STATUS_BADGE = {
  pending: { class: 'badge-warning', label: 'Pending' },
  confirmed: { class: 'badge-success', label: 'Confirmed' },
  completed: { class: 'badge-success', label: 'Completed' },
  cancelled: { class: 'badge-danger', label: 'Cancelled' },
  no_show: { class: 'badge-danger', label: 'No Show' },
  open: { class: 'badge-info', label: 'Open' },
  closed: { class: 'badge-neutral', label: 'Closed' },
  created: { class: 'badge-info', label: 'New' },
  warning: { class: 'badge-warning', label: 'Low Stock' },
  overdue: { class: 'badge-danger', label: 'Overdue' },
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const ActivityLog = () => {
  useDarkMode();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchActivities(); }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/activity?limit=100');
      setActivities(data);
    } catch {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  // Group activities by date
  const groupedByDate = {};
  filteredActivities.forEach(a => {
    const dateKey = new Date(a.timestamp).toDateString();
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(a);
  });

  const filterOptions = [
    { value: 'all', label: 'All Activity' },
    { value: 'booking', label: 'Bookings' },
    { value: 'contact', label: 'Contacts' },
    { value: 'conversation', label: 'Messages' },
    { value: 'form', label: 'Forms' },
    { value: 'form_submission', label: 'Submissions' },
    { value: 'inventory', label: 'Inventory' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Activity Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Track all actions across your workspace</p>
        </div>
        <button onClick={fetchActivities} className="btn btn-secondary btn-sm" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${filter === opt.value ? 'var(--primary)' : 'var(--border)'}`,
              background: filter === opt.value ? dm('#eef2ff') : dm('white'),
              color: filter === opt.value ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: filter === opt.value ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Activity timeline */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading activity...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} />
          <h3>No activity yet</h3>
          <p>Actions will appear here as you use CareOps</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(groupedByDate).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div style={{
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '0.75rem', paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--border)',
              }}>
                {formatDate(items[0].timestamp)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map(activity => {
                  const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.booking;
                  const Icon = config.icon;
                  const statusInfo = STATUS_BADGE[activity.status] || STATUS_BADGE.created;
                  return (
                    <div
                      key={activity.id}
                      className="card"
                      style={{
                        padding: '0.875rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.875rem',
                        transition: 'box-shadow 0.15s',
                      }}
                    >
                      <div style={{
                        width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                        background: dm(config.bg), display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={16} color={config.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {activity.action}
                        </div>
                        <div style={{
                          fontSize: '0.8125rem', color: 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {activity.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ActivityLog;
