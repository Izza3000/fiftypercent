import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import Layout from '../components/Layout';
import SearchableDropdown from '../components/SearchableDropdown';

const UserManagement = () => {
  const navigate = useNavigate();
  const location = useLocation(); // To highlight active link
  const { isDarkMode, toggleTheme } = useTheme();
  const [allUsers, setAllUsers] = useState([]); // Store all users
  const [filteredUsers, setFilteredUsers] = useState([]); // Store filtered users
  const [user, setUser] = useState(null); // The logged-in admin user
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // The user being edited
  const [searchQuery, setSearchQuery] = useState(""); // New state for search query
  const [loading, setLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "", // Added password to formData
    role: "farmer", // Always farmer for new users
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
  ];

  const fetchAllUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order('last_name', { ascending: true });

    if (error) {
      console.error("Error fetching all users:", error.message);
    } else {
      setAllUsers(data); // Set all users
      setFilteredUsers(data); // Initially set filtered users to all users
      // Create search suggestions from user names
      const suggestions = data.map(user => 
        `${user.first_name} ${user.middle_name || ''} ${user.last_name}`.trim()
      );
      setSearchSuggestions([...new Set(suggestions)]);
    }
  }, []);

  useEffect(() => {
    const fetchUserDataAndUsers = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/login");
        return;
      }

      // Fetch logged-in user's details and role
      const { data: loggedInUserData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, role")
        .eq("email", authUser.email)
        .single();

      if (userError) {
        console.error("Error fetching logged-in user details:", userError.message);
        navigate("/login"); // Redirect if logged-in user's details are not found
        return;
      }

      setUser(loggedInUserData);

      // Only fetch all users if the logged-in user is an admin
      if (loggedInUserData.role === "admin") {
        fetchAllUsers();
      } else {
        // If not admin, redirect them
        navigate("/dashboard", { replace: true });
      }
    };

    fetchUserDataAndUsers();
  }, [navigate, fetchAllUsers]); // Add fetchAllUsers to dependencies

  // Update the filtering logic
  useEffect(() => {
    if (searchQuery) {
      const filtered = allUsers.filter(user => {
        const fullName = `${user.first_name} ${user.middle_name || ''} ${user.last_name}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      });
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(allUsers);
    }
  }, [searchQuery, allUsers]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditUser = (userToEdit) => {
    setCurrentUser(userToEdit);
    setFormData({
      first_name: userToEdit.first_name,
      middle_name: userToEdit.middle_name || "",
      last_name: userToEdit.last_name,
      email: userToEdit.email,
      password: "", // Clear password field when editing
      role: userToEdit.role, // Keep existing role for editing
    });
    setShowModal(true);
  };

  const handleAddNewUserClick = () => {
    setCurrentUser(null); // Clear currentUser to indicate adding new user
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password: "", // Ensure password field is clear for new user
      role: "farmer", // Always set to farmer for new users
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (currentUser) {
      // Editing an existing user
      const { id, email } = currentUser; // Use current user's ID and email for update
      const { first_name, middle_name, last_name, role } = formData;

      const { error } = await supabase
        .from("users")
        .update({ first_name, middle_name, last_name, role })
        .eq("id", id); // Update by ID for precision

      if (error) {
        alert("Error updating user: " + error.message);
      } else {
        alert("User updated successfully!");
        setShowModal(false);
        fetchAllUsers(); // Re-fetch all users to update the table
      }
    } else {
      // Creating a new user - role is always "farmer"
      const { first_name, middle_name, last_name, email, password } = formData;
      const role = "farmer"; // Force role to be farmer for new users

      if (!password) {
        alert("Password is required for new user creation.");
        return;
      }

      try {
        // 1. Create user in Supabase Auth (handles password hashing)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              first_name: first_name,
              last_name: last_name,
              role: role, // Always farmer
            }
          }
        });

        if (authError) {
          throw authError;
        }

        // Check if an entry already exists to avoid duplicates
        const { data: existingUser, error: fetchExistingError } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        if (fetchExistingError && fetchExistingError.code !== 'PGRST116') {
          throw fetchExistingError;
        }

        if (!existingUser) {
            const { data: newUserData, error: insertError } = await supabase
                .from("users")
                .insert([{ first_name, middle_name, last_name, email, role }]);

            if (insertError) {
                throw insertError;
            }
        }

        alert("New user added successfully!");
        setShowModal(false);
        fetchAllUsers(); // Re-fetch all users to update the table
      } catch (error) {
        alert("Error adding new user: " + error.message);
        console.error("Error details:", error);
      }
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      try {
        // First delete from your 'users' table
        const { error: deleteUserError } = await supabase.from("users").delete().eq("id", id);
        if (deleteUserError) {
          throw deleteUserError;
        }

        // Then delete from Supabase Auth using the user's UUID
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
        if (deleteAuthError) {
          console.warn("Could not delete user from Supabase Auth:", deleteAuthError.message);
          // Don't throw, as the record from your 'users' table is already deleted
        }

        alert("User deleted successfully!");
        fetchAllUsers(); // Re-fetch all users to update the table
      } catch (error) {
        alert("Error deleting user: " + error.message);
        console.error("Delete error details:", error);
      }
    }
  };

  const handleFarmerClick = (farmerId) => {
    navigate(`/farmer-profile/${farmerId}`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Farmer Management
          </h2>
          {user && (
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Welcome back, {user.first_name} {user.last_name}
            </p>
          )}
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
            Manage and monitor farmer accounts
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Farmers</p>
                <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {allUsers.filter(u => u.role === 'farmer').length}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Farmers</p>
                <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {allUsers.filter(u => u.role === 'farmer').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <SearchableDropdown
              value={searchQuery}
              onChange={setSearchQuery}
              options={searchSuggestions}
                placeholder="Search users..."
              label=""
              isDarkMode={isDarkMode}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              }
            />
          </div>

          <button
            onClick={handleAddNewUserClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2
              ${isDarkMode 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add New User</span>
          </button>
        </div>

        {/* User Grid */}
        <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 animate-pulse`}>
                  <div className="flex-1">
                    <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded w-3/4 mb-2`}></div>
                    <div className={`h-3 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded w-1/2`}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.filter(user => user.role !== 'admin').map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleFarmerClick(user.id)}
                  className={`rounded-lg ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                  } p-4 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div>
                      <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {user.first_name} {user.middle_name} {user.last_name}
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {user.email}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium
                        ${isDarkMode 
                          ? 'bg-green-900 text-green-200' 
                          : 'bg-green-100 text-green-800'}`}>
                        Active
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium
                        ${isDarkMode 
                          ? 'bg-blue-900 text-blue-200' 
                          : 'bg-blue-100 text-blue-800'}`}>
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <div className={`pt-3 mt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(user.id);
                        }}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors
                          ${isDarkMode
                            ? 'bg-red-900 text-white hover:bg-red-800'
                            : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-300'}`}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`rounded-lg shadow-xl max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {currentUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className={`rounded-full p-1 hover:bg-opacity-80 transition-colors ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                {!currentUser && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                    />
                  </div>
                )}

                {currentUser && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                    {currentUser ? 'Save Changes' : 'Add User'}
                </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserManagement;