import React, { useState, useEffect, useRef } from 'react';

const SearchableDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  label,
  isDarkMode,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Filter options based on input value
    if (value) {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [value, options]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleOptionClick = (option) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`mt-1 block w-full rounded-lg border-2 px-4 py-2.5 
            placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500 
            focus:ring-opacity-50 transition-colors duration-200
            ${isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
        />
        <div className={`absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {icon}
        </div>
      </div>
      
      {/* Dropdown list */}
      {isOpen && filteredOptions.length > 0 && (
        <div className={`absolute z-10 w-full mt-1 rounded-md shadow-lg ${
          isDarkMode ? 'bg-gray-700' : 'bg-white'
        } max-h-60 overflow-auto`}>
          <ul className="py-1">
            {filteredOptions.map((option, index) => (
              <li
                key={index}
                onClick={() => handleOptionClick(option)}
                className={`px-4 py-2 cursor-pointer ${
                  isDarkMode 
                    ? 'text-gray-200 hover:bg-gray-600' 
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown; 