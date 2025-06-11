import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '../components/Layout';
import { useAuth } from "../lib/AuthProvider";

const LandDeclaration = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user: authUser } = useAuth();
  const initialLoadDone = useRef(false);
  const [farmerDetails, setFarmerDetails] = useState({
    farm_location: "",
    farm_size: "",
    farm_elevation: "",
    // plant_id is no longer needed here as a single link, it will be handled by foreign keys
  });
  const [plantDataList, setPlantDataList] = useState([]); // Array to hold multiple plant entries
  const [plantInputForm, setPlantInputForm] = useState({ // State for the single plant input form
    plant_id: null, // Will be null for new plants, set for editing
    coffee_variety: "",
    planting_date: "",
    number_of_tree_planted: "",
  });
  const [hasFarmerDetail, setHasFarmerDetail] = useState(false);
  const [isEditingFarmerDetail, setIsEditingFarmerDetail] = useState(false);
  const [isEditingPlant, setIsEditingPlant] = useState(false); // New state to manage editing an individual plant
  const [showPlantForm, setShowPlantForm] = useState(false); // Controls visibility of the plant data input form

  const fetchFarmerAndPlantData = async () => {
    if (!authUser) {
      navigate("/login");
      return;
    }

    try {
      // Fetch farmer details
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmer_detail")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (farmerError && farmerError.code === 'PGRST116') {
        setHasFarmerDetail(false);
        setIsEditingFarmerDetail(true);
        if (!initialLoadDone.current) {
          toast.info("No farmer details found. Please declare your farm.");
        }
      } else if (farmerData) {
        setFarmerDetails(farmerData);
        setHasFarmerDetail(true);
        setIsEditingFarmerDetail(false);

        // Fetch plant data
        const { data: plantDataFetched, error: plantListError } = await supabase
          .from("plant_data")
          .select("*")
          .eq("farmer_id", farmerData.id);

        if (!plantListError) {
          setPlantDataList(plantDataFetched || []);
          setShowPlantForm(false);
          if (!initialLoadDone.current) {
            const plantCount = plantDataFetched?.length || 0;
            if (plantCount > 0) {
              toast.success(`Farmer details and ${plantCount} plant record${plantCount > 1 ? 's' : ''} loaded successfully.`);
            } else {
              toast.success("Farmer details loaded. No plant records found.");
            }
          }
        } else {
          console.error("Error fetching plant data list:", plantListError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
          setPlantDataList([]);
        }
      } else if (farmerError) {
        console.error("Error fetching farmer details:", farmerError);
        if (!initialLoadDone.current) {
          toast.error("Error loading data. Please try refreshing the page.");
        }
      }
    } catch (error) {
      console.error("Error in fetchFarmerAndPlantData:", error);
      if (!initialLoadDone.current) {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      initialLoadDone.current = true;
    }
  };

  useEffect(() => {
    fetchFarmerAndPlantData();
  }, [authUser, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleFarmerDetailChange = (e) => {
    const { name, value } = e.target;
    setFarmerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlantInputChange = (e) => {
    const { name, value } = e.target;
    setPlantInputForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveFarmerDetails = async () => {
    if (!authUser) {
      toast.error("User not authenticated.");
      return;
    }

    if (!farmerDetails.farm_location || farmerDetails.farm_size === "" || farmerDetails.farm_elevation === "") {
      toast.warning("Please fill all farmer detail fields.");
      return;
    }
    const parsedFarmSize = parseFloat(farmerDetails.farm_size);
    const parsedFarmElevation = parseFloat(farmerDetails.farm_elevation);

    if (isNaN(parsedFarmSize) || parsedFarmSize < 0 || isNaN(parsedFarmElevation) || parsedFarmElevation < 0) {
      toast.warning("Farm size and elevation must be valid positive numbers.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("farmer_detail")
        .upsert(
          {
            id: authUser.id, // Link to authenticated user's UUID
            farm_location: farmerDetails.farm_location,
            farm_size: parsedFarmSize,
            farm_elevation: parsedFarmElevation,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFarmerDetails(data);
      setHasFarmerDetail(true);
      setIsEditingFarmerDetail(false);
      toast.success("Farmer details saved successfully!");
    } catch (error) {
      console.error("Error saving farmer details:", error);
      toast.error(`Error saving farmer details: ${error.message}`);
    }
  };

  const savePlantData = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!authUser || !hasFarmerDetail || !farmerDetails.id) {
      toast.error("Farmer details not saved or user not authenticated.");
      return;
    }

    if (!plantInputForm.coffee_variety || !plantInputForm.planting_date || plantInputForm.number_of_tree_planted === "") {
      toast.warning("Please fill all plant data fields.");
      return;
    }
    const parsedNumTrees = parseInt(plantInputForm.number_of_tree_planted, 10);
    if (isNaN(parsedNumTrees) || parsedNumTrees <= 0) {
      toast.warning("Number of trees planted must be a positive whole number.");
      return;
    }

    try {
      if (plantInputForm.plant_id) {
        // Update existing plant_data
        const { error: updateError } = await supabase
          .from("plant_data")
          .update({
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
            // Assuming farmer_id cannot change once set for a plant entry
          })
          .eq("plant_id", plantInputForm.plant_id);

        if (updateError) throw updateError;
        toast.success("Plant data updated successfully!");

      } else {
        // Insert new plant_data
        const { data: newPlant, error: insertError } = await supabase
          .from("plant_data")
          .insert({
            farmer_id: farmerDetails.id, // Link to the farmer's UUID
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
          })
          .select("plant_id") // Select only the ID to get the newly generated one
          .single();

        if (insertError) throw insertError;
        toast.success("Plant data added successfully!");
      }

      // Re-fetch all plant data to update the list
      const { data: updatedPlantList, error: fetchError } = await supabase
        .from("plant_data")
        .select("*")
        .eq("farmer_id", farmerDetails.id);

      if (fetchError) throw fetchError;
      setPlantDataList(updatedPlantList || []);

      // Reset form and hide it after successful save/update
      setPlantInputForm({
        plant_id: null,
        coffee_variety: "",
        planting_date: "",
        number_of_tree_planted: "",
      });
      setShowPlantForm(false);
      setIsEditingPlant(false); // Exit editing mode for plant
    } catch (error) {
      console.error("Error saving plant data:", error);
      toast.error(`Error saving plant data: ${error.message}`);
    }
  };

  const editPlant = (plant) => {
    setPlantInputForm({
      plant_id: plant.plant_id,
      coffee_variety: plant.coffee_variety,
      planting_date: plant.planting_date.split('T')[0], // Format for date input
      number_of_tree_planted: plant.number_of_tree_planted,
    });
    setShowPlantForm(true);
    setIsEditingPlant(true);
  };

  const deletePlant = async (plantId) => {
    if (!window.confirm("Are you sure you want to delete this plant entry?")) return;

    try {
      const { error } = await supabase
        .from("plant_data")
        .delete()
        .eq("plant_id", plantId);

      if (error) throw error;

      toast.success("Plant data deleted successfully!");
      setPlantDataList(plantDataList.filter(plant => plant.plant_id !== plantId));

      // If the deleted plant was being edited, reset the form
      if (plantInputForm.plant_id === plantId) {
        setPlantInputForm({ plant_id: null, coffee_variety: "", planting_date: "", number_of_tree_planted: "" });
        setShowPlantForm(false);
        setIsEditingPlant(false);
      }
    } catch (error) {
      console.error("Error deleting plant data:", error);
      toast.error(`Error deleting plant data: ${error.message}`);
    }
  };

  const cancelPlantEdit = () => {
    setPlantInputForm({ plant_id: null, coffee_variety: "", planting_date: "", number_of_tree_planted: "" });
    setShowPlantForm(false);
    setIsEditingPlant(false);
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

  const navLinks = authUser?.role === "admin" ? adminLinks : userLinks;

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Land & Plant Declaration
            </h2>
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Manage your farm details and coffee plant information
            </p>
          </div>

          {/* Farm Details Section */}
          <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farm Details</h3>
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                {!isEditingFarmerDetail && (
                  <button
                    onClick={() => setIsEditingFarmerDetail(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isDarkMode
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    Edit Farm Details
                  </button>
                )}
              </div>
            </div>

            {isEditingFarmerDetail ? (
              <form onSubmit={(e) => { e.preventDefault(); saveFarmerDetails(); }} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Farm Location
                  </label>
                  <input
                    type="text"
                    name="farm_location"
                    value={farmerDetails.farm_location}
                    onChange={handleFarmerDetailChange}
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
                    Farm Size (hectares)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="farm_size"
                    value={farmerDetails.farm_size}
                    onChange={handleFarmerDetailChange}
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
                    Farm Elevation (meters)
                  </label>
                  <input
                    type="number"
                    name="farm_elevation"
                    value={farmerDetails.farm_elevation}
                    onChange={handleFarmerDetailChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  Save Farm Details
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Location</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {farmerDetails.farm_location}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Size</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {farmerDetails.farm_size} hectares
                  </p>
                </div>
                <div className="space-y-2">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Elevation</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {farmerDetails.farm_elevation} meters
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Plant Data Section */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Plants</h3>
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <button
                  onClick={() => setShowPlantForm(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Add New Plant
                </button>
              </div>
            </div>

            {showPlantForm && (
              <form onSubmit={savePlantData} className="mb-8 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Coffee Variety
                  </label>
                  <input
                    type="text"
                    name="coffee_variety"
                    value={plantInputForm.coffee_variety}
                    onChange={handlePlantInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Planting Date
                  </label>
                  <input
                    type="date"
                    name="planting_date"
                    value={plantInputForm.planting_date}
                    onChange={handlePlantInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Number of Trees Planted
                  </label>
                  <input
                    type="number"
                    name="number_of_tree_planted"
                    value={plantInputForm.number_of_tree_planted}
                    onChange={handlePlantInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlantForm(false);
                      setIsEditingPlant(false);
                      setPlantInputForm({
                        plant_id: null,
                        coffee_variety: "",
                        planting_date: "",
                        number_of_tree_planted: "",
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
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isEditingPlant ? 'Update Plant' : 'Add Plant'}
                  </button>
                </div>
              </form>
            )}

            {/* Plant List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plantDataList.map((plant) => (
                <div
                  key={plant.plant_id}
                  className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} hover:shadow-lg transition-shadow duration-200`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {plant.coffee_variety}
                    </h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editPlant(plant)}
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
                        onClick={() => deletePlant(plant.plant_id)}
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
                  <div className="space-y-2">
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Planting Date</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {new Date(plant.planting_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Trees Planted</p>
                      <p className={`text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {plant.number_of_tree_planted}
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

export default LandDeclaration;