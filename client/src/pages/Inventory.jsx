// client/src/pages/Inventory.jsx - Inventory / Resource management page
import { useState, useEffect } from 'react';
import { Package, Plus, Trash2, X, AlertTriangle, ArrowUp, ArrowDown, Edit3 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

const Inventory = () => {
  useDarkMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', quantity: 0, unit: 'units', reorder_level: 5, price: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/inventory');
      setItems(data);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Item name required');
    setSaving(true);
    try {
      if (editingItem) {
        const { data } = await api.put(`/inventory/${editingItem.id}`, form);
        setItems(prev => prev.map(i => i.id === editingItem.id ? data : i));
        toast.success('Item updated');
      } else {
        const { data } = await api.post('/inventory', form);
        setItems(prev => [...prev, data]);
        toast.success('Item added');
      }
      resetForm();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Item deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleAdjust = async (item, delta) => {
    try {
      const { data } = await api.put(`/inventory/${item.id}/adjust`, { delta });
      setItems(prev => prev.map(i => i.id === item.id ? { ...data, warning: undefined } : i));
      if (data.warning) toast(data.warning, { icon: '⚠️', duration: 4000 });
    } catch { toast.error('Failed to update quantity'); }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ name: item.name, description: item.description || '', quantity: item.quantity, unit: item.unit || 'units', reorder_level: item.reorder_level, price: item.price || 0 });
    setShowAdd(true);
  };

  const resetForm = () => {
    setShowAdd(false);
    setEditingItem(null);
    setForm({ name: '', description: '', quantity: 0, unit: 'units', reorder_level: 5, price: 0 });
  };

  const lowStockItems = items.filter(i => i.reorder_level > 0 && i.quantity <= i.reorder_level);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Inventory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{items.length} item{items.length !== 1 ? 's' : ''}{lowStockItems.length > 0 ? ` · ${lowStockItems.length} low stock` : ''}</p>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div style={{
          ...dmc('#fef3c7', '#92400e'), border: '1px solid #fbbf24', borderRadius: '0.5rem',
          padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <AlertTriangle size={18} color="#d97706" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder level:
            {' '}{lowStockItems.map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="label">Item Name *</label>
                <input className="input" placeholder="e.g. Massage Oil" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Description</label>
                <input className="input" placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="label">Quantity</label>
                  <input className="input" type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="label">Unit</label>
                  <input className="input" placeholder="units / bottles / packs" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="label">Low Stock Threshold</label>
                  <input className="input" type="number" min="0" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="label">Price (₹)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editingItem ? 'Update' : 'Add Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(item => {
          const isLow = item.reorder_level > 0 && item.quantity <= item.reorder_level;
          const isCritical = item.reorder_level > 0 && item.quantity <= Math.floor(item.reorder_level / 2);
          return (
            <div key={item.id} className="card" style={{ padding: '1rem 1.25rem', borderLeft: isLow ? `4px solid ${isCritical ? '#dc2626' : '#f59e0b'}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Icon */}
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                  background: isLow ? (isCritical ? dm('#fef2f2') : dm('#fffbeb')) : dm('#f0fdf4'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isLow ? (isCritical ? '#dc2626' : '#d97706') : '#059669', flexShrink: 0
                }}>
                  {isLow ? <AlertTriangle size={18} /> : <Package size={18} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.name}</span>
                    {isLow && (
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 600, padding: '0.125rem 0.375rem', borderRadius: '1rem',
                        background: isCritical ? dm('#fef2f2') : dm('#fffbeb'),
                        color: isCritical ? '#dc2626' : '#d97706'
                      }}>{isCritical ? 'CRITICAL' : 'LOW STOCK'}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {item.description && <span>{item.description} · </span>}
                    Reorder at {item.reorder_level} {item.unit}
                    {item.price > 0 && <span> · ₹{item.price}</span>}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <button onClick={() => handleAdjust(item, -1)} style={{
                    width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                    border: '1px solid var(--border)', background: dm('white'), cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: dt('#64748b')
                  }}><ArrowDown size={14} /></button>
                  <div style={{
                    minWidth: '3.5rem', textAlign: 'center', padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem', fontWeight: 700, fontSize: '0.9375rem',
                    background: isLow ? (isCritical ? dm('#fef2f2') : dm('#fffbeb')) : dm('#f8fafc'),
                    color: isLow ? (isCritical ? '#dc2626' : '#d97706') : 'var(--text-primary)'
                  }}>
                    {item.quantity} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>{item.unit}</span>
                  </div>
                  <button onClick={() => handleAdjust(item, 1)} style={{
                    width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                    border: '1px solid var(--border)', background: dm('white'), cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: dt('#64748b')
                  }}><ArrowUp size={14} /></button>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button onClick={() => openEdit(item)} title="Edit" style={{
                    background: dm('#eef2ff'), border: 'none', cursor: 'pointer',
                    borderRadius: '0.25rem', padding: '0.375rem', color: '#6366f1'
                  }}><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(item)} title="Delete" style={{
                    background: dm('#fee2e2'), border: 'none', cursor: 'pointer',
                    borderRadius: '0.25rem', padding: '0.375rem', color: '#dc2626'
                  }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Package size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)', opacity: 0.3 }} />
            <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No inventory items yet</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Track supplies, products, and resources for your business</p>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={16} /> Add First Item</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
