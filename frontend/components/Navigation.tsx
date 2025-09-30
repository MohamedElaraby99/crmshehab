import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavigationProps {
  onLogout: () => void;
  userRole?: 'admin' | 'vendor' | 'client';
}

const Navigation: React.FC<NavigationProps> = ({ onLogout, userRole }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState<Array<{ key?: string; message: string; at: string }>>([]);
  const lastNotifRef = React.useRef<{ key: string; ts: number } | null>(null);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/orders', label: 'Orders'},
    { path: '/vendors', label: 'Vendors'},
    { path: '/products', label: 'Products'},
    { path: '/demands', label: 'Demands'},
    { path: '/users', label: 'Users'},
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    // Lazy import to avoid circular deps
    import('../services/api').then(({ getSocket }) => {
      const socket = getSocket();
      const onPush = (payload: any) => {
        const key = `${payload?.type || 'generic'}:${payload?.orderId || ''}:${payload?.message || ''}`;
        const now = Date.now();
        const last = lastNotifRef.current;
        // Deduplicate bursts of identical notifications within 5 seconds
        if (last && last.key === key && now - last.ts < 5000) {
          return;
        }
        lastNotifRef.current = { key, ts: now };
        setNotifItems(prev => [{ key, message: payload?.message || 'Update', at: payload?.at || new Date().toISOString() }, ...prev].slice(0, 20));
        setNotifCount(prev => prev + 1);
      };
      socket.on('notifications:push', onPush);
      return () => {
        socket.off('notifications:push', onPush);
      };
    });
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 shadow-xl backdrop-blur-md border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="p-2 rounded-xl shadow-lg">
                      <svg className="h-6 w-6 text-white">
                        <path strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">CRM System</h1>
                    <p className="text-gray-300 text-xs">Business Portal</p>
                  </div>
                </div>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {isActive(item.path) && (
                      <div className="ml-2 w-1.5 h-1.5 bg-gray-900 rounded-full"></div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {userRole === 'admin' && (
                <div className="relative">
                  <button
                    title="Notifications"
                    aria-label="Notifications"
                    onClick={() => setNotifOpen(v => !v)}
                    className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full shadow">{notifCount}</span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-gray-800 text-gray-200 rounded-lg shadow-xl border border-gray-700 z-50">
                      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                        <span className="text-sm font-semibold">Notifications</span>
                        <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => { setNotifCount(0); }}>Mark all read</button>
                      </div>
                      <div className="max-h-80 overflow-auto">
                        {notifItems.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-gray-400">No notifications yet</div>
                        ) : (
                          notifItems.map((n, idx) => (
                            <div key={n.key || idx} className="px-4 py-3 border-b border-gray-700 last:border-b-0">
                              <div className="text-sm">{n.message}</div>
                              <div className="text-[10px] text-gray-400 mt-1">{new Date(n.at).toLocaleString()}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="hidden lg:block">
                <div className="bg-gray-700/50 rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div>
                      <p className="text-white text-xs font-medium">Online</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mobile menu button */}
              <div className="sm:hidden">
                <button
                  onClick={toggleMobileMenu}
                  className="inline-flex items-center justify-center p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 transition-all duration-200"
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
                className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 group"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className={`sm:hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}>
          <div className="px-4 pt-2 pb-4 space-y-1 bg-gray-800 border-t border-gray-700">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-white text-gray-900'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.label}
                {isActive(item.path) && (
                  <div className="ml-auto w-1.5 h-1.5 bg-gray-900 rounded-full"></div>
                )}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-700">
              <button
                onClick={onLogout}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Spacer to account for fixed header */}
      <div className="h-16"></div>
    </>
  );
};

export default Navigation;