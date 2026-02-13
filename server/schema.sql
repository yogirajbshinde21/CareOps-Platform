-- CareOps Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Workspaces (Business accounts)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  business_type VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url TEXT,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  settings JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  owner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users (Owners and staff)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  permissions JSONB DEFAULT '{}',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for workspace owner
ALTER TABLE workspaces ADD CONSTRAINT fk_workspace_owner 
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Contacts (Leads/Customers - NO LOGIN)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  source VARCHAR(50) DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Services (Business offerings)
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL DEFAULT 60,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Availability (Working hours)
CREATE TABLE IF NOT EXISTS availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bookings (Appointments)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Conversations (Inbox threads)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  subject VARCHAR(500),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Messages (Chat messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('staff', 'contact', 'system')),
  sender_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Form Templates
CREATE TABLE IF NOT EXISTS form_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Form Submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  form_template_id UUID REFERENCES form_templates(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 0,
  unit VARCHAR(50),
  reorder_level INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger VARCHAR(100) NOT NULL,
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Staff-Service assignments (junction table)
CREATE TABLE IF NOT EXISTS staff_services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(user_id, service_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_services_workspace ON services(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bookings_workspace ON bookings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(workspace_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_availability_workspace ON availability(workspace_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_user ON staff_services(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services(service_id);

-- Disable RLS for all tables (using service role key on backend)
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services DISABLE ROW LEVEL SECURITY;
