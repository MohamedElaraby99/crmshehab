
import React, { useState, useRef, useEffect } from 'react';
import { Order } from '../types';
import OrderRow from './OrderRow';
import * as XLSX from 'xlsx';

interface OrderTableProps {
  orders: Order[];
  onUpdateOrder?: (order: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  onViewHistory?: (itemNumber: string) => void;
  userIsAdmin: boolean;
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onUpdateOrder, onDeleteOrder, onViewHistory, userIsAdmin }) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchType, setSearchType] = useState<'invoiceNumber' | 'itemCount' | 'all'>('all');
  const tableRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const scrollPositionRef = useRef<{ scrollTop: number; scrollLeft: number }>({ scrollTop: 0, scrollLeft: 0 });

  // Excel-like column configuration with widths
  const allColumns = [
    { key: 'itemImage', label: 'ITEM IMAGE', width: 120, type: 'image' },
    { key: 'itemNumber', label: 'ITEM NUMBER', width: 150, type: 'text' },
    { key: 'quantity', label: 'QTY', width: 80, type: 'number' },
    { key: 'price', label: 'PRICE', width: 100, type: 'number' },
    { key: 'total', label: 'TOTAL', width: 110, type: 'number' },
    { key: 'priceApprovalStatus', label: 'PRICE APPROVAL', width: 130, type: 'select' },
    { key: 'confirmFormShehab', label: 'CONFIRM FORM SHEHAB ', width: 150, type: 'date' },
    { key: 'estimatedDateReady', label: 'EST. DATE READY', width: 140, type: 'date' },
    { key: 'invoiceNumber', label: 'INVOICE #', width: 120, type: 'text' },
    { key: 'transferAmount', label: 'TRANSFER AMT', width: 120, type: 'currency' },
    { key: 'shippingDateToAgent', label: 'SHIP TO AGENT', width: 140, type: 'date' },
    { key: 'shippingDateToSaudi', label: 'SHIP TO SAUDI', width: 140, type: 'date' },
    { key: 'arrivalDate', label: 'ARRIVAL DATE', width: 120, type: 'date' },
    { key: 'notes', label: 'NOTES', width: 200, type: 'text' },
    { key: 'status', label: 'STATUS', width: 100, type: 'text' },
    { key: 'actions', label: 'ACTIONS', width: 120, type: 'actions' }
  ];

  // Filter columns based on user role - vendors don't see actions column
  const columns = userIsAdmin ? allColumns : allColumns.filter(col => col.key !== 'actions');

  // Ensure orders is always an array
  const safeOrders = Array.isArray(orders) ? orders : [];
  
  // Preserve scroll position during updates
  useEffect(() => {
    const table = tableRef.current;
    if (table) {
      // Save current scroll position before any updates
      const handleScroll = () => {
        scrollPositionRef.current = {
          scrollTop: table.scrollTop,
          scrollLeft: table.scrollLeft
        };
      };
      
      table.addEventListener('scroll', handleScroll);
      
      return () => {
        table.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Restore scroll position after updates
  useEffect(() => {
    const table = tableRef.current;
    if (table && scrollPositionRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        table.scrollTop = scrollPositionRef.current.scrollTop;
        table.scrollLeft = scrollPositionRef.current.scrollLeft;
      });
    }
  }, [orders]);

  // Search functionality
  const filterOrders = (orders: Order[]) => {
    if (!searchTerm.trim()) {
      return orders;
    }

    const term = searchTerm.toLowerCase().trim();
    
    return orders.filter(order => {
      switch (searchType) {
        case 'invoiceNumber':
          return order.invoiceNumber?.toLowerCase().includes(term) || false;
        case 'itemCount':
          const itemCount = order.items?.length || 0;
          return itemCount.toString().includes(term) || false;
        case 'all':
        default:
          // Search in multiple fields
          const invoiceMatch = order.invoiceNumber?.toLowerCase().includes(term) || false;
          const itemCountMatch = (order.items?.length || 0).toString().includes(term);
          const orderNumberMatch = order.orderNumber?.toLowerCase().includes(term) || false;
          const itemNumberMatch = order.items?.some(item => 
            item.itemNumber?.toLowerCase().includes(term) || false
          ) || false;
          const notesMatch = order.notes?.toLowerCase().includes(term) || false;
          
          return invoiceMatch || itemCountMatch || orderNumberMatch || itemNumberMatch || notesMatch;
      }
    });
  };

  // Excel-like row numbers
  const addRowNumbers = (orders: Order[]) => {
    return orders.map((order, index) => ({
      ...order,
      rowNumber: index + 1
    }));
  };

  const filteredOrders = filterOrders(safeOrders);
  const numberedOrders = addRowNumbers(filteredOrders);

  // Sorting functionality
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Select all functionality
  const handleSelectAll = () => {
    if (selectedRows.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredOrders.map(order => order.id)));
    }
  };

  // Row selection
  const handleRowSelect = (orderId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedRows(newSelected);
  };

  // Bulk actions
  const handleBulkDelete = () => {
    if (selectedRows.size > 0 && window.confirm(`Delete ${selectedRows.size} selected orders?`)) {
      if (onDeleteOrder) {
        selectedRows.forEach(orderId => onDeleteOrder(orderId));
      }
      setSelectedRows(new Set());
    }
  };

  // Excel export functionality
  const handleExportExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredOrders.map(order => {
        const vendorName = typeof order.vendorId === 'string' ? 'Unknown Vendor' : order.vendorId?.name || 'Unknown Vendor';
        const item = order.items[0];
        
        return {
          'Order Number': order.orderNumber,
          'Vendor': vendorName,
          'Item Number': item?.itemNumber || '',
          'Product Name': item?.productId?.name || '',
          'Quantity': item?.quantity || 0,
          'Unit Price': item?.unitPrice || 0,
          'Total Amount': order.totalAmount || 0,
          'Status': order.status,
          'Order Date': new Date(order.orderDate).toLocaleDateString(),
          'Confirm Form Shehab': order.confirmFormShehab || '',
          'Estimated Date Ready': order.estimatedDateReady || '',
          'Invoice Number': order.invoiceNumber || '',
          'Transfer Amount': order.transferAmount || '',
          'Shipping Date To Agent': order.shippingDateToAgent || '',
          'Shipping Date To Saudi': order.shippingDateToSaudi || '',
          'Arrival Date': order.arrivalDate || '',
          'Notes': order.notes || ''
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 15 }, // Order Number
        { wch: 20 }, // Vendor
        { wch: 12 }, // Item Number
        { wch: 25 }, // Product Name
        { wch: 8 },  // Quantity
        { wch: 12 }, // Unit Price
        { wch: 12 }, // Total Amount
        { wch: 12 }, // Status
        { wch: 12 }, // Order Date
        { wch: 18 }, // Confirm Form Shehab
        { wch: 18 }, // Estimated Date Ready
        { wch: 15 }, // Invoice Number
        { wch: 15 }, // Transfer Amount
        { wch: 20 }, // Shipping Date To Agent
        { wch: 20 }, // Shipping Date To Saudi
        { wch: 15 }, // Arrival Date
        { wch: 30 }  // Notes
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `orders_export_${currentDate}.xlsx`;

      // Export file
      XLSX.writeFile(workbook, filename);

      console.log(`✅ Exported ${exportData.length} orders to ${filename}`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
      {/* Excel-like toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 px-4 py-2">
        {/* Top row - Search and Orders count */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Orders:</span>
              <span className="text-sm text-gray-600">
                {filteredOrders.length} of {safeOrders.length}
              </span>
              {searchTerm && (
                <span className="text-xs text-blue-600">(filtered)</span>
              )}
            </div>
            {selectedRows.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-blue-600">{selectedRows.size} selected</span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete Selected
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleExportExcel}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 flex items-center space-x-1"
              title="Export filtered orders to Excel"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>
        
        {/* Search row */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Search:</span>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'invoiceNumber' | 'itemCount' | 'all')}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value="all">All Fields</option>
              <option value="invoiceNumber">Invoice Number</option>
              <option value="itemCount">Number of Items</option>
            </select>
            <input
              type="text"
              placeholder={
                searchType === 'invoiceNumber' 
                  ? 'Search by invoice number...' 
                  : searchType === 'itemCount'
                  ? 'Search by number of items...'
                  : 'Search orders...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs border border-gray-300 rounded px-3 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Excel-like table */}
      <div 
        ref={tableRef}
        className="overflow-auto max-h-96"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-300">
              {/* Row number column */}
              <th className="w-12 h-8 border border-gray-300 bg-gray-100 text-center text-xs font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredOrders.length && filteredOrders.length > 0}
                  onChange={handleSelectAll}
                  className="w-3 h-3"
                />
              </th>
              {/* Data columns */}
              {columns.map(column => (
                <th
                  key={column.key}
                  className="border border-gray-300 bg-gray-100 text-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-150 select-none"
                  style={{ width: column.width, minWidth: column.width }}
                  onClick={() => column.key !== 'actions' && handleSort(column.key)}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>{column.label}</span>
                    {sortConfig?.key === column.key && (
                      <span className="text-xs">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numberedOrders.map((order, index) => {
              // Get the ID from different possible fields
              const orderId = order.id || order._id;
              
              // Skip orders without valid IDs
              if (!orderId || orderId === 'undefined' || orderId === 'null') {
                console.warn('Skipping order without valid ID:', {
                  order,
                  index,
                  id: order.id,
                  _id: order._id,
                  orderNumber: order.orderNumber
                });
                return null;
              }
              
              // Ensure the order object has the id field
              const orderWithId = { ...order, id: orderId };
              
              return (
              <OrderRow 
                key={orderId} 
                order={orderWithId} 
                onUpdate={onUpdateOrder || (() => {})}
                onDelete={onDeleteOrder || (() => {})}
                onViewHistory={onViewHistory || (() => {})}
                userIsAdmin={userIsAdmin} 
                isSelected={selectedRows.has(orderId)}
                onSelect={() => handleRowSelect(orderId)}
                rowNumber={order.rowNumber}
                columns={columns}
                isEven={index % 2 === 0}
              />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Excel-like status bar */}
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-1 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Ready</span>
          <span>{safeOrders.length} orders</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderTable;