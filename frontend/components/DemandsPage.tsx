import React, { useEffect, useState } from 'react';
import { Demand, Product, User } from '../types';
import { getAllDemands, getAllProducts, getAllUsers } from '../services/api';

interface DemandsPageProps {
  onLogout: () => void;
}

const DemandsPage: React.FC<DemandsPageProps> = ({ onLogout }) => {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [d, p, u] = await Promise.all([getAllDemands(), getAllProducts(), getAllUsers()]);
      setDemands(d);
      setProducts(p);
      setUsers(u);
    } catch (e) {
      console.error('Failed to load demands:', e);
      setDemands([]);
      setProducts([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="p-8 text-center">Loading demands...</div>;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Demand Requests</h1>
          <p className="mt-2 text-gray-600">All demand requests from users</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Demands ({demands.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {demands.map((d) => {
                  const productObj: any = d.productId as any;
                  const userObj: any = d.userId as any;
                  const productName = typeof productObj === 'string' ? (products.find(p => p.id === productObj)?.name || '') : (productObj?.name || '');
                  const itemNumber = typeof productObj === 'string' ? (products.find(p => p.id === productObj)?.itemNumber || '') : (productObj?.itemNumber || '');
                  const username = typeof userObj === 'string'
                    ? (users.find(u => u.id === userObj)?.username || userObj)
                    : (userObj?.username || '');
                  const key = `${(typeof productObj === 'string' ? productObj : (productObj?._id || productObj?.id) || '')}-${d.createdAt}`;
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{itemNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.notes || '-'}</td>
                    </tr>
                  );
                })}
                {demands.length === 0 && (
                  <tr>
                    <td className="px-6 py-4 text-center text-sm text-gray-500" colSpan={6}>No demands found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemandsPage;


