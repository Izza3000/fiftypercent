import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../lib/ThemeContext';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';

const PriceManagement = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [currentPrices, setCurrentPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newPrice, setNewPrice] = useState({
    coffee_type: 'raw',
    price_per_kg: '',
    currency: 'PHP'
  });

  // Coffee types for dropdown
  const coffeeTypes = [
    { value: 'raw', label: 'Raw Coffee' },
    { value: 'dried', label: 'Dried Coffee' },
    { value: 'premium', label: 'Premium Grade' },
    { value: 'fine', label: 'Fine Grade' },
    { value: 'commercial', label: 'Commercial Grade' }
  ];

  useEffect(() => {
    checkUser();
    fetchPrices();
    fetchPriceHistory();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error) throw error;
        
        if (data.role !== 'admin') {
          toast.error('Admin access required');
          navigate('/dashboard');
          return;
        }
        
        setUser(data);
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error('Error checking user permissions');
    }
  };

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('coffee_prices')
        .select(`
          *,
          creator:created_by (
            first_name,
            last_name
          )
        `)
        .eq('is_active', true)
        .order('coffee_type');

      if (error) throw error;
      setCurrentPrices(data);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Failed to fetch current prices');
    }
  };

  const fetchPriceHistory = async () => {
    try {
      console.log('Fetching price history...');
      const { data, error } = await supabase
        .from('coffee_price_history')
        .select(`
          *,
          user:changed_by (
            first_name,
            last_name
          )
        `)
        .order('change_date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Price history data:', data);
      setPriceHistory(data);
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Failed to fetch price history');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Submitting new price...');
      // Get the current active price for this coffee type
      const currentPrice = currentPrices.find(p => p.coffee_type === newPrice.coffee_type);
      
      // Insert new price
      const { data: insertedPrice, error: insertError } = await supabase
        .from('coffee_prices')
        .insert([{
          ...newPrice,
          created_by: user.id,
          is_active: true
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting new price:', insertError);
        throw insertError;
      }

      console.log('New price inserted:', insertedPrice);

      // If there was a previous price, update its is_active status and create history
      if (currentPrice) {
        // Deactivate old price
        const { error: updateError } = await supabase
          .from('coffee_prices')
          .update({ is_active: false })
          .eq('price_id', currentPrice.price_id);

        if (updateError) {
          console.error('Error updating old price:', updateError);
          throw updateError;
        }

        console.log('Old price deactivated');

        // Create price history record
        const historyRecord = {
          price_id: insertedPrice.price_id,
          coffee_type: newPrice.coffee_type,
          old_price: currentPrice.price_per_kg,
          new_price: newPrice.price_per_kg,
          changed_by: user.id,
          reason: 'Price update'
        };

        console.log('Creating history record:', historyRecord);

        const { error: historyError } = await supabase
          .from('coffee_price_history')
          .insert([historyRecord]);

        if (historyError) {
          console.error('Error creating history record:', historyError);
          throw historyError;
        }

        console.log('History record created');
      }

      toast.success('Price updated successfully');
      setNewPrice({
        coffee_type: 'raw',
        price_per_kg: '',
        currency: 'PHP'
      });
      
      // Refresh data
      await fetchPrices();
      await fetchPriceHistory();
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Failed to update price');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-3xl font-bold mb-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Price Management
        </h1>

        {/* Price Input Form */}
        <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Set New Price
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Coffee Type
                </label>
                <select
                  value={newPrice.coffee_type}
                  onChange={(e) => setNewPrice({ ...newPrice, coffee_type: e.target.value })}
                  className={`w-full rounded-md border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } p-2`}
                  required
                >
                  {coffeeTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Price per KG
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newPrice.price_per_kg}
                  onChange={(e) => setNewPrice({ ...newPrice, price_per_kg: e.target.value })}
                  className={`w-full rounded-md border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } p-2`}
                  required
                  min="0"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Currency
                </label>
                <input
                  type="text"
                  value={newPrice.currency}
                  onChange={(e) => setNewPrice({ ...newPrice, currency: e.target.value })}
                  className={`w-full rounded-md border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } p-2`}
                  required
                  readOnly
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-md ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white font-medium`}
              >
                {loading ? 'Updating...' : 'Update Price'}
              </button>
            </div>
          </form>
        </div>

        {/* Current Prices Table */}
        <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Current Prices
          </h2>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-900' : 'bg-blue-50'}`}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Coffee Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Price per KG</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Currency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Created By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentPrices.map((price) => (
                  <tr key={price.price_id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {coffeeTypes.find(t => t.value === price.coffee_type)?.label}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{price.price_per_kg}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{price.currency}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {price.creator ? `${price.creator.first_name} ${price.creator.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(price.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price History Table */}
        <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Price History
          </h2>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-900' : 'bg-blue-50'}`}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Coffee Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Old Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">New Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Changed By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Change Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {priceHistory.map((history) => (
                  <tr key={history.history_id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {coffeeTypes.find(t => t.value === history.coffee_type)?.label}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{history.old_price}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{history.new_price}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {history.user ? `${history.user.first_name} ${history.user.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(history.change_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PriceManagement; 