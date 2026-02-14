// server/middleware/auth.js - JWT authentication middleware
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

/**
 * Middleware to verify JWT token and attach user to request.
 * Expects header: Authorization: Bearer <token>
 * Also fetches assigned service IDs for staff members.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, workspace_id, email, name, role, permissions')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    // For staff members, fetch their assigned service IDs
    if (user.role === 'staff') {
      const { data: assignments } = await supabase
        .from('staff_services')
        .select('service_id')
        .eq('user_id', user.id)
        .eq('workspace_id', user.workspace_id);
      
      user.assigned_service_ids = (assignments || []).map(a => a.service_id);
    } else {
      // Owners and admins have access to all services
      user.assigned_service_ids = null; // null means "all"
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate };
