import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const ProtectedRoute = ({ children, requiredRoles }) => {
  const { user } = useAuth();

  // If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If the user doesn't have the required role, redirect to dashboard
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children; // Render the children if the user is authorized
};

export default ProtectedRoute;
