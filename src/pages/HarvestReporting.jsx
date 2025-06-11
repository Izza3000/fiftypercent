import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '../components/Layout';

const HarvestReporting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const initialLoadDone = useRef(false);

  // Add global styles for dark mode select options
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .dark-mode select option {
        background-color: #374151 !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Add dark mode class to body when dark mode is active
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState(null); // Will hold the current farmer's details
  const [plantDataList, setPlantDataList] = useState([]); // To populate the plant_id dropdown
  const [harvestDataList, setHarvestDataList] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [harvestInputForm, setHarvestInputForm] = useState({
    harvest_id: null, // null for new entry, ID for editing
    farmer_id: null,
    plant_id: "", // Make sure this is initially an empty string for the select input
    harvest_date: "",
    coffee_raw_quantity: "", // NEW NAME (float8)
    coffee_dry_quantity: "", // NEW NAME (float8)
    coffee_premium_grade: "", // NEW GRADE FIELD (float8)
    coffee_fine_grade: "", // NEW GRADE FIELD (float8)
    coffee_commercial_grade: "", // NEW GRADE FIELD (float8)
  });
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [isEditingHarvest, setIsEditingHarvest] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add new state for maximum dry quantity
  const [maxDryQuantity, setMaxDryQuantity] = useState(0);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // Fetch user's role for navigation links
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", user.email)
        .single();
      if (!userError) setUser(prevUser => ({ ...prevUser, ...userData }));

      // Fetch farmer details (needed for farmer_id)
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmer_detail")
        .select("id") // Only need the ID for linking
        .eq("id", user.id)
        .single();

      if (farmerError && farmerError.code === 'PGRST116') { // No rows found
        if (!initialLoadDone.current) {
        toast.info("Please declare your farm details first in 'Land & Plant Declaration'.");
        }
        setFarmerDetails(null);
        setPlantDataList([]); // Clear plant list if no farmer details
        setHarvestDataList([]); // Clear harvest list if no farmer details
        return;
      } else if (farmerData) {
        setFarmerDetails(farmerData);

        // Fetch plant data for this farmer (to populate the dropdown)
        const { data: plants, error: plantsError } = await supabase
          .from("plant_data")
          .select("plant_id, coffee_variety, planting_date")
          .eq("farmer_id", farmerData.id);

        if (!plantsError) {
          setPlantDataList(plants || []);
        } else {
          console.error("Error fetching plant data for dropdown:", plantsError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
        }

        // Fetch harvest data for this farmer
        const { data: harvests, error: harvestsError } = await supabase
          .from("harvest_data")
          .select("*")
          .eq("farmer_id", farmerData.id)
          .order("harvest_date", { ascending: false }); // Order by date

        if (!harvestsError) {
          setHarvestDataList(harvests || []);
          if (!initialLoadDone.current) {
            const plantCount = plants?.length || 0;
            const harvestCount = harvests?.length || 0;
            if (plantCount === 0) {
              toast.info("No plant data found. Please add plants in 'Land & Plant Declaration'.");
            } else if (harvestCount === 0) {
              toast.info("No harvest data recorded yet. You can start adding harvest records.");
            } else {
              toast.success(`Loaded ${plantCount} plant record${plantCount > 1 ? 's' : ''} and ${harvestCount} harvest record${harvestCount > 1 ? 's' : ''}.`);
            }
          }
        } else {
          console.error("Error fetching harvest data:", harvestsError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
        }
      } else if (farmerError) {
        console.error("Error fetching farmer details:", farmerError);
        if (!initialLoadDone.current) {
          toast.error("Error loading data. Please try refreshing the page.");
        }
      }
      initialLoadDone.current = true;
    };
    fetchUserAndData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleHarvestInputChange = (e) => {
    const { name, value } = e.target;
    
    // Update the form state
    setHarvestInputForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Calculate max dry quantity when raw quantity changes (approximately 20% weight loss during drying)
    if (name === 'coffee_raw_quantity') {
      const rawQuantity = parseFloat(value) || 0;
      const maxDry = Math.round((rawQuantity * 1) * 100) / 100; // Round to 2 decimal places
      setMaxDryQuantity(maxDry);
    }

    // Calculate total dry quantity from grades
    if (['coffee_premium_grade', 'coffee_fine_grade', 'coffee_commercial_grade'].includes(name)) {
      const premiumGrade = parseFloat(name === 'coffee_premium_grade' ? value : harvestInputForm.coffee_premium_grade) || 0;
      const fineGrade = parseFloat(name === 'coffee_fine_grade' ? value : harvestInputForm.coffee_fine_grade) || 0;
      const commercialGrade = parseFloat(name === 'coffee_commercial_grade' ? value : harvestInputForm.coffee_commercial_grade) || 0;
      
      const calculatedDryQuantity = premiumGrade + fineGrade + commercialGrade;
      
      // Update the dry quantity
      setHarvestInputForm((prev) => ({
        ...prev,
        coffee_dry_quantity: calculatedDryQuantity.toFixed(2),
      }));
    }
  };

  const saveHarvestData = async (e) => {
    e.preventDefault();

    // Validate total dry quantity against max dry quantity
    const currentDryQuantity = parseFloat(harvestInputForm.coffee_dry_quantity);
    const currentRawQuantity = parseFloat(harvestInputForm.coffee_raw_quantity);
    
    if (currentDryQuantity > maxDryQuantity) {
      toast.error(`Total dry quantity (${currentDryQuantity}kg) cannot exceed ${maxDryQuantity}(kg of raw quantity ${currentRawQuantity}kg)`);
      return;
    }

    if (!farmerDetails || !farmerDetails.id) {
      toast.error("Farmer details not loaded. Cannot save harvest data.");
      return;
    }

    if (!harvestInputForm.harvest_date || !harvestInputForm.plant_id ||
        harvestInputForm.coffee_raw_quantity === "" ||
        harvestInputForm.coffee_premium_grade === "" ||
        harvestInputForm.coffee_fine_grade === "" ||
        harvestInputForm.coffee_commercial_grade === ""
    ) {
      toast.warning("Please fill all harvest data fields.");
      return;
    }

    const parsedRawQuantity = parseFloat(harvestInputForm.coffee_raw_quantity);
    if (isNaN(parsedRawQuantity) || parsedRawQuantity < 0) {
      toast.warning("Raw coffee quantity must be a non-negative number.");
      return;
    }

    const parsedPremiumGrade = parseFloat(harvestInputForm.coffee_premium_grade);
    if (isNaN(parsedPremiumGrade) || parsedPremiumGrade < 0) {
      toast.warning("Premium grade must be a non-negative number.");
      return;
    }

    const parsedFineGrade = parseFloat(harvestInputForm.coffee_fine_grade);
    if (isNaN(parsedFineGrade) || parsedFineGrade < 0) {
      toast.warning("Fine grade must be a non-negative number.");
      return;
    }

    const parsedCommercialGrade = parseFloat(harvestInputForm.coffee_commercial_grade);
    if (isNaN(parsedCommercialGrade) || parsedCommercialGrade < 0) {
      toast.warning("Commercial grade must be a non-negative number.");
      return;
    }

    // Calculate total dry quantity
    const totalDryQuantity = parsedPremiumGrade + parsedFineGrade + parsedCommercialGrade;

    try {
      const harvestDataToSave = {
        plant_id: harvestInputForm.plant_id,
        harvest_date: harvestInputForm.harvest_date,
        coffee_raw_quantity: parsedRawQuantity,
        coffee_dry_quantity: totalDryQuantity,
        coffee_premium_grade: parsedPremiumGrade,
        coffee_fine_grade: parsedFineGrade,
        coffee_commercial_grade: parsedCommercialGrade,
      };

      if (harvestInputForm.harvest_id) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("harvest_data")
          .update(harvestDataToSave)
          .eq("harvest_id", harvestInputForm.harvest_id)
          .eq("farmer_id", farmerDetails.id); // Ensure user can only update their own records

        if (updateError) throw updateError;
        toast.success("Harvest data updated successfully!");

      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("harvest_data")
          .insert({
            ...harvestDataToSave,
            farmer_id: farmerDetails.id, // Link to the farmer
          });

        if (insertError) throw insertError;
        toast.success("Harvest data added successfully!");
      }

      // Re-fetch all harvest data to update the list
      const { data: updatedHarvestList, error: fetchError } = await supabase
        .from("harvest_data")
        .select("*")
        .eq("farmer_id", farmerDetails.id)
        .order("harvest_date", { ascending: false });

      if (fetchError) throw fetchError;
      setHarvestDataList(updatedHarvestList || []);

      // Close modal and reset form after successful save
      if (isEditingHarvest) {
        setIsModalOpen(false);
        setIsEditingHarvest(false);
      }
      
      // Reset form
      setHarvestInputForm({
        harvest_id: null,
        farmer_id: farmerDetails?.id,
        plant_id: "",
        harvest_date: "",
        coffee_raw_quantity: "",
        coffee_dry_quantity: "",
        coffee_premium_grade: "",
        coffee_fine_grade: "",
        coffee_commercial_grade: "",
      });

    } catch (error) {
      console.error("Error saving harvest data:", error);
      toast.error(`Error saving harvest data: ${error.message}`);
    }
  };

  const editHarvest = (harvest) => {
    setHarvestInputForm({
      harvest_id: harvest.harvest_id,
      farmer_id: harvest.farmer_id,
      plant_id: harvest.plant_id,
      harvest_date: harvest.harvest_date.split('T')[0], // Format for date input
      coffee_raw_quantity: harvest.coffee_raw_quantity,
      coffee_dry_quantity: harvest.coffee_dry_quantity,
      coffee_premium_grade: harvest.coffee_premium_grade,
      coffee_fine_grade: harvest.coffee_fine_grade,
      coffee_commercial_grade: harvest.coffee_commercial_grade,
    });
    setIsEditingHarvest(true);
    setIsModalOpen(true);
  };

  const deleteHarvest = async (harvestId) => {
    if (!window.confirm("Are you sure you want to delete this harvest entry?")) return;

    try {
      const { error } = await supabase
        .from("harvest_data")
        .delete()
        .eq("harvest_id", harvestId)
        .eq("farmer_id", farmerDetails.id); // Ensure user can only delete their own records

      if (error) throw error;

      toast.success("Harvest data deleted successfully!");
      setHarvestDataList(harvestDataList.filter(harvest => harvest.harvest_id !== harvestId));

      // If the deleted harvest was being edited, reset the form
      if (harvestInputForm.harvest_id === harvestId) {
        setHarvestInputForm({
          harvest_id: null,
          farmer_id: farmerDetails.id,
          plant_id: "",
          harvest_date: "",
          coffee_raw_quantity: "",
          coffee_dry_quantity: "",
          coffee_premium_grade: "",
          coffee_fine_grade: "",
          coffee_commercial_grade: "",
        });
        setShowHarvestForm(false);
        setIsEditingHarvest(false);
      }
    } catch (error) {
      console.error("Error deleting harvest data:", error);
      toast.error(`Error deleting harvest data: ${error.message}`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditingHarvest(false);
    setHarvestInputForm({
      harvest_id: null,
      farmer_id: farmerDetails?.id,
      plant_id: "",
      harvest_date: "",
      coffee_raw_quantity: "",
      coffee_dry_quantity: "",
      coffee_premium_grade: "",
      coffee_fine_grade: "",
      coffee_commercial_grade: "",
    });
  };

  const handleOutsideClick = (e) => {
    // If the click is on the overlay (data-input-section) but not on the modal content
    if (e.target.classList.contains('data-input-section')) {
      cancelHarvestEdit();
    }
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
  ];

  const userLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : userLinks;

  // Add helper function to validate grade input
  const validateGradeInput = (value, name) => {
    const premiumGrade = parseFloat(name === 'coffee_premium_grade' ? value : harvestInputForm.coffee_premium_grade) || 0;
    const fineGrade = parseFloat(name === 'coffee_fine_grade' ? value : harvestInputForm.coffee_fine_grade) || 0;
    const commercialGrade = parseFloat(name === 'coffee_commercial_grade' ? value : harvestInputForm.coffee_commercial_grade) || 0;
    
    return (premiumGrade + fineGrade + commercialGrade) <= maxDryQuantity;
  };

  // Add function to get unique years from harvest data
  const getUniqueYears = () => {
    const years = harvestDataList.map(harvest => 
      new Date(harvest.harvest_date).getFullYear().toString()
    );
    return ['All', ...Array.from(new Set(years)).sort((a, b) => b - a)];
  };

  // Add function to filter harvests by year
  const getFilteredHarvests = () => {
    if (selectedYear === 'All') return harvestDataList;
    return harvestDataList.filter(harvest => 
      new Date(harvest.harvest_date).getFullYear().toString() === selectedYear
    );
  };

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Harvest Reporting
            </h2>
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Record and manage your coffee harvest data
            </p>
          </div>

          {/* Harvest Form Section */}
          <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Record New Harvest</h3>
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>

            <form onSubmit={saveHarvestData} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Plant
                  </label>
                  <select
                    name="plant_id"
                    value={harvestInputForm.plant_id}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  >
                    <option value="">Select a plant</option>
                    {plantDataList.map((plant) => (
                      <option key={plant.plant_id} value={plant.plant_id}>
                        {plant.coffee_variety} (Planted: {new Date(plant.planting_date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Harvest Date
                  </label>
                  <input
                    type="date"
                    name="harvest_date"
                    value={harvestInputForm.harvest_date}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Raw Coffee Quantity (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="coffee_raw_quantity"
                    value={harvestInputForm.coffee_raw_quantity}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                  {harvestInputForm.coffee_raw_quantity > 0 && (
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Maximum dry quantity: {maxDryQuantity}kg (of raw quantity)
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Total Dry Coffee Quantity (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="coffee_dry_quantity"
                    value={harvestInputForm.coffee_dry_quantity}
                    readOnly
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-600 border-gray-600 text-white'
                        : 'bg-gray-100 border-gray-300 text-gray-900'
                    } cursor-not-allowed`}
                  />
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Auto-calculated from grades
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quantity of Premium Grade (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="coffee_premium_grade"
                    value={harvestInputForm.coffee_premium_grade}
                    onChange={(e) => {
                      handleHarvestInputChange(e);
                      if (!validateGradeInput(e.target.value, 'coffee_premium_grade')) {
                        toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quantity of Fine Grade (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="coffee_fine_grade"
                    value={harvestInputForm.coffee_fine_grade}
                    onChange={(e) => {
                      handleHarvestInputChange(e);
                      if (!validateGradeInput(e.target.value, 'coffee_fine_grade')) {
                        toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quantity of Commercial Grade (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="coffee_commercial_grade"
                    value={harvestInputForm.coffee_commercial_grade}
                    onChange={(e) => {
                      handleHarvestInputChange(e);
                      if (!validateGradeInput(e.target.value, 'coffee_commercial_grade')) {
                        toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowHarvestForm(false);
                    setIsEditingHarvest(false);
                    setHarvestInputForm({
                      harvest_id: null,
                      farmer_id: farmerDetails?.id,
                      plant_id: "",
                      harvest_date: "",
                      coffee_raw_quantity: "",
                      coffee_dry_quantity: "",
                      coffee_premium_grade: "",
                      coffee_fine_grade: "",
                      coffee_commercial_grade: "",
                    });
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isEditingHarvest ? 'Update Harvest' : 'Record Harvest'}
                </button>
              </div>
            </form>
          </div>

          {/* Edit Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`relative w-full max-w-3xl p-8 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <button
                  onClick={closeModal}
                  className={`absolute top-4 right-4 text-2xl ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
                >
                  ×
                </button>
                
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Edit Harvest Record
                </h3>

                <form onSubmit={saveHarvestData} className="space-y-6">
                  {/* Plant and Date Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Plant
                      </label>
                      <select
                        name="plant_id"
                        value={harvestInputForm.plant_id}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      >
                        <option value="">Select a plant</option>
                        {plantDataList.map((plant) => (
                          <option key={plant.plant_id} value={plant.plant_id}>
                            {plant.coffee_variety} (Planted: {new Date(plant.planting_date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Harvest Date
                      </label>
                      <input
                        type="date"
                        name="harvest_date"
                        value={harvestInputForm.harvest_date}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      />
                    </div>
                  </div>

                  {/* Raw and Dry Quantity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Raw Coffee Quantity (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="coffee_raw_quantity"
                        value={harvestInputForm.coffee_raw_quantity}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      />
                      {harvestInputForm.coffee_raw_quantity > 0 && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Maximum dry quantity: {maxDryQuantity}kg (of raw quantity)
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Total Dry Coffee Quantity (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="coffee_dry_quantity"
                        value={harvestInputForm.coffee_dry_quantity}
                        readOnly
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-600 border-gray-600 text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-900'
                        } cursor-not-allowed`}
                      />
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Auto-calculated from grades
                      </p>
                    </div>
                  </div>

                  {/* Coffee Grades */}
                  <div className="space-y-2">
                    <h4 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Coffee Grades
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Premium Grade (kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="coffee_premium_grade"
                          value={harvestInputForm.coffee_premium_grade}
                          onChange={(e) => {
                            handleHarvestInputChange(e);
                            if (!validateGradeInput(e.target.value, 'coffee_premium_grade')) {
                              toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                            }
                          }}
                          className={`w-full px-4 py-2.5 rounded-lg border ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                          } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Fine Grade (kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="coffee_fine_grade"
                          value={harvestInputForm.coffee_fine_grade}
                          onChange={(e) => {
                            handleHarvestInputChange(e);
                            if (!validateGradeInput(e.target.value, 'coffee_fine_grade')) {
                              toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                            }
                          }}
                          className={`w-full px-4 py-2.5 rounded-lg border ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                          } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Commercial Grade (kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="coffee_commercial_grade"
                          value={harvestInputForm.coffee_commercial_grade}
                          onChange={(e) => {
                            handleHarvestInputChange(e);
                            if (!validateGradeInput(e.target.value, 'coffee_commercial_grade')) {
                              toast.warning(`Total dry quantity cannot exceed ${maxDryQuantity}kg`);
                            }
                          }}
                          className={`w-full px-4 py-2.5 rounded-lg border ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                          } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      Update Harvest
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Harvest History Section */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Harvest History</h3>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
                >
                  {getUniqueYears().map(year => (
                    <option key={year} value={year}>
                      {year === 'All' ? 'All Years' : year}
                    </option>
                  ))}
                </select>
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredHarvests().map((harvest) => (
                <div
                  key={harvest.harvest_id}
                  className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} hover:shadow-lg transition-shadow duration-200`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {new Date(harvest.harvest_date).toLocaleDateString()}
                      </h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Plant ID: {harvest.plant_id}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editHarvest(harvest)}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'hover:bg-gray-600 text-blue-400'
                            : 'hover:bg-gray-200 text-blue-600'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteHarvest(harvest.harvest_id)}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'hover:bg-gray-600 text-red-400'
                            : 'hover:bg-gray-200 text-red-600'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Raw Quantity</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {harvest.coffee_raw_quantity} kg
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Dry Quantity</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {harvest.coffee_dry_quantity} kg
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Premium Grade</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {harvest.coffee_premium_grade} kg
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Fine Grade</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {harvest.coffee_fine_grade} kg
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Commercial Grade</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {harvest.coffee_commercial_grade} kg
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HarvestReporting;