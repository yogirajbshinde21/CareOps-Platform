// client/src/pages/BookingPage.jsx - Public booking page for customers
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, User, Mail, Phone, CheckCircle, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import VoiceBookingModal from '../components/VoiceBookingModal';
import { Mic } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const BookingPage = () => {
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [step, setStep] = useState(1); // 1: service, 2: date/time, 3: info, 4: confirmed
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [customer, setCustomer] = useState({
    name: '', email: '', phone: '', notes: ''
  });
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  useEffect(() => {
    fetchBookingData();
  }, [slug]);

  const fetchBookingData = async () => {
    try {
      // Get workspace by slug
      const wsRes = await axios.get(`${API_URL}/workspaces/public/${slug}`);
      setWorkspace(wsRes.data);

      // Get services & availability
      const [servRes, availRes] = await Promise.all([
        axios.get(`${API_URL}/services/public/${wsRes.data.id}`),
        axios.get(`${API_URL}/availability/public/${wsRes.data.id}`)
      ]);

      setServices(servRes.data || []);
      setAvailability(availRes.data || []);
    } catch (err) {
      setError('Booking page not found');
      console.error('Booking page error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSlotsForDate = (dateStr) => {
    if (!availability.length) return [];
    const dayOfWeek = new Date(dateStr).getDay();
    const dayAvail = availability.find(a => a.day_of_week === dayOfWeek);
    if (!dayAvail || !dayAvail.is_available) return [];

    const slots = [];
    const [startH, startM] = dayAvail.start_time.split(':').map(Number);
    const [endH, endM] = dayAvail.end_time.split(':').map(Number);
    const duration = selectedService?.duration || 60;

    let current = startH * 60 + startM;
    const end = endH * 60 + endM;

    while (current + duration <= end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      current += 30; // 30-min intervals
    }
    return slots;
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    return getSlotsForDate(selectedDate);
  };

  const handleSubmit = async (voiceOverride = null) => {
    // Voice AI passes all booking data (name, email, phone, date, serviceId, etc.)
    const override = voiceOverride && voiceOverride.name ? voiceOverride : null;
    const finalCustomer = override || customer;
    const finalDate = override?.date || selectedDate;
    const finalTime = override?.time || selectedTime;

    // Resolve service: use selectedService state, or look up from voice override serviceId
    let finalService = selectedService;
    if (!finalService && override?.serviceId) {
      finalService = services.find(s => s.id === override.serviceId);
    }

    if (!finalCustomer.name || !finalCustomer.email) {
      return toast.error('Name and email are required');
    }
    if (!finalDate || !finalTime || !finalService) {
      return toast.error('Service, date, and time are required');
    }

    // Sync UI state for step 4 confirmation display
    if (override) {
      setCustomer(prev => ({ ...prev, name: override.name, email: override.email, phone: override.phone || prev.phone, notes: override.notes || prev.notes }));
      if (override.date) setSelectedDate(override.date);
    }

    setSubmitting(true);
    try {
      // Calculate end time
      const duration = finalService?.duration || 60;
      const [h, m] = finalTime.split(':').map(Number);
      const endMinutes = h * 60 + m + duration;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

      await axios.post(`${API_URL}/bookings/public`, {
        workspace_id: workspace.id,
        service_id: finalService.id,
        date: finalDate,
        start_time: finalTime,
        end_time: endTime,
        customer: { name: finalCustomer.name, email: finalCustomer.email, phone: finalCustomer.phone || '', notes: finalCustomer.notes || '' }
      });

      setStep(4);
      toast.success('Booking confirmed!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Get min date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get max date (advance booking days)
  const getMaxDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-main)', flexDirection: 'column', gap: '1rem'
      }}>
        <FileText size={48} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{error}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This booking page doesn't exist or has been removed.</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
      padding: '2rem 1rem'
    }}>
      <Toaster position="top-center" />
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'white' }}>
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '0.75rem',
            background: 'rgba(255,255,255,0.15)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.75rem',
            backdropFilter: 'blur(10px)'
          }}>C</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{workspace?.name}</h1>
          <p style={{ opacity: 0.8, fontSize: '0.875rem', marginTop: '0.25rem' }}>Book an appointment</p>
        </div>
        
        {/* Voice Trigger */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button 
            onClick={() => setIsVoiceOpen(true)}
            style={{
              padding: '0.75rem 1.5rem', borderRadius: '2rem',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)', color: 'white',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <Mic size={18} className="pulse" /> 
            Voice Booking Assistant
          </button>
        </div>

        {/* Progress */}
        {step < 4 && (
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: '3px', borderRadius: '2px',
                background: s <= step ? 'white' : 'rgba(255,255,255,0.25)'
              }} />
            ))}
          </div>
        )}

        <div style={{
          background: 'white', borderRadius: '1rem',
          padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
        }}>
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Select a Service</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => { setSelectedService(service); setStep(2); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem', borderRadius: '0.5rem',
                      border: '1px solid var(--border)', background: 'white',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{service.name}</div>
                      {service.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>{service.description}</div>}
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={13} /> {service.duration} min</span>
                        {service.price > 0 && <span>₹{service.price}</span>}
                      </div>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                ))}
              </div>
              {services.length === 0 && (
                <div className="empty-state">
                  <p>No services available for booking</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
                Select Date & Time
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {selectedService?.name} — {selectedService?.duration} min
              </p>

              <div className="form-group">
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                  min={getMinDate()}
                  max={getMaxDate()}
                />
              </div>

              {selectedDate && (
                <div className="form-group">
                  <label className="label">Available Times</label>
                  {generateTimeSlots().length > 0 ? (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                      gap: '0.5rem'
                    }}>
                      {generateTimeSlots().map(time => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          style={{
                            padding: '0.5rem', borderRadius: '0.375rem',
                            border: `2px solid ${selectedTime === time ? 'var(--primary)' : 'var(--border)'}`,
                            background: selectedTime === time ? '#eef2ff' : 'white',
                            color: selectedTime === time ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500
                          }}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      No availability on this day
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button onClick={() => setStep(1)} className="btn btn-secondary"><ArrowLeft size={16} /> Back</button>
                <button
                  onClick={() => setStep(3)}
                  className="btn btn-primary"
                  disabled={!selectedDate || !selectedTime}
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Customer Info */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Your Details</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {selectedService?.name} · {selectedDate} at {selectedTime}
              </p>

              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Your name" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" placeholder="you@email.com" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Notes (optional)</label>
                <textarea className="input" rows={2} placeholder="Anything we should know?" value={customer.notes} onChange={e => setCustomer({...customer, notes: e.target.value})} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <button onClick={() => setStep(2)} className="btn btn-secondary"><ArrowLeft size={16} /> Back</button>
                <button onClick={handleSubmit} className="btn btn-primary btn-lg" disabled={submitting}>
                  {submitting ? <div className="spinner" /> : <CheckCircle size={18} />}
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '4rem', height: '4rem', borderRadius: '50%',
                background: '#ecfdf5', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <CheckCircle size={32} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Booking Confirmed!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                You'll receive a confirmation at {customer.email}
              </p>
              <div style={{
                padding: '1rem', background: '#f8fafc',
                borderRadius: '0.5rem', textAlign: 'left',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Service</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{selectedService?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Date</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Time</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{selectedTime}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    <VoiceBookingModal 
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        workspaceName={workspace?.name}
        services={services}
        availability={availability}
        onSelectService={(s) => { setSelectedService(s); setStep(2); }}
        onSelectDate={(d) => { setSelectedDate(d); }}
        onSelectTime={(t) => { setSelectedTime(t); setStep(3); }}
        onUpdateCustomer={(c) => setCustomer(prev => ({ ...prev, ...c }))}
        onConfirmBook={handleSubmit}
      />
    </div>
  );
};

export default BookingPage;

