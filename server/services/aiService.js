// server/services/aiService.js - Gemini AI integration for voice onboarding
// Uses native JSON mode, systemInstruction, and Chat interface as per Gemini best practices
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// Multiple API keys for fallback when quota exhausted
const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP
].filter(Boolean); // Remove undefined/null entries

// Create GenAI instances for each key
const genAIInstances = API_KEYS.map(key => new GoogleGenerativeAI(key));

// Models to try in order (fallback chain) — each has its own quota pool
// DEFAULT CHAIN: Best quality models first (includes thinking model)
const MODEL_CHAIN = [
  'gemini-2.5-flash',       // Fast, high quality
  'gemini-2.5-flash-lite',  // Faster, good quality
  'gemini-2.0-flash',       // Reliable fallback
  'gemini-2.0-flash-lite',  // Fastest fallback
  'gemini-3-flash-preview', // Thinking model - SLOW but best reasoning (last resort)
];

// FAST CHAIN: For real-time voice interactions (NO thinking models)
// These respond in 1-5 seconds instead of 1-2 minutes
const FAST_MODEL_CHAIN = [
  'gemini-2.5-flash-lite',  // Fastest good model
  'gemini-2.0-flash-lite',  // Ultra fast
  'gemini-2.5-flash',       // High quality fallback
  'gemini-2.0-flash',       // Reliable fallback
  // NO gemini-3-flash-preview - it's a thinking model, too slow for voice
];

// ═══════════════════════════════════════════════════════════════════════════════
// SMART COOLDOWN TRACKING - Skip rate-limited model/key combos for 60 seconds
// ═══════════════════════════════════════════════════════════════════════════════
const COOLDOWN_MS = 60000; // 60 seconds cooldown for rate-limited combos
const rateLimitedCombos = new Map(); // Key: "modelName:keyIndex" → Value: timestamp

/**
 * Check if a model/key combo is currently in cooldown
 */
function isInCooldown(modelName, keyIndex) {
  const key = `${modelName}:${keyIndex}`;
  const failedAt = rateLimitedCombos.get(key);
  if (!failedAt) return false;
  
  const elapsed = Date.now() - failedAt;
  if (elapsed >= COOLDOWN_MS) {
    rateLimitedCombos.delete(key); // Cooldown expired, remove it
    return false;
  }
  return true;
}

/**
 * Mark a model/key combo as rate-limited (start cooldown)
 */
function markRateLimited(modelName, keyIndex) {
  const key = `${modelName}:${keyIndex}`;
  rateLimitedCombos.set(key, Date.now());
  console.log(`🚫 Marked ${modelName} (key ${keyIndex + 1}) as rate-limited for 60s`);
}

/**
 * Get cooldown status for logging
 */
function getCooldownStatus() {
  const active = [];
  for (const [combo, ts] of rateLimitedCombos.entries()) {
    const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - ts));
    if (remaining > 0) {
      active.push(`${combo}: ${Math.ceil(remaining / 1000)}s`);
    }
  }
  return active.length > 0 ? active.join(', ') : 'none';
}

const SYSTEM_INSTRUCTION = `You are CareOps AI Assistant. 
Extract business data from user descriptions into the specified JSON format.

RULES:
1. Set "success" to true if you successfully processed the input.
2. Set "needs_followup" to true if critical info (Business Type or Services) is missing.
3. Map business types to: Salon & Spa, Health & Wellness, Fitness & Gym, Medical Practice, Dental Clinic, Consulting, Tutoring & Education, Pet Care, Home Services, Legal Services, Photography, Other.
4. Services must include name, duration (mins), and price (number only).
5. Availability must always include all 7 days (0=Sunday...6=Saturday).`;

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Try calling Gemini with automatic retry and model fallback.
 * 
 * IMPROVED STRATEGY (Feb 2026):
 * - Interleaves API keys BEFORE trying next model (faster fallback)
 * - Skips rate-limited combos via cooldown tracking (no wasted time)
 * - Order: Model1→Key1→Key2 → Model2→Key1→Key2 → ...
 */
