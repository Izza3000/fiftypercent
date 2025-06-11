import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthProvider';
import { useTheme } from '../lib/ThemeContext';
import '../styles/Styles.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Analytics", path: "/admin-analytics" },
    { name: "DSS Insights", path: "/farmer-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Price Management", path: "/price-management" },
  ];

  const farmerLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === 'admin' ? adminLinks : farmerLinks;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error('Error during logout:', error);
      // Optionally show an error message to the user
    }
  };

  return (
    <div className={`fixed top-0 left-0 h-screen w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col`}>
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-2xl">☕</div>
            <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {user?.role === 'admin' ? 'Admin Panel' : 'Farmer Panel'}
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-md ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navLinks.map((link) => (
            <li key={link.path}>
              <button
                onClick={() => navigate(link.path)}
                className={`w-full text-left px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  location.pathname === link.path
                    ? isDarkMode 
                      ? 'bg-gray-700 text-indigo-400'
                      : 'bg-indigo-50 text-indigo-500'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-indigo-400'
                      : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-indigo-400'
                }`}
              >
                {link.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`w-full p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <button
          onClick={handleLogout}
          className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isDarkMode
              ? 'text-indigo-400 bg-gray-700 hover:bg-gray-600 focus:ring-indigo-500'
              : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:ring-indigo-500'
          }`}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Navbar;
