// client/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute - Guards routes based on auth and optional permissions
 * @param {string} requiredPermission - Optional section key (e.g., 'bookings', 'inbox')
 * @param {boolean} adminOnly - If true, only owners/admins can access
 */
const ProtectedRoute = ({ children, requiredPermission = null, adminOnly = false }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" style={{ width: '2rem', height: '2rem' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check admin-only access
  if (adminOnly && user?.role !== 'owner' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Check section permission (only for staff, owners/admins always have access)
  if (requiredPermission && user?.role === 'staff') {
    const userPerms = user.permissions?.sections || {};
    // If permission is explicitly set to false, deny access
    if (userPerms[requiredPermission] === false) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
