import { TimeSeriesAnalysis } from './TimeSeriesAnalysis';

export class DecisionSupportSystem {
    constructor() {
        this.growthAnalyzer = new TimeSeriesAnalysis();
        this.recommendations = [];
        this.seasonalYieldTargets = {
            wetSeason: { 
                min: 600, 
                target: 750, 
                max: 900,
                description: 'Main growing season with optimal rainfall'
            },
            drySeason: { 
                min: 400, 
                target: 500, 
                max: 650,
                description: 'Reduced yield due to water stress'
            },
            transitional: { 
                min: 500, 
                target: 600, 
                max: 750,
                description: 'Moderate growth with changing conditions'
            }
        };
    }

    // Add new growth data point
    addGrowthData(value, timestamp) {
        if (typeof value !== 'number' || value < 0) {
            throw new Error('Growth value must be a positive number');
        }
        this.growthAnalyzer.addDataPoint(value, timestamp);
    }

    // Validate environmental parameters
    validateEnvironmentalParams(temperature, humidity, pH) {
        // Ensure all values are numbers and positive
        if (typeof temperature !== 'number' || temperature <= 0) {
            throw new Error('Temperature must be a positive number');
        }
        if (typeof humidity !== 'number' || humidity <= 0) {
            throw new Error('Humidity must be a positive number');
        }
        if (typeof pH !== 'number' || pH <= 0) {
            throw new Error('pH must be a positive number');
        }

        // Validate ranges
        if (temperature < 15 || temperature > 35) {
            throw new Error('Temperature must be between 15°C and 35°C');
        }
        if (humidity < 30 || humidity > 100) {
            throw new Error('Humidity must be between 30% and 100%');
        }
        if (pH < 4 || pH > 8) {
            throw new Error('pH must be between 4 and 8');
        }
    }

    // Analyze current conditions and make recommendations
    analyzeConditions(temperature, humidity, pH) {
        try {
            // Validate input parameters
            this.validateEnvironmentalParams(temperature, humidity, pH);

            const growthTrend = this.growthAnalyzer.getSeasonalGrowthTrend();
            const predictedNextValue = this.growthAnalyzer.predictNextSeasonalValue();

            const recommendations = [];

            // Analyze environmental conditions
            if (temperature < 20) {
                recommendations.push({
                    type: 'temperature',
                    severity: 'high',
                    message: 'Temperature is too low. Consider increasing greenhouse temperature.'
                });
            } else if (temperature > 28) {
                recommendations.push({
                    type: 'temperature',
                    severity: 'high',
                    message: 'Temperature is too high. Consider cooling measures.'
                });
            }

            if (humidity < 60) {
                recommendations.push({
                    type: 'humidity',
                    severity: 'medium',
                    message: 'Humidity is low. Consider increasing misting frequency.'
                });
            } else if (humidity > 80) {
                recommendations.push({
                    type: 'humidity',
                    severity: 'high',
                    message: 'Humidity is too high. Improve ventilation.'
                });
            }

            if (pH < 6.0) {
                recommendations.push({
                    type: 'soil',
                    severity: 'medium',
                    message: 'Soil pH is too acidic. Consider pH adjustment.'
                });
            } else if (pH > 7.0) {
                recommendations.push({
                    type: 'soil',
                    severity: 'medium',
                    message: 'Soil pH is too alkaline. Consider pH adjustment.'
                });
            }

            // Analyze growth trend
            if (growthTrend === 'decreasing') {
                recommendations.push({
                    type: 'growth',
                    severity: 'high',
                    message: 'Growth rate is declining. Review recent environmental changes.'
                });
            }

            this.recommendations = recommendations;

            return {
                growthTrend,
                predictedNextValue,
                recommendations
            };
        } catch (error) {
            console.error('Error in analyzeConditions:', error);
            return {
                growthTrend: 'stable',
                predictedNextValue: null,
                recommendations: [{
                    type: 'error',
                    severity: 'high',
                    message: `Analysis error: ${error.message}`
                }]
            };
        }
    }

    // Get current recommendations
    getRecommendations() {
        return this.recommendations;
    }

    // Get growth forecast with seasonal adjustments
    getGrowthForecast(days = 90) {
        try {
            return this.growthAnalyzer.getSeasonalForecast(days);
        } catch (error) {
            console.error('Error in getGrowthForecast:', error);
            return Array(days).fill().map((_, i) => ({
                day: i + 1,
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
                season: this.growthAnalyzer.getSeason(new Date()),
                predictedValue: 0,
                optimal: { min: 0, max: 0 }
            }));
        }
    }

    // Get seasonal yield forecast
    getSeasonalYieldForecast() {
        try {
            const seasonalStats = this.growthAnalyzer.getSeasonalYieldStats();
            const currentSeason = this.growthAnalyzer.getTropicalSeason(new Date());
            const forecast = {};

            for (const season of Object.keys(this.seasonalYieldTargets)) {
                const stats = seasonalStats[season] || {
                    average: 0,
                    min: 0,
                    max: 0,
                    count: 0
                };

                const target = this.seasonalYieldTargets[season];
                const confidence = Math.min(stats.count / 5, 1) * 100;

                let predictedYield = stats.average;
                if (season === currentSeason) {
                    const environmentalFactor = this.calculateEnvironmentalFactor();
                    predictedYield *= environmentalFactor;
                }

                forecast[season] = {
                    predictedYield: Math.round(predictedYield),
                    target: target.target,
                    confidence,
                    variance: {
                        min: Math.round(predictedYield * 0.9),
                        max: Math.round(predictedYield * 1.1)
                    },
                    historical: {
                        average: Math.round(stats.average),
                        min: Math.round(stats.min),
                        max: Math.round(stats.max)
                    },
                    status: this.getYieldStatus(predictedYield, target)
                };
            }

            return forecast;
        } catch (error) {
            console.error('Error in getSeasonalYieldForecast:', error);
            return null;
        }
    }

