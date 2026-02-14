// client/src/pages/TeamMembers.jsx - Staff management page
import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, ShieldCheck, User, Mail, Trash2, Edit3, X, Check, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

const ROLES = { owner: { label: 'Owner', color: '#7c3aed', bg: '#ede9fe', dbg: '#4c1d95' }, admin: { label: 'Admin', color: '#0891b2', bg: '#ecfeff', dbg: '#164e63' }, staff: { label: 'Staff', color: '#059669', bg: '#ecfdf5', dbg: '#064e3b' } };

const TeamMembers = () => {
  useDarkMode();
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'staff' });
  const [inviting, setInviting] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
  const [editingServices, setEditingServices] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [staffRes, servicesRes] = await Promise.all([
        api.get('/staff'),
        api.get('/services')
      ]);
      setStaff(staffRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return toast.error('Name and email required');
    setInviting(true);
    try {
      const { data } = await api.post('/staff/invite', inviteForm);
      setStaff(prev => [...prev, data]);
      toast.success(`Invited ${data.name}! Temp password: ${data.temp_password}`, { duration: 8000 });
      setInviteForm({ name: '', email: '', role: 'staff' });
      setShowInvite(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member, newRole) => {
    try {
      await api.put(`/staff/${member.id}`, { role: newRole });
      setStaff(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
      toast.success(`${member.name} updated to ${newRole}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleToggleActive = async (member) => {
    try {
      await api.put(`/staff/${member.id}`, { is_active: !member.is_active });
      setStaff(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m));
      toast.success(`${member.name} ${member.is_active ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.name} from the team? This cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${member.id}`);
      setStaff(prev => prev.filter(m => m.id !== member.id));
      toast.success(`${member.name} removed`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove');
    }
  };

  const toggleServiceAssignment = (memberId, serviceId) => {
    setEditingServices(prev => {
      const current = prev[memberId] || staff.find(m => m.id === memberId)?.assigned_services?.map(s => s.id) || [];
      const updated = current.includes(serviceId) ? current.filter(id => id !== serviceId) : [...current, serviceId];
      return { ...prev, [memberId]: updated };
    });
  };

  const saveServiceAssignments = async (memberId) => {
    const serviceIds = editingServices[memberId];
    if (!serviceIds) return;
    try {
      const { data } = await api.put(`/staff/${memberId}/services`, { service_ids: serviceIds });
      setStaff(prev => prev.map(m => m.id === memberId ? { ...m, assigned_services: data.assigned_services } : m));
      setEditingServices(prev => { const n = { ...prev }; delete n[memberId]; return n; });
      toast.success('Service assignments updated');
    } catch (err) {
      toast.error('Failed to update assignments');
    }
  };

  const startEditingServices = (member) => {
    setEditingServices(prev => ({
      ...prev,
      [member.id]: member.assigned_services?.map(s => s.id) || []
    }));
    setExpandedMember(expandedMember === member.id ? null : member.id);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Team Members</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{staff.length} member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus size={16} /> Invite Staff
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Invite Team Member</h2>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="John Doe" value={inviteForm.name} onChange={e => setInviteForm({...inviteForm, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" placeholder="john@example.com" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Role</label>
                <select className="input" value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowInvite(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  {inviting ? <div className="spinner" /> : <UserPlus size={16} />}
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {staff.map(member => {
          const roleInfo = ROLES[member.role] || ROLES.staff;
          const isExpanded = expandedMember === member.id;
          const isEditingAssignments = editingServices[member.id] !== undefined;
          const assignedIds = isEditingAssignments ? editingServices[member.id] : member.assigned_services?.map(s => s.id) || [];

          return (
            <div key={member.id} className="card" style={{ padding: '1rem 1.25rem', opacity: member.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{
                  width: '2.75rem', height: '2.75rem', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${dm(roleInfo.bg)}, ${roleInfo.color}20)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: roleInfo.color, fontWeight: 700, fontSize: '1rem', flexShrink: 0
                }}>
                  {member.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{member.name}</span>
                    <span style={{
                      padding: '0.125rem 0.5rem', borderRadius: '1rem',
                      fontSize: '0.75rem', fontWeight: 600,
                      background: dm(roleInfo.bg), color: roleInfo.color,
                      display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                      {member.role === 'owner' ? <ShieldCheck size={10} /> : <Shield size={10} />}
                      {roleInfo.label}
                    </span>
                    {!member.is_active && (
                      <span style={{
                        padding: '0.125rem 0.5rem', borderRadius: '1rem',
                        fontSize: '0.75rem', fontWeight: 500, background: dm('#fee2e2'), color: '#dc2626'
                      }}>Inactive</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Mail size={12} /> {member.email}
                  </div>
                  {member.assigned_services?.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                      {member.assigned_services.map(s => (
                        <span key={s.id} style={{
                          padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
                          fontSize: '0.75rem', ...dmc('#f1f5f9', '#475569')
                        }}>{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {member.role !== 'owner' && (
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    <button
                      onClick={() => startEditingServices(member)}
                      title="Assign Services"
                      style={{
                        background: isExpanded ? dm('#e0e7ff') : dm('#f1f5f9'), border: 'none', cursor: 'pointer',
                        borderRadius: '0.375rem', padding: '0.375rem', color: isExpanded ? '#4338ca' : dt('#64748b')
                      }}
                    >
                      <Briefcase size={15} />
                    </button>
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member, e.target.value)}
                      style={{
                        fontSize: '0.75rem', padding: '0.25rem 0.375rem', borderRadius: '0.25rem',
                        border: '1px solid var(--border)', background: dm('white'), cursor: 'pointer',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleToggleActive(member)}
                      title={member.is_active ? 'Deactivate' : 'Activate'}
                      style={{
                        background: member.is_active ? dm('#ecfdf5') : dm('#fee2e2'), border: 'none',
                        cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem',
                        color: member.is_active ? '#059669' : '#dc2626'
                      }}
                    >
                      {member.is_active ? <Check size={15} /> : <X size={15} />}
                    </button>
                    <button
                      onClick={() => handleRemove(member)}
                      title="Remove"
                      style={{ background: dm('#fee2e2'), border: 'none', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.375rem', color: '#dc2626' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded: Service Assignment */}
              {isExpanded && (
                <div style={{
                  marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Briefcase size={14} /> Assign Services
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {services.map(service => {
                      const isAssigned = assignedIds.includes(service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => toggleServiceAssignment(member.id, service.id)}
                          style={{
                            padding: '0.375rem 0.75rem', borderRadius: '1rem',
                            border: `1.5px solid ${isAssigned ? '#4f46e5' : '#e2e8f0'}`,
                            background: isAssigned ? dm('#eef2ff') : dm('white'),
                            color: isAssigned ? '#4338ca' : dt('#64748b'),
                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
                            transition: 'all 0.15s'
                          }}
                        >
                          {isAssigned ? '✓ ' : ''}{service.name}
                        </button>
                      );
                    })}
                  </div>
                  {services.length === 0 && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No services created yet. Add services in Settings.</p>
                  )}
                  {isEditingAssignments && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button onClick={() => saveServiceAssignments(member.id)} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>
                        <Check size={14} /> Save Assignments
                      </button>
                      <button onClick={() => { setEditingServices(prev => { const n = { ...prev }; delete n[member.id]; return n; }); setExpandedMember(null); }} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {staff.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)', opacity: 0.3 }} />
            <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No team members yet</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Invite your staff to help manage bookings</p>
            <button onClick={() => setShowInvite(true)} className="btn btn-primary"><UserPlus size={16} /> Invite First Member</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMembers;
