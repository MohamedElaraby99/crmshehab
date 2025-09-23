import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { getAllUsers, createUser, updateUser, deleteUser } from '../services/api';

interface UsersPageProps {
  onLogout: () => void;
}

const UsersPage: React.FC<UsersPageProps> = ({ onLogout }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'vendor' | 'client'>('client');
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list || []);
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    const newUser = await createUser({ username, password, role });
    if (newUser) {
      setUsername('');
      setPassword('');
      setRole('client');
      await fetchUsers();
    } else {
      setError('Failed to create user');
    }
  };

  const handleRoleChange = async (id: string, newRole: 'admin' | 'vendor' | 'client') => {
    const updated = await updateUser(id, { role: newRole });
    if (updated) fetchUsers();
  };

  const handleDeactivate = async (id: string) => {
    const ok = await deleteUser(id);
    if (ok) fetchUsers();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <button onClick={onLogout} className="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200">Logout</button>
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Create User</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="border rounded px-3 py-2 pr-10 w-full"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.045.36-2.02.994-2.89M6.219 6.219A10.05 10.05 0 0112 5c5 0 9 4 9 7 0 1.084-.377 2.105-1.04 2.992M3 3l18 18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <select
            className="border rounded px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">Create</button>
        </form>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      </div>

      <div className="bg-white shadow rounded">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">All Users</h3>
        </div>
        {loading ? (
          <div className="p-4">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <select
                        className="border rounded px-2 py-1"
                        value={(u as any).role || 'client'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                      >
                        <option value="client">Client</option>
                        <option value="vendor">Vendor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => handleDeactivate(u.id)} className="text-red-600 hover:text-red-800">Deactivate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
