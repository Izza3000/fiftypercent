import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../lib/ThemeContext';
import { fetchWeatherData, fetchWeatherForecast } from '../lib/weatherService';
import { Line } from 'react-chartjs-2';
import Layout from '../components/Layout';

const SinglePlantAnalytics = () => {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  
  // Data states
  const [plant, setPlant] = useState(null);
  const [plantStatus, setPlantStatus] = useState(null);
  const [harvestHistory, setHarvestHistory] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherForecast, setWeatherForecast] = useState(null);
  
  // Analysis states
  const [yieldPrediction, setYieldPrediction] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [riskFactors, setRiskFactors] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1y'); // 1m, 3m, 6m, 1y
  const [editingCards, setEditingCards] = useState(new Set());
  
  // Manual input states
  const [manualStatus, setManualStatus] = useState({
    soil_ph: '',
    moisture_level: '',
    status: ''
  });

  // Chart data
  const [yieldTrendData, setYieldTrendData] = useState(null);
  const [healthTrendData, setHealthTrendData] = useState(null);

  // Handle editing cards
  const handleStartEditing = (cardType) => {
    setEditingCards(prev => {
      const newSet = new Set(prev);
      newSet.add(cardType);
      return newSet;
    });
    
    if (cardType === 'status') {
      setManualStatus({
        soil_ph: plantStatus?.soil_ph || '',
        moisture_level: plantStatus?.moisture_level || '',
        status: plantStatus?.status || ''
      });
    }
  };

  const handleCancelEdit = (cardType) => {
    setEditingCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(cardType);
      return newSet;
    });
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('plant_status')
        .insert([{
          plant_id: plantId,
          soil_ph: parseFloat(manualStatus.soil_ph),
          moisture_level: manualStatus.moisture_level,
          status: manualStatus.status
        }]);

      if (error) throw error;
      
      setPlantStatus({
        ...manualStatus,
        created_at: new Date().toISOString()
      });
      
      // Regenerate analytics with new status
      generateAnalytics(plant, manualStatus, harvestHistory, weatherData, weatherForecast);
      handleCancelEdit('status');
    } catch (error) {
      console.error('Error updating status:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    const fetchPlantData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch plant details
        const { data: plantData, error: plantError } = await supabase
          .from('plant_data')
          .select('*, farmer_detail(*)')
          .eq('plant_id', plantId)
          .single();

        if (plantError) throw plantError;
        setPlant(plantData);

        // Fetch latest status
        const { data: statusData, error: statusError } = await supabase
          .from('plant_status')
          .select('*')
          .eq('plant_id', plantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!statusError) setPlantStatus(statusData);

        // Fetch harvest history
        const { data: harvestData, error: harvestError } = await supabase
          .from('harvest_data')
          .select('*')
          .eq('plant_id', plantId)
          .order('harvest_date', { ascending: true });

        if (harvestError) throw harvestError;
        setHarvestHistory(harvestData || []);

        // Fetch weather data if we have farm location
        let weatherData = null;
        let forecastData = null;
        
        if (plantData.farmer_detail?.farm_latitude && plantData.farmer_detail?.farm_longitude) {
          weatherData = await fetchWeatherData(
            plantData.farmer_detail.farm_latitude,
            plantData.farmer_detail.farm_longitude
          );
          setWeatherData(weatherData);

          forecastData = await fetchWeatherForecast(
            plantData.farmer_detail.farm_latitude,
            plantData.farmer_detail.farm_longitude
          );
          setWeatherForecast(forecastData);
        }

        // Update charts
        updateCharts(harvestData || [], statusData);
        
        // Generate analytics with the correct weather data
        generateAnalytics(plantData, statusData, harvestData || [], weatherData, forecastData);

      } catch (error) {
        console.error('Error fetching plant data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (plantId) fetchPlantData();
  }, [plantId]);

  const updateCharts = (harvests, status) => {
    // Update yield trend chart
    if (harvests.length > 0) {
      setYieldTrendData({
        labels: harvests.map(h => new Date(h.harvest_date).toLocaleDateString()),
        datasets: [{
          label: 'Raw Coffee Yield (kg)',
          data: harvests.map(h => h.coffee_raw_quantity),
          borderColor: isDarkMode ? 'rgba(147, 197, 253, 1)' : 'rgba(59, 130, 246, 1)',
          backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        }]
      });
    }

    // Update health indicators chart if we have status history
    // This would require adding status history tracking
  };

  const generateAnalytics = (plant, status, harvests, weather, forecast) => {
    if (!plant || !status) return;

    // Calculate health score (0-100)
    let healthScore = 100;
    const risks = [];

    // Age-based analysis
    const plantingDate = new Date(plant.planting_date);
    const plantAge = (new Date() - plantingDate) / (1000 * 60 * 60 * 24 * 365); // Age in years
    
    if (plantAge < 3) {
      healthScore -= 10;
      risks.push('Young plant - requires careful nurturing');
    } else if (plantAge > 20) {
      healthScore -= 20;
      risks.push('Aging plant - may have reduced yield');
    }

    // Soil pH analysis
    if (status.soil_ph) {
      const pH = parseFloat(status.soil_ph);
      if (pH < 5.5 || pH > 6.5) {
        healthScore -= 15;
        risks.push(`Suboptimal soil pH (${pH}). Optimal range is 5.5-6.5`);
      }
    }

    // Moisture analysis
    if (status.moisture_level === 'dry') {
      healthScore -= 20;
      risks.push('Low soil moisture - risk of drought stress');
    }

    // Disease/pest analysis
    if (status.status === 'diseased') {
      healthScore -= 25;
      risks.push('Plant is currently diseased - requires immediate attention');
    } else if (status.status === 'pest-affected') {
      healthScore -= 20;
      risks.push('Plant is affected by pests - requires treatment');
    }

    // Weather-based analysis
    if (weather && forecast) {
      if (forecast.temperature > 24) {
        healthScore -= 10;
        risks.push('High temperature forecast - risk of heat stress');
      }
      if (forecast.rainfall * 12 < 1500) {
        healthScore -= 10;
        risks.push('Low rainfall forecast - irrigation may be needed');
      }
    }

    // Generate recommendations based on risks
    const recs = risks.map(risk => {
      if (risk.includes('soil pH')) {
        return 'Apply appropriate soil amendments to adjust pH level';
      } else if (risk.includes('moisture')) {
        return 'Increase irrigation frequency and consider mulching';
      } else if (risk.includes('diseased')) {
        return 'Apply fungicide treatment and improve air circulation';
      } else if (risk.includes('pest')) {
        return 'Implement integrated pest management strategies';
      } else if (risk.includes('temperature')) {
        return 'Provide additional shade and increase irrigation';
      } else if (risk.includes('rainfall')) {
        return 'Set up irrigation system and apply mulch for water retention';
      }
      return 'Monitor plant health and maintain regular care';
    });

    // Predict next yield
    if (harvests.length > 0) {
      const recentHarvests = harvests.slice(-3);
      const avgYield = recentHarvests.reduce((sum, h) => sum + h.coffee_raw_quantity, 0) / recentHarvests.length;
      
      // Adjust prediction based on health score and weather
      const healthFactor = healthScore / 100;
      const weatherFactor = weather && forecast ? 
        (forecast.temperature > 24 || forecast.rainfall * 12 < 1500 ? 0.9 : 1.1) : 1;
      
      const predictedYield = avgYield * healthFactor * weatherFactor;
      setYieldPrediction({
        amount: predictedYield,
        confidence: Math.min((healthScore / 100) * (harvests.length / 10), 1)
      });
    }

    setHealthScore(healthScore);
    setRiskFactors(risks);
    setRecommendations(recs);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
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

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              isDarkMode
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Analytics</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plant Status Card */}
          <div
            className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} cursor-pointer transition-colors hover:bg-opacity-90`}
            onClick={() => !editingCards.has('status') && handleStartEditing('status')}
          >
            <h3 className={`text-lg font-semibold mb-4 flex justify-between items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Plant Status
              {editingCards.has('status') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit('status');
                  }}
                  className={`text-xs ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'}`}
                >
                  Cancel
                </button>
              )}
            </h3>
            {editingCards.has('status') ? (
              <form onSubmit={handleStatusUpdate} className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Soil pH
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualStatus.soil_ph}
                    onChange={(e) => setManualStatus(prev => ({ ...prev, soil_ph: e.target.value }))}
                    className={`mt-1 block w-full rounded-md ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Moisture Level
                  </label>
                  <select
                    value={manualStatus.moisture_level}
                    onChange={(e) => setManualStatus(prev => ({ ...prev, moisture_level: e.target.value }))}
                    className={`mt-1 block w-full rounded-md ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  >
                    <option value="">Select moisture level</option>
                    <option value="dry">Dry</option>
                    <option value="moderate">Moderate</option>
                    <option value="wet">Wet</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Plant Status
                  </label>
                  <select
                    value={manualStatus.status}
                    onChange={(e) => setManualStatus(prev => ({ ...prev, status: e.target.value }))}
                    className={`mt-1 block w-full rounded-md ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  >
                    <option value="">Select status</option>
                    <option value="healthy">Healthy</option>
                    <option value="diseased">Diseased</option>
                    <option value="pest-affected">Pest Affected</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className={`w-full px-4 py-2 rounded-md ${
                    isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Soil pH</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {plantStatus?.soil_ph || 'Not measured'}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Moisture Level</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {plantStatus?.moisture_level ? plantStatus.moisture_level.charAt(0).toUpperCase() + plantStatus.moisture_level.slice(1) : 'Not measured'}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                  <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {plantStatus?.status ? plantStatus.status.charAt(0).toUpperCase() + plantStatus.status.slice(1) : 'Unknown'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Health Score Card */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Plant Health Score
            </h3>
            <div className="flex items-center justify-center mb-4">
              <div className={`text-5xl font-bold ${
                healthScore > 80
                  ? isDarkMode ? 'text-green-400' : 'text-green-600'
                  : healthScore > 60
                  ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                  : isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}>
                {healthScore}
              </div>
              <div className={`ml-2 text-2xl ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>/100</div>
            </div>
            <div className="mt-4">
              <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Risk Factors:
              </h4>
              <ul className={`list-disc pl-5 space-y-1 ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                {riskFactors.map((risk, index) => (
                  <li key={index} className="text-sm">{risk}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Yield Prediction Card */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Next Harvest Prediction
            </h3>
            {yieldPrediction ? (
              <>
                <div className="text-center mb-4">
                  <div className={`text-4xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {yieldPrediction.amount.toFixed(2)} kg
                  </div>
                  <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Confidence: {(yieldPrediction.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                    Recommendations:
                  </h4>
                  <ul className={`list-disc pl-5 space-y-1 ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                    {recommendations.map((rec, index) => (
                      <li key={index} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Not enough harvest data for prediction
              </p>
            )}
          </div>

          {/* Yield Trend Chart */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Yield History
            </h3>
            {yieldTrendData ? (
              <div className="h-64">
                <Line
                  data={yieldTrendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        },
                        ticks: {
                          color: isDarkMode ? '#e5e7eb' : '#374151',
                        }
                      },
                      x: {
                        grid: {
                          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        },
                        ticks: {
                          color: isDarkMode ? '#e5e7eb' : '#374151',
                        }
                      }
                    },
                    plugins: {
                      legend: {
                        labels: {
                          color: isDarkMode ? '#e5e7eb' : '#374151',
                        }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No yield history available
              </p>
            )}
          </div>

          {/* Weather Data */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Weather Conditions
            </h3>
            {weatherForecast ? (
              <div className="space-y-4">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Average Temperature
                  </p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {weatherForecast.temperature.toFixed(1)}°C
                  </p>
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Expected Rainfall (7-day)
                  </p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {weatherForecast.rainfall.toFixed(1)}mm
                  </p>
                </div>
                <div className="mt-4">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Location: {plant?.farmer_detail?.farm_latitude?.toFixed(4)}, {plant?.farmer_detail?.farm_longitude?.toFixed(4)}
                  </p>
                </div>
              </div>
            ) : (
              <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Weather data not available
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SinglePlantAnalytics;