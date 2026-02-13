// server/controllers/authController.js - Authentication logic
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

/**
 * Generate a URL-friendly slug from business name
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + 
    '-' + Math.random().toString(36).substring(2, 6);
};

/**
 * POST /api/auth/register
 * Create a new workspace and owner user
 */
const register = async (req, res) => {
  try {
    const { name, email, password, businessName } = req.body;

    // Validate inputs
    if (!name || !email || !password || !businessName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create workspace
    const slug = generateSlug(businessName);
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: businessName,
        slug,
        settings: {},
        onboarding_completed: false
      })
      .select()
      .single();

    if (wsError) {
      console.error('Workspace creation error:', wsError);
      return res.status(500).json({ error: 'Failed to create workspace' });
    }

    // Create owner user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        workspace_id: workspace.id,
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'owner',
        permissions: {}
      })
      .select('id, workspace_id, name, email, role')
      .single();

    if (userError) {
      // Rollback: delete workspace if user creation fails
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      console.error('User creation error:', userError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Update workspace with owner_id
    await supabase
      .from('workspaces')
      .update({ owner_id: user.id })
      .eq('id', workspace.id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, workspaceId: workspace.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspace_id: workspace.id
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        onboarding_completed: workspace.onboarding_completed
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, workspace_id, name, email, password_hash, role')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, slug, onboarding_completed')
      .eq('id', user.workspace_id)
      .single();

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, workspaceId: user.workspace_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspace_id: user.workspace_id
      },
      workspace
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, slug, onboarding_completed, business_type, settings')
      .eq('id', req.user.workspace_id)
      .single();

    res.json({
      user: req.user,
      workspace
    });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { register, login, getMe };
