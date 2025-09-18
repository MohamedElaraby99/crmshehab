
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

  const fetchDashboardData = useCallback(() => {
    setLoading(true);
    if (user.isSupplier && user.supplierId) {
      const supplierData = getSupplierById(user.supplierId);
      setSupplier(supplierData || null);
      if (supplierData) {
        setOrders(getOrdersBySupplierId(supplierData.id));
      }
    } else if (!user.isSupplier) { // Admin user
      setSupplier({id: 'admin', name: 'Admin View', userId: user.id});
      setOrders(getAllOrders());
    }
    setAllOrders(getAllOrders());
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleUpdateOrder = (updatedOrder: Order) => {
    apiUpdateOrder(updatedOrder);
    // Refresh data
    fetchDashboardData();
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

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {supplier?.name || user.username}
          </h1>
          <p className="mt-2 text-gray-600">Manage your orders and track their progress</p>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Orders</h2>
        <OrderTable 
          orders={orders} 
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleDeleteOrder}
          onViewHistory={handleViewHistory}
          userIsAdmin={!user.isSupplier}
        />
      </div>

      {selectedProduct && (
        <ProductHistoryModal
          itemNumber={selectedProduct}
          allOrders={allOrders}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};

export default SupplierDashboard;