import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTheme } from '../lib/ThemeContext';
import { useAuth } from '../lib/AuthProvider';
import { supabase } from '../lib/supabaseClient';
import Layout from '../components/Layout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const FarmerProfile = () => {
  const { farmerId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for farmer data
  const [farmerData, setFarmerData] = useState({
    basicInfo: null,
    plantStats: null,
    harvestData: null,
    qualityMetrics: null,
    financialData: null,
    sustainabilityData: null,
    supportHistory: null,
    documents: null
  });

  // State for charts
  const [charts, setCharts] = useState({
    yieldTrend: null,
    gradeDistribution: null,
    revenueChart: null,
    qualityTrend: null
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedBasicInfo, setEditedBasicInfo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Fetch all farmer data
  const fetchFarmerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch basic information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          middle_name,
          last_name,
          email,
          role,
          created_at
        `)
        .eq('id', farmerId)
        .single();

      if (userError) throw userError;

      // Fetch farmer details
      const { data: farmerDetail, error: farmerDetailError } = await supabase
        .from('farmer_detail')
        .select(`
          farmers_details,
          farm_location,
          farm_size,
          farm_elevation,
          plant_id,
          created_at
        `)
        .eq('id', farmerId)
        .single();

      if (farmerDetailError) throw farmerDetailError;

      // Fetch plant data
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select(`
          plant_id,
          coffee_variety,
          planting_date,
          number_of_tree_planted,
          plant_status (
            status,
            age_stage,
            soil_ph,
            moisture_level,
            last_fertilized
          )
        `)
        .eq('farmer_id', farmerId);

      if (plantError) throw plantError;

      // Fetch harvest data
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvest_data')
        .select(`
          harvest_id,
          harvest_date,
          plant_id,
          coffee_raw_quantity,
          coffee_dry_quantity,
          coffee_premium_grade,
          coffee_fine_grade,
          coffee_commercial_grade
        `)
        .eq('farmer_id', farmerId)
        .order('harvest_date', { ascending: false });

      if (harvestError) throw harvestError;

      // Process and set data
      const processedData = {
        basicInfo: {
          id: userData.id,
          first_name: userData.first_name,
          name: `${userData.first_name} ${userData.middle_name || ''} ${userData.last_name}`.trim(),
          email: userData.email,
          role: userData.role,
          farmLocation: farmerDetail?.farm_location || 'Not specified',
          farmSize: farmerDetail?.farm_size || 'Not specified',
          farmElevation: farmerDetail?.farm_elevation || 'Not specified',
          registrationDate: new Date(userData.created_at).toLocaleDateString(),
        },
        plantStats: {
          totalTrees: plantData.reduce((sum, plant) => sum + (parseInt(plant.number_of_tree_planted) || 0), 0),
          varieties: processPlantVarieties(plantData),
          ageDistribution: calculateAgeDistribution(plantData)
        },
        harvestData: processHarvestData(harvestData),
        qualityMetrics: calculateQualityMetrics(harvestData)
      };

      setFarmerData(processedData);
      generateCharts(processedData);

    } catch (err) {
      console.error('Error fetching farmer data:', err);
      setError('Failed to load farmer profile. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    fetchFarmerData();
  }, [fetchFarmerData]);

  // Data processing functions
  const processPlantVarieties = (plantData) => {
    const varieties = {};
    plantData.forEach(plant => {
      if (plant.coffee_variety) {
        varieties[plant.coffee_variety] = (varieties[plant.coffee_variety] || 0) + (parseInt(plant.number_of_tree_planted) || 0);
      }
    });
    return varieties;
  };

  const calculateAgeDistribution = (plantData) => {
    const currentYear = new Date().getFullYear();
    const distribution = {
      'Young (0-2 years)': 0,
      'Mature (3-7 years)': 0,
      'Old (8+ years)': 0
    };

    plantData.forEach(plant => {
      if (plant.planting_date && plant.number_of_tree_planted) {
        const plantingYear = new Date(plant.planting_date).getFullYear();
        const age = currentYear - plantingYear;
        const count = parseInt(plant.number_of_tree_planted) || 0;

        if (age <= 2) distribution['Young (0-2 years)'] += count;
        else if (age <= 7) distribution['Mature (3-7 years)'] += count;
        else distribution['Old (8+ years)'] += count;
      }
    });

    return distribution;
  };

  const processHarvestData = (harvestData) => {
    return {
      totalYield: harvestData.reduce((sum, h) => sum + (parseFloat(h.coffee_dry_quantity) || 0), 0),
      harvestCount: harvestData.length,
      lastHarvest: harvestData[0]?.harvest_date,
      yieldHistory: harvestData
        .map(h => ({
          date: h.harvest_date,
          yield: parseFloat(h.coffee_dry_quantity) || 0
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  };

  const calculateQualityMetrics = (harvestData) => {
    return {
      premiumGrade: harvestData.reduce((sum, h) => sum + (parseFloat(h.coffee_premium_grade) || 0), 0),
      fineGrade: harvestData.reduce((sum, h) => sum + (parseFloat(h.coffee_fine_grade) || 0), 0),
      commercialGrade: harvestData.reduce((sum, h) => sum + (parseFloat(h.coffee_commercial_grade) || 0), 0)
    };
  };

  // Generate chart data
  const generateCharts = (data) => {
    if (!data) return;

    const chartData = {
      yieldTrend: {
        labels: data.harvestData.yieldHistory.map(h => new Date(h.date).toLocaleDateString()),
        datasets: [{
          label: 'Yield (kg)',
          data: data.harvestData.yieldHistory.map(h => h.yield),
          borderColor: isDarkMode ? 'rgb(74, 222, 128)' : 'rgb(34, 197, 94)',
          backgroundColor: isDarkMode ? 'rgba(74, 222, 128, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          tension: 0.4
        }]
      },
      gradeDistribution: {
        labels: ['Premium', 'Fine', 'Commercial'],
        datasets: [{
          data: [
            data.qualityMetrics.premiumGrade,
            data.qualityMetrics.fineGrade,
            data.qualityMetrics.commercialGrade
          ],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(234, 179, 8, 0.8)'
          ]
        }]
      }
    };

    setCharts(chartData);
  };

  const handleEditClick = () => {
    // Split the full name to get individual components
    const nameParts = farmerData.basicInfo.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    setEditedBasicInfo({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      farm_location: farmerData.basicInfo.farmLocation,
      farm_size: farmerData.basicInfo.farmSize,
      farm_elevation: farmerData.basicInfo.farmElevation
    });
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Update user information
      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: editedBasicInfo.first_name,
          middle_name: editedBasicInfo.middle_name,
          last_name: editedBasicInfo.last_name
        })
        .eq('id', farmerId);

      if (userError) throw userError;

      // Update farmer details
      const { error: farmerError } = await supabase
        .from('farmer_detail')
        .update({
          farm_location: editedBasicInfo.farm_location,
          farm_size: editedBasicInfo.farm_size,
          farm_elevation: editedBasicInfo.farm_elevation
        })
        .eq('id', farmerId);

      if (farmerError) throw farmerError;

      // Refresh data
      await fetchFarmerData();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Error saving changes:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className={`mr-4 px-4 py-2 rounded-lg text-sm transition-colors
                ${isDarkMode
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </div>
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {farmerData.basicInfo?.first_name}'s Profile
              </h1>
              {farmerData.basicInfo && (
                <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  {farmerData.basicInfo.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`animate-pulse rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
                <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/4 mb-4`}></div>
                <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/2`}></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Row: Basic Information and Plant Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Basic Information */}
              <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Basic Information
                  </h2>
                  {user?.role === 'admin' && (
                    <button
                      onClick={handleEditClick}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${isDarkMode
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.basicInfo?.email}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Location</p>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.basicInfo?.farmLocation}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Size</p>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.basicInfo?.farmSize} hectares
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Elevation</p>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.basicInfo?.farmElevation} meters
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Registration Date</p>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.basicInfo?.registrationDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plant Statistics */}
              <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
                <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Plant Statistics
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Trees</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.plantStats?.totalTrees}
                    </p>
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Age Distribution
                    </h3>
                    <div className="h-64">
                      <Pie
                        data={{
                          labels: Object.keys(farmerData.plantStats?.ageDistribution || {}),
                          datasets: [{
                            data: Object.values(farmerData.plantStats?.ageDistribution || {}),
                            backgroundColor: [
                              'rgba(52, 211, 153, 0.8)',
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(251, 146, 60, 0.8)'
                            ]
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                color: isDarkMode ? '#D1D5DB' : '#374151'
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Harvest Performance */}
            <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
              <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Harvest Performance
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Yield</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.harvestData?.totalYield.toFixed(2)} kg
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Harvest Count</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.harvestData?.harvestCount}
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Last Harvest</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerData.harvestData?.lastHarvest ? new Date(farmerData.harvestData.lastHarvest).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Yield History
                  </h3>
                  <div className="h-80">
                    <Line
                      data={{
                        labels: farmerData.harvestData?.yieldHistory.map(h => new Date(h.date).toLocaleDateString()) || [],
                        datasets: [{
                          label: 'Yield (kg)',
                          data: farmerData.harvestData?.yieldHistory.map(h => h.yield) || [],
                          borderColor: isDarkMode ? 'rgb(74, 222, 128)' : 'rgb(34, 197, 94)',
                          backgroundColor: isDarkMode ? 'rgba(74, 222, 128, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          tension: 0.4
                        }]
                      }}
                      options={{
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                              color: isDarkMode ? '#D1D5DB' : '#374151'
                            }
                          },
                          x: {
                            grid: {
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                              color: isDarkMode ? '#D1D5DB' : '#374151'
                            }
                          }
                        },
                        plugins: {
                          legend: {
                            labels: {
                              color: isDarkMode ? '#D1D5DB' : '#374151'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
              <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Quality Metrics
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Grade Distribution
                  </h3>
                  <div className="h-64">
                    <Pie
                      data={{
                        labels: ['Premium', 'Fine', 'Commercial'],
                        datasets: [{
                          data: [
                            farmerData.qualityMetrics?.premiumGrade || 0,
                            farmerData.qualityMetrics?.fineGrade || 0,
                            farmerData.qualityMetrics?.commercialGrade || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(234, 179, 8, 0.8)'
                          ]
                        }]
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: isDarkMode ? '#D1D5DB' : '#374151'
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                                return [
                                  `${context.label}: ${percentage}%`,
                                  `Volume: ${value.toFixed(2)} kg`
                                ];
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Premium Grade</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(() => {
                        const value = farmerData.qualityMetrics?.premiumGrade || 0;
                        const total = (farmerData.qualityMetrics?.premiumGrade || 0) +
                                    (farmerData.qualityMetrics?.fineGrade || 0) +
                                    (farmerData.qualityMetrics?.commercialGrade || 0);
                        const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                        return `${percentage}%`;
                      })()}
                    </p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {farmerData.qualityMetrics?.premiumGrade.toFixed(2)} kg
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Fine Grade</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(() => {
                        const value = farmerData.qualityMetrics?.fineGrade || 0;
                        const total = (farmerData.qualityMetrics?.premiumGrade || 0) +
                                    (farmerData.qualityMetrics?.fineGrade || 0) +
                                    (farmerData.qualityMetrics?.commercialGrade || 0);
                        const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                        return `${percentage}%`;
                      })()}
                    </p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {farmerData.qualityMetrics?.fineGrade.toFixed(2)} kg
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Commercial Grade</p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(() => {
                        const value = farmerData.qualityMetrics?.commercialGrade || 0;
                        const total = (farmerData.qualityMetrics?.premiumGrade || 0) +
                                    (farmerData.qualityMetrics?.fineGrade || 0) +
                                    (farmerData.qualityMetrics?.commercialGrade || 0);
                        const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                        return `${percentage}%`;
                      })()}
                    </p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {farmerData.qualityMetrics?.commercialGrade.toFixed(2)} kg
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`rounded-lg shadow-xl max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Edit Basic Information
              </h3>
              
              {saveError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editedBasicInfo.first_name}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, first_name: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={editedBasicInfo.middle_name}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, middle_name: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editedBasicInfo.last_name}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, last_name: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Farm Location
                  </label>
                  <input
                    type="text"
                    value={editedBasicInfo.farm_location}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, farm_location: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Farm Size (hectares)
                  </label>
                  <input
                    type="number"
                    value={editedBasicInfo.farm_size}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, farm_size: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Farm Elevation (meters)
                  </label>
                  <input
                    type="number"
                    value={editedBasicInfo.farm_elevation}
                    onChange={(e) => setEditedBasicInfo({ ...editedBasicInfo, farm_elevation: e.target.value })}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    isDarkMode
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 
                    ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FarmerProfile; 