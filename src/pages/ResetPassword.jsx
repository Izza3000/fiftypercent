import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
      alert(`Error: ${error.message}`); // Alert message
    } else {
      setMessage('Password updated successfully! Redirecting to login...');
      alert('Success! Your password has been updated. Redirecting to login...'); // Alert message
      setTimeout(() => navigate('/login'), 3000);
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <h1 className="login-title">Reset Password</h1>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleResetPassword} className="login-form">
        <div className="form-group">
          <label htmlFor="password">Enter your new password</label>
          <PasswordInput
            id="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            required
          />
        </div>
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? 'Updating...' : 'Reset Password'}
        </button>
      </form>

      <div className="register-link">
        <a href="/login">Back to Login</a>
      </div>
    </div>
  );
};

export default ResetPassword;
