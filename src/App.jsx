import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard"; // Admin Dashboard (now handles redirect)
import FarmerDashboard from "./pages/FarmerDashboard";
import UserManagement from "./pages/UserManagement";
import UserProfile from "./pages/UserProfile";
import PredictiveAnalytics from "./pages/PredictiveAnalytics";
import SinglePlantAnalytics from "./pages/SinglePlantAnalytics";
import DataEntry from "./pages/DataEntry";
import DSSRecommendations from "./pages/DSSRecommendations";
import FarmerRecommendations from "./pages/FarmerRecommendations";
import { AuthProvider } from "./lib/AuthProvider"; // Keep AuthProvider
import ProtectedRoute from "./lib/ProtectedRoute"; // Keep ProtectedRoute for other routes
import LandDeclaration from "./pages/LandDeclaration";
import HarvestReporting from "./pages/HarvestReporting";
import FarmerReports from "./pages/FarmerReports";
import LandingPage from "./pages/LandingPage";
import AdminAnalytics from "./pages/AdminAnalytics";
import { ThemeProvider } from './lib/ThemeContext';
import './styles/landing.css';
import PlantStatus from "./pages/PlantStatus";
import FarmerProfile from "./pages/FarmerProfile";
import PriceManagement from "./pages/PriceManagement";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />

            {/* Dashboard route - now handles its own role-based redirection */}
            <Route
              path="/dashboard"
              element={<Dashboard />} // No ProtectedRoute here for role check
            />

            {/* Farmer Dashboard - still protected to ensure only farmers can access directly */}
            <Route
              path="/farmer-dashboard"
              element={
                <ProtectedRoute requiredRoles={['farmer']}>
                  <FarmerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Other Protected Routes (still use ProtectedRoute for strict access) */}
            <Route
              path="/user-management"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-analytics"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <AdminAnalytics />
                </ProtectedRoute>
              }
            />

            <Route
              path="/farmer-reports"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <FarmerReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-profile"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}>
                  <UserProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/predictive-analytics"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}>
                  <PredictiveAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-entry"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <DataEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dss-recommendations"
              element={
                <ProtectedRoute requiredRoles={['farmer']}>
                  <DSSRecommendations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/harvest-reporting"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}> {/* Changed to allow admin too, as they might want to see it */}
                  <HarvestReporting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/land-declaration"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}> {/* Changed to allow admin too */}
                  <LandDeclaration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plant-status/:plantId"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}>
                  <PlantStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/single-plant-analytics/:plantId"
              element={
                <ProtectedRoute requiredRoles={['farmer', 'admin']}>
                  <SinglePlantAnalytics />
                </ProtectedRoute>
              }
            />

            <Route
              path="/farmer-recommendations"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <FarmerRecommendations />
                </ProtectedRoute>
              }
            />

            <Route
              path="/farmer-profile/:farmerId"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <FarmerProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/price-management"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <PriceManagement />
                </ProtectedRoute>
              }
            />

            {/* Redirect unknown routes to landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;