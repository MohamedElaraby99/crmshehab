
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
  currencySymbol?: string;
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onUpdateOrder, onDeleteOrder, onViewHistory, userIsAdmin, currencySymbol: currencySymbolOverride }) => {
  const currencySymbol = currencySymbolOverride ?? (userIsAdmin ? '¥' : 'SR ');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchType, setSearchType] = useState<'invoiceNumber' | 'itemCount' | 'all'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const tableRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const scrollPositionRef = useRef<{ scrollTop: number; scrollLeft: number }>({ scrollTop: 0, scrollLeft: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Excel-like column configuration with widths
  const allColumns = [
    { key: 'itemImage', label: 'ITEM IMAGE', width: 120, type: 'image' },
    { key: 'itemNumber', label: 'ITEM NUMBER', width: 150, type: 'text' },
    { key: 'quantity', label: 'QTY', width: 80, type: 'number' },
    { key: 'price', label: 'PRICE', width: 100, type: 'number' },
    { key: 'total', label: 'TOTAL', width: 110, type: 'number' },
    { key: 'vendor', label: 'VENDOR', width: 150, type: 'text' },
    { key: 'itemPriceApprovalStatus', label: 'ITEM PRICE APPROVAL', width: 150, type: 'select' },
    { key: 'itemPriceApprovalRejectionReason', label: 'ITEM REJECTION REASON', width: 200, type: 'textarea' },
    { key: 'confirmFormShehab', label: 'CONFIRM FORM SHEHAB ', width: 150, type: 'date' },
    { key: 'estimatedDateReady', label: 'EST. DATE READY', width: 140, type: 'date' },
    { key: 'invoiceNumber', label: 'INVOICE #', width: 120, type: 'text' },
    { key: 'transferAmount', label: 'TRANSFER AMT', width: 120, type: 'currency' },
    { key: 'shippingDateToAgent', label: 'SHIP TO AGENT', width: 140, type: 'date' },
    { key: 'shippingDateToSaudi', label: 'SHIP TO SAUDI', width: 140, type: 'date' },
    { key: 'arrivalDate', label: 'ARRIVAL DATE', width: 120, type: 'date' },
    { key: 'notes', label: 'NOTES', width: 200, type: 'text' },
    { key: 'status', label: 'ITEM STATUS', width: 120, type: 'select' },
    { key: 'actions', label: 'ACTIONS', width: 120, type: 'actions' }
  ];

  // Filter columns based on user role - vendors don't see vendor column
  const columns = userIsAdmin ? allColumns : allColumns.filter(col => col.key !== 'vendor');

  // Ensure orders is always an array
  const safeOrders = Array.isArray(orders) ? orders : [];
  
  // Extract unique vendors for filter dropdown
  const getUniqueVendors = (orders: Order[]) => {
    const vendorMap = new Map();
    orders.forEach(order => {
      if (order.vendorId) {
        if (typeof order.vendorId === 'string') {
          // If vendorId is a string, use it as both ID and name
          vendorMap.set(order.vendorId, order.vendorId);
        } else if ((order.vendorId as any).name) {
          const vendorObj: any = order.vendorId;
          const vendorId = vendorObj.id || vendorObj._id;
          if (vendorId) {
            vendorMap.set(String(vendorId), vendorObj.name);
          }
        }
      }
    });
    
    const vendors = Array.from(vendorMap.entries()).map(([id, name]) => ({ id, name }));
    return vendors;
  };
  
  const uniqueVendors = getUniqueVendors(safeOrders);
  
  // Debug: Log sample order data to understand structure
  if (safeOrders.length > 0) {
  }
  
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

  // Update lastUpdated timestamp when orders change
  useEffect(() => {
    setLastUpdated(new Date());
  }, [orders]);

  // Real-time clock for admin users (updates every minute)
  useEffect(() => {
    if (!userIsAdmin) return;

    const updateTime = () => {
      setCurrentTime(new Date());
    };

    // Update immediately
    updateTime();

    // Set up interval to update every minute
    const interval = setInterval(updateTime, 60000); // 60000ms = 1 minute

    return () => {
      clearInterval(interval);
    };
  }, [userIsAdmin]);

  // Search and filter functionality
  const filterOrders = (orders: Order[]) => {
    let filteredOrders = orders;
    
    // Apply vendor filter first
    if (selectedVendor !== 'all') {
      filteredOrders = filteredOrders.filter(order => {
        let orderVendorId = null;
        let orderVendorName = null;
        
        if (typeof order.vendorId === 'string') {
          orderVendorId = order.vendorId;
          orderVendorName = order.vendorId;
        } else if (order.vendorId && (order.vendorId as any)) {
          const vendorObj: any = order.vendorId;
          orderVendorId = vendorObj.id || vendorObj._id;
          orderVendorName = vendorObj.name;
        }
        
        // Check both ID and name matches
        const idMatch = String(orderVendorId) === String(selectedVendor);
        const nameMatch = orderVendorName === selectedVendor;
        
        return idMatch || nameMatch;
      });
    }
    
    // Apply status filter (item-level: include order if any item matches)
    if (statusFilter !== 'all') {
      const st = statusFilter.toLowerCase();
      filteredOrders = filteredOrders.filter(order => {
        const items = order.items || [];
        return items.some(it => String(it.status || '').toLowerCase() === st);
      });
    }
    
    // Apply date range filter on orderDate
    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const toTs = dateTo ? new Date(dateTo).getTime() + 24*60*60*1000 - 1 : Infinity; // inclusive end day
      filteredOrders = filteredOrders.filter(order => {
        const od = (order as any).orderDate || (order as any).createdAt;
        const ts = od ? new Date(od).getTime() : 0;
        return ts >= fromTs && ts <= toTs;
      });
    }
    
    // Apply search filter
    if (!searchTerm.trim()) {
      return filteredOrders;
    }

    const term = searchTerm.toLowerCase().trim();
    
    return filteredOrders.filter(order => {
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
  
  // Flatten orders to show each item as a separate row
  const flattenedOrderItems = filteredOrders.flatMap((order, orderIndex) => {
    const orderId = order.id || (order as any)._id;
    if (!orderId || orderId === 'undefined' || orderId === 'null') {
      return [];
    }
    
    const items = order.items || [];
    
    if (items.length === 0) {
      // If no items, create a single row with empty item
      return [{
        ...order,
        id: orderId,
        itemIndex: 0,
        isFirstItem: true,
        isLastItem: true,
        totalItemsInOrder: 0,
        currentItem: null,
        orderRowNumber: orderIndex + 1,
        // Add a stable key to prevent React from losing track of the item
        stableKey: `${orderId}-0`
      }];
    }
    
    const flattenedItems = items.map((item, itemIndex) => {
      const flattenedItem = {
        ...order,
        id: orderId,
        itemIndex,
        isFirstItem: itemIndex === 0,
        isLastItem: itemIndex === items.length - 1,
        totalItemsInOrder: items.length,
        currentItem: item,
        orderRowNumber: orderIndex + 1,
        // Add a stable key to prevent React from losing track of the item
        stableKey: `${orderId}-${itemIndex}`
      };
    
      
      return flattenedItem;
    });

    return flattenedItems;
  });
  
  const numberedOrders = addRowNumbers(flattenedOrderItems);

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
    } catch (error) {
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
              {(searchTerm || selectedVendor !== 'all') && (
                <span className="text-xs text-blue-600">(filtered)</span>
              )}
            </div>
            {/* Legend for visual indicators */}
            <div className="flex items-center space-x-3 text-xs text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-l-4 border-l-green-500"></div>
                <span>Vendor completed</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-t-2 border-b-2 border-orange-400"></div>
                <span>Multi-item order</span>
              </div>
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

        
        
        {/* Search + Filters row */}
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Search:</span>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'invoiceNumber' | 'itemCount' | 'all')}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option key="all" value="all">All Fields</option>
              <option key="invoiceNumber" value="invoiceNumber">Invoice Number</option>
              <option key="itemCount" value="itemCount">Number of Items</option>
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
          
          {/* Vendor filter (admin only) */}
          {userIsAdmin && (
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <span className="text-sm font-medium text-gray-700">Vendor:</span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white min-w-40"
              >
                <option value="all">All Vendors</option>
                {uniqueVendors.map(vendor => (
                  <option key={`${vendor.id}-${vendor.name}`} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              {selectedVendor !== 'all' && (
                <button
                  onClick={() => setSelectedVendor('all')}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  title="Clear vendor filter"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Status filter (admin only) */}
          {userIsAdmin && (
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white min-w-32"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  title="Clear status filter"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          
          {/* Date range filter (admin only) */}
          {userIsAdmin && (
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <span className="text-sm font-medium text-gray-700">Date:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                title="From"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                title="To"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  title="Clear date filter"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {userIsAdmin && (
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <span>Current time: {currentTime.toLocaleTimeString()}</span>
            </div>
          )}


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
              const orderId = order.id || (order as any)._id;
              
              // Use the stable key if available, otherwise fall back to the old method
              const uniqueKey = (order as any).stableKey || `${orderId}-${(order as any).itemIndex || 0}-${index}`;
              
              // Ensure the order object has the id field
              const orderWithId = { ...order, id: orderId };
            
              
              return (
              <OrderRow 
                key={uniqueKey} 
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
                currencySymbol={currencySymbol}
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
      </div>
    </div>
  );
};

export default OrderTable;