import React, { useState, useEffect } from 'react';
import { Vendor } from '../types';
import { getAllVendors, createVendor, updateVendor, deleteVendor, updateVendorCredentials } from '../services/api';

interface VendorsPageProps {
  onLogout: () => void;
}

const VendorsPage: React.FC<VendorsPageProps> = ({ onLogout }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCredentials, setShowCredentials] = useState<Vendor | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const allVendors = await getAllVendors();
      console.log('Fetched vendors:', allVendors);
      setVendors(allVendors);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async (vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'username' | 'password' | 'userId'>) => {
    try {
      console.log('Creating vendor with data:', vendorData);
      const newVendor = await createVendor(vendorData);
      console.log('Created vendor response:', newVendor);
      if (newVendor) {
        // Add the new vendor to the existing list instead of refetching
        setVendors(prevVendors => [...prevVendors, newVendor]);
        setShowModal(false);
        setShowCredentials(newVendor);
      }
    } catch (error) {
      console.error('Failed to create vendor:', error);
    }
  };

  const handleUpdateVendor = async (vendorData: Vendor) => {
    try {
      console.log('Updating vendor with data:', vendorData);
      const updated = await updateVendor(vendorData.id, vendorData);
      console.log('Update response:', updated);
      if (updated) {
        console.log('Vendor updated successfully, refreshing list...');
        await fetchVendors();
        setShowModal(false);
        setEditingVendor(null);
      } else {
        console.error('Update returned null/undefined');
      }
    } catch (error) {
      console.error('Failed to update vendor:', error);
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        const deleted = await deleteVendor(id);
        if (deleted) {
          await fetchVendors();
        }
      } catch (error) {
        console.error('Failed to delete vendor:', error);
      }
    }
  };

  const handleUpdateCredentials = async (vendorId: string, credentials: { username?: string; password?: string }) => {
    try {
      console.log('Updating vendor credentials:', vendorId, credentials);
      const updated = await updateVendorCredentials(vendorId, credentials);
      if (updated) {
        console.log('Credentials updated successfully');
        await fetchVendors(); // Refresh the vendor list
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update vendor credentials:', error);
      return false;
    }
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setShowModal(true);
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="p-8 text-center">Loading vendors...</div>;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors Management</h1>
            <p className="mt-2 text-gray-600">Manage your vendor relationships and contact information</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Vendor
          </button>
        </div>
        {/* Filters */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Vendors
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, contact person, or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendors Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Vendors ({filteredVendors.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Login Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                         
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">{vendor.contactPerson}</div>
                          <div className="text-sm text-gray-500">{vendor.email}</div>
                          <div className="text-sm text-gray-500">{vendor.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">{vendor.city}, {vendor.country}</div>
                          <div className="text-sm text-gray-500">{vendor.address}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vendor.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {vendor.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">Username: {vendor.username}</div>
                          <button
                            onClick={() => setShowCredentials(vendor)}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            View Password
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditVendor(vendor)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVendor(vendor.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredVendors.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No vendors found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vendor Modal */}
      {showModal && (
        <VendorModal
          vendor={editingVendor}
          onSave={editingVendor ? handleUpdateVendor : handleCreateVendor}
          onClose={() => {
            setShowModal(false);
            setEditingVendor(null);
          }}
        />
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <CredentialsModal
          vendor={showCredentials}
          onClose={() => setShowCredentials(null)}
          onUpdateCredentials={handleUpdateCredentials}
        />
      )}
    </div>
  );
};

// Vendor Modal Component
interface VendorModalProps {
  vendor: Vendor | null;
  onSave: (vendor: any) => void;
  onClose: () => void;
}

const VendorModal: React.FC<VendorModalProps> = ({ vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    contactPerson: vendor?.contactPerson || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    city: vendor?.city || '',
    country: vendor?.country || '',
    status: vendor?.status || 'active' as 'active' | 'inactive'
  });

  // Update form data when vendor prop changes
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        contactPerson: vendor.contactPerson || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        city: vendor.city || '',
        country: vendor.country || '',
        status: vendor.status || 'active'
      });
    } else {
      // Reset form for new vendor
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        status: 'active'
      });
    }
  }, [vendor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('VendorModal handleSubmit - vendor:', vendor);
    console.log('VendorModal handleSubmit - formData:', formData);
    
    if (vendor) {
      // For updates, only send the form data with the vendor ID
      const updateData = { id: vendor.id, ...formData };
      console.log('VendorModal sending update data:', updateData);
      onSave(updateData);
    } else {
      // For creation, send the form data as is
      console.log('VendorModal sending create data:', formData);
      onSave(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {vendor ? 'Edit Vendor' : 'Add New Vendor'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vendor Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {vendor ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Credentials Modal Component
interface CredentialsModalProps {
  vendor: Vendor;
  onClose: () => void;
  onUpdateCredentials: (vendorId: string, credentials: { username?: string; password?: string }) => Promise<boolean>;
}

const CredentialsModal: React.FC<CredentialsModalProps> = ({ vendor, onClose, onUpdateCredentials }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: vendor.username,
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({
      username: vendor.username,
      password: ''
    });
    setMessage(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      username: vendor.username,
      password: ''
    });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editData.username.trim()) {
      setMessage({ type: 'error', text: 'Username is required' });
      return;
    }

    if (editData.password && editData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const credentials: { username?: string; password?: string } = {};
      
      if (editData.username !== vendor.username) {
        credentials.username = editData.username;
      }
      
      if (editData.password) {
        credentials.password = editData.password;
      }

      if (Object.keys(credentials).length === 0) {
        setMessage({ type: 'error', text: 'No changes to save' });
        setLoading(false);
        return;
      }

      const success = await onUpdateCredentials(vendor.id, credentials);
      
      if (success) {
        setMessage({ type: 'success', text: 'Credentials updated successfully!' });
        setIsEditing(false);
        setEditData({ username: editData.username, password: '' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update credentials' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update credentials' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Login Credentials
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Vendor Information</h4>
              <div className="text-sm text-blue-700">
                <div><strong>Name:</strong> {vendor.name}</div>
                <div><strong>Contact:</strong> {vendor.contactPerson}</div>
                <div><strong>Email:</strong> {vendor.email}</div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-green-800">Login Credentials</h4>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {message && (
                <div className={`mb-3 p-2 rounded text-xs ${
                  message.type === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-green-700 mb-1">Username</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={isEditing ? editData.username : vendor.username}
                      readOnly={!isEditing}
                      onChange={isEditing ? (e) => setEditData({...editData, username: e.target.value}) : undefined}
                      className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono ${
                        isEditing 
                          ? 'border-green-400 bg-white focus:ring-2 focus:ring-green-500' 
                          : 'border-green-300 bg-white'
                      }`}
                    />
                    {!isEditing && (
                      <button
                        onClick={() => copyToClipboard(vendor.username)}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-green-700 mb-1">Password</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type={isEditing ? "password" : (showPassword ? "text" : "password")}
                      value={isEditing ? editData.password : vendor.password}
                      readOnly={!isEditing}
                      onChange={isEditing ? (e) => setEditData({...editData, password: e.target.value}) : undefined}
                      placeholder={isEditing ? "Enter new password (leave blank to keep current)" : ""}
                      className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono ${
                        isEditing 
                          ? 'border-green-400 bg-white focus:ring-2 focus:ring-green-500' 
                          : 'border-green-300 bg-white'
                      }`}
                    />
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(vendor.password)}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          Copy
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditData({...editData, password: ''})}
                        className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                        title="Clear password"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {isEditing && (
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Important Notes</h4>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• Share these credentials securely with the vendor</li>
                <li>• Vendor can use these to log in to the system</li>
                <li>• Password should be changed on first login</li>
                <li>• Keep these credentials confidential</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorsPage;
