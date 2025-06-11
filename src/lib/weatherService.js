// Weather service utility using Open-Meteo API
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1';

/**
 * Fetches historical weather data for a given location
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {number} days - Number of days to fetch (max 30)
 * @returns {Promise<{temperature: number, rainfall: number}>} Average temperature and total rainfall
 */
export const fetchWeatherData = async (latitude, longitude, days = 30) => {
  try {
    // Fetch historical weather data
    const historicalEndpoint = `${OPEN_METEO_BASE_URL}/forecast?latitude=${latitude}&longitude=${longitude}&past_days=${days}&daily=temperature_2m_mean,rain_sum&timezone=auto`;
    const response = await fetch(historicalEndpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

    // Calculate averages
    const temperatures = data.daily.temperature_2m_mean;
    const rainfall = data.daily.rain_sum;

    const avgTemperature = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const totalRainfall = rainfall.reduce((sum, rain) => sum + rain, 0);

    return {
      temperature: avgTemperature,
      rainfall: totalRainfall
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
};

/**
 * Fetches weather forecast for a given location
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {number} days - Number of days to forecast (max 7)
 * @returns {Promise<{temperature: number, rainfall: number}>} Average temperature and total rainfall forecast
 */
export const fetchWeatherForecast = async (latitude, longitude, days = 7) => {
  try {
    // Fetch forecast data
    const forecastEndpoint = `${OPEN_METEO_BASE_URL}/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_mean,rain_sum&forecast_days=${days}&timezone=auto`;
    const response = await fetch(forecastEndpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Failed to fetch weather forecast');
    }

    // Calculate averages
    const temperatures = data.daily.temperature_2m_mean;
    const rainfall = data.daily.rain_sum;

    const avgTemperature = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const totalRainfall = rainfall.reduce((sum, rain) => sum + rain, 0);

    return {
      temperature: avgTemperature,
      rainfall: totalRainfall
    };
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    throw error;
  }
}; 