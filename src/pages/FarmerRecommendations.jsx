import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthProvider';
import { useTheme } from '../lib/ThemeContext';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FarmerRecommendations = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  // Fetch farmers data
  const fetchFarmersData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch users (farmers)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('role', 'farmer');

      if (usersError) throw usersError;

      // Fetch farmer details
      const { data: farmerDetails, error: farmerError } = await supabase
        .from('farmer_detail')
        .select(`
          id,
          farm_location,
          farm_size,
          farm_elevation,
          plant_id
        `);

      if (farmerError) throw farmerError;

      // Fetch plant data
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select('plant_id, farmer_id, number_of_tree_planted');

      if (plantError) throw plantError;

      // Fetch harvest data
      const { data: harvests, error: harvestError } = await supabase
        .from('harvest_data')
        .select('*');

      if (harvestError) throw harvestError;

      // Process and combine the data
      const processedData = users.map(farmer => {
        const details = farmerDetails.find(d => d.id === farmer.id) || {};
        const plants = plantData.filter(p => p.farmer_id === farmer.id);
        const farmerHarvests = harvests.filter(h => h.farmer_id === farmer.id);
        
        // Calculate metrics
        const totalTrees = plants.reduce((sum, p) => sum + (p.number_of_tree_planted || 0), 0);
        const totalRawYield = farmerHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
        const totalDryYield = farmerHarvests.reduce((sum, h) => sum + (h.coffee_dry_quantity || 0), 0);
        const premiumGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const fineGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const commercialGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);
        
        // Calculate averages and percentages
        const yieldPerTree = totalTrees > 0 ? totalDryYield / totalTrees : 0;
        const premiumPercentage = totalDryYield > 0 ? (premiumGrade / totalDryYield) * 100 : 0;
        const finePercentage = totalDryYield > 0 ? (fineGrade / totalDryYield) * 100 : 0;
        const commercialPercentage = totalDryYield > 0 ? (commercialGrade / totalDryYield) * 100 : 0;

        return {
          id: farmer.id,
          name: `${farmer.first_name} ${farmer.last_name}`,
          farmLocation: details.farm_location,
          farmSize: details.farm_size,
          farmElevation: details.farm_elevation,
          totalTrees,
          totalRawYield,
          totalDryYield,
          yieldPerTree,
          premiumPercentage,
          finePercentage,
          commercialPercentage,
          harvestCount: farmerHarvests.length,
          recommendations: generateRecommendations({
            yieldPerTree,
            premiumPercentage,
            totalTrees,
            farmSize: details.farm_size,
            elevation: details.farm_elevation,
            harvestCount: farmerHarvests.length,
            totalDryYield
          })
        };
      });

      setFarmers(processedData);
    } catch (err) {
      console.error('Error fetching farmer data:', err);
      setError('Failed to load farmer data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFarmersData();
  }, [fetchFarmersData]);

  // Generate recommendations based on metrics
  const generateRecommendations = ({
    yieldPerTree,
    premiumPercentage,
    totalTrees,
    farmSize,
    elevation,
    harvestCount,
    totalDryYield
  }) => {
    const recommendations = [];

    // Yield-based recommendations
    if (yieldPerTree < 2) {
      recommendations.push({
        type: 'critical',
        category: 'Yield',
        issue: 'Low yield per tree',
        action: 'Implement proper fertilization and pruning techniques',
        impact: 'Potential 20-30% yield increase'
      });
    }

    // Quality-based recommendations
    if (premiumPercentage < 30) {
      recommendations.push({
        type: 'high',
        category: 'Quality',
        issue: 'Low premium grade percentage',
        action: 'Improve cherry selection and processing methods',
        impact: 'Increase premium grade ratio by 15-20%'
      });
    }

    // Farm utilization recommendations
    if (farmSize && totalTrees) {
      const treeDensity = totalTrees / farmSize;
      if (treeDensity < 1000) {
        recommendations.push({
          type: 'medium',
          category: 'Farm Utilization',
          issue: 'Low tree density',
          action: 'Consider planting more trees in available space',
          impact: 'Optimize land usage and increase total yield'
        });
      }
    }

    // Harvest frequency recommendations
    if (harvestCount < 2 && totalDryYield > 0) {
      recommendations.push({
        type: 'high',
        category: 'Harvest Management',
        issue: 'Low harvest frequency',
        action: 'Implement regular harvest schedules',
        impact: 'Better yield distribution and quality control'
      });
    }

    // Elevation-based recommendations
    if (elevation < 1000) {
      recommendations.push({
        type: 'medium',
        category: 'Environment',
        issue: 'Low elevation farming',
        action: 'Implement shade management techniques',
        impact: 'Improve coffee quality and plant health'
      });
    }

    return recommendations;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            DSS Insights
          </h1>
          {user && (
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Welcome back, {user.first_name} {user.last_name}
            </p>
          )}
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
            Smart recommendations for optimal farming practices
          </p>
        </div>

        {loading ? (
          <div className="mt-6">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className={`mt-6 p-4 rounded-md ${isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Total Farmers
                </h3>
                <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {farmers.length}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Average Yield/Tree
                </h3>
                <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {(farmers.reduce((sum, f) => sum + f.yieldPerTree, 0) / farmers.length).toFixed(2)} kg
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Avg Premium Grade
                </h3>
                <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {(farmers.reduce((sum, f) => sum + f.premiumPercentage, 0) / farmers.length).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Farmer Cards */}
            {farmers.map(farmer => (
              <div
                key={farmer.id}
                className={`p-6 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-[1.02] ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {farmer.name}
                    </h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {farmer.farmLocation} • {farmer.farmElevation}m elevation
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFarmer(selectedFarmer?.id === farmer.id ? null : farmer)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      isDarkMode
                        ? 'text-indigo-400 hover:bg-gray-700 border border-indigo-400'
                        : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-600'
                    }`}
                  >
                    {selectedFarmer?.id === farmer.id ? 'Hide Details' : 'View Insights'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Yield per Tree
                    </p>
                    <p className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {farmer.yieldPerTree.toFixed(2)} kg
                    </p>
                  </div>
                  <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Premium Grade
                    </p>
                    <p className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {farmer.premiumPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Total Trees
                    </p>
                    <p className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {farmer.totalTrees}
                    </p>
                  </div>
                  <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Harvests
                    </p>
                    <p className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {farmer.harvestCount}
                    </p>
                  </div>
                </div>

                {selectedFarmer?.id === farmer.id && (
                  <div className="mt-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className={`text-xl font-bold mb-4 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Grade Distribution
                        </h3>
                        <Bar
                          data={{
                            labels: ['Premium', 'Fine', 'Commercial'],
                            datasets: [{
                              label: 'Grade Distribution (%)',
                              data: [
                                farmer.premiumPercentage,
                                farmer.finePercentage,
                                farmer.commercialPercentage
                              ],
                              backgroundColor: isDarkMode 
                                ? ['rgba(129, 140, 248, 0.8)', 'rgba(96, 165, 250, 0.8)', 'rgba(147, 197, 253, 0.8)']
                                : ['rgba(99, 102, 241, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(96, 165, 250, 0.8)']
                            }]
                          }}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: {
                                display: false
                              }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: {
                                  color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                  color: isDarkMode ? '#9CA3AF' : '#4B5563'
                                }
                              },
                              x: {
                                grid: {
                                  display: false
                                },
                                ticks: {
                                  color: isDarkMode ? '#9CA3AF' : '#4B5563'
                                }
                              }
                            }
                          }}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className={`text-xl font-bold mb-4 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Recommendations
                        </h3>
                        {farmer.recommendations.map((rec, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-md border-l-4 ${
                              rec.type === 'critical'
                                ? isDarkMode 
                                  ? 'bg-red-900/30 border-red-500' 
                                  : 'bg-red-50 border-red-500'
                                : rec.type === 'high'
                                ? isDarkMode
                                  ? 'bg-orange-900/30 border-orange-500'
                                  : 'bg-orange-50 border-orange-500'
                                : isDarkMode
                                  ? 'bg-yellow-900/30 border-yellow-500'
                                  : 'bg-yellow-50 border-yellow-500'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-bold ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {rec.category}
                              </span>
                              <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                                rec.type === 'critical'
                                  ? isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                                  : rec.type === 'high'
                                  ? isDarkMode ? 'bg-orange-900 text-orange-300' : 'bg-orange-100 text-orange-700'
                                  : isDarkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {rec.type.toUpperCase()}
                              </span>
                            </div>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {rec.issue}
                            </p>
                            <p className={`mt-2 text-sm font-medium ${
                              isDarkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}>
                              Action: {rec.action}
                            </p>
                            <p className={`mt-1 text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Expected Impact: {rec.impact}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FarmerRecommendations; 