async function callGeminiWithRetry(userInput, conversationHistory = [], maxRetries = 1, systemInstruction = null, responseSchema = null, signal = null, options = {}) {
  const { useFastChain = false, maxOutputTokens = 4096 } = options;
  const modelChain = useFastChain ? FAST_MODEL_CHAIN : MODEL_CHAIN;
  
  console.log(`🔄 Starting Gemini call. Chain: ${useFastChain ? 'FAST' : 'DEFAULT'}. Active cooldowns: ${getCooldownStatus()}`);
  
  // INTERLEAVED STRATEGY: For each model, try all keys before moving to next model
  for (const modelName of modelChain) {
    for (let keyIndex = 0; keyIndex < genAIInstances.length; keyIndex++) {
      // Stop if frontend disconnected
      if (signal?.aborted) throw new Error('Client disconnected');
      
      // Skip if this model/key combo is in cooldown
      if (isInCooldown(modelName, keyIndex)) {
        console.log(`⏭️ Skipping ${modelName} (key ${keyIndex + 1}) - in cooldown`);
        continue;
      }
      
      const genAI = genAIInstances[keyIndex];
      const keyLabel = keyIndex === 0 ? 'primary' : `backup-${keyIndex}`;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new Error('Client disconnected');
        
        try {
          console.log(`🤖 Trying: ${modelName} [${keyLabel}] (attempt ${attempt + 1})`);

          // Create model with systemInstruction and JSON response mode
          const generationConfig = {
            responseMimeType: 'application/json',
            maxOutputTokens: maxOutputTokens,
          };
          
          if (responseSchema) {
            generationConfig.responseSchema = responseSchema;
          }

          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction || SYSTEM_INSTRUCTION,
            generationConfig,
          });

          // Build chat history from conversation history
          const chatHistory = conversationHistory
            .filter(msg => msg.content && msg.content.trim())
            .map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }],
            }));

          // Gemini API requires history to start with 'user'
          const firstUserIndex = chatHistory.findIndex(msg => msg.role === 'user');
          
          let validHistory = [];
          if (firstUserIndex !== -1) {
            validHistory = chatHistory.slice(firstUserIndex);
          }
          
          // Merge consecutive roles (user -> model -> user)
          const sanitizedHistory = [];
          if (validHistory.length > 0) {
            let currentMsg = { ...validHistory[0] };
            
            for (let i = 1; i < validHistory.length; i++) {
              const msg = validHistory[i];
              if (msg.role === currentMsg.role) {
                currentMsg.parts[0].text += `\n\n(Follow-up): ${msg.parts[0].text}`;
              } else {
                sanitizedHistory.push(currentMsg);
                currentMsg = { ...msg };
              }
            }
            sanitizedHistory.push(currentMsg);
          }

          // Start chat and send message
          const chat = model.startChat({ history: sanitizedHistory });
          const result = await chat.sendMessage(userInput);
          const text = result.response.text().trim();

          console.log(`✅ Success with ${modelName} [${keyLabel}]`);
          return JSON.parse(text);
          
        } catch (error) {
          // Client disconnected → stop immediately, don't mark as rate-limited
          if (signal?.aborted || error.message?.includes('Client disconnected') || error.name === 'AbortError') {
            throw new Error('Client disconnected');
          }
          
          const isRateLimit = error.message?.includes('429') || error.message?.includes('quota');
          const isTransient = error.message?.includes('503') || error.message?.includes('Service Unavailable') || error.message?.includes('overloaded') || error.message?.includes('high demand');
          const isLastAttempt = attempt === maxRetries;

          // Rate limited → mark cooldown and try next key immediately
          if (isRateLimit) {
            markRateLimited(modelName, keyIndex);
            console.log(`🔄 Rate limited on ${modelName} [${keyLabel}], trying next key...`);
            break; // Exit retry loop, try next key
          }

          // Transient error → short wait then retry (only once)
          if (isTransient && !isLastAttempt) {
            console.log(`⏳ Transient error on ${modelName}. Waiting 2s...`);
            await sleep(2000);
            continue;
          }
          
          if (isTransient) {
            console.log(`🔄 ${modelName} unavailable, trying next key...`);
            break;
          }

          // JSON Parse error → retry immediately
          if (error.message?.includes('JSON') || error instanceof SyntaxError) {
            console.warn(`⚠️ JSON Error on ${modelName}: ${error.message}. Retrying...`);
            continue;
          }

          // Other errors → throw
          throw error;
        }
      }
    }
  }

  // All combos exhausted
  console.error(`❌ All model/key combinations exhausted. Cooldowns: ${getCooldownStatus()}`);
  throw new Error('QUOTA_EXHAUSTED');
}

