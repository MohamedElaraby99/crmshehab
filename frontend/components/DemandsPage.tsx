import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
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

  const exportDemandPdf = (d: any, bundle: any[]) => {
    const doc = new jsPDF();
    const marginLeft = 14;
    let y = 20;
    doc.setFontSize(16);
    doc.text('Demand Confirmation Report', marginLeft, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(d.createdAt).toLocaleString()}`, marginLeft, y);
    y += 6;
    const u: any = d.userId;
    const username = typeof u === 'string' ? (users.find(us => (us as any).id === u)?.username || u) : (u?.username || '');
    doc.text(`User: ${username}`, marginLeft, y);
    y += 8;
    // Table header
    doc.setFontSize(12);
    doc.text('Items', marginLeft, y);
    y += 8;
    doc.setFontSize(10);
    const rows = (bundle.length ? bundle : [d]).map((bd: any) => {
      const bp: any = bd.productId;
      const pid = typeof bp === 'string' ? bp : (bp?._id || bp?.id || '');
      const fullProd: any = products.find(pr => (pr as any).id === pid);
      const src = fullProd || (typeof bp === 'object' ? bp : null);
      const name = src?.name || '';
      const item = src?.itemNumber || '';
      const price = typeof src?.sellingPrice === 'number' ? src.sellingPrice : (typeof fullProd?.sellingPrice === 'number' ? fullProd.sellingPrice : 0);
      return { name, item, price, qty: bd.quantity };
    });
    // Column positions
    const colItem = marginLeft;
    const colName = marginLeft + 35;
    const colPrice = marginLeft + 130;
    const colQty = marginLeft + 165;
    // Header row
    doc.setFont(undefined, 'bold');
    doc.text('Item #', colItem, y);
    doc.text('Name', colName, y);
    doc.text('Selling Price', colPrice, y);
    doc.text('Qty', colQty, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    // Divider
    doc.line(marginLeft, y - 4, marginLeft + 180, y - 4);
    // Rows
    rows.forEach((r) => {
      doc.text(String(r.item || ''), colItem, y);
      // Wrap name if long
      const nameLines = doc.splitTextToSize(String(r.name || ''), colPrice - colName - 4);
      doc.text(nameLines, colName, y);
      doc.text(`$${Number(r.price || 0).toFixed(2)}`, colPrice, y);
      doc.text(String(r.qty || 0), colQty, y);
      // Adjust y based on wrapped name
      const usedLines = Array.isArray(nameLines) ? nameLines.length : 1;
      y += usedLines * 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    y += 4;
    doc.setFontSize(10);
    doc.text('Status: CONFIRMED', marginLeft, y);
    y += 6;
    if (d.notes) {
      doc.text('Notes:', marginLeft, y);
      y += 6;
      const split = doc.splitTextToSize(String(d.notes), 180);
      doc.text(split, marginLeft, y);
      y += split.length * 6;
    }
    const filename = `demand_${(d._id || d.id || 'report')}.pdf`;
    doc.save(filename);
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
            // Bundle: group nearby demands from same user within 60 seconds of selected
            const selTs = new Date(d.createdAt).getTime();
            const bundle = demands.filter(dm => {
              const sameUser = String((dm.userId as any)?._id || (dm.userId as any)?.id || dm.userId) === String((u?._id || u?.id || u));
              const dt = Math.abs(new Date(dm.createdAt).getTime() - selTs);
              return sameUser && dt <= 60000; // within 60 seconds window
            });
            return (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Date</span><span className="font-medium">{new Date(d.createdAt).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">User</span><span className="font-medium">{username}</span></div>
                {bundle.length <= 1 ? (
                  <>
                    <div className="flex justify-between"><span className="text-gray-600">Product</span><span className="font-medium">{productName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Item #</span><span className="font-medium">{itemNumber}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Quantity</span><span className="font-medium">{d.quantity}</span></div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Items in this request</span>
                      <span className="text-xs text-gray-500">{bundle.length} items</span>
                    </div>
                    <div className="mt-2 border rounded divide-y">
                      {bundle.map((bd, idx) => {
                        const bp: any = bd.productId as any;
                        const bName = typeof bp === 'string' ? (products.find(pr => pr.id === bp)?.name || bp) : (bp?.name || '');
                        const bItem = typeof bp === 'string' ? (products.find(pr => pr.id === bp)?.itemNumber || '') : (bp?.itemNumber || '');
                        return (
                          <div key={`${(bp?._id || bp?.id || bp || '')}-${bd.createdAt}-${idx}`} className="px-3 py-2 flex items-center justify-between text-sm">
                            <div className="truncate max-w-[65%]"><span className="font-medium text-gray-900">{bName}</span> <span className="text-gray-500 ml-1">#{bItem}</span></div>
                            <div className="text-gray-900 font-semibold">x{bd.quantity}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-gray-600 mb-1">Notes</div>
                  <div className="p-2 border rounded bg-gray-50 min-h-[48px]">{d.notes || '—'}</div>
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
                    // Compute same bundle used in view
                    const selTs = new Date(d.createdAt).getTime();
                    const u: any = d.userId;
                    const bundle = demands.filter(dm => {
                      const sameUser = String((dm.userId as any)?._id || (dm.userId as any)?.id || dm.userId) === String((u?._id || u?.id || u));
                      const dt = Math.abs(new Date(dm.createdAt).getTime() - selTs);
                      return sameUser && dt <= 60000;
                    });
                    exportDemandPdf(d, bundle);
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


