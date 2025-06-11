import { TimeSeriesAnalysis } from './TimeSeriesAnalysis';
import { DecisionSupportSystem } from './DecisionSupportSystem';

export class AdvancedAnalytics {
    constructor() {
        this.timeSeriesAnalyzer = new TimeSeriesAnalysis();
        this.dss = new DecisionSupportSystem();
        this.historicalData = [];
    }

    // Validate harvest data
    validateHarvestData(harvestData) {
        if (!Array.isArray(harvestData)) {
            throw new Error('Harvest data must be an array');
        }
        
        return harvestData.filter(harvest => {
            if (!harvest || typeof harvest !== 'object') return false;
            if (typeof harvest.coffee_raw_quantity !== 'number' || harvest.coffee_raw_quantity < 0) return false;
            if (!harvest.harvest_date) return false;
            const date = new Date(harvest.harvest_date);
            if (isNaN(date.getTime())) return false;
            return true;
        });
    }

    // Validate weather data
    validateWeatherData(weatherData) {
        if (!Array.isArray(weatherData)) {
            throw new Error('Weather data must be an array');
        }

        return weatherData.filter(data => {
            if (!data || typeof data !== 'object') return false;
            if (typeof data.temperature !== 'number' || data.temperature <= 0) return false;
            if (typeof data.humidity !== 'number' || data.humidity <= 0) return false;
            if (!data.timestamp) return false;
            const date = new Date(data.timestamp);
            if (isNaN(date.getTime())) return false;
            return true;
        });
    }

    // Initialize with historical data
    initializeWithHistoricalData(harvestData, weatherData) {
        try {
            // Validate input data
            const validHarvestData = this.validateHarvestData(harvestData);
            const validWeatherData = this.validateWeatherData(weatherData);

            if (validHarvestData.length === 0) {
                throw new Error('No valid harvest data available');
            }

            // Process harvest data for time series
            validHarvestData.forEach(harvest => {
                const value = Math.max(0, harvest.coffee_raw_quantity);
                this.timeSeriesAnalyzer.addDataPoint(
                    value,
                    new Date(harvest.harvest_date)
                );
            });

            // Store historical data for reference
            this.historicalData = validHarvestData.map(harvest => ({
                ...harvest,
                coffee_raw_quantity: Math.max(0, harvest.coffee_raw_quantity),
                weather: validWeatherData.find(w => 
                    new Date(w.timestamp).toDateString() === new Date(harvest.harvest_date).toDateString()
                )
            }));

        } catch (error) {
            console.error('Error initializing with historical data:', error);
            throw error;
        }
    }

    // Validate environmental conditions
    validateConditions(conditions) {
        if (!conditions || typeof conditions !== 'object') {
            throw new Error('Conditions must be an object');
        }

        const {
            temperature,
            humidity,
            pH,
            rainfall,
            pestDiseaseIncidence,
            fertilizerApplication
        } = conditions;

        // Validate and normalize values
        return {
            temperature: this.validateValue(temperature, 15, 35, 25, 'Temperature'),
            humidity: this.validateValue(humidity, 30, 100, 70, 'Humidity'),
            pH: this.validateValue(pH, 4, 8, 6.5, 'pH'),
            rainfall: this.validateValue(rainfall, 0, 5000, 1500, 'Rainfall'),
            pestDiseaseIncidence: this.validateValue(pestDiseaseIncidence, 0, 1, 0, 'Pest/Disease Incidence'),
            fertilizerApplication: this.validateValue(fertilizerApplication, 0, 1, 0, 'Fertilizer Application')
        };
    }

