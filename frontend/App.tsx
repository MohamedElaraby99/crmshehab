
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SupplierDashboard from './components/SupplierDashboard';
import VendorDashboard from './components/VendorDashboard';
import VendorsPage from './components/VendorsPage';
import ProductsPage from './components/ProductsPage';
import OrdersPage from './components/OrdersPage';
import Navigation from './components/Navigation';
import { User, Vendor } from './types';
import { authenticateUser, authenticateVendor, updateVendorByVendor, getCurrentUser, getCurrentVendor, isAuthenticated } from './services/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentVendor(null);
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentVendor');
    localStorage.removeItem('authToken');
  };

  useEffect(() => {
    const restoreUserSession = async () => {
      if (!isAuthenticated()) {
        handleLogout();
        return;
      }

      const storedUser = sessionStorage.getItem('currentUser');
      const storedVendor = sessionStorage.getItem('currentVendor');
      
      if (storedUser) {
        try {
          // Validate token by fetching current user
          const user = await getCurrentUser();
          if (user) {
            setCurrentUser(user);
            sessionStorage.setItem('currentUser', JSON.stringify(user));
          } else {
            // Token is invalid, clear everything
            handleLogout();
          }
        } catch (error) {
          // Token is invalid, clear everything
          handleLogout();
        }
      } else if (storedVendor) {
        try {
          // Validate token by fetching current vendor
          const vendor = await getCurrentVendor();
          if (vendor) {
            setCurrentVendor(vendor);
            sessionStorage.setItem('currentVendor', JSON.stringify(vendor));
          } else {
            // Token is invalid, clear everything
            handleLogout();
          }
        } catch (error) {
          // Token is invalid, clear everything
          handleLogout();
        }
      } else {
        // No stored user/vendor, clear everything
        handleLogout();
      }
    };

    restoreUserSession();
  }, []);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    const user = await authenticateUser(username, password);
    if (user) {
      setCurrentUser(user);
      setCurrentVendor(null); // Clear vendor if admin logs in
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.removeItem('currentVendor');
      return true;
    }
    return false;
  };

  const handleVendorLogin = async (username: string, password: string): Promise<boolean> => {
    const vendor = await authenticateVendor(username, password);
    if (vendor) {
      setCurrentVendor(vendor);
      setCurrentUser(null); // Clear user if vendor logs in
      sessionStorage.setItem('currentVendor', JSON.stringify(vendor));
      sessionStorage.removeItem('currentUser');
      return true;
    }
    return false;
  };

  const handleVendorUpdate = (updatedVendor: Vendor) => {
    updateVendorByVendor(updatedVendor.id, updatedVendor);
    setCurrentVendor(updatedVendor);
    sessionStorage.setItem('currentVendor', JSON.stringify(updatedVendor));
  };

  if (!currentUser && !currentVendor) {
    return <LoginPage onLogin={handleLogin} onVendorLogin={handleVendorLogin} />;
  }

      // Vendor Dashboard
      if (currentVendor) {
        return (
          <div className="min-h-screen bg-gray-100">
            <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 shadow-2xl backdrop-blur-sm border-b border-white/10">
              <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-6">
                    <div className="relative">
                      <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/30">
                        <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                        Vendor Portal
                      </h1>
                      <p className="text-emerald-100 text-lg sm:text-xl font-semibold">{currentVendor.name}</p>
                      <p className="text-emerald-200 text-sm sm:text-base hidden sm:block">Manage your business information and orders</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 sm:space-x-6">
                    <div className="hidden lg:block">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20 shadow-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${currentVendor.status === 'active' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                          <div>
                            <p className="text-white text-sm font-semibold">Status: {currentVendor.status}</p>
                            <p className="text-emerald-100 text-xs">Last updated: {new Date(currentVendor.updatedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-sm sm:text-base font-semibold rounded-2xl shadow-xl text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-emerald-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white group"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </header>
            
            {/* Spacer to account for fixed header */}
            <div className="h-28 sm:h-32"></div>
            
            <VendorDashboard user={currentVendor} onLogout={handleLogout} onUpdateVendor={handleVendorUpdate} />
          </div>
        );
      }

  // Admin/Supplier Dashboard
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<SupplierDashboard user={currentUser!} onLogout={handleLogout} />} />
          <Route path="/orders" element={<OrdersPage onLogout={handleLogout} />} />
          <Route path="/vendors" element={<VendorsPage onLogout={handleLogout} />} />
          <Route path="/products" element={<ProductsPage onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