/**
 * Process user input (voice transcript or text) to extract business setup data
 */
async function processOnboardingInput(userInput, conversationHistory = []) {
  try {

    // FULL ONBOARDING SCHEMA
    // Defining the full structure here ensures the AI follows your 'data' 
    // object strictly every time.
    const ONBOARDING_SCHEMA = {
      type: SchemaType.OBJECT,
      properties: {
        success: { type: SchemaType.BOOLEAN },
        needs_followup: { type: SchemaType.BOOLEAN },
        followup_questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        summary: { type: SchemaType.STRING },
        data: {
          type: SchemaType.OBJECT,
          properties: {
            business_type: { type: SchemaType.STRING },
            phone: { type: SchemaType.STRING },
            email: { type: SchemaType.STRING },
            address: { type: SchemaType.STRING },
            website: { type: SchemaType.STRING },
            services: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  duration: { type: SchemaType.NUMBER },
                  price: { type: SchemaType.NUMBER },
                  description: { type: SchemaType.STRING }
                }
              }
            },
            availability: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  day_of_week: { type: SchemaType.NUMBER },
                  start_time: { type: SchemaType.STRING },
                  end_time: { type: SchemaType.STRING },
                  is_available: { type: SchemaType.BOOLEAN }
                }
              }
            },
            booking_preferences: {
              type: SchemaType.OBJECT,
              properties: {
                buffer_time: { type: SchemaType.NUMBER },
                advance_booking_days: { type: SchemaType.NUMBER },
                auto_confirm: { type: SchemaType.BOOLEAN }
              }
            }
          }
        }
      },
      required: ["success", "needs_followup", "data"]
    };

    const parsed = await callGeminiWithRetry(userInput, conversationHistory, 2, SYSTEM_INSTRUCTION, ONBOARDING_SCHEMA);
    return parsed;
  } catch (error) {
    console.error('AI Service Error:', error.message);
    
    if (error.message === 'QUOTA_EXHAUSTED' || error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        success: false,
        error: '⏳ AI quota temporarily exceeded. Please wait 30 seconds and try again, or upgrade your Google AI API plan at https://aistudio.google.com',
        needs_followup: true,
        followup_questions: ['Please wait about 30 seconds and then try sending your message again. The free tier has per-minute rate limits.']
      };
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: 'AI returned an unexpected format. Please try again with more detail.',
        needs_followup: true,
        followup_questions: ['Could you describe your business again? For example: "I run a hair salon open Monday to Saturday, 10am to 7pm. We offer haircuts for ₹500 and coloring for ₹2000."']
      };
    }

    return {
      success: false,
      error: error.message || 'AI processing failed',
      needs_followup: true,
      followup_questions: ['Something went wrong. Could you try describing your business again?']
    };
  }
}

// ─── NEW FEATURES ─────────────────────────────────────────────────────────────

const SMART_REPLY_INSTRUCTION = (workspaceName) => `You are a professional customer support assistant for ${workspaceName}.
Your goal is to draft a polite, professional reply based on the user's input and history.

RULES:
1. Use the company name "${workspaceName}" explicitly. NEVER use placeholders like "[Your Company Name]" or "[Your Name]".
2. Ensuring proper spacing: Add a single space after every period or punctuation mark. Do not run sentences together.
3. Keep it friendly, concise, and helpful.
4. Output strict JSON with "suggested_reply".

INPUT:
- Last customer message
- Staff intent
- Conversation history

OUTPUT (JSON):
{
  "suggested_reply": "Hi Name, Thank you for..."
}`;

async function generateSmartReply(draft, conversationHistory, workspaceName = 'CareOps') {
  try {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        suggested_reply: { type: SchemaType.STRING }
      },
      required: ["suggested_reply"]
    };

    const response = await callGeminiWithRetry(
      `Draft a reply based on this intent: "${draft}".`,
      conversationHistory,
      2,
      SMART_REPLY_INSTRUCTION(workspaceName),
      schema
    );
    return { success: true, suggestion: response.suggested_reply };
  } catch (error) {
    console.error('Smart Reply Error:', error.message);
    return { success: false, error: 'Failed to generate reply' };
  }
}

