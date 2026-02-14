// client/src/services/nlqEngine.js
// Natural Language Query Engine — NO AI API needed
// Uses pattern matching to convert natural language into data queries

/**
 * Parse relative dates like "tomorrow", "this week", "next monday"
 */
function resolveDate(text) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();

  const fmt = (d) => d.toISOString().split('T')[0];

  // Exact patterns
  if (/\btoday\b/i.test(text)) return { start: fmt(today), end: fmt(today), label: 'today' };

  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return { start: fmt(d), end: fmt(d), label: 'tomorrow' };
  }

  if (/\byesterday\b/i.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return { start: fmt(d), end: fmt(d), label: 'yesterday' };
  }

  // "this week" = Mon-Sun of current week
  if (/\bthis\s+week\b/i.test(text)) {
    const mon = new Date(today); mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun), label: 'this week' };
  }

  // "last week"
  if (/\blast\s+week\b/i.test(text)) {
    const mon = new Date(today); mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun), label: 'last week' };
  }

  // "next week"
  if (/\bnext\s+week\b/i.test(text)) {
    const mon = new Date(today); mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun), label: 'next week' };
  }

  // "this month"
  if (/\bthis\s+month\b/i.test(text)) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: fmt(start), end: fmt(end), label: 'this month' };
  }

  // "last month"
  if (/\blast\s+month\b/i.test(text)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: fmt(start), end: fmt(end), label: 'last month' };
  }

  return null;
}

/**
 * Extract a number from text ("top 5", "last 10", etc.)
 */
