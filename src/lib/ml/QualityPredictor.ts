import { calculateDaysSinceDate } from '../utils/dateUtils';

interface HistoricalHarvest {
  coffee_raw_quantity: number;
  coffee_premium_grade: number;
  coffee_fine_grade: number;
  coffee_commercial_grade: number;
}

interface CurrentConditions {
  pH: number;
  moisture: 'very_dry' | 'dry' | 'moderate' | 'moist' | 'very_moist';
  lastFertilized: string;
}

interface QualityDistribution {
  premium: number;
  fine: number;
  commercial: number;
}

type Season = 'wet' | 'dry' | 'transition';

export class QualityPredictor {
  static OPTIMAL_PH_RANGE = { min: 6.0, max: 6.5 };
  static OPTIMAL_MOISTURE = "moderate";
  static FERTILIZER_CYCLE_DAYS = 90; // Recommended fertilization every 90 days

  static predictQualityDistribution(currentConditions: CurrentConditions, historicalHarvests: HistoricalHarvest[]): QualityDistribution {
    if (!historicalHarvests || historicalHarvests.length === 0) {
      return {
        premium: 0,
        fine: 0,
        commercial: 0
      };
    }

    // Base distribution from historical data
    const baseDistribution = this.calculateBaseDistribution(historicalHarvests);
    
    // Environmental factor adjustments
    const phFactor = this.calculatePhFactor(currentConditions.pH);
    const moistureFactor = this.calculateMoistureFactor(currentConditions.moisture);
    const fertilizerFactor = this.calculateFertilizerFactor(currentConditions.lastFertilized);

    // Calculate adjusted distributions
    const qualityMultiplier = (phFactor + moistureFactor + fertilizerFactor) / 3;
    
    return {
      premium: Math.min(100, baseDistribution.premium * qualityMultiplier),
      fine: Math.min(100, baseDistribution.fine * (2 - qualityMultiplier)),
      commercial: Math.min(100, baseDistribution.commercial * (2 - qualityMultiplier))
    };
  }

  static predictSeasonalYield(currentConditions: CurrentConditions, historicalHarvests: HistoricalHarvest[], season: Season): number {
    if (!historicalHarvests || historicalHarvests.length === 0) {
      return 0;
    }

    const baseYield = this.calculateBaseYield(historicalHarvests);
    const seasonalFactor = this.calculateSeasonalFactor(season);
    const environmentalFactor = this.calculateEnvironmentalFactor(currentConditions);

    return baseYield * seasonalFactor * environmentalFactor;
  }

  private static calculateBaseDistribution(historicalHarvests: HistoricalHarvest[]): QualityDistribution {
    const totalQuantity = historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
    
    return {
      premium: (historicalHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0) / totalQuantity) * 100,
      fine: (historicalHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0) / totalQuantity) * 100,
      commercial: (historicalHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0) / totalQuantity) * 100
    };
  }

  private static calculatePhFactor(pH: number): number {
    if (pH >= this.OPTIMAL_PH_RANGE.min && pH <= this.OPTIMAL_PH_RANGE.max) {
      return 1.2; // Optimal pH range
    } else if (pH < this.OPTIMAL_PH_RANGE.min) {
      return 0.8; // Too acidic
    } else {
      return 0.8; // Too alkaline
    }
  }

  private static calculateMoistureFactor(moisture: CurrentConditions['moisture']): number {
    const moistureFactors = {
      'very_dry': 0.6,
      'dry': 0.8,
      'moderate': 1.2,
      'moist': 1.0,
      'very_moist': 0.7
    };
    return moistureFactors[moisture] || 1.0;
  }

  private static calculateFertilizerFactor(lastFertilized: string): number {
    const daysSinceLastFertilized = calculateDaysSinceDate(lastFertilized);
    if (daysSinceLastFertilized <= this.FERTILIZER_CYCLE_DAYS) {
      return 1.2;
    } else if (daysSinceLastFertilized <= this.FERTILIZER_CYCLE_DAYS * 1.5) {
      return 1.0;
    } else {
      return 0.8;
    }
  }

  private static calculateBaseYield(historicalHarvests: HistoricalHarvest[]): number {
    return historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0) / historicalHarvests.length;
  }

  private static calculateSeasonalFactor(season: Season): number {
    const seasonalFactors = {
      'wet': 1.2,    // 20% increase during wet season
      'dry': 0.8,    // 20% decrease during dry season
      'transition': 1.0  // Normal yield during transition
    };
    return seasonalFactors[season] || 1.0;
  }

  private static calculateEnvironmentalFactor(currentConditions: CurrentConditions): number {
    const phFactor = this.calculatePhFactor(currentConditions.pH);
    const moistureFactor = this.calculateMoistureFactor(currentConditions.moisture);
    const fertilizerFactor = this.calculateFertilizerFactor(currentConditions.lastFertilized);
    
    return (phFactor + moistureFactor + fertilizerFactor) / 3;
  }
} 