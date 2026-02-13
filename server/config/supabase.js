// server/config/supabase.js - Supabase client initialization
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Use service role key for full database access on backend
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