function extractNumber(text) {
  const m = text.match(/\b(\d+)\b/);
  return m ? parseInt(m[1]) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DEFINITIONS — each pattern maps to a data query
// ═══════════════════════════════════════════════════════════════════════════════
const INTENTS = [
  // ── BOOKINGS ──────────────────────────────────────────────────────────────
  {
    id: 'bookings_count',
    patterns: [/how many bookings/i, /number of bookings/i, /booking count/i, /total bookings/i],
    keywords: [['how','many','booking'], ['number','booking'], ['booking','count'], ['total','booking'], ['how','many','appointment']],
    description: 'Count of bookings',
    execute: (data, query) => {
      const dateRange = resolveDate(query);
      const bookings = data.bookings || [];
      let filtered = bookings;
      let label = 'Total';

      if (dateRange) {
        filtered = bookings.filter(b => b.date >= dateRange.start && b.date <= dateRange.end);
        label = dateRange.label.charAt(0).toUpperCase() + dateRange.label.slice(1);
      }

      return {
        type: 'number',
        title: `${label} Bookings`,
        value: filtered.length,
        subtitle: dateRange ? `${dateRange.start} to ${dateRange.end}` : 'All time',
      };
    }
  },
  {
    id: 'bookings_today',
    patterns: [/today'?s?\s+(bookings|appointments|schedule)/i, /schedule\s+(for\s+)?today/i, /what'?s?\s+(on\s+)?today/i],
    keywords: [['today','booking'], ['today','schedule'], ['today','appointment'], ['what','today']],
    execute: (data) => {
      const today = new Date().toISOString().split('T')[0];
      const todayBookings = (data.bookings || []).filter(b => b.date === today);
      return {
        type: todayBookings.length > 0 ? 'table' : 'number',
        title: "Today's Schedule",
        value: todayBookings.length,
        columns: ['Customer', 'Service', 'Time', 'Status'],
        rows: todayBookings.map(b => [
          b.contacts?.name || 'N/A',
          b.services?.name || 'N/A',
          b.start_time?.slice(0, 5) || '',
          b.status
        ]),
        subtitle: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      };
    }
  },
  {
    id: 'bookings_upcoming',
    patterns: [/upcoming\s+bookings/i, /future\s+bookings/i, /next\s+bookings/i, /upcoming\s+appointments/i],
    keywords: [['upcoming','booking'], ['future','booking'], ['next','booking'], ['upcoming','appointment']],
    execute: (data) => {
      const today = new Date().toISOString().split('T')[0];
      const upcoming = (data.bookings || []).filter(b => b.date >= today && b.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''));
      return {
        type: upcoming.length > 0 ? 'table' : 'number',
        title: 'Upcoming Bookings',
        value: upcoming.length,
        columns: ['Customer', 'Service', 'Date', 'Time', 'Status'],
        rows: upcoming.slice(0, 10).map(b => [
          b.contacts?.name || 'N/A',
          b.services?.name || 'N/A',
          new Date(b.date).toLocaleDateString(),
          b.start_time?.slice(0, 5) || '',
          b.status
        ]),
      };
    }
  },
  {
    id: 'bookings_pending',
    patterns: [/pending\s+bookings/i, /unconfirmed\s+bookings/i, /bookings?\s+to\s+confirm/i],
    keywords: [['pending','booking'], ['unconfirmed','booking'], ['booking','confirm']],
    execute: (data) => {
      const pending = (data.bookings || []).filter(b => b.status === 'pending');
      return {
        type: pending.length > 0 ? 'table' : 'number',
        title: 'Pending Bookings',
        value: pending.length,
        columns: ['Customer', 'Service', 'Date', 'Status'],
        rows: pending.map(b => [
          b.contacts?.name || 'N/A', b.services?.name || 'N/A',
          new Date(b.date).toLocaleDateString(), b.status
        ]),
        subtitle: pending.length > 0 ? `${pending.length} need confirmation` : 'All confirmed!',
        navigateTo: '/bookings'
      };
    }
  },
  {
    id: 'bookings_cancelled',
    patterns: [/cancell?ed\s+bookings/i, /no[\s-]?shows?/i, /missed\s+appointments?/i],
    keywords: [['cancelled','booking'], ['cancel','booking'], ['no','show'], ['missed','appointment']],
    execute: (data) => {
      const dateRange = resolveDate(data._query);
      let cancelled = (data.bookings || []).filter(b => b.status === 'cancelled' || b.status === 'no_show');
      if (dateRange) cancelled = cancelled.filter(b => b.date >= dateRange.start && b.date <= dateRange.end);
      return {
        type: cancelled.length > 0 ? 'table' : 'number',
        title: 'Cancelled / No-Shows',
        value: cancelled.length,
        columns: ['Customer', 'Service', 'Date', 'Status'],
        rows: cancelled.slice(0, 10).map(b => [
          b.contacts?.name || 'N/A', b.services?.name || 'N/A',
          new Date(b.date).toLocaleDateString(), b.status
        ]),
        navigateTo: '/bookings'
      };
    }
  },
  {
    id: 'busiest_day',
    patterns: [/busiest\s+day/i, /most\s+bookings?\s+day/i, /peak\s+day/i, /which\s+day.*most/i],
    keywords: [['busiest','day'], ['most','booking'], ['peak','day'], ['which','day','most']],
    execute: (data, query) => {
      const dateRange = resolveDate(query) || (() => {
        // Default to this month
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], label: 'this month' };
      })();
      const bookings = (data.bookings || []).filter(b => b.date >= dateRange.start && b.date <= dateRange.end);
      
      // Group by day of week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const counts = new Array(7).fill(0);
      bookings.forEach(b => { const d = new Date(b.date).getDay(); counts[d]++; });
      
      const maxIdx = counts.indexOf(Math.max(...counts));
      const chartData = days.map((day, i) => ({ label: day.slice(0, 3), value: counts[i] }));

      return {
        type: 'chart',
        title: `Busiest Day (${dateRange.label})`,
        value: days[maxIdx],
        subtitle: `${days[maxIdx]} with ${counts[maxIdx]} bookings`,
        chartData,
      };
    }
  },

  // ── REVENUE ───────────────────────────────────────────────────────────────
  {
    id: 'revenue',
    patterns: [/revenue/i, /earnings/i, /income/i, /how much.*made/i, /how much.*earned/i, /total.*sales/i],
    keywords: [['revenue'], ['earning'], ['income'], ['how','much','made'], ['how','much','earned'], ['total','sale'], ['money']],
    execute: (data, query) => {
      const dateRange = resolveDate(query);
      let bookings = (data.bookings || []).filter(b => b.status === 'completed' || b.status === 'confirmed');
      let label = 'Total';

      if (dateRange) {
        bookings = bookings.filter(b => b.date >= dateRange.start && b.date <= dateRange.end);
        label = dateRange.label.charAt(0).toUpperCase() + dateRange.label.slice(1);
      }

      const revenue = bookings.reduce((sum, b) => sum + (b.services?.price || 0), 0);
      return {
        type: 'number',
        title: `${label} Revenue`,
        value: `₹${revenue.toLocaleString()}`,
        subtitle: `From ${bookings.length} completed booking${bookings.length !== 1 ? 's' : ''}`,
      };
    }
  },

  // ── CONTACTS ──────────────────────────────────────────────────────────────
  {
    id: 'contacts_count',
    patterns: [/how many (contacts|customers|clients)/i, /total (contacts|customers|clients)/i, /number of (contacts|customers)/i],
    keywords: [['how','many','contact'], ['how','many','customer'], ['how','many','client'], ['total','contact'], ['total','customer']],
    execute: (data) => ({
      type: 'number',
      title: 'Total Contacts',
      value: (data.contacts || []).length,
      navigateTo: '/contacts'
    })
  },
  {
    id: 'contacts_recent',
    patterns: [/recent\s+(contacts|customers|clients)/i, /new\s+(contacts|customers|clients)/i, /latest\s+(contacts|customers)/i],
    keywords: [['recent','contact'], ['recent','customer'], ['new','contact'], ['new','customer'], ['latest','contact']],
    execute: (data, query) => {
      const limit = extractNumber(query) || 5;
      const contacts = (data.contacts || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
      return {
        type: 'table',
        title: `Recent Contacts (${contacts.length})`,
        columns: ['Name', 'Email', 'Phone', 'Added'],
        rows: contacts.map(c => [
          c.name || 'N/A', c.email || '', c.phone || '',
          new Date(c.created_at).toLocaleDateString()
        ]),
        navigateTo: '/contacts'
      };
    }
  },

  // ── CONVERSATIONS / INBOX ─────────────────────────────────────────────────
  {
    id: 'inbox_open',
    patterns: [/open\s+conversations?/i, /unread\s+messages?/i, /unanswered/i, /inbox/i, /who\s+hasn'?t\s+replied/i, /hasn'?t\s+responded/i, /no\s+reply/i],
    keywords: [['open','conversation'], ['unread','message'], ['unanswered'], ['inbox'], ['who','replied'], ['who','responded'], ['no','reply']],
    execute: (data) => {
      const open = (data.conversations || []).filter(c => c.status === 'open');
      return {
        type: open.length > 0 ? 'table' : 'number',
        title: 'Open Conversations',
        value: open.length,
        columns: ['Contact', 'Subject', 'Status', 'Last Updated'],
        rows: open.slice(0, 10).map(c => [
          c.contacts?.name || c.contact_name || 'Unknown',
          c.subject || 'No subject',
          c.status,
          c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ''
        ]),
        subtitle: open.length > 0 ? `${open.length} need attention` : 'All caught up! 🎉',
        navigateTo: '/inbox'
      };
    }
  },

  // ── FORMS ─────────────────────────────────────────────────────────────────
  {
    id: 'forms_overdue',
    patterns: [/overdue\s+forms?/i, /late\s+forms?/i, /expired\s+forms?/i],
    keywords: [['overdue','form'], ['late','form'], ['expired','form']],
    execute: (data) => ({
      type: 'number',
      title: 'Overdue Forms',
      value: data.formStats?.overdueForms || 0,
      subtitle: (data.formStats?.overdueForms || 0) > 0 ? 'Need follow-up' : 'None overdue! ✅',
      navigateTo: '/forms'
    })
  },
  {
    id: 'forms_pending',
    patterns: [/pending\s+forms?/i, /incomplete\s+forms?/i, /waiting\s+forms?/i],
    keywords: [['pending','form'], ['incomplete','form'], ['waiting','form']],
    execute: (data) => ({
      type: 'number',
      title: 'Pending Forms',
      value: data.formStats?.pendingForms || 0,
      subtitle: `${data.formStats?.completedForms || 0} completed`,
      navigateTo: '/forms'
    })
  },
  {
    id: 'forms_stats',
    patterns: [/form\s+stats?/i, /form\s+status/i, /form\s+summary/i, /how.*forms/i],
    keywords: [['form','stat'], ['form','status'], ['form','summary'], ['how','form']],
    execute: (data) => {
      const fs = data.formStats || {};
      const chartData = [
        { label: 'Completed', value: fs.completedForms || 0 },
        { label: 'Pending', value: fs.pendingForms || 0 },
        { label: 'Overdue', value: fs.overdueForms || 0 },
      ];
      return {
        type: 'chart',
        title: 'Forms Overview',
        chartData,
        subtitle: `${(fs.completedForms || 0) + (fs.pendingForms || 0) + (fs.overdueForms || 0)} total forms`,
        navigateTo: '/forms'
      };
    }
  },

  // ── INVENTORY ─────────────────────────────────────────────────────────────
  {
    id: 'inventory_low',
    patterns: [/low\s+stock/i, /out\s+of\s+stock/i, /reorder/i, /inventory\s+alert/i, /running\s+low/i, /need\s+to\s+order/i],
    keywords: [['low','stock'], ['out','stock'], ['reorder'], ['inventory','alert'], ['running','low'], ['need','order'], ['inventory']],
    execute: (data) => {
      const low = data.lowStockItems || [];
      return {
        type: low.length > 0 ? 'table' : 'number',
        title: 'Low Stock Items',
        value: low.length,
        columns: ['Item', 'Quantity', 'Reorder Level'],
        rows: low.map(i => [i.name, `${i.quantity} ${i.unit || ''}`, i.reorder_level]),
        subtitle: low.length > 0 ? `${low.length} item${low.length !== 1 ? 's' : ''} need restocking` : 'All stocked up! ✅',
        navigateTo: '/inventory'
      };
    }
  },

  // ── OVERVIEW / SUMMARY ────────────────────────────────────────────────────
  {
    id: 'summary',
    patterns: [/summary/i, /overview/i, /how'?s?\s+(my\s+)?business/i, /what'?s?\s+happening/i, /status\s+report/i, /dashboard/i, /give\s+me\s+a\s+rundown/i],
    keywords: [['summary'], ['overview'], ['how','business'], ['what','happening'], ['status','report'], ['rundown']],
    execute: (data) => {
      const today = new Date().toISOString().split('T')[0];
      const todayBookings = (data.bookings || []).filter(b => b.date === today);
      const pending = (data.bookings || []).filter(b => b.status === 'pending');
      const open = (data.conversations || []).filter(c => c.status === 'open');
      const low = data.lowStockItems || [];
      
      const lines = [
        `📅 ${todayBookings.length} booking${todayBookings.length !== 1 ? 's' : ''} today`,
        `⏳ ${pending.length} pending confirmation`,
        `💬 ${open.length} open conversation${open.length !== 1 ? 's' : ''}`,
        `📋 ${data.formStats?.pendingForms || 0} pending form${(data.formStats?.pendingForms || 0) !== 1 ? 's' : ''}`,
        low.length > 0 ? `📦 ${low.length} low stock item${low.length !== 1 ? 's' : ''}` : '📦 Inventory all good',
      ];

      return {
        type: 'list',
        title: 'Business Summary',
        items: lines,
        subtitle: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      };
    }
  },

  // ── HELP ──────────────────────────────────────────────────────────────────
  {
    id: 'help',
    patterns: [/\bhelp\b/i, /what can (you|i) (do|ask)/i, /commands/i, /examples?/i],
    keywords: [['help'], ['what','can','ask'], ['what','can','do'], ['command'], ['example']],
    execute: () => ({
      type: 'list',
      title: 'What You Can Ask',
      items: [
        '📅 "How many bookings tomorrow?"',
        '📅 "Today\'s schedule"',
        '📅 "Pending bookings"',
        '📅 "Busiest day this month"',
        '💰 "Revenue this week"',
        '👥 "How many contacts?"',
        '👥 "Recent contacts"',
        '💬 "Open conversations"',
        '💬 "Who hasn\'t replied?"',
        '📋 "Overdue forms"',
        '📋 "Form stats"',
        '📦 "Low stock items"',
        '📊 "Business summary"',
        '❌ "Cancelled bookings"',
      ],
      subtitle: 'Try any of these queries!'
    })
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTIONS — shown as quick chips below the search bar
// ═══════════════════════════════════════════════════════════════════════════════
export const SUGGESTIONS = [
  "Today's schedule",
  "Pending bookings",
  "Revenue this month",
  "Low stock items",
  "Open conversations",
  "Busiest day",
  "Business summary",
  "Overdue forms",
];

// Typing-animation queries shown in the search placeholder
export const EXAMPLE_QUERIES = [
  'How many bookings tomorrow?',
  "Today's schedule",
  'Revenue this week',
  'Pending bookings',
  'Low stock items',
  'Open conversations',
  'Busiest day this month',
  'Business summary',
  'Overdue forms',
  'Recent contacts',
  "Who hasn't replied?",
  'Cancelled bookings',
];

// ═══════════════════════════════════════════════════════════════════════════════
// SMART MATCHING ENGINE — handles typos, singular/plural, and partial matches
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a word: strip trailing s/es/ing, lowercase
 * "bookings" → "booking", "cancelled" → "cancel", "earnings" → "earn"
 */
function stem(word) {
  let w = word.toLowerCase().trim();
  if (w.endsWith('ings')) w = w.slice(0, -4);
  else if (w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('es')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  return w;
}

/**
 * Check if two words are similar (handles typos up to edit distance 1 for short words, 2 for longer)
 */
function isSimilar(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // Simple: check if one starts with the other (prefix match)
  if (a.length >= 3 && b.length >= 3) {
    if (a.startsWith(b.slice(0, 3)) || b.startsWith(a.slice(0, 3))) {
      // Check Levenshtein for confirmation
      return levenshtein(a, b) <= (Math.max(a.length, b.length) > 5 ? 2 : 1);
    }
  }
  return levenshtein(a, b) <= 1;
}

/**
 * Levenshtein edit distance
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Score how well a query matches an intent's keywords.
 * Higher score = better match. Returns 0 for no match.
 * 
 * Each intent has `keywords` — an array of keyword groups.
 * A keyword group is an array of words that should ALL appear (AND logic).
 * Multiple keyword groups use OR logic between them.
 * 
 * Example: keywords: [['how','many','booking'], ['booking','count'], ['total','booking']]
 * Matches: "how many booking tomorrow" (group 1), "booking count" (group 2)
 */
function scoreIntent(query, intent) {
  const queryWords = query.toLowerCase().split(/\s+/).map(stem);
  
  // First try exact regex patterns (highest priority)
  if (intent.patterns) {
    for (const pattern of intent.patterns) {
      if (pattern.test(query)) return 100;
    }
  }
  
  // Then try keyword scoring (fuzzy)
  if (!intent.keywords) return 0;
  
  let bestScore = 0;
  
  for (const group of intent.keywords) {
    let matched = 0;
    let totalWeight = group.length;
    
    for (const keyword of group) {
      const kw = stem(keyword);
      // Check if any query word matches this keyword (exact or fuzzy)
      const found = queryWords.some(qw => qw === kw || isSimilar(qw, kw));
      if (found) matched++;
    }
    
    if (matched > 0) {
      // Score = (matched / total keywords in group) * matched count
      // Bonus for matching ALL keywords in a group
      const ratio = matched / totalWeight;
      const score = ratio * matched * 10 + (ratio === 1 ? 20 : 0);
      bestScore = Math.max(bestScore, score);
    }
  }
  
  return bestScore;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN QUERY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process a natural language query against dashboard data.
 * @param {string} query - The user's natural language question
 * @param {object} data - { bookings, contacts, conversations, formStats, lowStockItems }
 * @returns {object} - { type, title, value, subtitle, columns?, rows?, chartData?, items?, navigateTo? }
 */
export function processQuery(query, data) {
  if (!query || !query.trim()) return null;

  data._query = query; // Pass original query for date resolution in some intents

  // Score all intents and pick the best match
  let bestIntent = null;
  let bestScore = 0;

  for (const intent of INTENTS) {
    const score = scoreIntent(query, intent);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // Minimum threshold to avoid false positives
  if (bestIntent && bestScore >= 8) {
    try {
      return bestIntent.execute(data, query);
    } catch (err) {
      console.error(`NLQ Error in intent ${bestIntent.id}:`, err);
      return {
        type: 'error',
        title: 'Query Error',
        subtitle: 'Something went wrong processing your query. Try rephrasing it.',
      };
    }
  }

  // No match found
  return {
    type: 'no_match',
    title: "I didn't understand that",
    subtitle: 'Try asking something like "How many bookings tomorrow?" or type "help" to see what I can answer.',
  };
}
