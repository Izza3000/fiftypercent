import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../lib/ThemeContext';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import Layout from '../components/Layout';
import { useAuth } from '../lib/AuthProvider';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RevenueForecast = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for market price trends
  const [marketPriceTrends, setMarketPriceTrends] = useState({
    premium: [],
    fine: [],
    commercial: [],
    raw: [],
    dried: []
  });

  // State for dynamic pricing
  const [dynamicPricing, setDynamicPricing] = useState({
    current: {
      premium: 0,
      fine: 0,
      commercial: 0
    },
    projected: {
      premium: 0,
      fine: 0,
      commercial: 0
    }
  });

  // State for cost analysis
  const [costAnalysis, setCostAnalysis] = useState({
    fixed: {
      land: 0,
      equipment: 0,
      infrastructure: 0
    },
    variable: {
      labor: 0,
      fertilizer: 0,
      pestControl: 0,
      processing: 0
    },
    total: 0
  });

  // State for risk-adjusted projections
  const [riskAdjustedProjections, setRiskAdjustedProjections] = useState({
    optimistic: {
      revenue: 0,
      profit: 0,
      margin: 0
    },
    realistic: {
      revenue: 0,
      profit: 0,
      margin: 0
    },
    conservative: {
      revenue: 0,
      profit: 0,
      margin: 0
    }
  });

  // Add new state for farmer details
  const [farmerDetails, setFarmerDetails] = useState(null);

  // Add function to insert initial price data
  const insertInitialPrices = async () => {
    try {
      // Check if we have any prices
      const { data: existingPrices, error: checkError } = await supabase
        .from('coffee_prices')
        .select('price_id')
        .limit(1);

      if (checkError) throw checkError;

      // If no prices exist, insert initial data
      if (!existingPrices || existingPrices.length === 0) {
        const initialPrices = [
          {
            coffee_type: 'premium',
            price_per_kg: 8.50,
            currency: 'USD',
            created_at: new Date().toISOString()
          },
          {
            coffee_type: 'fine',
            price_per_kg: 6.75,
            currency: 'USD',
            created_at: new Date().toISOString()
          },
          {
            coffee_type: 'commercial',
            price_per_kg: 5.25,
            currency: 'USD',
            created_at: new Date().toISOString()
          }
        ];

        const { error: insertError } = await supabase
          .from('coffee_prices')
          .insert(initialPrices);

        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error inserting initial prices:', err);
      setError(err.message);
    }
  };

  // Modify fetchHistoricalPrices function
  const fetchHistoricalPrices = async () => {
    try {
      console.log('Fetching historical prices...');
      
      // First ensure we have initial prices
      await insertInitialPrices();

      const { data, error } = await supabase
        .from('coffee_prices')
        .select('price_id, coffee_type, price_per_kg, created_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching prices:', error);
        throw error;
      }

      console.log('Fetched price data:', data);

      if (data) {
        const prices = {
          premium: [],
          fine: [],
          commercial: [],
          raw: [],
          dried: []
        };

        // Group prices by type and sort by date
        data.forEach(price => {
          const priceData = {
            date: new Date(price.created_at).toLocaleDateString(),
            price_per_kg: parseFloat(price.price_per_kg)
          };

          // Map coffee types to their respective arrays
          const typeMap = {
            'premium': 'premium',
            'fine': 'fine',
            'commercial': 'commercial',
            'raw': 'raw',
            'dried': 'dried'
          };

          const type = typeMap[price.coffee_type];
          if (type) {
            prices[type].push(priceData);
          } else {
            console.warn(`Unknown coffee type: ${price.coffee_type}`);
          }
        });

        console.log('Processed prices:', prices);

        // Ensure each type has at least one price point
        const defaultPrices = {
          premium: 8.50,
          fine: 6.75,
          commercial: 5.25,
          raw: 4.50,
          dried: 5.00
        };

        Object.keys(prices).forEach(type => {
          if (prices[type].length === 0) {
            prices[type].push({
              date: new Date().toLocaleDateString(),
              price_per_kg: defaultPrices[type]
            });
          }
        });

        console.log('Final prices with defaults:', prices);
        setMarketPriceTrends(prices);
      }
    } catch (err) {
      console.error('Error in fetchHistoricalPrices:', err);
      setError(err.message);
    }
  };

  // Fetch farmer details and calculate costs
  const fetchFarmerDetails = async () => {
    try {
      const { data: farmerData, error: farmerError } = await supabase
        .from('farmer_detail')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (farmerError) throw farmerError;

      // Set default values if no farmer data exists
      const defaultFarmerData = {
        farm_size: 1, // Default to 1 hectare
        farm_location: 'Unknown',
        farm_elevation: 0
      };

      const finalFarmerData = farmerData || defaultFarmerData;
      setFarmerDetails(finalFarmerData);
      
      // Calculate fixed costs based on farm size and infrastructure
      const fixedCosts = {
        land: finalFarmerData.farm_size * 1000, // Assuming $1000 per hectare
        equipment: 5000, // Basic equipment cost
        infrastructure: 10000 // Basic infrastructure cost
      };

      // Calculate variable costs based on farm size
      const variableCosts = {
        labor: finalFarmerData.farm_size * 2000, // Labor cost per hectare
        fertilizer: finalFarmerData.farm_size * 500, // Fertilizer cost per hectare
        pestControl: finalFarmerData.farm_size * 300, // Pest control cost per hectare
        processing: finalFarmerData.farm_size * 800 // Processing cost per hectare
      };

      const totalCost = Object.values(fixedCosts).reduce((a, b) => a + b, 0) +
                       Object.values(variableCosts).reduce((a, b) => a + b, 0);

      setCostAnalysis({
        fixed: fixedCosts,
        variable: variableCosts,
        total: totalCost
      });
    } catch (err) {
      console.error('Error fetching farmer details:', err);
      setError(err.message);
    }
  };

  // Modify calculateDynamicPricing function
  const calculateDynamicPricing = (prices) => {
    const currentPrices = {
      premium: prices.premium[prices.premium.length - 1]?.price_per_kg || 8.50,
      fine: prices.fine[prices.fine.length - 1]?.price_per_kg || 6.75,
      commercial: prices.commercial[prices.commercial.length - 1]?.price_per_kg || 5.25
    };

    // Calculate projected prices based on recent trends
    const calculateProjection = (priceHistory) => {
      if (priceHistory.length < 2) {
        // If we don't have enough history, use a small increase
        return priceHistory[0]?.price_per_kg * 1.05 || currentPrices[priceHistory[0]?.coffee_type];
      }
      const recentPrices = priceHistory.slice(-3);
      const priceChanges = recentPrices.map((p, i) => 
        i > 0 ? p.price_per_kg - recentPrices[i-1].price_per_kg : 0
      );
      const avgChange = priceChanges.reduce((a, b) => a + b, 0) / (priceChanges.length - 1);
      return currentPrices[priceHistory[0].coffee_type] + avgChange;
    };

    const projectedPrices = {
      premium: calculateProjection(prices.premium),
      fine: calculateProjection(prices.fine),
      commercial: calculateProjection(prices.commercial)
    };

    setDynamicPricing({
      current: currentPrices,
      projected: projectedPrices
    });
  };

  // Calculate risk-adjusted projections
  const calculateRiskAdjustedProjections = (prices, costs) => {
    const totalCost = costs.total;
    const avgYieldPerHectare = 2000; // kg per hectare
    const farmSize = farmerDetails?.farm_size || 1;

    // Calculate base revenue using current prices
    const baseRevenue = Object.entries(prices.current).reduce((total, [grade, price]) => {
      const gradePercentage = {
        premium: 0.3,
        fine: 0.4,
        commercial: 0.3
      }[grade];
      return total + (price * avgYieldPerHectare * farmSize * gradePercentage);
    }, 0);

    // Calculate projections for different scenarios
    const projections = {
      optimistic: {
        revenue: baseRevenue * 1.2, // 20% increase
        profit: 0,
        margin: 0
      },
      realistic: {
        revenue: baseRevenue,
        profit: 0,
        margin: 0
      },
      conservative: {
        revenue: baseRevenue * 0.8, // 20% decrease
        profit: 0,
        margin: 0
      }
    };

    // Calculate profits and margins
    Object.keys(projections).forEach(scenario => {
      projections[scenario].profit = projections[scenario].revenue - totalCost;
      projections[scenario].margin = (projections[scenario].profit / projections[scenario].revenue) * 100;
    });

    setRiskAdjustedProjections(projections);
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchHistoricalPrices();
        await fetchFarmerDetails();
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add useEffect to calculate projections when data is available
  useEffect(() => {
    if (marketPriceTrends.premium.length > 0) {
      calculateDynamicPricing(marketPriceTrends);
    }
  }, [marketPriceTrends]);

  useEffect(() => {
    if (dynamicPricing.current.premium > 0 && costAnalysis.total > 0) {
      calculateRiskAdjustedProjections(dynamicPricing, costAnalysis);
    }
  }, [dynamicPricing, costAnalysis]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-red-600 p-4">Error: {error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`container mx-auto px-4 py-8 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <h1 className={`text-3xl font-bold mb-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Revenue Forecasting
        </h1>

        {/* Market Price Trends */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Market Price Trends
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(marketPriceTrends).map(([grade, prices]) => (
              <div key={grade} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {grade.charAt(0).toUpperCase() + grade.slice(1)} Grade
                </h3>
                {prices.length > 0 ? (
                  <Line
                    data={{
                      labels: prices.map(p => p.date),
                      datasets: [{
                        label: 'Price per kg',
                        data: prices.map(p => p.price_per_kg),
                        borderColor: isDarkMode ? 'rgba(147, 197, 253, 1)' : 'rgba(59, 130, 246, 1)',
                        backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        fill: true
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
                          beginAtZero: false,
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#fff' : '#1f2937'
                          }
                        },
                        x: {
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#fff' : '#1f2937'
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No price data available
                  </div>
                )}
                <div className={`mt-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Current Price: ${prices[prices.length - 1]?.price_per_kg.toFixed(2) || '0.00'}/kg
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Pricing */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Dynamic Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(dynamicPricing.current).map(([grade, price]) => (
              <div key={grade} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {grade.charAt(0).toUpperCase() + grade.slice(1)} Grade
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Current Price:
                    </span>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${price.toFixed(2)}/kg
                    </div>
                  </div>
                  <div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Projected Price:
                    </span>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${dynamicPricing.projected[grade].toFixed(2)}/kg
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Analysis */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Cost Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Fixed Costs
              </h3>
              <div className="space-y-2">
                {Object.entries(costAnalysis.fixed).map(([cost, amount]) => (
                  <div key={cost} className="flex justify-between">
                    <span className={`capitalize ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {cost.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Variable Costs
              </h3>
              <div className="space-y-2">
                {Object.entries(costAnalysis.variable).map(([cost, amount]) => (
                  <div key={cost} className="flex justify-between">
                    <span className={`capitalize ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {cost.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk-Adjusted Projections */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Risk-Adjusted Revenue Projections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(riskAdjustedProjections).map(([scenario, data]) => (
              <div key={scenario} className={`p-4 rounded-lg ${
                scenario === 'optimistic'
                  ? isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
                  : scenario === 'realistic'
                  ? isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
                  : isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                  scenario === 'optimistic'
                    ? isDarkMode ? 'text-green-200' : 'text-green-800'
                    : scenario === 'realistic'
                    ? isDarkMode ? 'text-blue-200' : 'text-blue-800'
                    : isDarkMode ? 'text-yellow-200' : 'text-yellow-800'
                }`}>
                  {scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Projected Revenue:
                    </span>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${data.revenue.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Projected Profit:
                    </span>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${data.profit.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Profit Margin:
                    </span>
                    <div className={`text-xl font-bold ${
                      data.margin > 20
                        ? isDarkMode ? 'text-green-400' : 'text-green-600'
                        : data.margin > 10
                        ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                        : isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {data.margin.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RevenueForecast; 