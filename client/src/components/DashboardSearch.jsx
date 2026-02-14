// client/src/components/DashboardSearch.jsx
// Natural Language Query search bar for the Dashboard
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, HelpCircle } from 'lucide-react';
import { processQuery, SUGGESTIONS, EXAMPLE_QUERIES } from '../services/nlqEngine';
import { dm, dt, dmc, useDarkMode } from '../utils/darkMode';

const DashboardSearch = ({ dashboardData }) => {
  useDarkMode();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const animRef = useRef({ mounted: true, timeout: null });

  // ── Typing placeholder animation ──────────────────────────────────────
  useEffect(() => {
    animRef.current.mounted = true;
    if (isFocused || query) { setPlaceholder(''); return; }

    let qIdx = 0, cIdx = 0, deleting = false;
    const tick = () => {
      if (!animRef.current.mounted) return;
      const word = EXAMPLE_QUERIES[qIdx];
      if (!deleting) {
        cIdx++;
        setPlaceholder(word.slice(0, cIdx));
        if (cIdx === word.length) {
          deleting = true;
          animRef.current.timeout = setTimeout(tick, 1800); // pause at full word
          return;
        }
        animRef.current.timeout = setTimeout(tick, 70);
      } else {
        cIdx--;
        setPlaceholder(word.slice(0, cIdx));
        if (cIdx === 0) {
          deleting = false;
          qIdx = (qIdx + 1) % EXAMPLE_QUERIES.length;
          animRef.current.timeout = setTimeout(tick, 400); // pause between words
          return;
        }
        animRef.current.timeout = setTimeout(tick, 35);
      }
    };
    animRef.current.timeout = setTimeout(tick, 600);
    return () => { animRef.current.mounted = false; clearTimeout(animRef.current.timeout); };
  }, [isFocused, query]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K or / to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSearch = async (text) => {
    const q = text || query;
    if (!q.trim()) { setResult(null); return; }
    
    // Show loading animation for ~1.5 seconds
    setIsLoading(true);
    setResult(null);
    setIsOpen(true);
    
    // Fixed delay for consistent, smooth experience
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const res = processQuery(q, dashboardData);
    setIsLoading(false);
    setResult(res);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    // Clear results when input is emptied
    if (!val.trim()) {
      setResult(null);
      setIsLoading(false);
    }
  };

  const handleSuggestion = (s) => {
    setQuery(s);
    handleSearch(s);
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    setIsOpen(false);
  };

  // ── RESULT RENDERERS ──────────────────────────────────────────────────────

  const renderNumber = (res) => (
    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
      <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
        {res.value}
      </p>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{res.title}</p>
      {res.subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{res.subtitle}</p>}
    </div>
  );

  const renderTable = (res) => (
    <div>
      <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{res.title} ({res.value})</p>
      {res.subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{res.subtitle}</p>}
      {res.rows && res.rows.length > 0 ? (
        <div style={{ overflowX: 'auto', maxHeight: '250px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>{res.columns.map((col, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '0.375rem 0.5rem', borderBottom: '2px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{col}</th>
              ))}</tr>
            </thead>
            <tbody>{res.rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '0.375rem 0.5rem', whiteSpace: 'nowrap' }}>
                    {/* Render status as badge */}
                    {res.columns[ci] === 'Status' ? (
                      <span style={{
                        padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600,
                        background: dm(cell === 'completed' ? '#dcfce7' : cell === 'confirmed' ? '#dbeafe' : cell === 'pending' ? '#fef3c7' : '#fee2e2'),
                        color: dt(cell === 'completed' ? '#166534' : cell === 'confirmed' ? '#1e40af' : cell === 'pending' ? '#92400e' : '#991b1b'),
                      }}>{cell}</span>
                    ) : cell}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No results</p>
      )}
    </div>
  );

  const renderChart = (res) => {
    const chartData = res.chartData || [];
    const maxVal = Math.max(...chartData.map(d => d.value), 1);
    return (
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{res.title}</p>
        {res.subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{res.subtitle}</p>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.375rem', height: '120px', padding: '0 0.5rem' }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{d.value}</span>
              <div style={{
                width: '100%', maxWidth: '40px',
                height: `${Math.max((d.value / maxVal) * 90, 4)}px`,
                background: d.value === maxVal ? 'var(--primary)' : '#c7d2fe',
                borderRadius: '0.25rem 0.25rem 0 0',
                transition: 'height 0.3s ease'
              }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderList = (res) => {
    // Check if items look like help queries (start with emoji)
    const isHelp = res.items?.length && /^[\p{Emoji}]/u.test(res.items[0]);
    return (
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{res.title}</p>
        {res.subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{res.subtitle}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {(res.items || []).map((item, i) => {
            // Extract raw query text by stripping leading emoji + space + quotes
            const rawQuery = item.replace(/^[\p{Emoji}\s]+/u, '').replace(/^["']|["']$/g, '');
            return isHelp ? (
              <button
                key={i}
                onClick={() => { handleSuggestion(rawQuery); }}
                style={{
                  padding: '0.375rem 0.625rem', borderRadius: '0.375rem',
                  background: dm('#f8fafc'), border: '1px solid var(--border)',
                  fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', display: 'block', width: '100%'
                }}
                onMouseEnter={e => e.currentTarget.style.background = dm('#eef2ff')}
                onMouseLeave={e => e.currentTarget.style.background = dm('#f8fafc')}
              >{item}</button>
            ) : (
              <div key={i} style={{
                padding: '0.375rem 0.625rem', borderRadius: '0.375rem',
                background: dm('#f8fafc'), border: '1px solid var(--border)',
                fontSize: '0.85rem'
              }}>{item}</div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    
    let content;
    switch (result.type) {
      case 'number': content = renderNumber(result); break;
      case 'table': content = renderTable(result); break;
      case 'chart': content = renderChart(result); break;
      case 'list': content = renderList(result); break;
      case 'error':
      case 'no_match':
        content = (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <HelpCircle size={32} color="var(--text-secondary)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ fontWeight: 600 }}>{result.title}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{result.subtitle}</p>
          </div>
        );
        break;
      default: content = null;
    }

    return (
      <div className="nlq-result-fade">
        {content}
        {result.navigateTo && (
          <button
            onClick={() => { navigate(result.navigateTo); setIsOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              width: '100%', marginTop: '0.75rem', padding: '0.5rem',
              background: 'var(--primary)', color: 'white', border: 'none',
              borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            View Details <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', maxWidth: '560px', width: '100%', margin: '0 auto' }}>
      {/* Search Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: dm('white'), border: '2px solid ' + (isOpen ? 'var(--primary)' : 'var(--border)'),
        borderRadius: '0.75rem', transition: 'border-color 0.2s',
        boxShadow: isOpen ? '0 4px 20px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <Search size={18} color={isOpen ? 'var(--primary)' : 'var(--text-secondary)'} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { setIsOpen(true); setIsFocused(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={isFocused ? 'Ask anything...' : (placeholder ? placeholder : 'Ask anything...')}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: '0.875rem',
            background: 'transparent', color: 'var(--text-primary)',
          }}
        />
        {query && (
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', display: 'flex' }}>
            <X size={16} color="var(--text-secondary)" />
          </button>
        )}
        <kbd style={{
          padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.65rem',
          background: dm('#f1f5f9'), border: '1px solid var(--border)', color: 'var(--text-secondary)',
          fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap'
        }}>Ctrl+K</kbd>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 0.5rem)', left: 0, right: 0,
          background: dm('white'), border: '1px solid var(--border)', borderRadius: '0.75rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100,
          maxHeight: '420px', overflowY: 'auto', padding: '0.75rem'
        }}>
          {isLoading ? (
            /* Loading Animation */
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.75rem'
              }}>
                <span className="nlq-dot" style={{ '--delay': '0s' }} />
                <span className="nlq-dot" style={{ '--delay': '0.15s' }} />
                <span className="nlq-dot" style={{ '--delay': '0.3s' }} />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Analyzing your question...
              </p>
            </div>
          ) : result ? (
            renderResult()
          ) : (
            /* Suggestions */
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Try asking
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    style={{
                      padding: '0.25rem 0.625rem', borderRadius: '1rem',
                      background: dm('#eef2ff'), border: '1px solid ' + dm('#c7d2fe'),
                      fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)',
                      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => { e.target.style.background = dm('#c7d2fe'); }}
                    onMouseLeave={(e) => { e.target.style.background = dm('#eef2ff'); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NLQ Animation Styles */}
      <style>{`
        .nlq-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--primary);
          animation: nlqPulse 1s ease-in-out infinite;
          animation-delay: var(--delay);
        }
        @keyframes nlqPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        .nlq-result-fade {
          animation: nlqFadeIn 0.3s ease-out;
        }
        @keyframes nlqFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DashboardSearch;