    // Validate and normalize a single value
    validateValue(value, min, max, defaultValue, name) {
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn(`Invalid ${name}: ${value}, using default: ${defaultValue}`);
            return defaultValue;
        }
        if (value < min || value > max) {
            console.warn(`${name} out of range [${min}-${max}]: ${value}, using default: ${defaultValue}`);
            return defaultValue;
        }
        return value;
    }

    // Get comprehensive analysis
    async getComprehensiveAnalysis(currentConditions) {
        try {
            // Validate and normalize conditions
            const validatedConditions = this.validateConditions(currentConditions);

            // Get ML-based insights
            const mlInsights = this.dss.analyzeConditions(
                validatedConditions.temperature,
                validatedConditions.humidity,
                validatedConditions.pH
            );
            
            // Calculate risk factors
            const riskScore = this.dss.calculateRiskScore(
                validatedConditions.temperature,
                validatedConditions.humidity,
                validatedConditions.pH
            );
            
            // Get growth forecast
            const growthForecast = this.dss.getGrowthForecast(7);

            // Calculate yield prediction
            const yieldPrediction = this.predictYield(validatedConditions);

            // Generate comprehensive recommendations
            const recommendations = [
                ...mlInsights.recommendations,
                ...this.generateYieldRecommendations(yieldPrediction, validatedConditions)
            ];

            return {
                currentAnalysis: {
                    riskScore,
                    yieldPrediction,
                    growthTrend: mlInsights.growthTrend
                },
                forecast: {
                    growth: growthForecast,
                    confidence: this.calculateConfidence(validatedConditions)
                },
                recommendations: this.prioritizeRecommendations(recommendations),
                environmentalStatus: {
                    temperature: this.analyzeEnvironmentalFactor('temperature', validatedConditions.temperature),
                    humidity: this.analyzeEnvironmentalFactor('humidity', validatedConditions.humidity),
                    pH: this.analyzeEnvironmentalFactor('pH', validatedConditions.pH),
                    rainfall: this.analyzeEnvironmentalFactor('rainfall', validatedConditions.rainfall)
                }
            };
        } catch (error) {
            console.error('Error in comprehensive analysis:', error);
            return {
                currentAnalysis: {
                    riskScore: 50,
                    yieldPrediction: null,
                    growthTrend: 'stable'
                },
                forecast: {
                    growth: [],
                    confidence: 0
                },
                recommendations: [{
                    type: 'error',
                    severity: 'high',
                    message: `Analysis error: ${error.message}`
                }],
                environmentalStatus: {
                    temperature: this.getDefaultEnvironmentalStatus('temperature'),
                    humidity: this.getDefaultEnvironmentalStatus('humidity'),
                    pH: this.getDefaultEnvironmentalStatus('pH'),
                    rainfall: this.getDefaultEnvironmentalStatus('rainfall')
                }
            };
        }
    }

    // Get default environmental status
    getDefaultEnvironmentalStatus(factor) {
        const ranges = {
            temperature: { min: 20, max: 28, unit: '°C', default: 25 },
            humidity: { min: 60, max: 80, unit: '%', default: 70 },
            pH: { min: 6.0, max: 7.0, unit: '', default: 6.5 },
            rainfall: { min: 1200, max: 1800, unit: 'mm', default: 1500 }
        };

        const range = ranges[factor];
        return {
            value: range.default,
            status: 'unknown',
            unit: range.unit,
            optimal: {
                min: range.min,
                max: range.max
            }
        };
    }

    // Predict yield based on all available factors
    predictYield(conditions) {
        try {
            const { temperature, rainfall, fertilizerApplication, pestDiseaseIncidence } = conditions;
            
            // Get base prediction from time series
            const basePrediction = this.timeSeriesAnalyzer.predictNextValue() || 0;

            // Apply environmental impact factors
            const tempImpact = this.calculateTemperatureImpact(temperature);
            const rainImpact = this.calculateRainfallImpact(rainfall);
            const fertilizerImpact = this.calculateFertilizerImpact(fertilizerApplication);
            const pestImpact = this.calculatePestImpact(pestDiseaseIncidence);

            // Combine all factors and ensure non-negative
            return Math.max(0, basePrediction * tempImpact * rainImpact * fertilizerImpact * pestImpact);
        } catch (error) {
            console.error('Error in yield prediction:', error);
            return null;
        }
    }

    // Calculate environmental factor impacts
    calculateTemperatureImpact(temp) {
        const optimal = 25;
        const tolerance = 5;
        const impact = 1 - Math.abs(temp - optimal) / (tolerance * 2);
        return Math.max(0.5, Math.min(1.2, impact + 1));
    }

    calculateRainfallImpact(rainfall) {
        const optimal = 1500;
        const impact = rainfall / optimal;
        return Math.max(0.6, Math.min(1.3, impact));
    }

    calculateFertilizerImpact(level) {
        return Math.max(0.7, Math.min(1.2, 0.7 + (level * 0.5)));
    }

    calculatePestImpact(level) {
        return Math.max(0.4, Math.min(1.0, 1 - (level * 0.6)));
    }

    // Generate specific yield-related recommendations
    generateYieldRecommendations(prediction, conditions) {
        try {
            const recommendations = [];
            const lastYield = this.historicalData[this.historicalData.length - 1]?.coffee_raw_quantity || 0;

            if (prediction && prediction < lastYield * 0.9) {
                recommendations.push({
                    type: 'yield',
                    severity: 'high',
                    message: 'Predicted yield is significantly lower than last harvest. Review all growing conditions.'
                });
            }

            // Add more specific recommendations based on conditions
            if (conditions.temperature < 20 || conditions.temperature > 28) {
                recommendations.push({
                    type: 'temperature',
                    severity: 'medium',
                    message: `Temperature is outside optimal range. Adjust greenhouse conditions to maintain 20-28°C.`
                });
            }

            return recommendations;
        } catch (error) {
            console.error('Error generating yield recommendations:', error);
            return [];
        }
    }

    // Prioritize recommendations based on severity and impact
    prioritizeRecommendations(recommendations) {
        try {
            const severityScore = {
                high: 3,
                medium: 2,
                low: 1
            };

            return recommendations
                .sort((a, b) => severityScore[b.severity] - severityScore[a.severity])
                .slice(0, 5); // Return top 5 most important recommendations
        } catch (error) {
            console.error('Error prioritizing recommendations:', error);
            return recommendations;
        }
    }

    // Analyze environmental factors
    analyzeEnvironmentalFactor(factor, value) {
        try {
            const ranges = {
                temperature: { min: 20, max: 28, unit: '°C' },
                humidity: { min: 60, max: 80, unit: '%' },
                pH: { min: 6.0, max: 7.0, unit: '' },
                rainfall: { min: 1200, max: 1800, unit: 'mm' }
            };

            const range = ranges[factor];
            const status = value < range.min ? 'low' : 
                        value > range.max ? 'high' : 'optimal';

            return {
                value,
                status,
                unit: range.unit,
                optimal: {
                    min: range.min,
                    max: range.max
                }
            };
        } catch (error) {
            console.error(`Error analyzing ${factor}:`, error);
            return this.getDefaultEnvironmentalStatus(factor);
        }
    }

    // Calculate confidence score for predictions
    calculateConfidence(conditions) {
        try {
            const dataQuality = this.historicalData.length >= 5 ? 1 : 
                            this.historicalData.length >= 3 ? 0.8 : 0.6;

            const environmentalQuality = Object.values(conditions)
                .filter(val => val !== undefined && val !== null)
                .length / Object.keys(conditions).length;

            return Math.round((dataQuality * 0.6 + environmentalQuality * 0.4) * 100);
        } catch (error) {
            console.error('Error calculating confidence:', error);
            return 0;
        }
    }
} 