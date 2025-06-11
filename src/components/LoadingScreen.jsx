import React from 'react';
import '../styles/loading.css';

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a0f0c]/50 backdrop-blur-md transition-opacity duration-500">
      <div className="relative">
        {/* Coffee bean loading animation */}
        <div className="coffee-loading">
          <span className="coffee-bean"></span>
          <span className="coffee-bean"></span>
          <span className="coffee-bean"></span>
        </div>
        
        {/* Loading text */}
        <div className="text-white text-xl font-medium mt-4 text-center animate-pulse">
          Loading your experience...
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen; 