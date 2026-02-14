// client/src/pages/Dashboard.jsx - Enhanced dashboard with alerts
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, FileText, Package, Bell, CheckCircle, XCircle, Sparkles, RefreshCw,
  Calendar, Users, MessageSquare, Clock, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import DashboardSearch from '../components/DashboardSearch';
import { dm, dt, dmc, dmGrad, useDarkMode } from '../utils/darkMode';

const Dashboard = () => {
  useDarkMode();
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0, todayBookings: 0, upcomingBookings: 0, completedBookings: 0, noShowBookings: 0,
    totalContacts: 0, openConversations: 0, unansweredMessages: 0,
    pendingForms: 0, overdueForms: 0, completedForms: 0,
    lowStockItems: []
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [rawData, setRawData] = useState({ bookings: [], contacts: [], conversations: [], formStats: {}, lowStockItems: [] });

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const [bookingsRes, contactsRes, conversationsRes, formStatsRes, inventoryRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/contacts'),
        api.get('/conversations'),
        api.get('/forms/stats/summary').catch(() => ({ data: { pendingForms: 0, overdueForms: 0, completedForms: 0 } })),
        api.get('/inventory/alerts').catch(() => ({ data: [] }))
      ]);

      const today = new Date().toISOString().split('T')[0];
      const bookings = bookingsRes.data || [];
      const contacts = contactsRes.data || [];
      const conversations = conversationsRes.data || [];
      const lowStock = inventoryRes.data || [];
      const formStats = formStatsRes.data || {};

      // Store raw data for NLQ search engine
      setRawData({ bookings, contacts, conversations, formStats, lowStockItems: lowStock });
      
      const todayBookings = bookings.filter(b => b.date === today);
      const upcomingBookings = bookings.filter(b => b.date >= today && b.status !== 'cancelled');
      const pendingBookings = bookings.filter(b => b.status === 'pending');
      const completedBookings = bookings.filter(b => b.status === 'completed');
      const noShowBookings = bookings.filter(b => b.status === 'cancelled' || b.status === 'no_show');
      const openConvos = conversations.filter(c => c.status === 'open');

      // Build alerts
      const newAlerts = [];
      if (pendingBookings.length > 0) {
        newAlerts.push({ type: 'warning', icon: Calendar, text: `${pendingBookings.length} unconfirmed booking${pendingBookings.length !== 1 ? 's' : ''}`, link: '/bookings', linkText: 'View Bookings' });
      }
      if (openConvos.length > 0) {
        newAlerts.push({ type: 'info', icon: MessageSquare, text: `${openConvos.length} open conversation${openConvos.length !== 1 ? 's' : ''} need attention`, link: '/inbox', linkText: 'Open Inbox' });
      }
      if (lowStock.length > 0) {
        newAlerts.push({ type: 'danger', icon: Package, text: `${lowStock.length} inventory item${lowStock.length !== 1 ? 's' : ''} below reorder level`, link: '/inventory', linkText: 'View Inventory' });
      }
      if (formStats.overdueForms > 0) {
        newAlerts.push({ type: 'warning', icon: FileText, text: `${formStats.overdueForms} overdue form${formStats.overdueForms !== 1 ? 's' : ''} need follow-up`, link: '/forms', linkText: 'View Forms' });
      }
      if (formStats.pendingForms > 0 && formStats.overdueForms === 0) {
        newAlerts.push({ type: 'info', icon: FileText, text: `${formStats.pendingForms} pending intake form${formStats.pendingForms !== 1 ? 's' : ''}`, link: '/forms', linkText: 'View Forms' });
      }

      setStats({
        totalBookings: bookings.length,
        todayBookings: todayBookings.length,
        upcomingBookings: upcomingBookings.length,
        completedBookings: completedBookings.length,
        noShowBookings: noShowBookings.length,
        totalContacts: contacts.length,
        openConversations: openConvos.length,
        unansweredMessages: openConvos.length,
        pendingForms: formStats.pendingForms || 0,
        overdueForms: formStats.overdueForms || 0,
        completedForms: formStats.completedForms || 0,
        lowStockItems: lowStock
      });
      setAlerts(newAlerts);
      setRecentBookings(bookings.slice(0, 5));
    } catch (err) {
      console.error('Dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger', no_show: 'badge-danger' };
    return map[status] || 'badge-neutral';
  };

  const generateInsights = async () => {
    if (generatingInsights) return;
    setGeneratingInsights(true);
    try {
      // Send simplified stats to avoid huge payload
      const businessData = {
        bookings: { total: stats.totalBookings, today: stats.todayBookings, upcoming: stats.upcomingBookings },
        inventory: { lowStockCount: stats.lowStockItems.length, lowStockItems: stats.lowStockItems.map(i => i.name) },
        conversations: { open: stats.openConversations },
        forms: { completed: stats.completedForms }
      };

      const { data } = await api.post('/ai/insights', { businessData });
      
      if (data.success && data.insights) {
        setInsights(data.insights);
        toast.success('✨ Insights generated!');
      } else {
        toast.error('Could not generate insights');
      }
    } catch (err) {
      console.error(err);
      toast.error('AI unavailable');
    } finally {
      setGeneratingInsights(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>;
  }

  const statCards = [
    { label: 'Today\'s Bookings', value: stats.todayBookings, icon: Clock, color: '#6366f1', bg: () => dm('#eef2ff'), link: '/bookings' },
    { label: 'Upcoming', value: stats.upcomingBookings, icon: Calendar, color: '#059669', bg: () => dm('#ecfdf5'), link: '/bookings' },
    { label: 'Contacts', value: stats.totalContacts, icon: Users, color: '#d97706', bg: () => dm('#fffbeb'), link: '/contacts' },
    { label: 'Open Conversations', value: stats.openConversations, icon: MessageSquare, color: '#2563eb', bg: () => dm('#eff6ff'), link: '/inbox' },
    { label: 'Pending Forms', value: stats.pendingForms, icon: FileText, color: '#f59e0b', bg: () => dm('#fffbeb'), link: '/forms' },
    { label: 'No-Shows / Cancelled', value: stats.noShowBookings, icon: XCircle, color: '#dc2626', bg: () => dm('#fef2f2'), link: '/bookings' },
  ];

  const alertColors = { warning: { bg: dm('#fffbeb'), border: '#fbbf24', text: dt('#92400e') }, info: { bg: dm('#eff6ff'), border: '#60a5fa', text: dt('#1e40af') }, danger: { bg: dm('#fef2f2'), border: '#f87171', text: dt('#991b1b') } };

  return (
    <div>
      {/* Header + NLQ Search */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Here's what's happening at {workspace?.name}
            </p>
          </div>
        </div>
        <DashboardSearch dashboardData={rawData} />
      </div>

      {/* 🚨 Key Alerts Section */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {alerts.map((alert, i) => {
            const c = alertColors[alert.type];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 1rem', borderRadius: '0.5rem',
                background: c.bg, border: `1px solid ${c.border}`,
                flexWrap: 'wrap'
              }}>
                <alert.icon size={18} color={c.text} />
                <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500, color: c.text }}>{alert.text}</span>
                <button onClick={() => navigate(alert.link)} style={{
                  background: 'none', border: `1px solid ${c.border}`, borderRadius: '0.25rem',
                  padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600,
                  color: c.text, cursor: 'pointer'
                }}>{alert.linkText} →</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {statCards.map(card => (
          <div key={card.label} className="card" style={{ padding: '1rem', cursor: card.link ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }} onClick={() => card.link && navigate(card.link)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.125rem', color: card.color }}>{card.value}</p>
              </div>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', background: typeof card.bg === 'function' ? card.bg() : card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <card.icon size={18} color={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 🤖 AI Insights Section */}
      <div className="card" style={{ marginBottom: '1.25rem', background: dmGrad('linear-gradient(to right, #fdfbf7, #fff)', 'var(--bg-card)') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="#8b5cf6" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>AI Business Insights</h2>
          </div>
          <button 
            onClick={generateInsights}
            disabled={generatingInsights}
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {generatingInsights ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
            {insights ? 'Refresh Insights' : 'Generate Insights'}
          </button>
        </div>

        {insights ? (
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {insights.map((insight, i) => (
              <div key={i} style={{
                padding: '1rem', background: dm('#f5f3ff'), 
                border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '0.5rem',
                fontSize: '0.9rem', color: dt('#4c1d95'), lineHeight: '1.5'
              }}>
                {insight}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', background: dm('#fafafa'), borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            Click "Generate Insights" to let AI analyze your business performance and suggest actions.
          </div>
        )}
      </div>

      {/* Three-Column Grid: Bookings + Forms + Inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Recent Bookings */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Bookings</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/bookings')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          {recentBookings.length > 0 ? (
            <div className="table-container">
              <table>
                <thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {recentBookings.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.contacts?.name || 'N/A'}</td>
                      <td>{b.services?.name || 'N/A'}</td>
                      <td>{new Date(b.date).toLocaleDateString()}</td>
                      <td>{b.start_time?.slice(0, 5)}</td>
                      <td><span className={`badge ${getStatusBadge(b.status)}`}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><Calendar size={40} /><h3>No bookings yet</h3><p>Bookings will appear here once customers start booking</p></div>
          )}
        </div>

        {/* Right Column: Inventory Alerts + Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Inventory Alerts */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Package size={16} color="#d97706" /> Inventory
            </h2>
            {stats.lowStockItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {stats.lowStockItems.slice(0, 4).map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.375rem 0.5rem', borderRadius: '0.375rem',
                    background: item.quantity <= Math.floor(item.reorder_level / 2) ? dm('#fef2f2') : dm('#fffbeb'),
                    fontSize: '0.8125rem'
                  }}>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{
                      fontWeight: 700, color: item.quantity <= Math.floor(item.reorder_level / 2) ? '#dc2626' : '#d97706'
                    }}>{item.quantity} {item.unit}</span>
                  </div>
                ))}
                <button onClick={() => navigate('/inventory')} className="btn btn-sm btn-secondary" style={{ marginTop: '0.25rem' }}>
                  View All <ArrowRight size={12} />
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>All items are well-stocked ✅</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                { label: 'View Bookings', path: '/bookings', icon: Calendar },
                { label: 'Check Inbox', path: '/inbox', icon: MessageSquare },
                { label: 'Manage Forms', path: '/forms', icon: FileText },
                { label: 'Inventory', path: '/inventory', icon: Package },
              ].map(action => (
                <button key={action.path} onClick={() => navigate(action.path)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.75rem', background: dm('#f8fafc'),
                  border: '1px solid var(--border)', borderRadius: '0.375rem',
                  cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
                  color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.15s'
                }}>
                  <action.icon size={16} color="var(--primary)" />
                  {action.label}
                  <ArrowRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
                </button>
              ))}
            </div>

            {/* Booking link */}
            {workspace?.slug && (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem',
                background: dm('#eef2ff'), borderRadius: '0.375rem', border: `1px solid ${dm('#c7d2fe')}`
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.375rem' }}>Your Public Booking Link</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: '1.4' }}>
                  {window.location.origin}/book/{workspace.slug}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive grid fix */}
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Dashboard;
