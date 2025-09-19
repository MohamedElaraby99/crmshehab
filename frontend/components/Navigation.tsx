import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavigationProps {
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/orders', label: 'Orders'},
    { path: '/vendors', label: 'Vendors'},
    { path: '/products', label: 'Products'},
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 shadow-xl backdrop-blur-md border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl shadow-lg">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">CRM System</h1>
                    <p className="text-gray-300 text-xs">Business Portal</p>
                  </div>
                </div>
              </div>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group inline-flex items-center px-6 py-4 rounded-2xl text-base font-semibold transition-all duration-300 transform hover:scale-105 ${
                      isActive(item.path)
                        ? 'bg-white/90 text-indigo-600 shadow-xl backdrop-blur-sm border border-white/50'
                        : 'text-blue-100 hover:bg-white/20 hover:text-white hover:shadow-lg hover:backdrop-blur-sm'
                    }`}
                  >
                    {item.label}
                    {isActive(item.path) && (
                      <div className="ml-2 w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="hidden lg:block">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-white text-sm font-semibold">System Online</p>
                      <p className="text-blue-100 text-xs">All services running</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mobile menu button */}
              <div className="sm:hidden">
                <button
                  onClick={toggleMobileMenu}
                  className="inline-flex items-center justify-center p-3 rounded-2xl text-indigo-100 hover:text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-all duration-300 backdrop-blur-sm"
                  aria-expanded="false"
                >
                  <span className="sr-only">Open main menu</span>
                  <div className="relative w-8 h-8">
                    <span className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-0.5 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-2'
                    }`}></span>
                    <span className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-0.5 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                    }`}></span>
                    <span className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-0.5 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? '-rotate-45 -translate-y-0' : 'translate-y-2'
                    }`}></span>
                  </div>
                </button>
              </div>

              <button
                onClick={onLogout}
                className="hidden sm:inline-flex items-center px-6 py-4 border-2 border-white/30 text-base font-semibold rounded-2xl shadow-xl text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-blue-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white group"
              >
                <svg className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className={`sm:hidden transition-all duration-500 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}>
          <div className="px-4 pt-4 pb-6 space-y-2 bg-gradient-to-b from-indigo-700 to-purple-700 backdrop-blur-sm border-t border-white/10">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center px-6 py-4 rounded-2xl text-base font-medium transition-all duration-300 transform hover:scale-105 ${
                  isActive(item.path)
                    ? 'bg-white/90 text-blue-600 shadow-xl'
                    : 'text-blue-100 hover:bg-white/20 hover:text-white'
                }`}
              >
                {item.label}
                {isActive(item.path) && (
                  <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                )}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/20">
              <button
                onClick={onLogout}
                  className="w-full flex items-center justify-center px-6 py-4 rounded-2xl text-base font-medium text-blue-100 hover:bg-white/20 hover:text-white transition-all duration-300 transform hover:scale-105 group"
              >
                <svg className="w-5 h-5 mr-3 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Spacer to account for fixed header */}
      <div className="h-24"></div>
    </>
  );
};

export default Navigation;