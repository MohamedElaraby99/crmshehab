import React, { useEffect, useState } from 'react';
import { Demand, Product, User } from '../types';
import { getAllDemands, getAllProducts, getAllUsers, getSocket } from '../services/api';

interface DemandsPageProps {
  onLogout: () => void;
}

const DemandsPage: React.FC<DemandsPageProps> = ({ onLogout }) => {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);

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

  // Realtime: update list when new demand arrives
  useEffect(() => {
    const socket = getSocket();
    const onDemand = () => fetchData();
    socket.on('demands:created', onDemand);
    return () => { socket.off('demands:created', onDemand); };
  }, []);

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
                    <tr
                      key={key}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedDemand(d)}
                      title="Click to view details"
                    >
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

    {/* Demand Details Modal */}
    {selectedDemand && (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setSelectedDemand(null)}>
        <div className="bg-white w-full max-w-lg rounded shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Demand Details</h3>
            <button onClick={() => setSelectedDemand(null)} className="text-gray-600 hover:text-gray-800">✕</button>
          </div>
          {(() => {
            const d = selectedDemand as any;
            const p: any = d.productId;
            const u: any = d.userId;
            const productName = typeof p === 'string' ? (products.find(pr => pr.id === p)?.name || p) : (p?.name || '');
            const itemNumber = typeof p === 'string' ? (products.find(pr => pr.id === p)?.itemNumber || '') : (p?.itemNumber || '');
            const username = typeof u === 'string' ? (users.find(us => us.id === u)?.username || u) : (u?.username || '');
            return (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Date</span><span className="font-medium">{new Date(d.createdAt).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">User</span><span className="font-medium">{username}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Product</span><span className="font-medium">{productName}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Item #</span><span className="font-medium">{itemNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Quantity</span><span className="font-medium">{d.quantity}</span></div>
                <div>
                  <div className="text-gray-600 mb-1">Notes</div>
                  <div className="p-2 border rounded bg-gray-50 min-h-[48px]">{d.notes || '—'}</div>
                </div>
              </div>
            );
          })()}
          <div className="mt-4 text-right">
            <button onClick={() => setSelectedDemand(null)} className="px-4 py-2 rounded border">Close</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default DemandsPage;


