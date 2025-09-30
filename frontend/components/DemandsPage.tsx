import React, { useEffect, useState } from 'react';
import { usePDF } from 'react-to-pdf';
import { Demand, Product, User } from '../types';
import { getAllDemands, getAllProducts, getAllUsers, getSocket, updateDemandStatus } from '../services/api';

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

  const { toPDF, targetRef } = usePDF({ filename: 'demand.pdf' });

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const st = String((d as any).status || 'pending').toLowerCase();
                          const cls = st === 'confirmed' ? 'bg-green-100 text-green-800' : st === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                          return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{st.toUpperCase()}</span>;
                        })()}
                      </td>
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
        <div className="bg-white w-full max-w-2xl rounded shadow-lg p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold w-full text-center">Demand Details</h3>
            <button onClick={() => setSelectedDemand(null)} className="text-gray-600 hover:text-gray-800">✕</button>
          </div>
          {(() => {
            const d = selectedDemand as any;
            const p: any = d.productId;
            const u: any = d.userId;
            const productName = typeof p === 'string' ? (products.find(pr => pr.id === p)?.name || p) : (p?.name || '');
            const itemNumber = typeof p === 'string' ? (products.find(pr => pr.id === p)?.itemNumber || '') : (p?.itemNumber || '');
            const username = typeof u === 'string' ? (users.find(us => us.id === u)?.username || u) : (u?.username || '');
            // Bundle: group nearby demands from same user within 60 seconds of selected
            const selTs = new Date(d.createdAt).getTime();
            const bundle = demands.filter(dm => {
              const sameUser = String((dm.userId as any)?._id || (dm.userId as any)?.id || dm.userId) === String((u?._id || u?.id || u));
              const dt = Math.abs(new Date(dm.createdAt).getTime() - selTs);
              return sameUser && dt <= 60000; // within 60 seconds window
            });
            return (
              <div className="space-y-3 text-sm mx-auto max-w-2xl" ref={targetRef as any}>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="text-gray-600">Date</div>
                  <div className="font-medium">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="text-gray-600">User</div>
                  <div className="font-medium">{username}</div>
                </div>
                {/* Items table (single or bundle) */}
                <div className="mt-2">
                  <div className="text-center mb-2">
                    <span className="text-gray-600">Items</span>
                    <span className="text-xs text-gray-500 ml-2">{(bundle.length ? bundle : [d]).length} item(s)</span>
                  </div>
                  <div className="overflow-x-auto flex justify-center">
                    <table className="border border-gray-200 w-auto">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b">Item Number</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b">Name</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b">Selling Price</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {(bundle.length ? bundle : [d]).map((bd: any, idx: number) => {
                          const bp: any = bd.productId;
                          const pid = typeof bp === 'string' ? bp : (bp?._id || bp?.id || '');
                          const fullProd: any = products.find(pr => (pr as any).id === pid);
                          const src = fullProd || (typeof bp === 'object' ? bp : null);
                          const name = src?.name || '';
                          const item = src?.itemNumber || '';
                          const price = typeof src?.sellingPrice === 'number' ? src.sellingPrice : (typeof fullProd?.sellingPrice === 'number' ? fullProd.sellingPrice : 0);
                          return (
                            <tr key={`${pid}-${bd.createdAt || idx}`} className="text-center">
                              <td className="px-3 py-2 text-sm text-gray-900">{item}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{name}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${Number(price || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{bd.quantity}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600 mb-1">Notes</div>
                  <div className="p-2 border rounded bg-gray-50 min-h-[48px] inline-block max-w-xl">{d.notes || '—'}</div>
                </div>
              </div>
            );
          })()}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">Status: <span className="font-semibold">{(selectedDemand as any).status || 'pending'}</span></div>
            <div className="space-x-2 text-right">
              <button onClick={() => setSelectedDemand(null)} className="px-4 py-2 rounded border">Close</button>
              {String((selectedDemand as any).status || 'pending').toLowerCase() === 'confirmed' && (
                <button
                  className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => {
                    const d = selectedDemand as any;
                    toPDF({ filename: `demand_${(d._id || d.id || 'report')}.pdf` });
                  }}
                >Export PDF</button>
              )}
              <button
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={async () => {
                  const ok = await updateDemandStatus((selectedDemand as any).id || (selectedDemand as any)._id, 'confirmed');
                  if (ok) { await fetchData(); setSelectedDemand(null); }
                }}
              >Confirm</button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={async () => {
                  const ok = await updateDemandStatus((selectedDemand as any).id || (selectedDemand as any)._id, 'rejected');
                  if (ok) { await fetchData(); setSelectedDemand(null); }
                }}
              >Reject</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default DemandsPage;


