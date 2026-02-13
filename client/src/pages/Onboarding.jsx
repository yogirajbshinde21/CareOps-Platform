// client/src/pages/Onboarding.jsx - 8-step onboarding wizard with AI Voice Assistant + Quick Start Templates
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, Briefcase, Clock, Users, CalendarCheck, 
  Mail, FileText, CheckCircle, ArrowRight, ArrowLeft, Plus, Trash2,
  Mic, MicOff, Sparkles, Send, Bot, User, Volume2, X, Edit3, Loader, Package, Settings, Zap
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import BUSINESS_TEMPLATES from '../data/businessTemplates';
import Confetti from '../components/Confetti';
import { dm, dt, dmc, dmGrad, useDarkMode } from '../utils/darkMode';

const BUSINESS_TYPES = [
  'Salon & Spa', 'Health & Wellness', 'Fitness & Gym', 'Medical Practice',
  'Dental Clinic', 'Consulting', 'Tutoring & Education', 'Pet Care',
  'Home Services', 'Legal Services', 'Photography', 'Other'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── AI Assistant Modal Component ─────────────────────────────────────────────
const INITIAL_AI_MESSAGES = [
  {
    role: 'assistant',
    content: "Hi! I'm your CareOps AI Assistant 🤖✨\n\nTell me about your business and I'll set everything up for you! You can speak or type.\n\nFor example: \"I run a hair salon called Glamour Studio. We're open Monday to Saturday, 10am to 7pm. We offer haircuts for ₹500, coloring for ₹2000, and spa treatments for ₹3000.\""
  }
];

const AIAssistantModal = ({ 
  isOpen, onClose, onApplyData,
  messages, setMessages,
  extractedData, setExtractedData,
  editableData, setEditableData
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // extractedData, editableData are now props
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser. Please type instead.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInputText(finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access or type instead.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    toast.success('🎤 Listening... Speak about your business!');
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    // Add user message
    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsProcessing(true);

    try {
      // Build conversation history for context
      const conversationHistory = updatedMessages
        .filter(m => m.role !== 'assistant' || updatedMessages.indexOf(m) > 0)
        .map(m => ({ role: m.role, content: m.content }));

      const { data } = await api.post('/ai/process-voice', {
        input: text,
        conversationHistory
      });

      if (data.success === false) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || 'Something went wrong. Could you try again?'
        }]);
      } else if (data.needs_followup && data.followup_questions?.length > 0) {
        // AI needs more info
        const followupMsg = `I got some details! But I need a bit more info:\n\n${data.followup_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${data.summary ? `So far I understand: *${data.summary}*` : ''}`;
        setMessages(prev => [...prev, { role: 'assistant', content: followupMsg }]);
        
        // Store partial data if available
        if (data.data) {
          setExtractedData(data.data);
          setEditableData(JSON.parse(JSON.stringify(data.data)));
        }
      } else {
        // Got complete data!
        setExtractedData(data.data);
        setEditableData(JSON.parse(JSON.stringify(data.data)));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Got it! Here's what I extracted:\n\n**${data.summary}**\n\nScroll down to review and confirm the data. You can edit anything before applying it to your setup!`
        }]);
      }
    } catch (err) {
      console.error('AI process error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Oops! Something went wrong connecting to the AI. Please try again.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyData = () => {
    const dataToApply = isEditing ? editableData : extractedData;
    onApplyData(dataToApply);
    onClose();
    toast.success('🎉 AI data applied! Review each step and continue.');
  };

  const updateEditableService = (idx, field, value) => {
    const updated = { ...editableData };
    updated.services[idx] = { ...updated.services[idx], [field]: value };
    setEditableData(updated);
  };

  const removeEditableService = (idx) => {
    const updated = { ...editableData };
    updated.services = updated.services.filter((_, i) => i !== idx);
    setEditableData(updated);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '640px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.375rem', borderRadius: '0.5rem' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>CareOps Assistant</h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>Voice & Text Setup</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}>
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: dm('#f8fafc'), display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: msg.role === 'user' ? 'var(--primary)' : dm('white'),
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              padding: '0.75rem 1rem',
              borderRadius: msg.role === 'user' ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none'
            }}>
              {msg.content}
            </div>
          ))}
          {isProcessing && (
            <div style={{ alignSelf: 'flex-start', background: dm('white'), padding: '0.75rem 1rem', borderRadius: '1rem 1rem 1rem 0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div className="spinner" style={{ width: '1rem', height: '1rem', border: '2px solid #e2e8f0', borderTopColor: 'var(--primary)' }} />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Extracted Data Review (if available) */}
        {extractedData && (

            <div style={{ padding: '1rem', background: dm('#e0e7ff'), border: '2px solid #818cf8', borderRadius: '0.5rem', marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #c7d2fe', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.975rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: dt('#1e1b4b') }}>
                  <CheckCircle size={16} color="#4338ca" /> Review & Edit Extracted Data
                </h4>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  style={{ fontSize: '0.75rem', color: '#4338ca', background: dm('white'), border: '1px solid #4338ca', borderRadius: '1rem', padding: '0.25rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                >
                  <Edit3 size={12} /> {isEditing ? 'Done Editing' : 'Edit Data'}
                </button>
              </div>
              
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                {/* Business Type */}
                <div style={{ ...dmc('white', '#1e293b'), padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #c7d2fe' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#4f46e5' }}>Business Type</strong>
                  {isEditing ? (
                    <select 
                      value={editableData.business_type} 
                      onChange={e => setEditableData({...editableData, business_type: e.target.value})}
                      style={{ width: '100%', padding: '0.375rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                    >
                      {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (extractedData.business_type || 'Not detected')}
                </div>

                {/* Contact Info */}
                <div style={{ ...dmc('white', '#1e293b'), padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #c7d2fe' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4f46e5' }}>Contact Details</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {['phone', 'email', 'address', 'website'].map(field => (
                      <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{field}:</span>
                        {isEditing ? (
                          <input 
                            value={editableData[field] || ''}
                            onChange={e => setEditableData({...editableData, [field]: e.target.value})}
                            placeholder={`Enter ${field}`}
                            style={{ padding: '0.375rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                          />
                        ) : (extractedData[field] || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not provided</span>)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services */}
                <div style={{ ...dmc('white', '#1e293b'), padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #c7d2fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#4f46e5' }}>Services ({isEditing ? editableData?.services?.length || 0 : extractedData?.services?.length || 0})</strong>
                    {isEditing && (
                      <button 
                        onClick={() => setEditableData({...editableData, services: [...editableData.services, { name: '', price: 0, duration: 60 }]})}
                        style={{ fontSize: '0.75rem', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >+ Add New</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {((isEditing ? editableData : extractedData)?.services || []).map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: dm('#f8fafc'), padding: '0.5rem', borderRadius: '0.25rem' }}>
                        {isEditing ? (
                          <>
                            <input 
                              value={s.name} 
                              onChange={e => updateEditableService(i, 'name', e.target.value)} 
                              placeholder="Name"
                              style={{ flex: 1, padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                            />
                            <input 
                              type="number"
                              value={s.price} 
                              onChange={e => updateEditableService(i, 'price', parseInt(e.target.value) || 0)} 
                              style={{ width: '60px', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                            />
                            <button onClick={() => removeEditableService(i)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span>• {s.name} - ₹{s.price}</span>
                        )}
                      </div>
                    ))}
                    {!((isEditing ? editableData : extractedData)?.services?.length) && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No services detected</span>}
                  </div>
                </div>

                {/* Availability Summary */}
                <div style={{ ...dmc('white', '#1e293b'), padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #c7d2fe' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#4f46e5' }}>Availability</strong>
                  <div style={{ fontSize: '0.8125rem' }}>
                    {((isEditing ? editableData : extractedData)?.availability || []).filter(d => d.is_available).length} days open. 
                    <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>(Edit details in next steps)</span>
                  </div>
                </div>
              </div>


            <button
              onClick={applyData}
              style={{
                width: '100%', marginTop: '1rem', padding: '0.75rem',
                background: 'var(--success)', color: 'white', border: 'none',
                borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
               Apply to Setup <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', background: dm('white') }}>
           <button
            onClick={isListening ? stopListening : startListening}
            style={{
              width: '3rem', height: '3rem', borderRadius: '50%',
              background: isListening ? '#fef2f2' : 'white',
              border: `1px solid ${isListening ? '#ef4444' : 'var(--border)'}`,
              color: isListening ? '#ef4444' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative', flexShrink: 0
            }}
            title={speechSupported ? "Hold to speak" : "Voice not supported"}
            disabled={!speechSupported}
          >
            {isListening ? (
              <>
                <MicOff size={20} />
                <span style={{ position: 'absolute', inset: -4, border: '2px solid #ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
              </>
            ) : (
              <Mic size={20} />
            )}
          </button>

          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Describe your business..."}
              style={{
                width: '100%', height: '3rem', borderRadius: '1.5rem',
                border: '1px solid var(--border)', padding: '0.75rem 3rem 0.75rem 1.25rem',
                resize: 'none', outline: 'none', fontSize: '0.9375rem',
                background: isListening ? '#fafafa' : dm('white'),
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isProcessing}
            style={{
              width: '3rem', height: '3rem', borderRadius: '50%',
              background: inputText.trim() && !isProcessing ? 'var(--primary)' : '#f1f5f9',
              border: 'none',
              color: inputText.trim() && !isProcessing ? 'white' : '#94a3b8',
              transition: 'all 0.2s', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
};

// ─── Main Onboarding Component ────────────────────────────────────────────────
const Onboarding = () => {
  useDarkMode();
  const { workspace, updateWorkspace } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = welcome, 1-8 = wizard
  const [loading, setLoading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // AI State (persisted across open/close)
  const [aiMessages, setAiMessages] = useState(INITIAL_AI_MESSAGES);
  const [aiExtractedData, setAiExtractedData] = useState(null);
  const [aiEditableData, setAiEditableData] = useState(null);

  const totalSteps = 8;

  // Activation check state
  const [activationCheck, setActivationCheck] = useState(null);

  // Step 1: Business Info
  const [businessInfo, setBusinessInfo] = useState({
    business_type: '', address: '', phone: '', email: '', website: '', timezone: 'Asia/Kolkata'
  });

  // Step 2: Services
  const [services, setServices] = useState([
    { name: '', duration: 60, price: 0, description: '' }
  ]);

  // Step 3: Availability
  const [availability, setAvailability] = useState(
    DAYS.map((_, i) => ({
      day_of_week: i,
      start_time: '09:00',
      end_time: '17:00',
      is_available: i >= 1 && i <= 5
    }))
  );

  // Step 4: Inventory
  const [inventoryItems, setInventoryItems] = useState([
    { name: 'Example Product', quantity: 10, unit: 'units', reorder_level: 5, price: 0 }
  ]);

  // Step 5: Forms
  const [formsEnabled, setFormsEnabled] = useState(true);

  // Step 7: Booking preferences
  const [bookingPrefs, setBookingPrefs] = useState({
    buffer_time: 15,
    advance_booking_days: 30,
    auto_confirm: false
  });

  // Webhook URL for integrations
  const [webhookUrl, setWebhookUrl] = useState('');

  // ─── AI / Template Data Apply Handler ────────────────────────────────────────
  const handleAIDataApply = (data) => {
    if (!data) return;

    if (data.business_type) {
      setBusinessInfo(prev => ({ ...prev, business_type: data.business_type, phone: data.phone || prev.phone, email: data.email || prev.email, address: data.address || prev.address, website: data.website || prev.website }));
    }

    if (data.services?.length > 0) {
      setServices(data.services.map(s => ({ name: s.name || '', duration: s.duration || 60, price: s.price || 0, description: s.description || '' })));
    }

    if (data.availability?.length === 7) {
      setAvailability(data.availability.map(a => ({ day_of_week: a.day_of_week, start_time: a.start_time || '09:00', end_time: a.end_time || '17:00', is_available: a.is_available ?? false })));
    }

    if (data.inventory?.length > 0) {
      setInventoryItems(data.inventory.map(i => ({ name: i.name || '', quantity: i.quantity || 0, unit: i.unit || 'units', reorder_level: i.reorder_level || 0, price: i.price || 0 })));
    }

    if (data.booking_preferences || data.bookingPrefs) {
      const prefs = data.booking_preferences || data.bookingPrefs;
      setBookingPrefs(prev => ({ ...prev, ...prefs }));
    }

    setStep(1);
  };

  // ─── Quick Start Template Handler ───────────────────────────────────────────
  const handleTemplateSelect = (businessType) => {
    const template = BUSINESS_TEMPLATES[businessType];
    if (!template) return;

    handleAIDataApply({
      business_type: businessType,
      services: template.services,
      availability: template.availability,
      inventory: template.inventory,
      bookingPrefs: template.bookingPrefs,
    });

    setShowTemplatePicker(false);
    toast.success(`⚡ ${businessType} template loaded! Review and customize each step.`);
  };

  const addService = () => setServices([...services, { name: '', duration: 60, price: 0, description: '' }]);
  const removeService = (idx) => services.length > 1 && setServices(services.filter((_, i) => i !== idx));
  const updateService = (idx, field, value) => {
    const updated = [...services];
    updated[idx] = { ...updated[idx], [field]: value };
    setServices(updated);
  };

  const addInventoryItem = () => setInventoryItems([...inventoryItems, { name: '', quantity: 0, unit: 'units', reorder_level: 0, price: 0 }]);
  const removeInventoryItem = (idx) => inventoryItems.length > 1 && setInventoryItems(inventoryItems.filter((_, i) => i !== idx));
  const updateInventory = (idx, field, value) => {
    const updated = [...inventoryItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setInventoryItems(updated);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!businessInfo.business_type) return toast.error('Please select a business type');
      try {
        setLoading(true);
        await api.put('/workspaces/current', businessInfo);
      } catch (err) {
        toast.error('Failed to save business info');
        return;
      } finally { setLoading(false); }
    }

    if (step === 2) {
      const validServices = services.filter(s => s.name.trim());
      if (validServices.length === 0) return toast.error('Add at least one service');
      try {
        setLoading(true);
        await api.post('/services/bulk', { services: validServices });
      } catch (err) {
        toast.error('Failed to save services');
        return;
      } finally { setLoading(false); }
    }

    if (step === 3) {
      try {
        setLoading(true);
        await api.post('/availability/bulk', { availability });
      } catch (err) {
        toast.error('Failed to save availability');
        return;
      } finally { setLoading(false); }
    }

    if (step === 4) {
      const validItems = inventoryItems.filter(i => i.name.trim());
      if (validItems.length > 0) {
        try {
          setLoading(true);
          await api.post('/inventory/bulk', { items: validItems });
        } catch (err) {
          toast.error('Failed to save inventory');
          return;
        } finally { setLoading(false); }
      }
    }

    if (step === 5) {
      // Create a default intake form if forms are enabled
      if (formsEnabled) {
        try {
          setLoading(true);
          await api.post('/forms', {
            name: 'Customer Intake Form',
            description: 'Default intake form for new customers',
            fields: [
              { name: 'full_name', label: 'Full Name', type: 'text', required: true },
              { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
              { name: 'email', label: 'Email', type: 'email', required: false },
              { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false },
            ]
          });
        } catch (err) {
          // Form may already exist — that's fine, ignore duplicates
          console.log('Form creation skipped (may already exist):', err?.response?.status);
        } finally { setLoading(false); }
      }
    }

    if (step === 7) {
      try {
        setLoading(true);
        const settings = {
          ...workspace.settings,
          booking_preferences: bookingPrefs,
          webhooks: webhookUrl ? [{ url: webhookUrl, events: ['booking.created', 'contact.created', 'form.submitted', 'inventory.low_stock'], active: true }] : []
        };
        await api.put('/workspaces/current', { settings });
      } catch (err) {
        toast.error('Failed to save preferences');
        return;
      } finally { setLoading(false); }
    }

    if (step < totalSteps) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === totalSteps) {
        // Fetch activation check when we reach final step
        try {
          const res = await api.get('/workspaces/activation-check');
          setActivationCheck(res.data);
        } catch { setActivationCheck({ hasServices: false, hasAvailability: false, hasContactForm: false, hasEmail: true, canActivate: false }); }
      }
    }
  };

  const handleComplete = async () => {
    if (activationCheck && !activationCheck.canActivate) {
      toast.error('Please complete required steps (Services + Working Hours) before activating');
      return;
    }
    try {
      setLoading(true);
      await api.put('/workspaces/complete-onboarding');
      // Update local workspace state so HomeRedirect sees onboarding_completed = true
      updateWorkspace({ onboarding_completed: true });
      setShowConfetti(true);
      toast.success('🎉 Setup complete! Welcome to CareOps!');
      // Delay navigation to let confetti play
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      toast.error('Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Business Information</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Tell us about your business</p>
            <div className="form-group">
              <label className="label">Business Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBusinessInfo({ ...businessInfo, business_type: type })}
                    style={{
                      padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
                      border: `2px solid ${businessInfo.business_type === type ? 'var(--primary)' : 'var(--border)'}`,
                      background: businessInfo.business_type === type ? dm('#eef2ff') : dm('white'),
                      color: businessInfo.business_type === type ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={businessInfo.phone} onChange={e => setBusinessInfo({...businessInfo, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="hello@business.com" value={businessInfo.email} onChange={e => setBusinessInfo({...businessInfo, email: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Address</label>
              <textarea className="input" rows={2} placeholder="123 Main St, City, State" value={businessInfo.address} onChange={e => setBusinessInfo({...businessInfo, address: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">Website</label>
              <input className="input" placeholder="https://yourbusiness.com" value={businessInfo.website} onChange={e => setBusinessInfo({...businessInfo, website: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">Timezone</label>
              <select className="input" value={businessInfo.timezone} onChange={e => setBusinessInfo({...businessInfo, timezone: e.target.value})}>
                {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Jakarta',
                  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
                  'America/Denver', 'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'
                ].map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Your Services</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Add the services you offer to customers</p>
            {services.map((service, idx) => (
              <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '0.75rem', background: dm('#fafafa') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Service {idx + 1}</span>
                  {services.length > 1 && (
                    <button onClick={() => removeService(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={15} /></button>
                  )}
                </div>
                <div className="form-group">
                  <input className="input" placeholder="Service name (e.g., Haircut)" value={service.name} onChange={e => updateService(idx, 'name', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="label">Duration (min)</label>
                    <input className="input" type="number" min="15" step="15" value={service.duration} onChange={e => updateService(idx, 'duration', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Price (₹)</label>
                    <input className="input" type="number" min="0" value={service.price} onChange={e => updateService(idx, 'price', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input className="input" placeholder="Description (optional)" value={service.description} onChange={e => updateService(idx, 'description', e.target.value)} />
                </div>
              </div>
            ))}
            <button onClick={addService} className="btn btn-secondary" style={{ width: '100%' }}><Plus size={16} /> Add Another Service</button>
          </div>
        );
      case 3:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Working Hours</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Set your business availability</p>
            {availability.map((day, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={day.is_available} onChange={e => { const updated = [...availability]; updated[idx].is_available = e.target.checked; setAvailability(updated); }} style={{ accentColor: 'var(--primary)' }} />
                  {DAYS[idx]}
                </label>
                {day.is_available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '200px' }}>
                    <input type="time" className="input" value={day.start_time} onChange={e => { const updated = [...availability]; updated[idx].start_time = e.target.value; setAvailability(updated); }} style={{ flex: '1 1 100px', minWidth: '100px', maxWidth: '140px' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>to</span>
                    <input type="time" className="input" value={day.end_time} onChange={e => { const updated = [...availability]; updated[idx].end_time = e.target.value; setAvailability(updated); }} style={{ flex: '1 1 100px', minWidth: '100px', maxWidth: '140px' }} />
                  </div>
                )}
                {!day.is_available && <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Closed</span>}
              </div>
            ))}
          </div>
        );
      case 4:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Inventory Setup</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Add products you track (shampoos, oils, medical supplies)</p>
            {inventoryItems.map((item, idx) => (
              <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '0.75rem', background: dm('#fafafa') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Item {idx + 1}</span>
                  {inventoryItems.length > 1 && (
                    <button onClick={() => removeInventoryItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={15} /></button>
                  )}
                </div>
                <div className="form-group">
                  <input className="input" placeholder="Product name (e.g., L'Oreal Shampoo)" value={item.name} onChange={e => updateInventory(idx, 'name', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="label">Quantity</label>
                    <input className="input" type="number" min="0" value={item.quantity} onChange={e => updateInventory(idx, 'quantity', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Reorder Level</label>
                    <input className="input" type="number" min="0" value={item.reorder_level} onChange={e => updateInventory(idx, 'reorder_level', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addInventoryItem} className="btn btn-secondary" style={{ width: '100%' }}><Plus size={16} /> Add Another Item</button>
          </div>
        );
      case 5:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Intake Forms</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Configure customer intake forms</p>
            <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '0.75rem', background: dm('#fafafa') }}>
              <FileText size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-secondary)', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Intake Forms</p>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formsEnabled} onChange={e => setFormsEnabled(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                  Enable Intake Forms for Bookings
                </label>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                Can be customized later in Form Builder
              </p>
            </div>
          </div>
        );
      case 6:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Team Members</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>You can add staff members later</p>
            <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '0.75rem', background: dm('#fafafa') }}>
              <Users size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-secondary)', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>You're the owner</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Staff management can be configured after setup</p>
            </div>
          </div>
        );
      case 7:
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Booking & Integrations</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Configure booking preferences and external integrations</p>
            <div className="form-group">
              <label className="label">Buffer Time (minutes)</label>
              <select className="input" value={bookingPrefs.buffer_time} onChange={e => setBookingPrefs({...bookingPrefs, buffer_time: parseInt(e.target.value)})}>
                <option value={0}>No buffer</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Booking Horizon</label>
              <select className="input" value={bookingPrefs.advance_booking_days} onChange={e => setBookingPrefs({...bookingPrefs, advance_booking_days: parseInt(e.target.value)})}>
                <option value={7}>1 week</option>
                <option value={30}>1 month</option>
                <option value={90}>3 months</option>
              </select>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={16} /> Webhook Integration
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                Receive real-time notifications when bookings, contacts, or forms are created. Events are sent as POST requests.
              </p>
              <div className="form-group">
                <label className="label">Webhook URL (optional)</label>
                <input className="input" placeholder="https://hooks.zapier.com/... or your endpoint" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: dm('#f8fafc'), padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <strong>Events sent:</strong> booking.created, contact.created, form.submitted, inventory.low_stock
              </div>
            </div>
          </div>
        );
      case 8: {
        const checks = activationCheck || {};
        const items = [
          { label: 'Business Info', done: !!businessInfo.business_type, required: false },
          { label: 'Services', done: !!checks.hasServices, required: true },
          { label: 'Working Hours', done: !!checks.hasAvailability, required: true },
          { label: 'Inventory', done: inventoryItems.some(i => i.name.trim()), required: false },
          { label: 'Intake Forms', done: !!checks.hasContactForm, required: false },
          { label: 'Email Configured', done: !!checks.hasEmail, required: false },
          { label: 'Booking Prefs', done: true, required: false },
        ];
        const canActivate = checks.canActivate !== false;
        return (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>You're All Set! 🎉</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Review your setup and launch CareOps</p>
            {!canActivate && (
              <div style={{ ...dmc('#fef3c7', '#92400e'), border: '1px solid #f59e0b', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                ⚠️ Complete the required steps marked with * before activating.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: item.done ? dm('#f0fdf4') : dm('#fafafa'), borderRadius: '0.5rem', border: `1px solid ${item.done ? '#bbf7d0' : item.required ? '#fca5a5' : 'var(--border)'}` }}>
                  <CheckCircle size={18} color={item.done ? 'var(--success)' : item.required ? '#ef4444' : 'var(--border)'} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.label}{item.required ? ' *' : ''}</span>
                  {!item.done && item.required && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>Required</span>}
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '2rem 1rem' }}>
      <Confetti active={showConfetti} duration={3000} />
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {step === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0f0a3c 0%, #1e1b4b 100%)', borderRadius: '1rem', color: 'white' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>Welcome to CareOps!</h1>
            <p style={{ marginBottom: '2rem', opacity: 0.8 }}>Let's set up <strong>{workspace?.name}</strong></p>
            <button onClick={() => setShowTemplatePicker(true)} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', fontWeight: 700, marginBottom: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Zap size={18} /> Quick Start Template
            </button>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.75rem' }}>Pre-configured setup for your business type — ready in seconds</p>
            <button onClick={() => setShowAIModal(true)} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: dm('white'), color: '#4f46e5', fontWeight: 700, marginBottom: '0.75rem', border: 'none', cursor: 'pointer' }}>
              <Sparkles size={18} style={{ display: 'inline', marginRight: '0.5rem' }} /> Setup with AI Assistant
            </button>
            <button onClick={() => setStep(1)} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
              Manual Setup
            </button>

            {/* ─── Template Picker Modal ──────────────────────────────────── */}
            {showTemplatePicker && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                padding: '1rem'
              }} onClick={() => setShowTemplatePicker(false)}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: dm('white'), borderRadius: '1rem', width: '100%', maxWidth: '640px',
                  maxHeight: '85vh', overflow: 'auto', padding: '2rem',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.3)', color: dt('#1a1a2e')
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Zap size={20} color="#f59e0b" /> Quick Start Templates
                    </h2>
                    <button onClick={() => setShowTemplatePicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                      <X size={20} color="#666" />
                    </button>
                  </div>
                  <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Pick your business type for instant setup with services, hours, and inventory
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem' }}>
                    {Object.entries(BUSINESS_TEMPLATES).map(([type, tpl]) => (
                      <button
                        key={type}
                        onClick={() => handleTemplateSelect(type)}
                        style={{
                          padding: '1.25rem 1rem', borderRadius: '0.75rem',
                          border: '2px solid #e5e7eb', background: dm('#fafbfc'),
                          cursor: 'pointer', textAlign: 'center',
                          transition: 'all 0.2s ease',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = dm('#eef2ff'); e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = dm('#fafbfc'); e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <span style={{ fontSize: '2rem' }}>{tpl.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: dt('#1a1a2e') }}>{type}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#888', lineHeight: 1.3 }}>{tpl.tagline}</span>
                        <span style={{ fontSize: '0.625rem', color: '#4f46e5', fontWeight: 600, marginTop: '0.25rem' }}>
                          {tpl.services.length} services · {tpl.inventory.length} items
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <AIAssistantModal 
              isOpen={showAIModal} 
              onClose={() => setShowAIModal(false)} 
              onApplyData={handleAIDataApply}
              messages={aiMessages} setMessages={setAiMessages}
              extractedData={aiExtractedData} setExtractedData={setAiExtractedData}
              editableData={aiEditableData} setEditableData={setAiEditableData}
            />
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Set Up {workspace?.name}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '2rem' }}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < step ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>Step {step} of {totalSteps}</p>
              <button onClick={() => setShowAIModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600 }}>
                <Sparkles size={12} /> AI Fill
              </button>
            </div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              {renderStep()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(Math.max(0, step - 1))} className="btn btn-secondary"><ArrowLeft size={16} /> Back</button>
              {step === totalSteps ? (
                <button onClick={handleComplete} className="btn btn-primary" disabled={loading || (activationCheck && !activationCheck.canActivate)} style={(activationCheck && !activationCheck.canActivate) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>{loading ? 'Finishing...' : 'Launch CareOps \ud83d\ude80'} <CheckCircle size={16} /></button>
              ) : (
                <button onClick={handleNext} className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Continue'} <ArrowRight size={16} /></button>
              )}
            </div>
            <AIAssistantModal 
              isOpen={showAIModal} 
              onClose={() => setShowAIModal(false)} 
              onApplyData={handleAIDataApply}
              messages={aiMessages} setMessages={setAiMessages}
              extractedData={aiExtractedData} setExtractedData={setAiExtractedData}
              editableData={aiEditableData} setEditableData={setAiEditableData}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
