import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthProvider';
import { useTheme } from '../lib/ThemeContext';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AdminAnalytics = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [activeFarmers, setActiveFarmers] = useState(0);
  const [averageYieldPerFarmer, setAverageYieldPerFarmer] = useState(0);
  const [topPerformingFarmers, setTopPerformingFarmers] = useState([]);

  // Chart data states
  const [yearlyProductivity, setYearlyProductivity] = useState({
    labels: [],
    datasets: [{
      label: 'Average Yield per Farmer (kg)',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  });

  const [farmerGrowthTrend, setFarmerGrowthTrend] = useState({
    labels: [],
    datasets: [{
      label: 'Number of Active Farmers',
      data: [],
      borderColor: 'rgb(54, 162, 235)',
      tension: 0.1
    }]
  });

  const [gradeDistribution, setGradeDistribution] = useState({
    labels: ['Premium Grade', 'Fine Grade', 'Commercial Grade'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: [
        'rgba(75, 192, 192, 0.8)',  // Premium - Teal
        'rgba(54, 162, 235, 0.8)',  // Fine - Blue
        'rgba(255, 206, 86, 0.8)',  // Commercial - Gold
      ],
      borderWidth: 0,
      hoverOffset: 4
    }]
  });

  const [averageTreesPerFarmer, setAverageTreesPerFarmer] = useState(0);
  const [totalActivePlants, setTotalActivePlants] = useState(0);
  const [predictiveMetrics, setPredictiveMetrics] = useState({
    expectedYield: 0,
    growthRate: 0,
    performanceCategories: {
      high: 0,
      average: 0,
      needsSupport: 0
    }
  });

  useEffect(() => {
    const fetchFarmerAnalytics = async () => {
      try {
        setLoading(true);
        
        // Fetch data in parallel
        const [
          farmersData,
          harvestData,
          plantData
        ] = await Promise.all([
          // Basic farmer data
          supabase
            .from('farmer_detail')
            .select(`
              id,
              farm_location,
              farm_size,
              farm_elevation,
              created_at,
              users (
                first_name,
                last_name
              )
            `),
          
          // Harvest data by farmer
          supabase
            .from('harvest_data')
            .select(`
              farmer_id,
              harvest_date,
              coffee_raw_quantity,
              coffee_dry_quantity,
              coffee_premium_grade,
              coffee_fine_grade,
              coffee_commercial_grade,
              farmer_detail (
                farm_elevation,
                users (
                  first_name,
                  last_name
                )
              )
            `)
            .order('harvest_date', { ascending: true }),
          
          // Plant data for all farmers
          supabase
            .from('plant_data')
            .select('farmer_id, number_of_tree_planted')
        ]);

        if (farmersData.error || harvestData.error || plantData.error) {
          throw new Error('Error fetching farmer data');
        }

        // Process basic farmer metrics
        setTotalFarmers(farmersData.data.length);
        
        // Calculate active farmers (those with harvests in the last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const activeCount = new Set(
          harvestData.data
            .filter(h => new Date(h.harvest_date) >= sixMonthsAgo)
            .map(h => h.farmer_id)
        ).size;
        setActiveFarmers(activeCount);

        // Calculate total trees and average trees per farmer
        const farmerTrees = {};
        let totalTrees = 0;

        // First, calculate total trees for each farmer
        plantData.data.forEach(plant => {
          if (plant.farmer_id) {
            farmerTrees[plant.farmer_id] = (farmerTrees[plant.farmer_id] || 0) + (plant.number_of_tree_planted || 0);
            totalTrees += (plant.number_of_tree_planted || 0);
          }
        });

        // Calculate average trees (only for farmers who have trees)
        const farmersWithTrees = Object.keys(farmerTrees).length;
        const avgTrees = farmersWithTrees > 0 ? Math.round(totalTrees / farmersWithTrees) : 0;

        setAverageTreesPerFarmer(avgTrees);
        setTotalActivePlants(totalTrees);

        // Calculate coffee grade distribution
        const gradeData = {
          premium: 0,
          fine: 0,
          commercial: 0
        };

        harvestData.data.forEach(harvest => {
          gradeData.premium += Number(harvest.coffee_premium_grade) || 0;
          gradeData.fine += Number(harvest.coffee_fine_grade) || 0;
          gradeData.commercial += Number(harvest.coffee_commercial_grade) || 0;
        });

        setGradeDistribution(prev => ({
          ...prev,
          datasets: [{
            ...prev.datasets[0],
            data: [gradeData.premium, gradeData.fine, gradeData.commercial]
          }]
        }));

        // Process top performing farmers
        const farmerYields = harvestData.data.reduce((acc, harvest) => {
          acc[harvest.farmer_id] = (acc[harvest.farmer_id] || 0) + (harvest.coffee_dry_quantity || 0);
          return acc;
        }, {});

        const farmerPerformance = Object.entries(farmerYields)
          .map(([farmerId, totalYield]) => {
            const farmer = farmersData.data.find(f => f.id === farmerId);
            return {
              id: farmerId,
              name: `${farmer?.users?.first_name} ${farmer?.users?.last_name}`,
              totalYield,
              location: farmer?.farm_location
            };
          })
          .sort((a, b) => b.totalYield - a.totalYield)
          .slice(0, 5);
        setTopPerformingFarmers(farmerPerformance);

        // Process yearly productivity
        const yearlyData = {};
        const yearlyFarmerCounts = {};
        
        harvestData.data.forEach(harvest => {
          const year = new Date(harvest.harvest_date).getFullYear();
          if (!yearlyData[year]) {
            yearlyData[year] = 0;
            yearlyFarmerCounts[year] = new Set();
          }
          yearlyData[year] += (harvest.coffee_dry_quantity || 0);
          yearlyFarmerCounts[year].add(harvest.farmer_id);
        });

        // Calculate average yield per farmer per year
        const years = Object.keys(yearlyData).sort();
        const avgYields = years.map(year => 
          yearlyData[year] / yearlyFarmerCounts[year].size
        );

        setYearlyProductivity({
          labels: years,
          datasets: [{
            label: 'Average Yield per Farmer (kg)',
            data: avgYields,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            tension: 0.1
          }]
        });

        // Calculate farmer growth trend
        const farmersByYear = years.map(year => 
          yearlyFarmerCounts[year].size
        );

        setFarmerGrowthTrend({
          labels: years,
          datasets: [{
            label: 'Number of Active Farmers',
            data: farmersByYear,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            tension: 0.1
          }]
        });

        // Calculate predictive metrics
        const recentYear = Math.max(...years);
        const previousYear = recentYear - 1;
        
        // Calculate growth rate
        const growthRate = farmersByYear[farmersByYear.length - 1] / farmersByYear[farmersByYear.length - 2] - 1;
        
        // Calculate expected yield based on recent trends
        const recentYieldPerFarmer = yearlyData[recentYear] / yearlyFarmerCounts[recentYear].size;
        const expectedYield = recentYieldPerFarmer * (1 + growthRate);

        // Calculate performance categories
        const farmerPerformances = Object.entries(farmerYields).map(([farmerId, totalYield]) => ({
          farmerId,
          avgYield: totalYield / (harvestData.data.filter(h => h.farmer_id === farmerId).length || 1)
        }));

        const sortedYields = farmerPerformances.map(f => f.avgYield).sort((a, b) => b - a);
        const highPerformanceThreshold = sortedYields[Math.floor(sortedYields.length * 0.2)] || 0; // Top 20%
        const lowPerformanceThreshold = sortedYields[Math.floor(sortedYields.length * 0.8)] || 0; // Bottom 20%

        const performanceCategories = {
          high: farmerPerformances.filter(f => f.avgYield >= highPerformanceThreshold).length,
          average: farmerPerformances.filter(f => f.avgYield < highPerformanceThreshold && f.avgYield > lowPerformanceThreshold).length,
          needsSupport: farmerPerformances.filter(f => f.avgYield <= lowPerformanceThreshold).length
        };

        setPredictiveMetrics({
          expectedYield: expectedYield,
          growthRate: growthRate,
          performanceCategories
        });

      } catch (err) {
        console.error('Error fetching farmer analytics:', err);
        setError('Failed to load farmer analytics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchFarmerAnalytics();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
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
      <div className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Analytics
            </h1>
            {user && (
              <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Comprehensive overview of farmer performance and trends
            </p>
          </div>

          {/* Current Farmer Analytics */}
          <div className="mt-8">
            <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Current Farmer Metrics
            </h2>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Farmers</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {totalFarmers}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Farmers</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {activeFarmers}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avg Trees/Farmer</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {Math.round(averageTreesPerFarmer)}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Active Plants</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {totalActivePlants}
                </p>
              </div>
            </div>

            {/* Top Performers and Grade Distribution Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Top Performers
                </h3>
                <div className="space-y-4">
                  {topPerformingFarmers.slice(0, 3).map((farmer, index) => (
                    <div key={farmer.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                          ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'}`}>
                          {index + 1}
                        </div>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {farmer.name}
                        </span>
                      </div>
                      <span className={`font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {farmer.totalYield.toFixed(1)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Coffee Grade Distribution
                </h3>
                <div className="relative h-64">
                  <Doughnut
                    data={gradeDistribution}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '60%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563',
                            padding: 20,
                            font: {
                              size: 12
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Yearly Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Yearly Productivity
                </h3>
                <div className="h-64">
                  <Line
                    data={yearlyProductivity}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        },
                        x: {
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Farmer Growth Trend
                </h3>
                <div className="h-64">
                  <Line
                    data={farmerGrowthTrend}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        },
                        x: {
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Predictive Analytics Section */}
            <div className="mt-12 mb-8">
              <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Predictive Analytics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Expected Yield Growth
                  </h3>
                  <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {(predictiveMetrics.growthRate * 100).toFixed(1)}%
                  </p>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Projected annual growth rate
                  </p>
                </div>

                <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Projected Average Yield
                  </h3>
                  <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {predictiveMetrics.expectedYield.toFixed(1)} kg
                  </p>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Expected yield per farmer next year
                  </p>
                </div>

                <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Performance Distribution
                  </h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>High Performing</span>
                      <span className="font-bold">{predictiveMetrics.performanceCategories.high}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Average</span>
                      <span className="font-bold">{predictiveMetrics.performanceCategories.average}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>Needs Support</span>
                      <span className="font-bold">{predictiveMetrics.performanceCategories.needsSupport}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminAnalytics;