import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import "../styles/Styles.css"; // Ensure your styles are imported
import Layout from '../components/Layout';

// Import Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState(null); // Will be null if no details declared
  const [plants, setPlants] = useState([]); // Add plants state
  const [statuses, setStatuses] = useState({}); // Add statuses state
  const [totalFarmerPlants, setTotalFarmerPlants] = useState(0); // Sum of trees
  const [totalRawHarvests, setTotalRawHarvests] = useState(0); // Sum of raw quantity
  const [totalDryHarvests, setTotalDryHarvests] = useState(0); // Sum of dry quantity
  const [totalPremiumKg, setTotalPremiumKg] = useState(0); // Sum of premium grade in Kg
  const [totalFineKg, setTotalFineKg] = useState(0);       // Sum of fine grade in Kg
  const [totalCommercialKg, setTotalCommercialKg] = useState(0); // Sum of commercial grade in Kg
  const [recentFarmerActivities, setRecentFarmerActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for Chart Data
  const [harvestBarChartData, setHarvestBarChartData] = useState({
    labels: ['Raw Harvest', 'Dry Harvest'],
    datasets: [{
      label: 'Coffee Quantity (kg)',
      data: [0, 0],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
      borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
      borderWidth: 1,
    }]
  });

  const [gradePieChartData, setGradePieChartData] = useState({
    labels: ['Premium', 'Fine', 'Commercial'],
    datasets: [{
      label: 'Grade Distribution (%)',
      data: [0, 0, 0],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
      ],
      borderWidth: 1,
    }]
  });

  // Add new state for legend data
  const [legendData, setLegendData] = useState([
    { label: 'Premium', percentage: 0, value: 0, color: 'rgba(255, 99, 132, 0.6)' },
    { label: 'Fine', percentage: 0, value: 0, color: 'rgba(54, 162, 235, 0.6)' },
    { label: 'Commercial', percentage: 0, value: 0, color: 'rgba(255, 206, 86, 0.6)' }
  ]);

  // Add getStatusColor function
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return isDarkMode 
          ? 'bg-green-900 text-green-200' 
          : 'bg-green-100 text-green-800';
      case 'diseased':
        return isDarkMode 
          ? 'bg-red-900 text-red-200' 
          : 'bg-red-100 text-red-800';
      case 'pest-affected':
        return isDarkMode 
          ? 'bg-yellow-900 text-yellow-200' 
          : 'bg-yellow-100 text-yellow-800';
      default:
        return isDarkMode 
          ? 'bg-gray-700 text-gray-200' 
          : 'bg-gray-100 text-gray-800';
    }
  };

  // Add handlePlantClick function
  const handlePlantClick = (plant) => {
    navigate(`/plant-status/${plant.plant_id}`);
  };

  useEffect(() => {
    const fetchFarmerDashboardData = async () => {
      setLoading(true);
      setError("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate("/login");
        return;
      }
      // Set the base user info (auth user)
      setUser(authUser);

      // Fetch user's role and full name from 'users' table
      const { data: userData, error: userDetailsError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", authUser.email)
        .single();

      if (userDetailsError) {
        console.error("Error fetching user details:", userDetailsError.message);
        setError("Failed to fetch your user profile. Please try again.");
        setLoading(false);
        return;
      }
      // Update user state with details including role and names
      setUser(prevUser => ({ ...prevUser, ...userData }));

      // --- Access Control: Only allow farmers ---
      if (userData?.role !== "farmer") {
        setError("Access Denied: Only farmers can view this dashboard.");
        setLoading(false);
        // Optionally redirect to a generic dashboard or login if not a farmer
        // navigate("/dashboard", { replace: true });
        return;
      }
      // --- End Access Control ---

      try {
        // Fetch specific farmer details using user.id
        // Handle case where farmer_detail might not exist (new user)
        const { data: farmerData, error: farmerDetailError } = await supabase
          .from("farmer_detail")
          .select("id, farm_location, farm_size, farm_elevation")
          .eq("id", authUser.id) // IMPORTANT: Filter by the authenticated user's ID
          .single();

        if (farmerDetailError && farmerDetailError.code !== 'PGRST116') { // PGRST116 means no rows found, which is expected for new farmers
          throw farmerDetailError; // Re-throw other unexpected errors
        }

        // If farmerData is null (no details yet), farmerDetails will remain null, and the UI will show default.
        // If farmerData is found, set it.
        setFarmerDetails(farmerData);

        // Fetch plant data
        const { data: plantData, error: plantsError } = await supabase
          .from("plant_data")
          .select("*")
          .eq("farmer_id", authUser.id);
        if (plantsError) throw plantsError;

        setPlants(plantData);

        // Fetch latest status for each plant
        const newStatuses = {};
        for (const plant of plantData) {
          const { data: statusData, error: statusError } = await supabase
            .from('plant_status')
            .select('*')
            .eq('plant_id', plant.plant_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (!statusError && statusData) {
            newStatuses[plant.plant_id] = statusData;
          }
        }
        setStatuses(newStatuses);

        // Sum up the number_of_tree_planted
        const sumTotalTrees = plantData.reduce((sum, plant) => sum + (plant.number_of_tree_planted || 0), 0);
        setTotalFarmerPlants(sumTotalTrees);

        // Fetch ALL relevant Harvest data for this farmer
        const { data: harvestData, error: harvestsError } = await supabase
          .from("harvest_data")
          .select("coffee_raw_quantity, coffee_dry_quantity, coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade, harvest_date") // Select all relevant columns
          .eq("farmer_id", authUser.id); // IMPORTANT: Filter by farmer's ID
        if (harvestsError) throw harvestsError;

        // Sum up the coffee quantities
        const sumRawQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_raw_quantity || 0), 0);
        setTotalRawHarvests(sumRawQuantity);

        const sumDryQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_dry_quantity || 0), 0);
        setTotalDryHarvests(sumDryQuantity);

        // Calculate total Kg for each grade (using dry quantity as base)
        const sumPremiumKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const premiumPercentage = harvest.coffee_premium_grade || 0;
          return sum + (dryQuantity * (premiumPercentage / 100));
        }, 0);
        setTotalPremiumKg(Math.round(sumPremiumKg * 100) / 100);

        const sumFineKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const finePercentage = harvest.coffee_fine_grade || 0;
          return sum + (dryQuantity * (finePercentage / 100));
        }, 0);
        setTotalFineKg(Math.round(sumFineKg * 100) / 100);

        const sumCommercialKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const commercialPercentage = harvest.coffee_commercial_grade || 0;
          return sum + (dryQuantity * (commercialPercentage / 100));
        }, 0);
        setTotalCommercialKg(Math.round(sumCommercialKg * 100) / 100);

        // Update Chart Data
        setHarvestBarChartData({
          labels: ['Raw Harvest', 'Dry Harvest'],
          datasets: [{
            label: 'Coffee Quantity (kg)',
            data: [sumRawQuantity, sumDryQuantity],
            backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
            borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
            borderWidth: 1,
          }]
        });

        // Calculate total graded yield and percentages for pie chart
        const totalGradedYield = sumPremiumKg + sumFineKg + sumCommercialKg;
        
        // Calculate percentages
        const premiumPercentage = totalGradedYield > 0 ? (sumPremiumKg / totalGradedYield) * 100 : 0;
        const finePercentage = totalGradedYield > 0 ? (sumFineKg / totalGradedYield) * 100 : 0;
        const commercialPercentage = totalGradedYield > 0 ? (sumCommercialKg / totalGradedYield) * 100 : 0;

        // Update Pie Chart with percentage distribution
        setGradePieChartData({
          labels: ['Premium', 'Fine', 'Commercial'],
          datasets: [{
            label: 'Grade Distribution (%)',
            data: [
              Math.round(premiumPercentage * 10) / 10,    // Round to 1 decimal place
              Math.round(finePercentage * 10) / 10,
              Math.round(commercialPercentage * 10) / 10
            ],
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)', // Premium - Pink/Red
              'rgba(54, 162, 235, 0.6)', // Fine - Blue
              'rgba(255, 206, 86, 0.6)', // Commercial - Yellow
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
            ],
            borderWidth: 1,
          }]
        });

        // Update the legend data when updating pie chart
        setLegendData([
          { 
            label: 'Premium', 
            percentage: Math.round(premiumPercentage * 10) / 10,
            value: Math.round(sumPremiumKg * 100) / 100,
            color: 'rgba(255, 99, 132, 0.6)'
          },
          { 
            label: 'Fine', 
            percentage: Math.round(finePercentage * 10) / 10,
            value: Math.round(sumFineKg * 100) / 100,
            color: 'rgba(54, 162, 235, 0.6)'
          },
          { 
            label: 'Commercial', 
            percentage: Math.round(commercialPercentage * 10) / 10,
            value: Math.round(sumCommercialKg * 100) / 100,
            color: 'rgba(255, 206, 86, 0.6)'
          }
        ]);

        // Fetch Recent Activities for this farmer
        // Get recent plant declarations
        const { data: recentPlants, error: recentPlantsError } = await supabase
          .from("plant_data")
          .select("planting_date, coffee_variety")
          .eq("farmer_id", authUser.id)
          .order("planting_date", { ascending: false })
          .limit(3);

        // Get recent harvest records (use the already fetched harvestData for activities)
        // Sort the fetched harvestData by date for recent activities
        const sortedRecentHarvests = [...harvestData].sort((a, b) => new Date(b.harvest_date) - new Date(a.harvest_date)).slice(0, 3);


        let activities = [];
        if (!recentPlantsError && recentPlants) {
          activities = activities.concat(recentPlants.map(p => ({
            date: new Date(p.planting_date).toLocaleDateString(),
            activity: `New Plant Declaration: ${p.coffee_variety}`,
            status: "Completed"
          })));
        } else if (recentPlantsError) {
          console.error("Error fetching recent plants:", recentPlantsError);
        }

        if (sortedRecentHarvests) { // Use sortedRecentHarvests directly
          activities = activities.concat(sortedRecentHarvests.map(h => ({
            date: new Date(h.harvest_date).toLocaleDateString(),
            activity: "Harvest Recorded",
            status: "Completed"
          })));
        }
        // No need for else if (recentHarvestsError) here, as we're using already fetched data.

        // Sort activities by date in descending order and limit to top 5
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentFarmerActivities(activities.slice(0, 5));

      } catch (err) {
        console.error("Failed to fetch farmer dashboard data:", err);
        setError(`Failed to load your dashboard data: ${err.message}`);
        // If a critical error occurs, it should still show the error state.
      } finally {
        setLoading(false);
      }
    };

    fetchFarmerDashboardData();
  }, [navigate]); // navigate is a dependency

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Navigation links for farmer dashboard
  const farmerNavLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" }, // This new dashboard
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = farmerNavLinks;

  // Chart options for Bar Graph (Harvests)
  const harvestBarChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Raw vs. Dry Coffee Harvest (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Harvest Type',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Quantity (kg)',
        },
        beginAtZero: true,
      },
    },
  };

  // Chart options for Pie Chart (Graded Yield)
  const gradePieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Distribution of Graded Yield (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed !== null) {
                label += context.parsed.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
  };

  // Add this custom legend component
  const CustomLegend = ({ data }) => (
    <div className="flex flex-col gap-4 p-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: item.color }}
          />
          <div className="flex flex-col">
            <span className="font-medium">{item.label}</span>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span>{item.percentage}%</span>
              <span className="mx-1">•</span>
              <span>{item.value} kg</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

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

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Error</h1>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Farmer Dashboard
          </h2>
          {user && (
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Welcome back, <span className="font-semibold">{user.first_name} {user.last_name}</span>
            </p>
          )}
          <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Monitor your farm's performance and activities
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Plants</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalFarmerPlants}</p>
              </div>
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Raw Harvest</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{totalRawHarvests} kg</p>
              </div>
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dry Harvest</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{totalDryHarvests} kg</p>
              </div>
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-amber-900' : 'bg-amber-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Harvest Distribution</h3>
            <div className="h-64">
              <Bar data={harvestBarChartData} options={harvestBarChartOptions} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="w-full md:w-1/2 max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-center">Grade Distribution</h3>
              <Pie data={gradePieChartData} options={gradePieChartOptions} />
            </div>
            <div className="w-full md:w-1/2 max-w-md">
              <CustomLegend data={legendData} />
            </div>
          </div>
        </div>

        {/* Your Current Plants Section */}
        <div className={`mt-8 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
          <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Your Current Plants</h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Click on a plant to view its status and manage it.
            </p>
          </div>
          <div className="p-6">
            {plants.length === 0 ? (
              <div className="text-center py-8">
                <p className={`mb-4 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Please declare plant first.
                </p>
                <button
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                  onClick={() => navigate('/land-declaration')}
                >
                  Declare Plant
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {plants.map((plant) => (
                  <div
                    key={plant.plant_id}
                    className={`p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} 
                      hover:shadow-lg transition-all duration-200 cursor-pointer`}
                    onClick={() => handlePlantClick(plant)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {plant.coffee_variety}
                        </h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Trees: {plant.number_of_tree_planted}
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Planted: {new Date(plant.planting_date).toLocaleDateString()}
                        </p>
                      </div>
                      {statuses[plant.plant_id] && (
                        <div className={`px-4 py-2 rounded-full text-sm font-medium
                          ${getStatusColor(statuses[plant.plant_id].status)}`}>
                          {statuses[plant.plant_id].status}
                        </div>
                      )}
                      <div className={`ml-4 p-2 rounded-full ${
                        isDarkMode ? 'bg-gray-600 text-indigo-400' : 'bg-gray-200 text-indigo-600'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className={`mt-8 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
          <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activities</h3>
          </div>
          <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {recentFarmerActivities.map((activity, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activity.activity}</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{activity.date}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium
                    ${isDarkMode 
                      ? 'bg-green-900 text-green-200' 
                      : 'bg-green-100 text-green-800'}`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FarmerDashboard;