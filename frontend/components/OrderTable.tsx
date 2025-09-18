
import React, { useState } from 'react';
import { Order } from '../types';
import OrderRow from './OrderRow';
import Pagination from './Pagination';

interface OrderTableProps {
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
  onViewHistory: (itemNumber: string) => void;
  userIsAdmin: boolean;
}

const ITEMS_PER_PAGE = 10;

const OrderTable: React.FC<OrderTableProps> = ({ orders, onUpdateOrder, onDeleteOrder, onViewHistory, userIsAdmin }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentOrders = orders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const headers = [
    'ITEM NUMBER', 'Quantity', 'Price', 'Confirm form shehab', 'Estimated date to be ready', 
    'Invoice Number', 'Transfer Amount', 'Shipping date to the agent', 'Shipping date to Saudi Arabia', 
    'Arrive Date', 'Notes', 'Actions'
  ];

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map(header => (
                <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentOrders.map((order) => (
              <OrderRow 
                key={order.id} 
                order={order} 
                onUpdate={onUpdateOrder}
                onDelete={onDeleteOrder}
                onViewHistory={onViewHistory}
                userIsAdmin={userIsAdmin} 
              />
            ))}
          </tbody>
        </table>
      </div>
       {orders.length === 0 && <p className="text-center py-4 text-gray-500">No orders found.</p>}
      {orders.length > ITEMS_PER_PAGE && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={orders.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  );
};

export default OrderTable;