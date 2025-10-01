import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { usePDF } from 'react-to-pdf';
import { Demand, Product, User } from '../types';
import { getAllDemands, getAllProducts, getAllUsers, getSocket, updateDemandStatus, getWhatsAppRecipients, sendDemandReportToWhatsApp, updateProduct } from '../services/api';

interface DemandsPageProps {
  onLogout: () => void;
}

const DemandsPage: React.FC<DemandsPageProps> = ({ onLogout }) => {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [whatsappRecipients, setWhatsappRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [d, p, u, w] = await Promise.all([getAllDemands(), getAllProducts(), getAllUsers(), getWhatsAppRecipients()]);
      setDemands(d);
      setProducts(p);
      setUsers(u);
      setWhatsappRecipients(w);
    } catch (e) {
      console.error('Failed to load demands:', e);
      setDemands([]);
      setProducts([]);
      setUsers([]);
      setWhatsappRecipients([]);
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
                <>
                  <button
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={() => {
                      const d = selectedDemand as any;
                      toPDF({ filename: `demand_${(d._id || d.id || 'report')}.pdf` });
                    }}
                  >Export PDF</button>
                  <button
                    className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      try {
                        const d = selectedDemand as any;
                        const p: any = d.productId;
                        const u: any = d.userId;
                        const username = typeof u === 'string' ? (users.find(us => us.id === u)?.username || u) : (u?.username || '');
                        const selTs = new Date(d.createdAt).getTime();
                        const bundle = demands.filter(dm => {
                          const sameUser = String((dm.userId as any)?._id || (dm.userId as any)?.id || dm.userId) === String((u?._id || u?.id || u));
                          const dt = Math.abs(new Date(dm.createdAt).getTime() - selTs);
                          return sameUser && dt <= 60000; // within 60 seconds window
                        });
                        const items = (bundle.length ? bundle : [d]).map((bd: any) => {
                          const bp: any = bd.productId;
                          const pid = typeof bp === 'string' ? bp : (bp?._id || bp?.id || '');
                          const fullProd: any = products.find(pr => (pr as any).id === pid);
                          const src = fullProd || (typeof bp === 'object' ? bp : null);
                          const name = src?.name || '';
                          const item = src?.itemNumber || '';
                          const price = typeof src?.sellingPrice === 'number' ? src.sellingPrice : (typeof fullProd?.sellingPrice === 'number' ? fullProd.sellingPrice : 0);
                          const qty = bd.quantity || 0;
                          return { item, name, price: Number(price || 0), qty, lineTotal: Number(price || 0) * qty };
                        });
                        const total = items.reduce((sum, it) => sum + it.lineTotal, 0);
                        const aoa: any[][] = [];
                        aoa.push(['Demand Report']);
                        aoa.push(['Date', new Date(d.createdAt).toLocaleString()]);
                        aoa.push(['User', username]);
                        aoa.push(['Notes', d.notes || '—']);
                        aoa.push([]);
                        aoa.push(['Item Number', 'Name', 'Unit Price', 'Quantity', 'Line Total']);
                        items.forEach(it => aoa.push([it.item, it.name, it.price, it.qty, it.lineTotal]));
                        aoa.push([]);
                        aoa.push(['Total', '', '', '', total]);
                        const ws = XLSX.utils.aoa_to_sheet(aoa);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Demand');
                        const fname = `demand_${(d._id || d.id || 'report')}.xlsx`;
                        XLSX.writeFile(wb, fname);
                      } catch (e) {
                        console.error('Excel export failed:', e);
                        alert('Failed to export Excel');
                      }
                    }}
                  >Export Excel</button>
                  {whatsappRecipients.length > 0 && (
                    <div className="inline-block relative group">
                      <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 inline-flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        Send to WhatsApp
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                        <div className="py-1">
                          {whatsappRecipients.map((recipient) => (
                            <button
                              key={recipient.id}
                              onClick={() => {
                                const cleanNumber = recipient.phone.replace(/[^\d]/g, '');
                                const d = selectedDemand as any;
                                const p: any = d.productId;
                                const u: any = d.userId;
                                const username = typeof u === 'string' ? (users.find(us => us.id === u)?.username || u) : (u?.username || '');
                                const selTs = new Date(d.createdAt).getTime();
                                const bundle = demands.filter(dm => {
                                  const sameUser = String((dm.userId as any)?._id || (dm.userId as any)?.id || dm.userId) === String((u?._id || u?.id || u));
                                  const dt = Math.abs(new Date(dm.createdAt).getTime() - selTs);
                                  return sameUser && dt <= 60000; // within 60 seconds window
                                });
                                const list = (bundle.length ? bundle : [d]).map((bd: any) => {
                                  const bp: any = bd.productId;
                                  const pid = typeof bp === 'string' ? bp : (bp?._id || bp?.id || '');
                                  const fullProd: any = products.find(pr => (pr as any).id === pid);
                                  const src = fullProd || (typeof bp === 'object' ? bp : null);
                                  const name = src?.name || '';
                                  const item = src?.itemNumber || '';
                                  const price = typeof src?.sellingPrice === 'number' ? src.sellingPrice : (typeof fullProd?.sellingPrice === 'number' ? fullProd.sellingPrice : 0);
                                  const qty = bd.quantity || 0;
                                  return { item, name, price: Number(price || 0), qty };
                                });
                                const total = list.reduce((sum, it) => sum + (it.price * it.qty), 0);
                                const lines = [
                                  'Demand Report',
                                  `Date: ${new Date(d.createdAt).toLocaleString()}`,
                                  `User: ${username}`,
                                  '',
                                  'Items:',
                                  ...list.map(it => `- ${it.item} • ${it.name} • x${it.qty} • $${it.price.toFixed(2)}`),
                                  '',
                                  `Total (est): $${total.toFixed(2)}`,
                                  `Notes: ${d.notes || '—'}`
                                ];
                                const text = encodeURIComponent(lines.join('\n'));
                                const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${text}`;
                                window.open(whatsappUrl, '_blank');
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Send to {recipient.name || recipient.phone}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {String((selectedDemand as any).status || 'pending').toLowerCase() === 'pending' && (
                <>
                  <button
                    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                    onClick={async () => {
                      const d = selectedDemand as any;
                      const bp: any = d.productId;
                      const pid = typeof bp === 'string' ? bp : (bp?._id || bp?.id || '');
                      const fullProd: any = products.find(pr => (pr as any).id === pid);
                      const currentStock = typeof fullProd?.stock === 'number' ? fullProd.stock : 0;
                      const qty = d.quantity || 0;
                      if (currentStock < qty) {
                        const proceed = window.confirm('This item is out of stock. Approve the demand anyway?');
                        if (!proceed) return;
                      }
                      const ok = await updateDemandStatus((d.id || d._id), 'confirmed');
                      if (ok) {
                        // Stock update is handled server-side on confirmation; refresh UI only
                        await fetchData();
                        setSelectedDemand(null);
                      }
                    }}
                  >Confirm</button>
                  <button
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={async () => {
                      const ok = await updateDemandStatus((selectedDemand as any).id || (selectedDemand as any)._id, 'rejected');
                      if (ok) { await fetchData(); setSelectedDemand(null); }
                    }}
                  >Reject</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default DemandsPage;


