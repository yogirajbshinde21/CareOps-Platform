import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, MoreHorizontal, Volume2 } from 'lucide-react';
import axios from 'axios';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper: extract booking details from conversation text as a reliable fallback
// (AI models often don't return structured data fields consistently)
const extractFromConversation = (msgs) => {
  const extracted = {};
  const userText = msgs.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const aiText = msgs.filter(m => m.role === 'assistant').map(m => m.content).join(' ');

  // Normalize speech-to-text: convert verbal "@" patterns to actual "@"
  // Handles: "at the rate", "at the rate of", "at rate", "at"
  const normalizedUserText = userText
    .replace(/\s+at\s+the\s+rate\s+of\s+/gi, '@')
    .replace(/\s+at\s+the\s+rate\s+/gi, '@')
    .replace(/\s+at\s+rate\s+/gi, '@');

  // Extract email — first try normalized user text, then verbal patterns, then AI messages
  const emailMatch = normalizedUserText.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
  if (emailMatch) {
    extracted.email = emailMatch[0].toLowerCase();
  } else {
    // Fallback: "yogiraj at gmail dot com" or "yogiraj at gmail.com"
    const verbalEmail = userText.match(/([\w.-]+)\s+at\s+([\w.-]+)\s*(?:dot|\.)\s*([a-z]{2,})/i);
    if (verbalEmail) {
      extracted.email = `${verbalEmail[1]}@${verbalEmail[2]}.${verbalEmail[3]}`.toLowerCase();
    } else {
      // Last resort: extract email from AI messages (AI often correctly formats it)
      const aiEmailMatch = aiText.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
      if (aiEmailMatch) extracted.email = aiEmailMatch[0].toLowerCase();
    }
  }

  // Extract phone (8+ digit sequences)
  const phoneMatch = userText.match(/(\d[\d\s-]{7,}\d)/);
  if (phoneMatch) extracted.phone = phoneMatch[0].replace(/[\s-]/g, '');

  // Extract name - "my name is X" / "I'm X" / "I am X"
  // Only capture capitalized words (proper names), stop before lowercase words like "and"
  const nameMatch = userText.match(/(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (nameMatch) extracted.name = nameMatch[1].trim();

  // Extract date from AI messages (AI reformats nicely: "February 23rd" or "2026-02-19")
  const months = { january:0, february:1, march:2, april:3, may:4, june:5,
                   july:6, august:7, september:8, october:9, november:10, december:11 };
  
  // First try ISO format (YYYY-MM-DD) - most reliable
  const isoDateMatches = [...aiText.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)];
  if (isoDateMatches.length > 0) {
    const lastMatch = isoDateMatches[isoDateMatches.length - 1];
    extracted.date = lastMatch[0]; // Already in YYYY-MM-DD format
  } else {
    // Fallback to text format (February 19th)
    const dateMatches = [...aiText.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?/gi)];
    if (dateMatches.length > 0) {
      const lastMatch = dateMatches[dateMatches.length - 1]; // Use last mention (most confirmed)
      const month = months[lastMatch[1].toLowerCase()];
      const day = parseInt(lastMatch[2]);
      const year = new Date().getFullYear();
      const d = new Date(year, month, day);
      if (d < new Date(new Date().toDateString())) d.setFullYear(year + 1);
      extracted.date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
  }

  return extracted;
};

const VoiceBookingModal = ({ 
  isOpen, onClose, 
  workspaceName, services, availability,
  onSelectService, onSelectDate, onSelectTime, onUpdateCustomer, onConfirmBook
}) => {
  useDarkMode();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm the ${workspaceName} AI assistant. How can I help you book today?` }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const messagesRef = useRef(messages);
  messagesRef.current = messages; // Keep ref synced with state

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const customerDataRef = useRef({}); // Persist data across turns
  const abortControllerRef = useRef(null); // Cancel pending AI requests

  // Keep callback refs synced to avoid stale closures in speech recognition handler
  const callbacksRef = useRef({ onSelectService, onSelectDate, onSelectTime, onUpdateCustomer, onConfirmBook, onClose });
  callbacksRef.current = { onSelectService, onSelectDate, onSelectTime, onUpdateCustomer, onConfirmBook, onClose };

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        processUserMessage(text);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('Speech recognition not supported');
    }
  }, []);

  // Speak welcome message on open
  useEffect(() => {
    if (isOpen && messages.length === 1) {
      speak(messages[0].content);
    }
  }, [isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup: abort pending AI request when modal closes
  useEffect(() => {
    if (!isOpen && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      // Cancel previous speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      // Try to find a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const processUserMessage = async (text) => {
    // Use REF to get latest messages (fix stale closure)
    const currentHistory = messagesRef.current;
    
    // Add user message
    const newMessages = [...currentHistory, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsProcessing(true);

    try {
      // Prepare context
      const context = {
        workspaceName,
        services: services.map(s => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
        availability, // Pass business hours so AI knows when we are open
        today: new Date().toDateString(), // Anchor for relative dates
        slots: [], // We need a way to get meaningful slots. For now, empty or basic availability.
        currentState: {
          // We can't easily access parent state here without props, 
          // but the AI tracks state via conversation history usually.
        }
      };

      // Cancel any pending request before starting new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Call Backend (90s timeout - first AI call can be slow due to cold start)
      const { data } = await axios.post(`${API_URL}/ai/booking-assistant`, {
        message: text,
        history: newMessages.map(m => ({ role: m.role, content: m.content })),
        context
      }, { 
        timeout: 90000,
        signal: abortControllerRef.current.signal
      });

      // Handle AI Response
      const aiReply = data.reply || "I'm sorry, I didn't catch that.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
      speak(aiReply);

      // === Handle Actions & Data Updates ===

      // 1. Process structured data from AI response (if any)
      if (data.data) {
        if (data.data.serviceId) {
          const service = services.find(s => s.id === data.data.serviceId);
          if (service) {
            callbacksRef.current.onSelectService(service);
            customerDataRef.current.serviceId = data.data.serviceId;
          }
        }
        if (data.data.date && data.data.date.length < 20) {
          callbacksRef.current.onSelectDate(data.data.date);
          customerDataRef.current.date = data.data.date; // Store date!
        }
        if (data.data.time) {
          let timeStr = data.data.time.replace(/\s+/g, '').toUpperCase();
          // Only parse simple time values (avoid corrupted ones like "11:00AM-1:00PM")
          if (!timeStr.includes('-')) {
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              let h = parseInt(timeMatch[1]);
              const m = timeMatch[2];
              if (timeStr.includes('PM') && h < 12) h += 12;
              if (timeStr.includes('AM') && h === 12) h = 0;
              const time24 = `${String(h).padStart(2, '0')}:${m}`;
              callbacksRef.current.onSelectTime(time24);
              customerDataRef.current.time = time24; // Store time!
            }
          }
        }
        // Merge AI-returned customer data into ref
        const aiCustomer = {
          name: data.data.customerName,
          email: data.data.customerEmail,
          phone: data.data.customerPhone,
          notes: data.data.customerNote
        };
        Object.keys(aiCustomer).forEach(key => {
          if (aiCustomer[key]) customerDataRef.current[key] = aiCustomer[key];
        });
      }

      // 2. Conversation extraction fallback — reliably parse name/email/phone/date
      //    from the actual conversation text (AI often omits structured fields)
      const fullConversation = [...newMessages, { role: 'assistant', content: aiReply }];
      const extracted = extractFromConversation(fullConversation);
      console.log('📝 Extracted from conversation:', extracted);
      
      // Always prefer extracted data (it's more reliable than AI structured data for these fields)
      if (extracted.name) customerDataRef.current.name = extracted.name;
      if (extracted.email) customerDataRef.current.email = extracted.email;
      if (extracted.phone) customerDataRef.current.phone = extracted.phone;

      // Set date from conversation if available
      if (extracted.date) {
        callbacksRef.current.onSelectDate(extracted.date);
        customerDataRef.current.date = extracted.date;
      }

      // Extract time from AI messages (e.g. "11:00 AM") as fallback
      const allText = fullConversation.map(m => m.content).join(' ');
      const timeFromConv = allText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeFromConv) {
        let th = parseInt(timeFromConv[1]);
        const tm = timeFromConv[2];
        const ampm = timeFromConv[3].toUpperCase();
        if (ampm === 'PM' && th < 12) th += 12;
        if (ampm === 'AM' && th === 12) th = 0;
        const extractedTime = `${String(th).padStart(2, '0')}:${tm}`;
        callbacksRef.current.onSelectTime(extractedTime);
        customerDataRef.current.time = extractedTime;
      }

      // Also try to extract serviceId if not already set
      if (!customerDataRef.current.serviceId && data.data?.serviceId) {
        customerDataRef.current.serviceId = data.data.serviceId;
      }

      // 3. Update parent form fields (progressive auto-fill)
      if (Object.keys(customerDataRef.current).length > 0) {
        callbacksRef.current.onUpdateCustomer(customerDataRef.current);
      }

      // 4. Handle confirm action — auto-submit the booking
      if (data.action === 'confirm') {
        const accumulated = { ...customerDataRef.current };
        console.log('🎯 Confirm action. Accumulated data:', accumulated);

        if (accumulated.name && accumulated.email) {
          callbacksRef.current.onConfirmBook(accumulated);
          callbacksRef.current.onClose();
        }
      }

    } catch (err) {
      // Silently ignore aborted requests (user started new message or closed modal)
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log('🔌 Request aborted');
        return;
      }
      console.error('AI Error:', err);
      
      // Timeout-specific message
      let errorMsg;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = "The AI is taking longer than expected. Please try again in a moment.";
      } else {
        errorMsg = "I'm having trouble connecting right now. Please try again.";
      }
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
      padding: '1rem'
    }}>
      <div style={{
        background: dm('white'), borderRadius: '1.5rem', width: '100%', maxWidth: '400px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1rem', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: dm('#f8fafc')
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '8px', height: '8px', borderRadius: '50%',
              background: isListening ? '#ef4444' : (isSpeaking ? '#22c55e' : '#94a3b8'),
              boxShadow: isListening ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none'
            }} />
            <span style={{ fontWeight: 600, color: dt('#0f172a') }}>Voice Assistant</span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Chat */}
        <div style={{
          height: '300px', overflowY: 'auto', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          background: dm('white')
        }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '0.75rem 1rem',
              borderRadius: '1rem',
              ...dmc(msg.role === 'user' ? '#4f46e5' : '#f1f5f9', msg.role === 'user' ? '#ffffff' : '#1e293b'),
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              borderBottomRightRadius: msg.role === 'user' ? '0' : '1rem',
              borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '1rem'
            }}>
              {msg.content}
            </div>
          ))}
          {isProcessing && (
            <div style={{ alignSelf: 'flex-start', color: '#94a3b8' }}>
              <MoreHorizontal size={24} className="spinner" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Controls */}
        <div style={{
          padding: '1.5rem', borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '1rem', background: dm('#f8fafc')
        }}>
          <button 
            onClick={toggleListening}
            style={{
              width: '4rem', height: '4rem', borderRadius: '50%',
              background: isListening ? '#ef4444' : '#4f46e5',
              color: 'white', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          
          <div style={{ position: 'absolute', bottom: '2rem', right: '2rem', opacity: 0.5 }}>
             {isSpeaking && <Volume2 size={20} className="pulse" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceBookingModal;
