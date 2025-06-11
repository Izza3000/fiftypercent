import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthProvider';
import Navbar from '../components/Navbar';
import '../styles/Styles.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo">☕</div>
        <b><p>Admin Dashboard</p></b>
        <div className="user-info">
          {user && <span>{user.role} | {user.first_name} {user.last_name}</span>}
          {user && (
            <button onClick={() => navigate("/login")} className="logout-btn">Logout</button>
          )}
        </div>
      </header>
      
      <div className="dashboard-main">
        <Navbar /> 
        <main className="content">
          <h2>Welcome to the Admin Dashboard</h2>
          {/* Admin Dashboard content */}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
