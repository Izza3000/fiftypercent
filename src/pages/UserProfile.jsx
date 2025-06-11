import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthProvider";
import Layout from '../components/Layout';

const UserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for editable profile fields
  const [profileData, setProfileData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });

  // State for password change
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) {
        navigate("/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("users")
          .select("first_name, middle_name, last_name")
          .eq("id", authUser.id)
          .single();

        if (error) throw error;

        setProfileData({
          firstName: data.first_name || "",
          middleName: data.middle_name || "",
          lastName: data.last_name || "",
        });
      } catch (error) {
        console.error("Error fetching user profile:", error.message);
        setError("Failed to load user profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate, authUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setPasswordChangeMessage("");

    try {
      const { error } = await supabase
        .from("users")
        .update({
          first_name: profileData.firstName,
          middle_name: profileData.middleName,
          last_name: profileData.lastName,
        })
        .eq("id", authUser?.id);

      if (error) throw error;
      setError("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error.message);
      setError("Error updating profile: " + error.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage("");
    setError("");

    const { newPassword, confirmNewPassword } = passwordData;

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordChangeMessage("Password changed successfully!");
      setPasswordData({
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordChangeMessage("Error changing password: " + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Navigation links for admin dashboard
  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
  ];

  // Navigation links for farmer dashboard
  const userLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  // Determine which set of links to use based on the current user's role
  const navLinks = authUser?.role === "admin" ? adminLinks : userLinks;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className={`h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/4 mb-8`}></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
                  <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/2 mb-4`}></div>
                  <div className={`h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            User Profile
          </h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Personal Information */}
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Personal Information
            </h2>
            <form onSubmit={handleSaveProfile}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="firstName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md border-2 px-4 py-2 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="middleName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    value={profileData.middleName}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md border-2 px-4 py-2 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md border-2 px-4 py-2 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Change Password
            </h2>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className={`mt-1 block w-full rounded-md border-2 px-4 py-2 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="confirmNewPassword" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    name="confirmNewPassword"
                    value={passwordData.confirmNewPassword}
                    onChange={handlePasswordChange}
                    className={`mt-1 block w-full rounded-md border-2 px-4 py-2 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    }`}
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={`mt-4 p-4 rounded-md ${
            error.includes('successfully') 
              ? isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
              : isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
          }`}>
            {error}
          </div>
        )}
        {passwordChangeMessage && (
          <div className={`mt-4 p-4 rounded-md ${
            passwordChangeMessage.includes('successfully')
              ? isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
              : isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
          }`}>
            {passwordChangeMessage}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserProfile;