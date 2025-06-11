import { mean } from 'simple-statistics';

export class TimeSeriesAnalysis {
    constructor() {
        this.data = [];
        this.seasonalPatterns = {
            wetSeason: { weight: 1.2, optimal: { min: 90, max: 120 } },
            drySeason: { weight: 0.8, optimal: { min: 70, max: 90 } },
            transitional: { weight: 1.0, optimal: { min: 80, max: 100 } }
        };
    }

    // Add data point to the analysis
    addDataPoint(value, timestamp) {
        this.data.push({ value, timestamp: new Date(timestamp) });
        this.data.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Get tropical season based on month
    getTropicalSeason(date) {
        const month = date.getMonth();
        // Wet season: November to February
        if (month >= 10 || month <= 1) return 'wetSeason';
        // Dry season: June to September
        if (month >= 5 && month <= 8) return 'drySeason';
        // Transitional: March-May, October
        return 'transitional';
    }

    // Calculate seasonal weighted moving average
    calculateSeasonalWMA(period = 7) {
        if (this.data.length < period) return null;

        const recentData = this.data.slice(-period);
        let weightedSum = 0;
        let weightSum = 0;

        recentData.forEach((point, index) => {
            const season = this.getTropicalSeason(point.timestamp);
            const seasonalWeight = this.seasonalPatterns[season].weight;
            const recencyWeight = (index + 1) / period;
            const weight = seasonalWeight * recencyWeight;
            
            weightedSum += point.value * weight;
            weightSum += weight;
        });

        return weightedSum / weightSum;
    }

    // Get seasonal growth trend
    getSeasonalGrowthTrend(period = 7) {
        if (this.data.length < period) return 'stable';

        const recentData = this.data.slice(-period);
        const seasonalValues = {};

        // Group values by season
        recentData.forEach(point => {
            const season = this.getTropicalSeason(point.timestamp);
            if (!seasonalValues[season]) seasonalValues[season] = [];
            seasonalValues[season].push(point.value);
        });

        // Calculate average change per season
        let totalChange = 0;
        let seasonCount = 0;

        Object.values(seasonalValues).forEach(values => {
            if (values.length > 1) {
                const seasonalChange = (values[values.length - 1] - values[0]) / values[0];
                totalChange += seasonalChange;
                seasonCount++;
            }
        });

        const averageChange = seasonCount > 0 ? totalChange / seasonCount : 0;

        if (averageChange > 0.05) return 'increasing';
        if (averageChange < -0.05) return 'decreasing';
        return 'stable';
    }

    // Get seasonal forecast
    getSeasonalForecast(daysAhead = 90) {
        const forecast = [];
        const startDate = new Date();
        
        // Calculate initial values from recent data
        const recentAvg = this.calculateSeasonalWMA(7) || 100; // Default to 100 if no data
        let currentValue = recentAvg;
        
        // Get base growth rate from historical data
        const baseGrowthRate = this.calculateBaseGrowthRate();
        
        for (let i = 0; i < daysAhead; i++) {
            const forecastDate = new Date(startDate);
            forecastDate.setDate(forecastDate.getDate() + i);
            const season = this.getTropicalSeason(forecastDate);
            const { weight, optimal } = this.seasonalPatterns[season];

            // Calculate daily growth with seasonal influence
            const seasonalGrowthRate = baseGrowthRate * weight;
            const randomVariation = 1 + (Math.random() * 0.02 - 0.01); // ±1% random variation
            
            // Apply growth factors
            currentValue *= (1 + seasonalGrowthRate) * randomVariation;
            
            // Ensure value stays within seasonal optimal range
            currentValue = Math.max(
                optimal.min,
                Math.min(optimal.max, currentValue)
            );

            forecast.push({
                day: i + 1,
                date: forecastDate.toISOString(),
                season,
                predictedValue: currentValue,
                optimal,
                growthRate: seasonalGrowthRate
            });
        }

        return forecast;
    }

    // Calculate base growth rate from historical data
    calculateBaseGrowthRate() {
        if (this.data.length < 2) return 0.001; // Default small positive growth

        // Group data by season
        const seasonalData = {};
        this.data.forEach(point => {
            const season = this.getTropicalSeason(point.timestamp);
            if (!seasonalData[season]) seasonalData[season] = [];
            seasonalData[season].push(point);
        });

        // Calculate average growth rate per season
        let totalGrowthRate = 0;
        let seasonCount = 0;

        Object.entries(seasonalData).forEach(([season, points]) => {
            if (points.length > 1) {
                points.sort((a, b) => a.timestamp - b.timestamp);
                const firstValue = points[0].value;
                const lastValue = points[points.length - 1].value;
                const timeDiff = (points[points.length - 1].timestamp - points[0].timestamp) / (1000 * 60 * 60 * 24);
                
                if (timeDiff > 0) {
                    const seasonalGrowthRate = (Math.pow(lastValue / firstValue, 1 / timeDiff) - 1);
                    totalGrowthRate += seasonalGrowthRate;
                    seasonCount++;
                }
            }
        });

        // Return average daily growth rate, with fallback and bounds
        const avgGrowthRate = seasonCount > 0 ? totalGrowthRate / seasonCount : 0.001;
        return Math.max(-0.05, Math.min(0.05, avgGrowthRate)); // Limit to ±5% per day
    }

    // Get seasonal yield statistics
    getSeasonalYieldStats() {
        const stats = {
            wetSeason: { total: 0, count: 0, min: Infinity, max: -Infinity },
            drySeason: { total: 0, count: 0, min: Infinity, max: -Infinity },
            transitional: { total: 0, count: 0, min: Infinity, max: -Infinity }
        };

        this.data.forEach(point => {
            const season = this.getTropicalSeason(point.timestamp);
            stats[season].total += point.value;
            stats[season].count++;
            stats[season].min = Math.min(stats[season].min, point.value);
            stats[season].max = Math.max(stats[season].max, point.value);
        });

        // Calculate averages and handle empty seasons
        Object.keys(stats).forEach(season => {
            if (stats[season].count > 0) {
                stats[season].average = stats[season].total / stats[season].count;
                if (stats[season].min === Infinity) stats[season].min = 0;
                if (stats[season].max === -Infinity) stats[season].max = 0;
            } else {
                stats[season] = { average: 0, min: 0, max: 0, count: 0 };
            }
        });

        return stats;
    }

    // Predict next value based on recent trend
    predictNextValue() {
        if (this.data.length < 2) return null;

        // Get recent data points
        const recentData = this.data.slice(-7); // Use last 7 data points
        const values = recentData.map(d => d.value);
        
        // Calculate simple moving average
        const sma = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        // Calculate trend
        const trend = this.calculateTrend(recentData);
        
        // Predict next value
        return Math.max(0, sma * (1 + trend));
    }

    // Predict next seasonal value
    predictNextSeasonalValue() {
        if (this.data.length < 2) return null;

        const currentSeason = this.getTropicalSeason(new Date());
        const seasonalData = this.data.filter(d => 
            this.getTropicalSeason(d.timestamp) === currentSeason
        );

        if (seasonalData.length === 0) return this.predictNextValue();

        // Calculate seasonal average
        const seasonalAvg = seasonalData.reduce((sum, d) => sum + d.value, 0) / seasonalData.length;
        
        // Get seasonal pattern
        const pattern = this.seasonalPatterns[currentSeason];
        
        // Apply seasonal weight
        return Math.max(0, seasonalAvg * pattern.weight);
    }

    // Calculate trend from data points
    calculateTrend(dataPoints) {
        if (dataPoints.length < 2) return 0;

        const values = dataPoints.map(d => d.value);
        const n = values.length;
        
        // Calculate simple linear regression
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;

        values.forEach((y, x) => {
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        // Normalize trend to percentage
        const avgY = sumY / n;
        return slope / avgY;
    }
} 