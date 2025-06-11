// src/components/DSSRecommendations.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import Layout from '../components/Layout';
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

const DSSRecommendations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [plants, setPlants] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [webglContextLost, setWebglContextLost] = useState(false);
  const [yieldStats, setYieldStats] = useState(null);
  const [gradeDistribution, setGradeDistribution] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [harvests, setHarvests] = useState([]);

  // DSS Input States
  const [soilType, setSoilType] = useState("");
  const [averageRainfall, setAverageRainfall] = useState(""); // Can be 'low', 'moderate', 'high'
  const [plantAge, setPlantAge] = useState(""); // Can be 'young', 'mature', 'old'
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'

  // Add new state for recommendation weights and context
  const [recommendationContext, setRecommendationContext] = useState({
    season: new Date().getMonth() < 6 ? 'dry' : 'wet',
    marketTrend: 'stable',
    sustainabilityFocus: true,
    elevation: '',
    lastHarvest: null,
    soilPH: null,
    previousYieldRate: null,
    diseaseHistory: [],
    weatherForecast: null
  });

  // Add after the existing state declarations
  const [seasonalRecommendations, setSeasonalRecommendations] = useState([]);
  const [bestPractices, setBestPractices] = useState([]);

  // Fetch user and plants
  useEffect(() => {
    const fetchUserAndPlants = async () => {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login');
        return;
      }

      // Fetch complete user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!userError && userData) {
        setUserDetails(userData);
      }

      setUser(authUser);
      
      // Fetch plant data
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select('*')
        .eq('farmer_id', authUser.id);
      if (!plantError && plantData) setPlants(plantData);

      // Fetch harvest data
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvest_data')
        .select('*')
        .eq('farmer_id', authUser.id);

      if (!harvestError && harvestData) {
        setHarvests(harvestData);
        // Calculate yield statistics
        const totalTrees = plantData.reduce((sum, p) => sum + (p.number_of_tree_planted || 0), 0);
        const totalRawYield = harvestData.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
        const totalDryYield = harvestData.reduce((sum, h) => sum + (h.coffee_dry_quantity || 0), 0);
        const premiumGrade = harvestData.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const fineGrade = harvestData.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const commercialGrade = harvestData.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);

        // Calculate averages and percentages
        const yieldPerTree = totalTrees > 0 ? totalDryYield / totalTrees : 0;
        const premiumPercentage = totalDryYield > 0 ? (premiumGrade / totalDryYield) * 100 : 0;
        const finePercentage = totalDryYield > 0 ? (fineGrade / totalDryYield) * 100 : 0;
        const commercialPercentage = totalDryYield > 0 ? (commercialGrade / totalDryYield) * 100 : 0;

        setYieldStats({
          totalTrees,
          yieldPerTree,
          premiumPercentage,
          harvestCount: harvestData.length,
          totalDryYield
        });

        setGradeDistribution({
          premiumGrade,
          fineGrade,
          commercialGrade,
          premiumPercentage,
          finePercentage,
          commercialPercentage
        });

        // Fetch farmer details for recommendations
        const { data: farmerDetails } = await supabase
          .from('farmer_detail')
          .select('*')
          .eq('id', authUser.id)
          .single();

        // Generate recommendations
        const recs = generateRecommendations({
          yieldPerTree,
          premiumPercentage,
          totalTrees,
          farmSize: farmerDetails?.farm_size,
          elevation: farmerDetails?.farm_elevation,
          harvestCount: harvestData.length,
          totalDryYield
        });

        setRecommendations(recs);
      }
      
      setLoading(false);
    };
    fetchUserAndPlants();
  }, [navigate]);

  // Fetch latest status for each plant
  useEffect(() => {
    const fetchStatuses = async () => {
      const newStatuses = {};
      for (const plant of plants) {
        const { data, error } = await supabase
          .from('plant_status')
          .select('*')
          .eq('plant_id', plant.plant_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (!error && data) newStatuses[plant.plant_id] = data;
      }
      setStatuses(newStatuses);
    };
    if (plants.length > 0) fetchStatuses();
  }, [plants]);

  // Handle WebGL context events
  useEffect(() => {
    const handleContextLost = () => {
      setWebglContextLost(true);
      console.warn('WebGL context lost - attempting to restore...');
    };

    const handleContextRestored = () => {
      setWebglContextLost(false);
      console.log('WebGL context restored successfully');
    };

    // Add listeners to canvas if it exists
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
    };
  }, []);

  // Enhanced recommendation weights with dynamic adjustment
  const getRecommendationWeights = () => {
    const baseWeights = {
      soilManagement: 0.20,
      waterManagement: 0.20,
      pestControl: 0.15,
      fertilization: 0.15,
      pruning: 0.10,
      harvestTiming: 0.10,
      climaticAdaptation: 0.10
    };

    // Adjust weights based on context
    const adjustedWeights = { ...baseWeights };

    // Increase water management priority during dry season
    if (recommendationContext.season === 'dry') {
      adjustedWeights.waterManagement += 0.05;
      adjustedWeights.soilManagement -= 0.05;
    }

    // Increase pest control priority during wet season
    if (recommendationContext.season === 'wet') {
      adjustedWeights.pestControl += 0.05;
      adjustedWeights.waterManagement -= 0.05;
    }

    // Adjust based on soil pH if available
    if (recommendationContext.soilPH) {
      if (recommendationContext.soilPH < 5.5 || recommendationContext.soilPH > 6.5) {
        adjustedWeights.soilManagement += 0.05;
        adjustedWeights.fertilization += 0.05;
        adjustedWeights.pruning -= 0.05;
        adjustedWeights.harvestTiming -= 0.05;
      }
    }

    return adjustedWeights;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getRecommendations = () => {
    setRecommendations([]);
    setMessage("");
    setMessageType("");

    if (!soilType || !averageRainfall || !plantAge) {
      setMessage("Please select all criteria to get recommendations.");
      setMessageType("error");
      return;
    }

    const currentRecommendations = [];
    const recommendationScores = {};

    // Analyze soil management needs
    const soilRecommendations = analyzeSoilManagement(soilType, plantAge);
    currentRecommendations.push(...soilRecommendations.recommendations);
    recommendationScores.soilManagement = soilRecommendations.score;

    // Analyze water management needs
    const waterRecommendations = analyzeWaterManagement(averageRainfall, soilType);
    currentRecommendations.push(...waterRecommendations.recommendations);
    recommendationScores.waterManagement = waterRecommendations.score;

    // Analyze pest control needs
    const pestRecommendations = analyzePestControl(averageRainfall, soilType);
    currentRecommendations.push(...pestRecommendations.recommendations);
    recommendationScores.pestControl = pestRecommendations.score;

    // Analyze fertilization needs
    const fertilizerRecommendations = analyzeFertilization(soilType, plantAge);
    currentRecommendations.push(...fertilizerRecommendations.recommendations);
    recommendationScores.fertilization = fertilizerRecommendations.score;

    // Analyze pruning needs
    const pruningRecommendations = analyzePruning(plantAge);
    currentRecommendations.push(...pruningRecommendations.recommendations);
    recommendationScores.pruning = pruningRecommendations.score;

    // Calculate overall effectiveness score
    const effectivenessScore = calculateEffectivenessScore(recommendationScores);

    // Prioritize recommendations based on scores and context
    const prioritizedRecommendations = prioritizeRecommendations(
      currentRecommendations,
      effectivenessScore
    );

    if (prioritizedRecommendations.length === 0) {
      setMessage("No specific recommendations for this combination of criteria yet, but general good practices apply.");
      setMessageType("info");
    } else {
      setRecommendations(prioritizedRecommendations);
      setMessage(`Recommendations generated with ${getEffectivenessLevel(effectivenessScore)} effectiveness!`);
      setMessageType("success");
    }
  };

  // Helper functions for analysis
  const analyzeSoilManagement = (soilType, plantAge) => {
    const recommendations = [];
    let score = 0;

    // Enhanced soil management analysis
    if (soilType === "loamy") {
      if (recommendationContext.soilPH && recommendationContext.soilPH < 5.5) {
        recommendations.push("Apply agricultural lime to raise soil pH.");
        score += 0.9;
      }
      recommendations.push("Maintain soil organic matter through regular composting.");
      recommendations.push("Consider cover cropping during non-harvest seasons.");
      score += 0.8;
    } else if (soilType === "clayey") {
      recommendations.push("Improve soil structure through regular aeration.");
      recommendations.push("Add organic matter to improve drainage.");
      if (recommendationContext.season === 'wet') {
        recommendations.push("Install drainage channels to prevent waterlogging.");
      }
      score += 0.7;
    } else if (soilType === "sandy") {
      recommendations.push("Implement mulching to retain moisture and nutrients.");
      recommendations.push("Add clay-based soil amendments to improve water retention.");
      if (recommendationContext.season === 'dry') {
        recommendations.push("Increase organic matter content through green manure.");
      }
      score += 0.6;
    }

    // Age-specific recommendations
    if (plantAge === "old") {
      recommendations.push("Consider soil rejuvenation techniques.");
      recommendations.push("Implement deep soil testing for nutrient deficiencies.");
      score += 0.5;
    }

    return { recommendations, score };
  };

  const analyzeWaterManagement = (rainfall, soilType) => {
    const recommendations = [];
    let score = 0;

    // Enhanced water management analysis
    if (rainfall === "low") {
      recommendations.push("Implement drip irrigation system.");
      recommendations.push("Use water conservation techniques like mulching.");
      if (recommendationContext.weatherForecast === 'drought') {
        recommendations.push("Consider installing shade structures for water conservation.");
        recommendations.push("Implement soil moisture sensors for precise irrigation.");
      }
      score += 0.9;
    } else if (rainfall === "moderate") {
      recommendations.push("Monitor soil moisture regularly.");
      if (soilType === "sandy") {
        recommendations.push("Increase irrigation frequency with smaller water quantities.");
      }
      score += 0.7;
    } else if (rainfall === "high") {
      recommendations.push("Ensure proper drainage systems are in place.");
      if (soilType === "clayey") {
        recommendations.push("Implement raised beds to prevent waterlogging.");
        recommendations.push("Install subsurface drainage systems.");
      }
      if (recommendationContext.season === 'wet') {
        recommendations.push("Monitor for signs of root rot and adjust drainage accordingly.");
      }
      score += 0.8;
    }

    return { recommendations, score };
  };

  const analyzePestControl = (rainfall, soilType) => {
    const recommendations = [];
    let score = 0;

    if (rainfall === "high") {
      recommendations.push("Implement regular fungicide application schedule.");
      recommendations.push("Monitor for coffee rust and other fungal diseases.");
      score += 0.8;
    }

    if (soilType === "clayey") {
      recommendations.push("Implement proper drainage to prevent root rot.");
      score += 0.6;
    }

    return { recommendations, score };
  };

  const analyzeFertilization = (soilType, plantAge) => {
    const recommendations = [];
    let score = 0;

    if (plantAge === "young") {
      recommendations.push("Apply balanced NPK fertilizer with higher Phosphorus.");
      score += 0.8;
    } else if (plantAge === "mature") {
      recommendations.push("Regular application of balanced NPK fertilizer.");
      score += 0.7;
    } else if (plantAge === "old") {
      recommendations.push("Focus on Potassium-rich fertilizers for fruit development.");
      score += 0.6;
    }

    if (soilType === "sandy") {
      recommendations.push("Use slow-release fertilizers to prevent nutrient leaching.");
      score += 0.5;
    }

    return { recommendations, score };
  };

  const analyzePruning = (plantAge) => {
    const recommendations = [];
    let score = 0;

    if (plantAge === "young") {
      recommendations.push("Focus on structural pruning to establish strong framework.");
      score += 0.8;
    } else if (plantAge === "mature") {
      recommendations.push("Regular maintenance pruning to remove unproductive branches.");
      score += 0.7;
    } else if (plantAge === "old") {
      recommendations.push("Consider rejuvenation pruning to encourage new growth.");
      score += 0.6;
    }

    return { recommendations, score };
  };

  const calculateEffectivenessScore = (scores) => {
    const weights = getRecommendationWeights();
    return Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * (weights[key] || 0));
    }, 0);
  };

  const prioritizeRecommendations = (recommendations, effectivenessScore) => {
    // Enhanced prioritization logic
    return recommendations
      .filter(rec => {
        // Context-based filtering
        if (recommendationContext.season === 'dry' && rec.toLowerCase().includes('drainage')) {
          return false;
        }
        if (recommendationContext.weatherForecast === 'drought' && 
            rec.toLowerCase().includes('heavy watering')) {
          return false;
        }
        return true;
      })
      .map(rec => ({
        text: rec,
        priority: calculatePriority(rec, effectivenessScore)
      }))
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.text);
  };

  const calculatePriority = (recommendation, effectivenessScore) => {
    let priority = effectivenessScore;
    
    // Enhanced priority calculation
    if (recommendationContext.sustainabilityFocus && 
        recommendation.toLowerCase().includes('organic')) {
      priority += 0.2;
    }
    
    if (recommendationContext.weatherForecast === 'drought' && 
        recommendation.toLowerCase().includes('water conservation')) {
      priority += 0.3;
    }

    if (recommendationContext.diseaseHistory.length > 0 && 
        recommendation.toLowerCase().includes('disease')) {
      priority += 0.25;
    }

    // Adjust priority based on market trends
    if (recommendationContext.marketTrend === 'rising' && 
        recommendation.toLowerCase().includes('quality')) {
      priority += 0.15;
    }
    
    return priority;
  };

  const getEffectivenessLevel = (score) => {
    if (score >= 0.8) return "High";
    if (score >= 0.6) return "Moderate";
    return "Basic";
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
  ];

  const farmerLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : farmerLinks;

  // DSS logic per plant (simple example, you can expand)
  const getRecommendationsForPlant = (status) => {
    if (!status) return ["No status data available. Please update plant status."];
    const recs = [];
    if (status.status === 'healthy') {
      recs.push("Maintain regular care and monitoring.");
    } else if (status.status === 'diseased') {
      recs.push("Apply appropriate disease management practices.");
    } else if (status.status === 'pest-affected') {
      recs.push("Implement pest control measures immediately.");
    } else {
      recs.push("Monitor plant closely and update status regularly.");
    }
    if (status.soil_ph && (status.soil_ph < 5.5 || status.soil_ph > 6.5)) {
      recs.push("Adjust soil pH to optimal range (5.5-6.5) for coffee.");
    }
    if (status.moisture_level === 'dry') {
      recs.push("Increase irrigation or mulching to retain soil moisture.");
    }
    return recs;
  };

  // Add function to handle farmer profile navigation
  const handleFarmerClick = (farmerId) => {
    navigate(`/farmer-profile/${farmerId}`);
  };

  // Function to determine status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return isDarkMode 
          ? 'bg-green-900 text-green-200' 
          : 'bg-green-100 text-green-800';
      case 'diseased':
        return isDarkMode 
          ? 'bg-red-900 text-red-200' 
          : 'bg-red-100 text-red-800';
      case 'pest-affected':
        return isDarkMode 
          ? 'bg-yellow-900 text-yellow-200' 
          : 'bg-yellow-100 text-yellow-800';
      default:
        return isDarkMode 
          ? 'bg-gray-700 text-gray-200' 
          : 'bg-gray-100 text-gray-800';
    }
  };

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

  // Handle plant click
  const handlePlantClick = (plant) => {
    navigate(`/plant-status/${plant.plant_id}`);
  };

  // Add after fetchFarmerData function
  const generateSeasonalRecommendations = (plantData, harvestData, plantStatus) => {
    const currentMonth = new Date().getMonth();
    const recommendations = [];

    // Seasonal recommendations based on month
    if (currentMonth >= 2 && currentMonth <= 4) { // March-May (Peak Season)
      recommendations.push({
        type: 'seasonal',
        priority: 'high',
        message: 'Peak harvest season - Focus on proper harvesting techniques and post-harvest processing',
        details: [
          'Harvest only ripe cherries',
          'Maintain proper drying conditions',
          'Monitor moisture content during processing'
        ]
      });
    } else if (currentMonth >= 5 && currentMonth <= 7) { // June-August (Post-Harvest)
      recommendations.push({
        type: 'seasonal',
        priority: 'medium',
        message: 'Post-harvest maintenance period',
        details: [
          'Prune trees to remove dead branches',
          'Apply balanced fertilizer',
          'Monitor for pest infestations'
        ]
      });
    } else if (currentMonth >= 8 && currentMonth <= 10) { // September-November (Pre-Harvest)
      recommendations.push({
        type: 'seasonal',
        priority: 'high',
        message: 'Pre-harvest preparation',
        details: [
          'Monitor cherry development',
          'Prepare processing equipment',
          'Plan harvest schedule'
        ]
      });
    } else { // December-February (Off-Season)
      recommendations.push({
        type: 'seasonal',
        priority: 'medium',
        message: 'Off-season maintenance',
        details: [
          'Focus on soil management',
          'Implement water conservation measures',
          'Plan for next season\'s activities'
        ]
      });
    }

    // Add recommendations based on plant status
    if (plantStatus) {
      if (plantStatus.soil_ph < 5.5 || plantStatus.soil_ph > 6.5) {
        recommendations.push({
          type: 'soil',
          priority: 'high',
          message: 'Soil pH needs adjustment',
          details: [
            `Current pH: ${plantStatus.soil_ph}`,
            'Apply appropriate soil amendments',
            'Monitor pH changes after application'
          ]
        });
      }

      if (plantStatus.moisture_level === 'dry') {
        recommendations.push({
          type: 'irrigation',
          priority: 'high',
          message: 'Irrigation needed',
          details: [
            'Implement regular watering schedule',
            'Consider mulching to retain moisture',
            'Monitor soil moisture levels'
          ]
        });
      }

      if (plantStatus.status === 'diseased') {
        recommendations.push({
          type: 'health',
          priority: 'critical',
          message: 'Disease management required',
          details: [
            'Identify specific disease symptoms',
            'Apply appropriate treatment',
            'Implement preventive measures'
          ]
        });
      }
    }

    // Add recommendations based on harvest data
    if (harvestData && harvestData.length > 0) {
      const recentHarvests = harvestData.slice(-3);
      const avgYield = recentHarvests.reduce((sum, h) => sum + h.coffee_dry_quantity, 0) / recentHarvests.length;
      const avgPremium = recentHarvests.reduce((sum, h) => sum + h.coffee_premium_grade, 0) / recentHarvests.length;

      if (avgPremium / avgYield < 0.3) {
        recommendations.push({
          type: 'quality',
          priority: 'medium',
          message: 'Quality improvement needed',
          details: [
            'Review harvesting techniques',
            'Improve post-harvest processing',
            'Consider selective picking'
          ]
        });
      }
    }

    return recommendations;
  };

  const generateBestPractices = (plantData, harvestData) => {
    const practices = [];

    // General best practices
    practices.push({
      category: 'Planting',
      practices: [
        'Maintain proper spacing between trees (2-3 meters)',
        'Plant in well-draining soil',
        'Provide adequate shade for young plants'
      ]
    });

    practices.push({
      category: 'Maintenance',
      practices: [
        'Regular pruning to maintain tree shape',
        'Annual soil testing and amendment',
        'Proper weed management',
        'Regular pest and disease monitoring'
      ]
    });

    practices.push({
      category: 'Harvesting',
      practices: [
        'Selective picking of ripe cherries',
        'Proper sorting of harvested cherries',
        'Maintain clean processing equipment',
        'Monitor moisture content during drying'
      ]
    });

    // Add specific practices based on coffee variety
    if (plantData && plantData.length > 0) {
      const varieties = [...new Set(plantData.map(p => p.coffee_variety))];
      varieties.forEach(variety => {
        practices.push({
          category: `${variety} Specific`,
          practices: [
            'Follow variety-specific pruning techniques',
            'Monitor for variety-specific diseases',
            'Adjust fertilization based on variety requirements'
          ]
        });
      });
    }

    return practices;
  };

  // Update the useEffect for seasonal recommendations
  useEffect(() => {
    if (plants && harvests && Object.keys(statuses).length > 0) {
      const seasonalRecs = generateSeasonalRecommendations(plants, harvests, statuses[plants[0].plant_id]);
      setSeasonalRecommendations(seasonalRecs);
      
      const practices = generateBestPractices(plants, harvests);
      setBestPractices(practices);
    }
  }, [plants, harvests, statuses]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header Section */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                DSS Recommendations
              </h2>
              {userDetails && (
                <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Welcome back, <span className="font-semibold">
                    {userDetails.first_name} {userDetails.middle_name ? `${userDetails.middle_name} ` : ''}{userDetails.last_name}
                  </span>
                </p>
              )}
              <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Here are your personalized recommendations and insights
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : (
          <>
            {/* Yield Statistics */}
            {yieldStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Yield per Tree
                  </h3>
                  <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {yieldStats.yieldPerTree.toFixed(2)} kg
                  </p>
                </div>
                <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Premium Grade
                  </h3>
                  <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {yieldStats.premiumPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Total Trees
                  </h3>
                  <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {yieldStats.totalTrees}
                  </p>
                </div>
                <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Harvests
                  </h3>
                  <p className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {yieldStats.harvestCount}
                  </p>
                </div>
              </div>
            )}

            {/* Grade Distribution and Recommendations */}
            {gradeDistribution && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Grade Distribution (kg)
                </h2>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: ['Premium', 'Fine', 'Commercial'],
                      datasets: [
                        {
                          label: 'Grade Distribution (kg)',
                          data: [
                            gradeDistribution.premiumGrade,
                            gradeDistribution.fineGrade,
                            gradeDistribution.commercialGrade
                          ],
                          backgroundColor: isDarkMode
                            ? ['rgba(129, 140, 248, 0.8)', 'rgba(96, 165, 250, 0.8)', 'rgba(147, 197, 253, 0.8)']
                            : ['rgba(99, 102, 241, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(96, 165, 250, 0.8)']
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: value => `${value} kg`
                          },
                          grid: {
                            display: false
                          }
                        },
                        x: {
                          grid: {
                            display: false
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          display: false
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const value = context.raw;
                              const percentage = gradeDistribution[`${context.label.toLowerCase()}Percentage`];
                              return `${value.toFixed(2)} kg (${percentage.toFixed(1)}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

                <div className="space-y-4">
                  <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Recommendations
                  </h3>
                  <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                    {recommendations.map((rec, index) => (
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
                          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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
                        <p className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Action: {rec.action}
                        </p>
                        <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Expected Impact: {rec.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}



            {/* Seasonal Recommendations */}
            <div className="mt-8">
              <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Seasonal Recommendations
                  </h3>
                  <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                    isDarkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {seasonalRecommendations.map((rec, index) => (
                    <div key={index} className={`p-6 rounded-lg border-l-4 transition-all duration-200 hover:shadow-lg ${
                      rec.priority === 'critical' 
                        ? isDarkMode 
                          ? 'bg-red-900/20 border-red-500 hover:bg-red-900/30' 
                          : 'bg-red-50 border-red-500 hover:bg-red-100'
                        : rec.priority === 'high'
                        ? isDarkMode
                          ? 'bg-yellow-900/20 border-yellow-500 hover:bg-yellow-900/30'
                          : 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100'
                        : isDarkMode
                          ? 'bg-blue-900/20 border-blue-500 hover:bg-blue-900/30'
                          : 'bg-blue-50 border-blue-500 hover:bg-blue-100'
                    }`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-full ${
                          rec.priority === 'critical'
                            ? isDarkMode ? 'bg-red-900/50' : 'bg-red-100'
                            : rec.priority === 'high'
                            ? isDarkMode ? 'bg-yellow-900/50' : 'bg-yellow-100'
                            : isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                        }`}>
                          {rec.priority === 'critical' ? (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          ) : rec.priority === 'high' ? (
                            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <span className={`font-semibold text-lg ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {rec.message}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {rec.details.map((detail, i) => (
                          <li key={i} className={`flex items-start gap-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div className="mt-8">
              <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Best Practices
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bestPractices.map((category, index) => (
                    <div key={index} className={`p-6 rounded-lg transition-all duration-200 hover:shadow-lg ${
                      isDarkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    }`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-full ${
                          isDarkMode ? 'bg-indigo-900/50' : 'bg-indigo-100'
                        }`}>
                          {category.category === 'Planting' ? (
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                          ) : category.category === 'Maintenance' ? (
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </div>
                        <h4 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category.category}
                        </h4>
                      </div>
                      <ul className="space-y-3">
                        {category.practices.map((practice, i) => (
                          <li key={i} className={`flex items-start gap-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{practice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Plants Section */}
            <div className={`mt-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-2xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Your Current Plants
              </h3>
              {plants.length === 0 ? (
                <div className="text-center py-8">
                  <p className={`mb-4 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Please declare plant first.
                  </p>
                  <button
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                    onClick={() => navigate('/land-declaration')}
                  >
                    Declare Plant
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {plants.map((plant) => (
                    <div
                      key={plant.plant_id}
                      className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} 
                        hover:shadow-xl transition-all duration-200 cursor-pointer 
                        ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                      onClick={() => handlePlantClick(plant)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {plant.coffee_variety}
                          </h3>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Trees: {plant.number_of_tree_planted}
                          </p>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Planted: {new Date(plant.planting_date).toLocaleDateString()}
                          </p>
                        </div>
                        {statuses[plant.plant_id] && (
                          <div className={`px-4 py-2 rounded-full text-sm font-medium
                            ${getStatusColor(statuses[plant.plant_id].status)}`}>
                            {statuses[plant.plant_id].status}
                          </div>
                        )}
                        <div className={`ml-4 p-2 rounded-full ${
                          isDarkMode ? 'bg-gray-700 text-indigo-400' : 'bg-gray-100 text-indigo-600'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


          </>
        )}
      </div>
    </Layout>
  );
};

export default DSSRecommendations;