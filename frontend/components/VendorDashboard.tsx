import React, { useState, useEffect } from 'react';
import { Vendor, Order } from '../types';
import { getVendorById, getOrdersByVendorId, updateOrder as apiUpdateOrder, getAllOrders, updateVendorByVendor } from '../services/api';
import OrderTable from './OrderTable';
import ProductHistoryModal from './ProductHistoryModal';
import DynamicOrderForm from './DynamicOrderForm';

interface VendorDashboardProps {
  user: Vendor;
  onLogout: () => void;
  onUpdateVendor: (vendor: Vendor) => void;
}

const VendorDashboard: React.FC<VendorDashboardProps> = ({ user, onLogout, onUpdateVendor }) => {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [vendorData, vendorOrders, allOrdersData] = await Promise.all([
        getVendorById(user.id),
        getOrdersByVendorId(user.id),
        getAllOrders()
      ]);
      setVendor(vendorData || user);
      setOrders(vendorOrders);
      setAllOrders(allOrdersData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      // Optimistic update - update the local state immediately
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );
      setAllOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );
      
      // Then make the API call
      const updated = await apiUpdateOrder(updatedOrder.id, updatedOrder);
      
      // Only refresh if there was an error (to sync with server state)
      // This prevents unnecessary full refreshes
    } catch (error) {
      console.error('Failed to update order:', error);
      // Revert optimistic update on error
      await fetchDashboardData();
    }
  };
  
  const handleDeleteOrder = (orderId: string) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    console.log(`Order ${orderId} deleted.`);
  };

  const handleViewHistory = (itemNumber: string) => {
    setSelectedProduct(itemNumber);
  };

  const handleUpdateVendor = async (updatedVendor: Vendor) => {
    try {
      const updated = await updateVendorByVendor(updatedVendor.id, updatedVendor);
      if (updated) {
        onUpdateVendor(updated);
        setVendor(updated);
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Failed to update vendor:', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {vendor?.name}
          </h1>
          <p className="mt-2 text-gray-600">Manage your orders</p>
        </div>

      

        {/* Orders Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Related Orders</h3>
            </div>
            <OrderTable 
              orders={orders} 
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              onViewHistory={handleViewHistory}
              userIsAdmin={false}
            />
          </div>
        </div>
      </div>

      {/* Product History Modal */}
      {selectedProduct && (() => {
        // Find product information from orders
        const productOrders = allOrders.filter(order => 
          order.items?.some(item => item.itemNumber === selectedProduct)
        );
        
        if (productOrders.length === 0) return null;
        
        const firstItem = productOrders[0].items.find(item => item.itemNumber === selectedProduct);
        if (!firstItem) return null;
        
        // Convert orders to ProductPurchase format
        const purchases = productOrders.map(order => ({
          id: order.id,
          productId: firstItem.productId.id,
          vendorId: typeof order.vendorId === 'string' ? order.vendorId : order.vendorId._id,
          vendorName: typeof order.vendorId === 'string' ? 'Unknown' : order.vendorId.name,
          quantity: firstItem.quantity,
          price: firstItem.unitPrice,
          totalAmount: firstItem.totalPrice,
          purchaseDate: order.orderDate,
          orderId: order.id,
          notes: order.notes
        }));
        
        return (
          <ProductHistoryModal
            productId={firstItem.productId.id}
            productName={firstItem.productId.name}
            purchases={purchases}
            onClose={() => setSelectedProduct(null)}
          />
        );
      })()}

      {/* Vendor Edit Modal */}
      {showEditModal && vendor && (
        <VendorEditModal
          vendor={vendor}
          onSave={handleUpdateVendor}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

// Vendor Edit Modal Component
interface VendorEditModalProps {
  vendor: Vendor;
  onSave: (vendor: Vendor) => void;
  onClose: () => void;
}

const VendorEditModal: React.FC<VendorEditModalProps> = ({ vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: vendor.name,
    contactPerson: vendor.contactPerson,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    city: vendor.city,
    country: vendor.country,
    status: vendor.status
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...vendor, ...formData });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Edit Vendor Information
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
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
                required
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
                required
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
                required
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
                required
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
                  required
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
                  required
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
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
