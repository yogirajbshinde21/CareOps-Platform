// client/src/pages/Bookings.jsx - Bookings management page
import { useState, useEffect } from 'react';
import { Calendar, Filter, CheckCircle, XCircle, Clock, Bell, Send } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, useDarkMode } from '../utils/darkMode';

const Bookings = () => {
  useDarkMode();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data } = await api.get('/bookings');
      setBookings(data || []);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      toast.success(`Booking ${status}`);
      fetchBookings();
    } catch (err) {
      toast.error('Failed to update booking');
    }
  };

  const sendReminder = async (id) => {
    try {
      await api.post(`/bookings/${id}/remind`);
      toast.success('Reminder sent');
    } catch (err) {
      toast.error('Failed to send reminder');
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const getStatusBadge = (status) => {
    const map = {
      pending: 'badge-warning',
      confirmed: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger',
      no_show: 'badge-danger'
    };
    return map[status] || 'badge-neutral';
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Bookings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Manage your appointments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f === 'no_show' ? 'No Show' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {filtered.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Remind</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.contacts?.name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.contacts?.email}</div>
                    </td>
                    <td>{b.services?.name || 'N/A'}</td>
                    <td>{new Date(b.date).toLocaleDateString()}</td>
                    <td>{b.start_time?.slice(0, 5)}</td>
                    <td><span className={`badge ${getStatusBadge(b.status)}`}>{b.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {b.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(b.id, 'confirmed')} className="btn btn-sm" style={{ background: dm('#ecfdf5'), color: '#059669', border: 'none' }} title="Confirm">
                              <CheckCircle size={15} />
                            </button>
                            <button onClick={() => updateStatus(b.id, 'cancelled')} className="btn btn-sm" style={{ background: dm('#fef2f2'), color: '#dc2626', border: 'none' }} title="Cancel">
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {b.status === 'confirmed' && (
                          <>
                            <button onClick={() => updateStatus(b.id, 'completed')} className="btn btn-sm" style={{ background: dm('#ecfdf5'), color: '#059669', border: 'none' }} title="Complete">
                              <CheckCircle size={15} /> Done
                            </button>
                            <button onClick={() => updateStatus(b.id, 'no_show')} className="btn btn-sm" style={{ background: dm('#fef2f2'), color: '#dc2626', border: 'none' }} title="No Show">
                              <XCircle size={15} /> No Show
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <button 
                          onClick={() => sendReminder(b.id)} 
                          className="btn btn-sm" 
                          style={{ background: dm('#eef2ff'), color: '#4f46e5', border: 'none', marginLeft: '0.5rem' }} 
                          title="Send Reminder Email"
                        >
                          <Bell size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Calendar size={40} />
            <h3>No bookings found</h3>
            <p>{filter !== 'all' ? `No ${filter} bookings` : 'Bookings will appear here once customers start booking'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookings;
