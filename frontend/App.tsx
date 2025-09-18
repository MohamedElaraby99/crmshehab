
import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import SupplierDashboard from './components/SupplierDashboard';
import { User } from './types';
import { authenticateUser } from './services/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (username: string, password: string): boolean => {
    const user = authenticateUser(username, password);
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <SupplierDashboard user={currentUser} onLogout={handleLogout} />;
};

export default App;
