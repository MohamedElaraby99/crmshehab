import React, { useEffect, useState } from 'react';
import { createWhatsAppRecipient, deleteWhatsAppRecipient, getWhatsAppRecipients, WhatsAppRecipient } from '../services/api';

interface PageProps { onLogout: () => void }

const WhatsAppRecipientsPage: React.FC<PageProps> = ({ onLogout }) => {
  const [list, setList] = useState<WhatsAppRecipient[]>([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getWhatsAppRecipients();
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    const created = await createWhatsAppRecipient({ phone: phone.trim(), name: name.trim() || undefined });
    if (created) {
      setPhone(''); setName('');
      await load();
    } else {
      alert('Failed to add phone');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this number?')) return;
    const ok = await deleteWhatsAppRecipient(id);
    if (ok) await load(); else alert('Failed to delete');
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Recipients</h1>
          <p className="text-gray-600 text-sm">Numbers to receive PDF reports</p>
        </div>
        <button onClick={onLogout} className="px-3 py-2 rounded bg-gray-800 text-white text-sm">Logout</button>
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <form onSubmit={onAdd} className="flex items-end space-x-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g. +9665xxxxxxx" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="Contact name" />
          </div>
          <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white">Add</button>
        </form>
      </div>

      <div className="bg-white shadow rounded">
        <div className="px-4 py-3 border-b">
          <div className="text-sm text-gray-700">Total: {list.length}</div>
        </div>
        {loading ? (
          <div className="p-6 text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {list.map(r => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm text-gray-900">{r.phone}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{r.name || '-'}</td>
                    <td className="px-6 py-3 text-sm text-right">
                      <button onClick={() => onDelete(r.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={3}>No recipients yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppRecipientsPage;
