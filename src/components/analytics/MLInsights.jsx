import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { DecisionSupportSystem } from '../../lib/ml/DecisionSupportSystem';
import { useTheme } from '../../lib/ThemeContext';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const MLInsights = ({ environmentalData, growthData }) => {
    const [dss] = useState(() => new DecisionSupportSystem());
    const [insights, setInsights] = useState(null);
    const [seasonalAnalysis, setSeasonalAnalysis] = useState(null);
    const [riskScore, setRiskScore] = useState(0);
    const { isDarkMode } = useTheme();

    useEffect(() => {
        if (environmentalData && growthData) {
            // Update growth data
            growthData.forEach(data => {
                dss.addGrowthData(data.value, data.timestamp);
            });

            // Get latest environmental readings
            const latest = environmentalData[environmentalData.length - 1] || {
                temperature: 25,
                humidity: 70,
                pH: 6.5
            };

            // Get seasonal analysis
            const analysis = dss.getSeasonalAnalysis();
            setSeasonalAnalysis(analysis);

            // Get other insights
            const currentInsights = dss.analyzeConditions(
                latest.temperature,
                latest.humidity,
                latest.pH
            );

            // Calculate risk score
            const currentRiskScore = dss.calculateRiskScore(
                latest.temperature,
                latest.humidity,
                latest.pH
            );

            setInsights(currentInsights);
            setRiskScore(currentRiskScore);
        }
    }, [environmentalData, growthData]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'optimal':
                return isDarkMode ? 'text-green-400' : 'text-green-600';
            case 'acceptable':
                return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
            default:
                return isDarkMode ? 'text-red-400' : 'text-red-600';
        }
    };

    const getSeasonDisplayName = (season) => {
        const displayNames = {
            wetSeason: 'Wet Season',
            drySeason: 'Dry Season',
            transitional: 'Transitional Period'
        };
        return displayNames[season] || season;
    };

    const getSeasonDescription = (season) => {
        const descriptions = {
            wetSeason: 'Main growing season with optimal rainfall',
            drySeason: 'Reduced yield due to water stress',
            transitional: 'Moderate growth with changing conditions'
        };
        return descriptions[season] || '';
    };

    const getSeasonIcon = (season) => {
        switch (season) {
            case 'wetSeason':
                return '🌧️';
            case 'drySeason':
                return '☀️';
            case 'transitional':
                return '🌤️';
            default:
                return '🌱';
        }
    };

    const seasonalChartData = {
        labels: seasonalAnalysis?.growthForecast.map(f => `${f.season} - Day ${f.day}`) || [],
        datasets: [
            {
                label: 'Predicted Growth',
                data: seasonalAnalysis?.growthForecast.map(f => f.predictedValue) || [],
                borderColor: isDarkMode ? 'rgb(147, 197, 253)' : 'rgb(75, 192, 192)',
                backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.2)' : 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: isDarkMode ? '#fff' : '#1f2937'
                }
            },
            title: {
                display: true,
                text: 'Seasonal Growth Forecast (90 Days)',
                color: isDarkMode ? '#fff' : '#1f2937'
            }
        },
        scales: {
            x: {
                grid: {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    color: isDarkMode ? '#fff' : '#1f2937'
                }
            },
            y: {
                grid: {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    color: isDarkMode ? '#fff' : '#1f2937'
                }
            }
        }
    };

    if (!insights || !seasonalAnalysis) {
        return <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Loading insights...</div>;
    }

    return (
        <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>ML Insights</h2>
            
            {/* Current Season */}
            <div className="mb-6">
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Current Season: {getSeasonIcon(seasonalAnalysis.currentSeason)} {getSeasonDisplayName(seasonalAnalysis.currentSeason)}
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {getSeasonDescription(seasonalAnalysis.currentSeason)}
                </p>
            </div>

            {/* Seasonal Yield Forecast */}
            <div className="mb-6">
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Seasonal Yield Forecast</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(seasonalAnalysis.yieldForecast).map(([season, forecast]) => (
                        <div 
                            key={season}
                            className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} ${
                                season === seasonalAnalysis.currentSeason ? 'ring-2 ring-blue-500' : ''
                            }`}
                        >
                            <div className={`font-semibold capitalize flex items-center gap-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {getSeasonIcon(season)} {getSeasonDisplayName(season)}
                            </div>
                            <div className={`text-lg font-bold ${getStatusColor(forecast.status)}`}>
                                {forecast.predictedYield} kg
                            </div>
                            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Target: {forecast.target} kg
                            </div>
                            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Confidence: {forecast.confidence}%
                            </div>
                            <div className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                Range: {forecast.variance.min} - {forecast.variance.max} kg
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Growth Forecast Chart */}
            <div className="mb-6">
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Growth Forecast</h3>
                <div className="h-64">
                    <Line data={seasonalChartData} options={chartOptions} />
                </div>
            </div>

            {/* Seasonal Recommendations */}
            <div className="mb-6">
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Recommendations</h3>
                <ul className="space-y-2">
                    {seasonalAnalysis.recommendations.map((rec, index) => (
                        <li 
                            key={index}
                            className={`p-3 border rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} ${
                                rec.type === 'seasonal' 
                                    ? isDarkMode ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'
                                    : rec.type === 'seasonal_tip'
                                    ? isDarkMode ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'
                                    : ''
                            }`}
                        >
                            <div className={`font-semibold ${
                                rec.severity === 'high' 
                                    ? isDarkMode ? 'text-red-400' : 'text-red-600'
                                    : rec.severity === 'medium'
                                    ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                                    : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                                {rec.type === 'seasonal' && getSeasonIcon(seasonalAnalysis.currentSeason)} {rec.message}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default MLInsights; 