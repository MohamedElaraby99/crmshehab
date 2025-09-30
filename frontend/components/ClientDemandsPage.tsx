import React, { useEffect, useState } from 'react';
import { Product, Demand } from '../types';
import { getAllProducts, getMyDemands } from '../services/api';

interface ClientDemandsPageProps {
  onLogout: () => void;
}

const ClientDemandsPage: React.FC<ClientDemandsPageProps> = ({ onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [myDemands, setMyDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, mine] = await Promise.all([getAllProducts(), getMyDemands()]);
      setProducts(prods || []);
      setMyDemands(mine || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-center">Loading demands...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Demands</h2>
        <button onClick={onLogout} className="px-3 py-2 rounded bg-gray-800 text-white text-sm">Logout</button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-700">Total: {myDemands.length}</span>
            <button onClick={load} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myDemands.map((d, idx) => {
                  const p: any = d.productId as any;
                  const pid = typeof p === 'string' ? p : (p?._id || (p as any)?.id || '');
                  const prod = products.find(pp => (pp as any).id === pid);
                  const name = prod?.name || (typeof p === 'object' ? p?.name : '') || '';
                  const item = prod?.itemNumber || (typeof p === 'object' ? p?.itemNumber : '') || '';
                  const st = String((d as any).status || 'pending').toLowerCase();
                  const cls = st === 'confirmed' ? 'bg-green-100 text-green-800' : st === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                  return (
                    <tr key={(d as any).id || (d as any)._id || idx}>
                      <td className="px-6 py-2 text-sm text-gray-900">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-2 text-sm text-gray-900">{name}</td>
                      <td className="px-6 py-2 text-sm text-gray-900">{item}</td>
                      <td className="px-6 py-2 text-sm text-gray-900">{d.quantity}</td>
                      <td className="px-6 py-2 text-sm"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{st.toUpperCase()}</span></td>
                    </tr>
                  );
                })}
                {myDemands.length === 0 && (
                  <tr><td className="px-6 py-6 text-center text-gray-500" colSpan={5}>No demand history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDemandsPage;