const DASHBOARD_INSIGHTS_INSTRUCTION = `You are a business analytics expert.
Analyze the provided JSON data about a service business (bookings, revenue, inventory, etc.) and generate 3-4 actionable insights.

INPUT: JSON data with bookings count, revenue, low stock items, etc.

OUTPUT (JSON):
{
  "insights": [
    "Insight 1 (e.g., 'Your revenue is up 20% this week...')",
    "Insight 2 (e.g., 'You have 3 items low in stock, reorder soon...')",
    "Insight 3"
  ]
}

Keep insights short, actionable, and encouraging. Use emojis occasionally.`;

async function generateDashboardInsights(businessData) {
  try {
    const dataString = JSON.stringify(businessData);
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        insights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["insights"]
    };

    const response = await callGeminiWithRetry(
      `Analyze this business data: ${dataString}`,
      [],
      2,
      DASHBOARD_INSIGHTS_INSTRUCTION,
      schema
    );
    return { success: true, insights: response.insights };
  } catch (error) {
    console.error('Insights Error:', error.message);
    return { success: false, error: 'Failed to generate insights' };
  }
}

// ─── BOOKING ASSISTANT ────────────────────────────────────────────────────────

const getCalendarContext = () => {
  const today = new Date();
  // Only 14 days to keep context small and responses fast
  let cal = "CALENDAR (next 14 days):\n";
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    cal += `${d.toDateString()}\n`;
  }
  return cal;
};

const BOOKING_INSTRUCTION = (context) => `You are a receptionist for ${context.workspaceName}. Help customer book.

TODAY: ${context.today}
${getCalendarContext()}
SERVICES: ${JSON.stringify(context.services.map(s => ({ id: s.id, name: s.name, price: s.price })))}
HOURS: ${JSON.stringify((context.availability || []).filter(a => a.is_available).map(a => ({ day: a.day_of_week, start: a.start_time, end: a.end_time })))}

FLOW:
1. Ask which service → action="select_service"
2. Ask date/time → action="select_time", include serviceId+date+time in data
3. Ask name, email, phone → action="collect_info", include all prior data
4. Summarize & ask "Is that correct?" → action="summarize", include ALL data
5. User says "yes/correct" → action="confirm", include ALL data

RULES:
- Reply in 1 SHORT sentence (spoken aloud)
- Always include ALL collected data in the data field
- action="confirm" ONLY after user affirms the summary
- Output ONLY the JSON object, nothing else

OUTPUT FORMAT:
{"reply":"Your 1-sentence reply","action":"none|select_service|select_time|collect_info|summarize|confirm","data":{"serviceId":"","date":"YYYY-MM-DD","time":"HH:MM AM/PM","customerName":"","customerEmail":"","customerPhone":""}}`;

async function processBookingAssistant(userMessage, history, context, signal = null) {
  try {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        reply: { type: SchemaType.STRING },
        action: { type: SchemaType.STRING },
        data: {
          type: SchemaType.OBJECT,
          properties: {
            serviceId: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            time: { type: SchemaType.STRING },
            customerName: { type: SchemaType.STRING },
            customerEmail: { type: SchemaType.STRING },
            customerPhone: { type: SchemaType.STRING },
            customerNote: { type: SchemaType.STRING }
          }
        }
      },
      required: ["reply", "action", "data"]
    };

    const response = await callGeminiWithRetry(
      userMessage,
      history,
      1, // Only 1 retry for fast response
      BOOKING_INSTRUCTION(context),
      schema,
      signal,
      { useFastChain: true, maxOutputTokens: 512 } // Fast models, short output
    );
    console.log('🤖 AI Response:', JSON.stringify({ action: response.action, data: response.data }, null, 2));
    return { success: true, ...response };
  } catch (error) {
    console.error('Booking AI Error:', error.message);
    return { success: false, error: 'Failed to process booking request' };
  }
}

module.exports = { 
  processOnboardingInput, 
  generateSmartReply, 
  generateDashboardInsights,
  processBookingAssistant 
};
