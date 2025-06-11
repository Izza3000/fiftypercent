import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../lib/ThemeContext';
import Layout from '../components/Layout';

const PlantStatus = () => {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [plant, setPlant] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    status: '',
    age_stage: '',
    soil_ph: '',
    moisture_level: '',
    last_fertilized: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchPlantAndStatus = async () => {
      setLoading(true);
      // Fetch plant info
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select('*')
        .eq('plant_id', plantId)
        .single();
      if (!plantError) setPlant(plantData);
      // Fetch latest status
      const { data: statusData, error: statusError } = await supabase
        .from('plant_status')
        .select('*')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!statusError && statusData) {
        setStatus(statusData);
        setForm({
          status: statusData.status || '',
          age_stage: statusData.age_stage || '',
          soil_ph: statusData.soil_ph || '',
          moisture_level: statusData.moisture_level || '',
          last_fertilized: statusData.last_fertilized || ''
        });
      }
      setLoading(false);
    };
    if (plantId) fetchPlantAndStatus();
  }, [plantId]);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    try {
      // First, delete existing status for this plant
      await supabase
        .from('plant_status')
        .delete()
        .eq('plant_id', plantId);

      // Then insert the new status
      const { error } = await supabase
        .from('plant_status')
        .insert([
      {
        plant_id: plantId,
        status: form.status,
        age_stage: form.age_stage,
        soil_ph: form.soil_ph,
        moisture_level: form.moisture_level,
        last_fertilized: form.last_fertilized
      }
    ]);

      if (error) throw error;
      
    setSuccessMsg("Status updated successfully!");
      
      // Refetch status
    const { data: statusData } = await supabase
      .from('plant_status')
      .select('*')
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
        
    setStatus(statusData);
    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMsg(error.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Layout>
      <div className="flex-1 flex items-center justify-center">
        <div className={`text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Loading...</div>
      </div>
    </Layout>
  );

  if (!plant) return (
    <Layout>
      <div className="flex-1 flex items-center justify-center">
        <div className={`text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plant not found.</div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ← Back
              </button>
              <div>
                <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plant Status</h1>
                <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Monitor and update your plant's health and conditions
                </p>
              </div>
            </div>
          </div>

          {/* Plant Overview Card */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plant Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Variety</p>
                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {plant.coffee_variety}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Planting Date</p>
                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {plant.planting_date?.split('T')[0]}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Number of Trees</p>
                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {plant.number_of_tree_planted}
                </p>
              </div>
            </div>
          </div>

          {/* Status Update Form */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Update Status</h2>
            {errorMsg && <div className="mb-4 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">{errorMsg}</div>}
            {successMsg && <div className="mb-4 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">{successMsg}</div>}
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                    <span className="ml-1 cursor-pointer group relative">
                      <span className={`inline-block ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} text-white rounded-full w-4 h-4 text-xs text-center`}>?</span>
                      <span className={`absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block ${isDarkMode ? 'bg-gray-700' : 'bg-gray-600'} text-white text-xs rounded px-2 py-1 whitespace-nowrap`}>
                        General health status
                      </span>
                    </span>
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                    required
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  >
                    <option value="">Select status</option>
                    <option value="healthy">Healthy</option>
                    <option value="diseased">Diseased</option>
                    <option value="pest-affected">Pest-affected</option>
                    <option value="stressed">Stressed</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Age Stage
                    <span className="ml-1 cursor-pointer group relative">
                      <span className={`inline-block ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} text-white rounded-full w-4 h-4 text-xs text-center`}>?</span>
                      <span className={`absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block ${isDarkMode ? 'bg-gray-700' : 'bg-gray-600'} text-white text-xs rounded px-2 py-1 whitespace-nowrap`}>
                        Plant age or stage
                      </span>
                    </span>
                  </label>
                  <select
                    name="age_stage"
                    value={form.age_stage}
                    onChange={handleFormChange}
                    required
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  >
                    <option value="">Select age stage</option>
                    <option value="seedling">Seedling</option>
                    <option value="young">Young</option>
                    <option value="mature">Mature</option>
                    <option value="old">Old</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Soil pH
                    <span className="ml-1 cursor-pointer group relative">
                      <span className={`inline-block ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} text-white rounded-full w-4 h-4 text-xs text-center`}>?</span>
                      <span className={`absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block ${isDarkMode ? 'bg-gray-700' : 'bg-gray-600'} text-white text-xs rounded px-2 py-1 whitespace-nowrap`}>
                        Measured soil pH
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="soil_ph"
                    value={form.soil_ph}
                    onChange={handleFormChange}
                    placeholder="e.g. 6.2"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Moisture Level
                    <span className="ml-1 cursor-pointer group relative">
                      <span className={`inline-block ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} text-white rounded-full w-4 h-4 text-xs text-center`}>?</span>
                      <span className={`absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block ${isDarkMode ? 'bg-gray-700' : 'bg-gray-600'} text-white text-xs rounded px-2 py-1 whitespace-nowrap`}>
                        Soil moisture level
                      </span>
                    </span>
                  </label>
                  <select
                    name="moisture_level"
                    value={form.moisture_level}
                    onChange={handleFormChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  >
                    <option value="">Select moisture</option>
                    <option value="dry">Dry</option>
                    <option value="moist">Moist</option>
                    <option value="wet">Wet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Last Fertilized
                  <span className="ml-1 cursor-pointer group relative">
                    <span className={`inline-block ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} text-white rounded-full w-4 h-4 text-xs text-center`}>?</span>
                    <span className={`absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block ${isDarkMode ? 'bg-gray-700' : 'bg-gray-600'} text-white text-xs rounded px-2 py-1 whitespace-nowrap`}>
                      Date of last fertilization
                    </span>
                  </span>
                </label>
                <input
                  type="date"
                  name="last_fertilized"
                  value={form.last_fertilized}
                  onChange={handleFormChange}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                  } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Latest Status Card */}
          {status && (
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Latest Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Health Status</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.status}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Age Stage</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.age_stage}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Soil pH</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.soil_ph || 'N/A'}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Moisture Level</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.moisture_level || 'N/A'}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Last Fertilized</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.last_fertilized || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PlantStatus; 