    // Calculate environmental factor for yield adjustment
    calculateEnvironmentalFactor() {
        try {
            const currentSeason = this.growthAnalyzer.getTropicalSeason(new Date());
            const recommendations = this.getRecommendations();
            const seasonalPatterns = this.growthAnalyzer.seasonalPatterns[currentSeason];
            
            const severityWeights = {
                high: 0.8,
                medium: 0.9,
                low: 0.95
            };

            // Start with seasonal base factor
            let factor = seasonalPatterns.weight;

            // Adjust factor based on recommendations severity
            recommendations.forEach(rec => {
                factor *= severityWeights[rec.severity] || 1;
            });

            return Math.max(0.6, factor); // Never reduce yield by more than 40%
        } catch (error) {
            console.error('Error calculating environmental factor:', error);
            return 1.0;
        }
    }

    // Get yield status compared to target
    getYieldStatus(predicted, target) {
        if (predicted >= target.target) return 'optimal';
        if (predicted >= target.min) return 'acceptable';
        return 'below_target';
    }

    // Get comprehensive seasonal analysis
    getSeasonalAnalysis() {
        try {
            const growthForecast = this.getGrowthForecast();
            const yieldForecast = this.getSeasonalYieldForecast();
            const currentSeason = this.growthAnalyzer.getTropicalSeason(new Date());

            return {
                currentSeason,
                growthForecast,
                yieldForecast,
                seasonalPatterns: this.growthAnalyzer.seasonalPatterns,
                recommendations: this.generateSeasonalRecommendations(yieldForecast)
            };
        } catch (error) {
            console.error('Error in getSeasonalAnalysis:', error);
            return null;
        }
    }

    // Generate season-specific recommendations
    generateSeasonalRecommendations(yieldForecast) {
        try {
            const currentSeason = this.growthAnalyzer.getTropicalSeason(new Date());
            const recommendations = [...this.recommendations];
            const forecast = yieldForecast[currentSeason];

            if (!forecast) return recommendations;

            // Add yield-specific recommendations
            if (forecast.status === 'below_target') {
                recommendations.push({
                    type: 'yield',
                    severity: 'high',
                    message: `Current yield trajectory is below target for ${this.getSeasonDisplayName(currentSeason)}. Consider implementing intensive care measures.`
                });
            }

            // Add seasonal-specific care recommendations
            const seasonalCare = {
                wetSeason: [
                    'Monitor for fungal diseases due to high humidity',
                    'Ensure proper drainage to prevent waterlogging',
                    'Implement disease prevention measures',
                    'Consider reducing irrigation frequency'
                ],
                drySeason: [
                    'Increase irrigation frequency',
                    'Apply mulch to retain soil moisture',
                    'Provide shade protection during peak heat',
                    'Monitor for drought stress symptoms'
                ],
                transitional: [
                    'Adjust irrigation based on rainfall patterns',
                    'Prepare for upcoming seasonal changes',
                    'Monitor temperature and humidity fluctuations',
                    'Balance nutrient applications'
                ]
            };

            // Add primary seasonal recommendation
            recommendations.push({
                type: 'seasonal',
                severity: 'medium',
                message: seasonalCare[currentSeason][0]
            });

            // Add additional seasonal tips
            seasonalCare[currentSeason].slice(1).forEach(tip => {
                recommendations.push({
                    type: 'seasonal_tip',
                    severity: 'low',
                    message: tip
                });
            });

            return recommendations;
        } catch (error) {
            console.error('Error generating seasonal recommendations:', error);
            return this.recommendations;
        }
    }

    // Helper method to get display name for season
    getSeasonDisplayName(season) {
        const displayNames = {
            wetSeason: 'Wet Season',
            drySeason: 'Dry Season',
            transitional: 'Transitional Period'
        };
        return displayNames[season] || season;
    }

    // Calculate risk score (0-100)
    calculateRiskScore(temperature, humidity, pH) {
        try {
            // Validate parameters
            this.validateEnvironmentalParams(temperature, humidity, pH);

            const growthTrend = this.growthAnalyzer.getSeasonalGrowthTrend();
            let riskScore = 0;

            // Environmental conditions risk (0-75 points)
            if (temperature < 20 || temperature > 28) riskScore += 25;
            if (humidity < 60 || humidity > 80) riskScore += 25;
            if (pH < 6.0 || pH > 7.0) riskScore += 25;

            // Growth trend-based risk (0-25 points)
            if (growthTrend === 'decreasing') riskScore += 25;
            else if (growthTrend === 'stable') riskScore += 12.5;

            return Math.min(Math.round(riskScore), 100);
        } catch (error) {
            console.error('Error in calculateRiskScore:', error);
            return 50; // Return medium risk on error
        }
    }
} 