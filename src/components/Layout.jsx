import React from 'react';
import Navbar from './Navbar';
import { useTheme } from '../lib/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Layout = ({ children }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      <Navbar />
      <div className="flex-1 p-8 ml-64">
        {children}
      </div>
      <ToastContainer position="bottom-right" theme={isDarkMode ? "dark" : "light"} />
    </div>
  );
};

export default Layout; 