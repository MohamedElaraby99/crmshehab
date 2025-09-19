
import React, { useState, useEffect, useCallback } from 'react';
import { User, Order, Supplier } from '../types';
import { getSupplierById, getOrdersBySupplierId, updateOrder as apiUpdateOrder, getAllOrders } from '../services/api';
import OrderTable from './OrderTable';
import ProductHistoryModal from './ProductHistoryModal';

interface SupplierDashboardProps {
  user: User;
  onLogout: () => void;
}

const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ user, onLogout }) => {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      if (user.isSupplier && user.supplierId) {
        const supplierData = await getSupplierById(user.supplierId);
        setSupplier(supplierData || null);
        if (supplierData) {
          const supplierOrders = await getOrdersBySupplierId(supplierData.id);
          setOrders(supplierOrders);
        }
      } else if (!user.isSupplier) { // Admin user
        setSupplier({id: 'admin', name: 'Admin View', userId: user.id});
        const allOrdersData = await getAllOrders();
        setOrders(allOrdersData);
      }
      const allOrdersData = await getAllOrders();
      setAllOrders(allOrdersData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setOrders([]);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
      await apiUpdateOrder(updatedOrder.id, updatedOrder);
      
      // Only refresh if there was an error (to sync with server state)
      // This prevents unnecessary full refreshes
    } catch (error) {
      console.error('Error updating order:', error);
      // Revert optimistic update on error
      await fetchDashboardData();
    }
  };
  
  const handleDeleteOrder = (orderId: string) => {
    // In a real app, you would call an API to delete the order.
    // Here we just filter it out from the state.
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    console.log(`Order ${orderId} deleted.`);
  };

  const handleViewHistory = (itemNumber: string) => {
    setSelectedProduct(itemNumber);
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      // Find the order to update
      const orderToUpdate = orders.find(order => order.id === orderId);
      if (!orderToUpdate) {
        console.error('Order not found for confirmation');
        return;
      }

      // Update the order status to confirmed
      const updatedOrder = {
        ...orderToUpdate,
        status: 'confirmed' as const
      };

      await apiUpdateOrder(orderId, updatedOrder);
      
      // Refresh the data to show updated status
      await fetchDashboardData();
      
      console.log(`Order ${orderId} confirmed successfully`);
    } catch (error) {
      console.error('Error confirming order:', error);
    }
  };


  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {supplier?.name || user.username}
          </h1>
          <p className="mt-2 text-gray-600">Manage your orders </p>
        </div>

        {/* Orders Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Orders Management</h2>
                <p className="text-gray-600">View and manage all your orders</p>
              </div>
              <button 
                onClick={fetchDashboardData}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                disabled={loading}
              >
                <span>{loading ? 'Refreshing...' : 'Refresh Orders'}</span>
              </button>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <OrderTable 
                orders={orders} 
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onViewHistory={handleViewHistory}
                onConfirmOrder={handleConfirmOrder}
                userIsAdmin={!user.isSupplier}
              />
            </div>
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
    </div>
  );
};

export default SupplierDashboard;