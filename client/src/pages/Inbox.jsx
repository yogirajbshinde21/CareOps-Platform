// client/src/pages/Inbox.jsx - Unified inbox / conversations
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

const Inbox = () => {
  useDarkMode();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data || []);
    } catch (err) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (convo) => {
    setSelected(convo);
    try {
      const { data } = await api.get(`/conversations/${convo.id}/messages`);
      setMessages(data || []);
    } catch (err) {
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selected.id}/messages`, { content: newMessage });
      setNewMessage('');
      // Refresh messages
      const { data } = await api.get(`/conversations/${selected.id}/messages`);
      setMessages(data || []);
      fetchConversations(); // Update last_message_at
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const generateSmartReply = async () => {
    if (!selected || isGeneratingReply) return;
    setIsGeneratingReply(true);
    try {
      // Prepare history: last 10 messages
      const history = messages.slice(-10).map(m => ({
        // Map 'system' messages to 'user' role so Gemini sees them as context (e.g. "New booking created")
        role: (m.sender_type === 'contact' || m.sender_type === 'system') ? 'user' : 'model',
        content: m.sender_type === 'system' ? `System Notification: ${m.content}` : m.content
      }));

      const { data } = await api.post('/ai/suggest-reply', {
        draft: newMessage, // Optional intent
        conversationHistory: history
      });

      if (data.success && data.suggestion) {
        setNewMessage(data.suggestion);
        toast.success('✨ Reply suggested!');
      } else {
        toast.error('Could not generate reply');
      }
    } catch (err) {
      console.error(err);
      toast.error('AI is unavailable right now');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Inbox</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Customer conversations</p>
      </div>

      <div className="card inbox-container" style={{ 
        padding: 0, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr',
        height: 'calc(100vh - 200px)', minHeight: '500px'
      }}>
        {/* Conversations List */}
        <div className={`inbox-list ${selected ? 'inbox-list-hidden-mobile' : ''}`} style={{
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          display: selected ? undefined : 'block'
        }}>
          {conversations.length > 0 ? (
            conversations.map(c => (
              <div
                key={c.id}
                onClick={() => selectConversation(c)}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selected?.id === c.id ? dm('#eef2ff') : dm('white'),
                  transition: 'background 0.1s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '0.75rem', fontWeight: 600,
                    flexShrink: 0
                  }}>
                    {c.contacts?.name?.charAt(0) || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.contacts?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.subject}
                    </div>
                  </div>
                  <span className={`badge badge-${c.status === 'open' ? 'success' : 'neutral'}`} style={{ fontSize: '0.625rem' }}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <MessageSquare size={32} />
              <h3>No conversations</h3>
              <p>Conversations are created when customers book or contact you</p>
            </div>
          )}
        </div>

        {/* Message Thread */}
        {selected && (
          <div className="inbox-thread" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Thread Header */}
            <div style={{
              padding: '0.875rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: dm('#fafafa')
            }}>
              <button
                onClick={() => setSelected(null)}
                className="btn btn-sm btn-secondary inbox-back-btn"
              >
                <ArrowLeft size={14} />
              </button>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selected.contacts?.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selected.subject}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {messages.map(m => (
                <div
                  key={m.id}
                  style={{
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: m.sender_type === 'staff' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    background: m.sender_type === 'staff' ? 'var(--primary)' :
                                m.sender_type === 'system' ? dm('#f1f5f9') : dm('#e2e8f0'),
                    color: m.sender_type === 'staff' ? 'white' : 'var(--text-primary)'
                  }}>
                    {m.sender_type === 'system' && (
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>System</div>
                    )}
                    {m.content}
                    <div style={{
                      fontSize: '0.625rem', marginTop: '0.375rem',
                      opacity: 0.7, textAlign: 'right'
                    }}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <form onSubmit={sendMessage} style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}>
              {/* AI Suggestion Bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                 <button
                  type="button"
                  onClick={generateSmartReply}
                  disabled={isGeneratingReply}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                    border: 'none', borderRadius: '1rem',
                    padding: '0.25rem 0.75rem',
                    color: 'white', fontSize: '0.75rem', fontWeight: 600,
                    cursor: isGeneratingReply ? 'not-allowed' : 'pointer',
                    opacity: isGeneratingReply ? 0.7 : 1
                  }}
                >
                  {isGeneratingReply ? (
                    <RefreshCw size={12} className="spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {isGeneratingReply ? 'Drafting...' : 'AI Suggest Reply'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </form>
            <style>{`
              .spin { animation: spin 1s linear infinite; }
              @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}
      </div>

      <style>{`
        .inbox-back-btn { display: none; }
        @media (max-width: 768px) {
          .inbox-container { grid-template-columns: 1fr !important; height: calc(100vh - 160px) !important; min-height: 400px !important; }
          .inbox-list-hidden-mobile { display: none !important; }
          .inbox-thread { grid-column: 1 / -1; }
          .inbox-back-btn { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
};

export default Inbox;
