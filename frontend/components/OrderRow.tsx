
import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import { SUPPLIER_EDITABLE_FIELDS, VENDOR_EDITABLE_ITEM_FIELDS } from '../data/mockData';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig } from '../data/orderFieldConfig';
import { uploadOrderImage, uploadOrderItemImage, getApiOrigin, updateOrder, confirmOrderItem, transferOrderItemQuantity } from '../services/api';

interface OrderRowProps {
  order: Order & { 
    rowNumber?: number;
    itemIndex?: number;
    isFirstItem?: boolean;
    isLastItem?: boolean;
    totalItemsInOrder?: number;
    currentItem?: any;
    orderRowNumber?: number;
  };
  onUpdate: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onViewHistory: (itemNumber: string) => void;
  userIsAdmin: boolean;
  isSelected: boolean;
  onSelect: () => void;
  rowNumber?: number;
  columns: Array<{ key: string; label: string; width: number; type: string }>;
  isEven: boolean;
  currencySymbol?: string;
}

// Excel-like editable cell
const EditableCell: React.FC<{ 
  value: string | number | null; 
  onChange: (newValue: string) => void; 
  isEditable: boolean; 
  userIsAdmin: boolean; 
  type?: string;
  width: number;
  isSelected: boolean;
  fieldName?: string;
}> = ({ value, onChange, isEditable, userIsAdmin, type = 'text', width, isSelected, fieldName }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  
  const cellClasses = `
    h-8 border border-gray-300 px-2 text-xs
    ${isSelected ? 'bg-blue-100' : 'bg-white'}
    ${isEditable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}
    ${!userIsAdmin && isEditable ? 'bg-green-50' : ''}
  `;

  const inputClasses = `
    w-full h-full border-none outline-none px-1 text-xs bg-transparent
    ${isSelected ? 'bg-blue-100' : 'bg-white'}
  `;

  const handleClick = () => {
    if (isEditable && !isEditing) {
      setIsEditing(true);
      // For date fields, format the value properly
      if (type === 'date' && value) {
        const dateValue = new Date(value as string);
        if (!isNaN(dateValue.getTime())) {
          setEditValue(dateValue.toISOString().split('T')[0]);
        } else {
          setEditValue(String(value ?? ''));
        }
      } else {
        setEditValue(String(value ?? ''));
      }
    }
  };

  const handleCellClick = (e: React.MouseEvent) => {
    // Prevent cell click when already editing
    if (isEditing) {
      e.stopPropagation();
    } else {
      handleClick();
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== String(value ?? '')) {
      onChange(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault(); // Prevent form submission only for non-textarea fields
      handleBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(String(value ?? ''));
    }
    // For textarea, allow Enter key for new lines
    // For other input types, allow normal typing
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling
    
    setEditValue(e.target.value);
    // For select elements, immediately save the change
    onChange(e.target.value);
    setIsEditing(false);
    return false; // Additional prevention
    
    // Test: Send only the priceApprovalStatus field
    
    const testUpdate = { priceApprovalStatus: e.target.value };
    
  };

  const handleSelectBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    // Only blur if the focus is moving outside the select element
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      handleBlur();
    }
  };

  // Format display value for date fields
  const formatDisplayValue = (val: string | number | null, fieldType: string) => {
    if (!val) return '';
    if (fieldType === 'date' && val) {
      const dateValue = new Date(val as string);
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toLocaleDateString();
      }
    }
    return String(val);
  };

  // Get color classes for status-like fields
  const getStatusColorClasses = (value: string | number | null) => {
    const status = String(value).toLowerCase();
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (!isEditable && !isEditing) {
    // Apply color coding for item price approval status field
    const statusClasses = fieldName === 'itemPriceApprovalStatus' ? getStatusColorClasses(value) : '';
    const finalCellClasses = fieldName === 'itemPriceApprovalStatus' 
      ? `${cellClasses} ${statusClasses} font-medium rounded` 
      : cellClasses;
    
    return (
      <td 
        className={finalCellClasses}
        style={{ width, minWidth: width }}
      >
        <div className="flex items-center h-full">
          {formatDisplayValue(value, type)}
        </div>
      </td>
    );
  }

  // Apply color coding for item price approval status field when editing
  const statusClasses = fieldName === 'itemPriceApprovalStatus' ? getStatusColorClasses(value) : '';
  const finalCellClasses = fieldName === 'itemPriceApprovalStatus' 
    ? `${cellClasses} ${statusClasses} font-medium rounded` 
    : cellClasses;

  return (
    <td 
      className={finalCellClasses}
      style={{ width, minWidth: width }}
      onClick={handleCellClick}
    >
      {isEditing ? (
        type === 'select' ? (
          <select
            value={editValue}
            onChange={handleSelectChange}
            onBlur={handleSelectBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={inputClasses}
            autoFocus
          >
            {fieldName === 'itemStatus' || fieldName === 'status' ? (
              <>
                <option key="pending" value="pending">PENDING</option>
                <option key="confirmed" value="confirmed">CONFIRMED</option>
                <option key="shipped" value="shipped">SHIPPED</option>
                <option key="delivered" value="delivered">DELIVERED</option>
                <option key="cancelled" value="cancelled">CANCELLED</option>
              </>
            ) : (
              <>
                <option key="pending" value="pending">PENDING</option>
                <option key="approved" value="approved">APPROVED</option>
                <option key="rejected" value="rejected">REJECTED</option>
              </>
            )}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`${inputClasses} resize-none`}
            rows={3}
            autoFocus
          />
        ) : (
          <input
              type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputClasses}
            autoFocus
          />
        )
      ) : (
        <div className="flex items-center h-full">
          {formatDisplayValue(value, type).toString().toUpperCase()}
        </div>
      )}
    </td>
  );
};


const OrderRow: React.FC<OrderRowProps> = ({ 
  order, 
  onUpdate, 
  onDelete, 
  onViewHistory, 
  userIsAdmin, 
  isSelected, 
  onSelect, 
  rowNumber, 
  columns, 
  isEven,
  currencySymbol = '$' 
}) => {
  const [editableOrder, setEditableOrder] = useState<Order>(order);
  const [fieldConfigs, setFieldConfigs] = useState<OrderFieldConfig[]>(ORDER_FIELD_CONFIGS);

  // Update editableOrder when the order prop changes (e.g., when items are deleted)
  useEffect(() => {
    setEditableOrder(order);
  }, [order]);

  // Load saved field configurations
  useEffect(() => {
    const savedConfigs = localStorage.getItem('orderFieldConfigs');
    
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs);
        setFieldConfigs(parsed);
      } catch (error) {
        console.error('Error loading field configurations:', error);
        setFieldConfigs(ORDER_FIELD_CONFIGS);
      }
    } else {
      setFieldConfigs(ORDER_FIELD_CONFIGS);
    }
  }, []);

  // Sync local state with incoming order prop
  useEffect(() => {
    setEditableOrder(order);
  }, [order]);

  const canEditField = (fieldName: keyof Order | 'itemPriceApprovalStatus' | 'itemPriceApprovalRejectionReason'): boolean => {
    if (userIsAdmin) {
      return true;
    }
    
    // Special logic for vendors when price approval is rejected
    if (!userIsAdmin && currentItem?.priceApprovalStatus === 'rejected') {
      // When price is rejected, vendors can ONLY edit the price field
      return fieldName === 'price';
    }
    
    // Use dynamic configuration if available, fallback to static config
    const fieldConfig = fieldConfigs.find(config => config.name === fieldName);
    
    if (fieldConfig) {
      const isEditable = fieldConfig.editableBy === 'vendor' || fieldConfig.editableBy === 'both';
      return isEditable;
    }
    
    // Fallback to static configuration - check both order-level and item-level fields
    const orderLevelResult = SUPPLIER_EDITABLE_FIELDS.includes(fieldName as any);
    const itemLevelResult = VENDOR_EDITABLE_ITEM_FIELDS.includes(fieldName as any);
    const fallbackResult = orderLevelResult || itemLevelResult;
    
    return fallbackResult;
  };

  const handleChange = (field: string, value: string) => {      
    // Prevent non-admins from changing protected fields
    if (!canEditField(field as any)) {
      return;
    }

    let parsedValue: string | number | null = value;
    if (field === 'transferAmount') {
        parsedValue = value === '' ? null : parseFloat(value);
        if(isNaN(parsedValue as number)) parsedValue = 0;
    }
    
    // Handle special cases for fields that might be in the order or items
    let updatedOrder = { ...editableOrder };
    
    if (field === 'quantity' || field === 'price' || field === 'itemPriceApprovalStatus' || field === 'itemStatus' || field === 'status' || field === 'itemNotes' || field === 'itemEstimatedDateReady' || field === 'itemPriceApprovalRejectionReason') {
      // Update the correct item based on currentItem or itemIndex
      const currentItem = order.currentItem || (updatedOrder.items && updatedOrder.items[order.itemIndex || 0] ? updatedOrder.items[order.itemIndex || 0] : null);
      const itemIndex = order.itemIndex || 0;
      
      if (updatedOrder.items && updatedOrder.items[itemIndex]) {
        if (field === 'quantity') {
          const numValue = value === '' ? 0 : parseFloat(value);
          updatedOrder.items[itemIndex].quantity = isNaN(numValue) ? 0 : numValue;
          updatedOrder.items[itemIndex].totalPrice = updatedOrder.items[itemIndex].quantity * updatedOrder.items[itemIndex].unitPrice;
        } else if (field === 'price') {
          const numValue = value === '' ? 0 : parseFloat(value);
          updatedOrder.items[itemIndex].unitPrice = isNaN(numValue) ? 0 : numValue;
          updatedOrder.items[itemIndex].totalPrice = updatedOrder.items[itemIndex].quantity * updatedOrder.items[itemIndex].unitPrice;
          
          // Only update order-level price for single item orders
          if (updatedOrder.items.length === 1) {
            updatedOrder.price = numValue;
          }
          // For multi-item orders, don't update the order-level price
        } else if (field === 'itemPriceApprovalStatus') {
          updatedOrder.items[itemIndex].priceApprovalStatus = String(parsedValue) as 'pending' | 'approved' | 'rejected';
        } else if (field === 'itemStatus' || field === 'status') {
          updatedOrder.items[itemIndex].status = String(parsedValue) as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
        } else if (field === 'itemNotes') {
          updatedOrder.items[itemIndex].notes = String(parsedValue);
        } else if (field === 'itemEstimatedDateReady') {
          updatedOrder.items[itemIndex].estimatedDateReady = String(parsedValue);
        } else if (field === 'itemPriceApprovalRejectionReason') {
          updatedOrder.items[itemIndex].priceApprovalRejectionReason = String(parsedValue);
        } else if (field === 'confirmFormShehab') {
          (updatedOrder.items[itemIndex] as any).confirmFormShehab = String(parsedValue);
        } else if (field === 'estimatedDateReady') {
          (updatedOrder.items[itemIndex] as any).estimatedDateReady = String(parsedValue);
        } else if (field === 'invoiceNumber') {
          (updatedOrder.items[itemIndex] as any).invoiceNumber = String(parsedValue);
        } else if (field === 'transferAmount') {
          (updatedOrder.items[itemIndex] as any).transferAmount = parsedValue;
        } else if (field === 'shippingDateToAgent') {
          (updatedOrder.items[itemIndex] as any).shippingDateToAgent = String(parsedValue);
        } else if (field === 'shippingDateToSaudi') {
          (updatedOrder.items[itemIndex] as any).shippingDateToSaudi = String(parsedValue);
        } else if (field === 'arrivalDate') {
          (updatedOrder.items[itemIndex] as any).arrivalDate = String(parsedValue);
        } else if (field === 'notes') {
          (updatedOrder.items[itemIndex] as any).notes = String(parsedValue);
        }
        // Recalculate total amount
        updatedOrder.totalAmount = updatedOrder.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      }
      
    } else {
      // Regular field update
      updatedOrder = { ...editableOrder, [field]: String(parsedValue) };
    }
    
    // For item-level fields, send only the specific field that changed with item index
    if (field.startsWith('item') || field === 'price' || field === 'quantity' || field === 'status' || field === 'confirmFormShehab' || field === 'estimatedDateReady' || field === 'invoiceNumber' || field === 'transferAmount' || field === 'shippingDateToAgent' || field === 'shippingDateToSaudi' || field === 'arrivalDate' || field === 'notes') {
      // Map frontend field names to backend field names
      let backendFieldName = field;
      if (field === 'price') {
        backendFieldName = 'unitPrice';
      } else if (field === 'itemPriceApprovalStatus') {
        backendFieldName = 'priceApprovalStatus';
      } else if (field === 'itemStatus' || field === 'status') {
        backendFieldName = 'status';
      } else if (field === 'itemNotes') {
        backendFieldName = 'notes';
      } else if (field === 'itemEstimatedDateReady') {
        backendFieldName = 'estimatedDateReady';
      } else if (field === 'itemPriceApprovalRejectionReason') {
        backendFieldName = 'priceApprovalRejectionReason';
      }
      
      // Create a partial order with the ID, item index, and the changed field
      const partialUpdate = { 
        id: editableOrder.id,
        itemIndex: itemIndex,
        [backendFieldName]: parsedValue
      };
      
      // Update the local state for item-level fields FIRST
      setEditableOrder(updatedOrder);
      
      // Then send the update to parent
      onUpdate(partialUpdate as any);
    } else {
      // For non-item fields, update the full order
      setEditableOrder(updatedOrder);
      // For vendor updates, send only the specific field that changed
      if (!userIsAdmin) {
        // Create a minimal update object with only the changed field and order ID
        const vendorUpdate = {
          id: editableOrder.id,
          [field]: parsedValue
        };
        
        onUpdate(vendorUpdate as any);
      } else {
        onUpdate(updatedOrder);
      }
    }
  };

  const handleDeleteItem = async () => {
    try {
      const itemIndex = order.itemIndex || 0;
      
      // Create updated order with the item removed
      const updatedItems = [...editableOrder.items];
      updatedItems.splice(itemIndex, 1);
      
      // Recalculate total amount
      const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      // Update the order using the API service
      const updatedOrder = await updateOrder(editableOrder.id, {
        items: updatedItems,
        totalAmount: newTotalAmount
      });
      
      if (updatedOrder) {
        // Update local state
        setEditableOrder(updatedOrder);
        // Notify parent component
        onUpdate(updatedOrder);
        console.log('Item deleted successfully');
      } else {
        console.error('Failed to delete item');
        alert('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item');
    }
  };

  // Get the current item for display (from flattened structure)
  const itemIndex = order.itemIndex !== undefined ? order.itemIndex : 0;
  const currentItem = order.currentItem || (editableOrder.items && editableOrder.items[itemIndex] ? editableOrder.items[itemIndex] : null);
  const isFirstItem = order.isFirstItem || false;
  const isLastItem = order.isLastItem || false;
  const totalItemsInOrder = order.totalItemsInOrder || 1;

  const getCellValue = (columnKey: string) => {
    switch (columnKey) {
      case 'itemImage':
        // Prefer item image, fallback to order-level image if item image is missing
        const itemImage = currentItem?.itemImageUrl || currentItem?.imagePath || (order as any).itemImageUrl || (order as any).imagePath || '';
        console.log('Item image for item', order.itemIndex, ':', {
          itemItemImageUrl: currentItem?.itemImageUrl,
          itemImagePath: currentItem?.imagePath,
          orderItemImageUrl: (order as any).itemImageUrl,
          orderImagePath: (order as any).imagePath,
          finalImage: itemImage
        });
        return itemImage;
      case 'itemNumber':
        return currentItem?.itemNumber || 'N/A';
      case 'quantity':
        return currentItem?.quantity || 0;
      case 'price':
        return currentItem?.unitPrice || 0;
      case 'total':
        return currentItem ? (currentItem.unitPrice || 0) * (currentItem.quantity || 0) : 0;
      case 'vendor':
        
        if (typeof editableOrder.vendorId === 'string') {
          return 'Unknown Vendor';
        } else if (editableOrder.vendorId && editableOrder.vendorId.name) {
          return editableOrder.vendorId.name;
        }
        return 'Unknown Vendor';
      case 'confirmFormShehab':
        return currentItem?.confirmFormShehab || '';
      case 'estimatedDateReady':
        return currentItem?.estimatedDateReady || '';
      case 'invoiceNumber':
        return currentItem?.invoiceNumber || '';
      case 'transferAmount':
        return currentItem?.transferAmount || 0;
      case 'shippingDateToAgent':
        return currentItem?.shippingDateToAgent || '';
      case 'shippingDateToSaudi':
        return currentItem?.shippingDateToSaudi || '';
      case 'arrivalDate':
        return currentItem?.arrivalDate || '';
      case 'notes':
        return currentItem?.notes || '';
      case 'status':
        return currentItem?.status || 'pending';
      case 'itemPriceApprovalRejectionReason':
        return currentItem?.priceApprovalRejectionReason || '';
      case 'itemPriceApprovalStatus':
        return currentItem?.priceApprovalStatus || 'pending';
      case 'itemStatus':
        return currentItem?.status || 'pending';
      case 'itemNotes':
        return currentItem?.notes || '';
      case 'itemEstimatedDateReady':
        return currentItem?.estimatedDateReady || '';
      default:
        return '';
    }
  };

  const getCellType = (columnKey: string) => {
    switch (columnKey) {
      case 'quantity':
      case 'price':
      case 'transferAmount':
        return 'number';
      case 'itemPriceApprovalStatus':
      case 'itemStatus':
      case 'status':
        return 'select';
      case 'itemPriceApprovalRejectionReason':
        return 'textarea';
      case 'itemImage':
        return 'image';
      case 'confirmFormShehab':
      case 'estimatedDateReady':
      case 'shippingDateToAgent':
      case 'shippingDateToSaudi':
      case 'arrivalDate':
      case 'itemEstimatedDateReady':
        return 'date';
      default:
        return 'text';
    }
  };

  // Check if vendor fields are completed
  const isVendorFieldsCompleted = (): boolean => {
    const vendorFields = ['estimatedDateReady', 'invoiceNumber', 'transferAmount', 'shippingDateToAgent', 'shippingDateToSaudi', 'arrivalDate'];
    const completedFields = vendorFields.filter(field => {
      const value = editableOrder[field as keyof Order];
      return value !== undefined && value !== null && value !== '';
    });
    
    // Consider it completed if at least 3 out of 6 vendor fields are filled
    return completedFields.length >= 3;
  };

  // Check if order can be confirmed (vendor fields completed and not already confirmed)
  const canConfirm = (): boolean => {
    return userIsAdmin && 
           isVendorFieldsCompleted() && 
           editableOrder.status !== 'confirmed' && 
           editableOrder.status !== 'cancelled' && 
           editableOrder.status !== 'shipped' && 
           editableOrder.status !== 'delivered';
  };

  // Check if order can be cancelled (not already cancelled, shipped, or delivered)
  const canCancel = (): boolean => {
    return userIsAdmin && 
           editableOrder.status !== 'cancelled' && 
           editableOrder.status !== 'confirmed' && 
           editableOrder.status !== 'shipped' && 
           editableOrder.status !== 'delivered';
  };

  // Handle status change
  const handleStatusChange = async (newStatus: 'confirmed' | 'cancelled') => {
    try {
      onUpdate({ 
        id: editableOrder.id, 
        status: newStatus 
      } as any);
      
      // Update local state optimistically
      setEditableOrder(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  // Handle item confirmation with stock addition
  const handleItemConfirmation = async () => {
    if (!currentItem) return;
    
    const itemName = currentItem.productId?.name || currentItem.itemNumber || 'this item';
    const quantity = currentItem.quantity || 0;
    
    const confirmed = window.confirm(
      `Are you sure you want to confirm "${itemName}"?\n\n` +
      `This will add ${quantity} units to your current stock for this item.\n\n` +
      `Current stock will be increased by ${quantity} units.`
    );
    
    if (confirmed) {
      try {
        // Call the new API function for item confirmation with stock addition
        const result = await confirmOrderItem(
          editableOrder.id, 
          order.itemIndex || 0, 
          quantity
        );
        
        if (result.success) {
          // Update local state
          setEditableOrder(prev => {
            const updatedItems = [...prev.items];
            if (updatedItems[order.itemIndex || 0]) {
              updatedItems[order.itemIndex || 0].status = 'confirmed';
            }
            return { ...prev, items: updatedItems };
          });
          
          // Notify parent component
          if (result.data) {
            onUpdate(result.data);
          }
          
          console.log('Item confirmed and stock updated successfully');
          if (result.stockUpdate) {
            console.log('Stock update details:', result.stockUpdate);
          }
        } else {
          alert(`Failed to confirm item: ${result.message}`);
        }
      } catch (error) {
        console.error('Error confirming item:', error);
        alert('Error confirming item. Please try again.');
      }
    }
  };

  // Check if order has multiple items
  const hasMultipleItems = totalItemsInOrder > 1;
  const itemCount = totalItemsInOrder;

  // Determine row styling based on item position in order
  let rowStyling = `${isEven ? 'bg-white' : 'bg-gray-50'} ${isSelected ? 'bg-blue-100' : ''} ${isVendorFieldsCompleted() ? 'border-l-4 border-l-green-500' : ''} hover:bg-blue-50`;
  
  if (hasMultipleItems) {
    if (isFirstItem) {
      rowStyling += ' border-t-2 border-t-orange-400';
    }
    if (isLastItem) {
      rowStyling += ' border-b-2 border-b-orange-400';
    }
    if (!isFirstItem && !isLastItem) {
      rowStyling += ' border-l-2 border-l-orange-300';
    }
  }

  return (
    <tr className={rowStyling}>
      {/* Row number and selection */}
      <td className="w-12 h-8 border border-gray-300 bg-gray-100 text-center text-xs relative">
        <div className="flex flex-col items-center justify-center h-full">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-3 h-3"
          />
          {hasMultipleItems && (
            <div className="mt-1">
              <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                {itemIndex + 1}/{itemCount}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Data cells */}
      {columns.map(column => {
        if (column.key === 'actions') {
          return (
            <td 
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-center"
              style={{ width: column.width, minWidth: column.width }}
            >
              <div className="flex items-center justify-center space-x-1">
                {canConfirm() && (
                  <button
                    onClick={() => handleStatusChange('confirmed')}
                    className="text-xs text-green-600 hover:text-green-800 px-1"
                    title="Confirm Order"
                  >
                    ✅
                  </button>
                )}
                
                {canCancel() && (
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    className="text-xs text-gray-600 hover:text-gray-800 px-1"
                    title="Cancel Order"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-10.95a1 1 0 10-1.414-1.414L10 7.586 7.879 5.465a1 1 0 00-1.414 1.414L8.586 9l-2.121 2.121a1 1 0 101.414 1.414L10 10.414l2.121 2.121a1 1 0 001.414-1.414L11.414 9l2.121-2.121z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                
                {/* Admin-only: Confirm Item button */}
                {userIsAdmin && currentItem?.status !== 'confirmed' && currentItem?.status !== 'shipped' && currentItem?.status !== 'delivered' && (
                  <button
                    onClick={handleItemConfirmation}
                    className="text-xs text-blue-600 hover:text-blue-800 px-1"
                    title="Confirm Item (Add to Stock)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                
                {/* Admin-only: Quick Item Status selector */}
                {userIsAdmin && (
                  <select
                    value={currentItem?.status || 'pending'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                    title="Update item status"
                  >
                    <option value="pending">PENDING</option>
                    <option value="confirmed">CONFIRMED</option>
                    <option value="shipped">SHIPPED</option>
                    <option value="delivered">DELIVERED</option>
                    <option value="cancelled">CANCELLED</option>
                  </select>
                )}

                {/* Vendor-only: Transfer quantity to new order */}
                {!userIsAdmin && currentItem && (currentItem.status !== 'confirmed') && (
                  <button
                    onClick={async () => {
                      const maxQty = currentItem.quantity || 0;
                      const input = prompt(`Enter quantity to transfer (1 - ${maxQty}):`);
                      if (!input) return;
                      const qty = parseInt(input, 10);
                      if (!Number.isFinite(qty) || qty < 1 || qty > maxQty) {
                        alert('Invalid quantity');
                        return;
                      }
                      const notes = prompt('New order notes (optional):') || '';
                      const result = await transferOrderItemQuantity(editableOrder.id, order.itemIndex || 0, qty, { notes });
                      if (result.success && result.data) {
                        onUpdate(result.data.updatedOrder);
                        alert(`Transferred ${qty} to new order ${result.data.newOrder.orderNumber || result.data.newOrder.id}`);
                      } else {
                        alert(result.message || 'Transfer failed');
                      }
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 px-1"
                    title="Transfer quantity to a new order"
                  >
                    ↪
                  </button>
                )}

                {/* Admin-only: Delete Item button */}
                {userIsAdmin && editableOrder.items && (
                  <button
                    onClick={() => {
                      const itemName = currentItem?.productId?.name || currentItem?.itemNumber || 'this item';
                      if (confirm(`Are you sure you want to delete item "${itemName}"? This action cannot be undone.`)) {
                        handleDeleteItem();
                      }
                    }}
                    className="text-xs text-orange-600 hover:text-orange-800 px-1"
                    title="Delete Item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </td>
          );
        }

        // Image column rendering with vendor upload capability
  if (column.key === 'itemImage') {
    const canUpload = !userIsAdmin; // vendors only
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const itemImageUrl = getCellValue('itemImage');
    
          return (
            <td
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-center"
              style={{ width: column.width, minWidth: column.width }}
            >
              <div className="flex items-center justify-center space-x-2">
          {itemImageUrl ? (
            <a
              href={`${getApiOrigin().replace(/\/api\/?$/, '')}${itemImageUrl}`}
              target="_blank"
              rel="noreferrer"
              title="Open full image"
            >
              <img
                src={`${getApiOrigin().replace(/\/api\/?$/, '')}${itemImageUrl}`}
                alt="Item"
                className="w-10 h-10 object-cover rounded border"
              />
            </a>
          ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}
          {canUpload && (
            <>
              <button
                type="button"
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => fileInputRef.current?.click()}
                title={itemImageUrl ? 'Change this item image' : 'Upload image for this item'}
              >
                {itemImageUrl ? 'Change' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const inputEl = e.currentTarget;
                  const file = inputEl.files && inputEl.files[0];
                  if (!file) return;
                  try {
                    const result = await uploadOrderItemImage(editableOrder.id, order.itemIndex || 0, file);
                    if (result.success) {
                      // Update local state with the new item image
                      setEditableOrder(prev => {
                        const updatedItems = [...prev.items];
                        if (updatedItems[order.itemIndex || 0]) {
                          updatedItems[order.itemIndex || 0].itemImageUrl = result.data.itemImageUrl;
                          updatedItems[order.itemIndex || 0].imagePath = result.data.imagePath;
                        }
                        return { ...prev, items: updatedItems };
                      });
                      
                      // Create updated order with only the item image change
                      const updatedOrder = { ...editableOrder };
                      if (updatedOrder.items && updatedOrder.items[order.itemIndex || 0]) {
                        updatedOrder.items[order.itemIndex || 0].itemImageUrl = result.data.itemImageUrl;
                        updatedOrder.items[order.itemIndex || 0].imagePath = result.data.imagePath;
                      }
                      
                      // Notify parent component to refresh
                      onUpdate(updatedOrder);
                    } else {
                      alert(`Failed to upload image: ${result.message}`);
                    }
                  } catch (err) {
                    console.error('Upload error:', err);
                    alert('Failed to upload image. Please try again.');
                  } finally {
                    inputEl.value = '';
                  }
                }}
              />
            </>
          )}
              </div>
            </td>
          );
        }

        const value = getCellValue(column.key);
        const cellType = getCellType(column.key);
        const isEditable = canEditField(column.key as any);

        // Special handling for item number column to show item position info
        if (column.key === 'itemNumber' && hasMultipleItems) {
          return (
            <td 
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-xs bg-orange-50"
              style={{ width: column.width, minWidth: column.width }}
              title={`Item ${itemIndex + 1} of ${itemCount} in this order`}
            >
              <div className="flex items-center h-full">
                <span className="font-medium text-orange-800">
                  {currentItem?.itemNumber || 'N/A'} 
                </span>
                <span className="ml-1 text-orange-600 font-semibold">
                  ({itemIndex + 1}/{itemCount})
                </span>
              </div>
            </td>
          );
        }

        // Special handling for status column
        if (column.key === 'status') {
          const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            confirmed: 'bg-green-100 text-green-800',
            shipped: 'bg-blue-100 text-blue-800',
            delivered: 'bg-gray-100 text-gray-800',
            cancelled: 'bg-red-100 text-red-800'
          };
          
          // Use item-level status instead of order-level status
          const itemStatus = currentItem?.status || 'pending';
          
          return (
            <td 
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-center"
              style={{ width: column.width, minWidth: column.width }}
            >
              <div className="flex items-center justify-center h-full">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[itemStatus as keyof typeof statusColors] || statusColors.pending}`}>
                  {itemStatus.toUpperCase()}
                </span>
              </div>
      </td>
          );
        }

        // Conditional rendering for item-level rejection reason - only show when item price approval is rejected
        if (column.key === 'itemPriceApprovalRejectionReason') {
          
          // Only show rejection reason field when item price approval status is 'rejected'
          if (currentItem?.priceApprovalStatus !== 'rejected') {
            return (
              <td 
                key={column.key}
                className="h-8 border border-gray-300 px-2 text-center bg-gray-100"
                style={{ width: column.width, minWidth: column.width }}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-xs text-gray-400">N/A</span>
                </div>
              </td>
            );
          }
          
          // When status is 'rejected', render the editable cell
          const value = getCellValue(column.key);
          const cellType = getCellType(column.key);
          const isEditable = canEditField(column.key as any);
          
          return (
            <EditableCell
              key={column.key}
              value={value}
              onChange={(val) => handleChange(column.key, val)}
              isEditable={isEditable}
              userIsAdmin={userIsAdmin}
              type={cellType}
              width={column.width}
              isSelected={isSelected}
              fieldName={column.key}
            />
          );
        }

        return (
          <EditableCell
            key={column.key}
            value={
              column.key === 'price' || column.key === 'total' || column.key === 'transferAmount'
                ? `${currencySymbol}${Number(value || 0).toFixed(2)}`
                : value
            }
            onChange={(val) => handleChange(column.key, val)}
            isEditable={isEditable}
            userIsAdmin={userIsAdmin}
            type={cellType}
            width={column.width}
            isSelected={isSelected}
            fieldName={column.key}
          />
        );
      })}
    </tr>
  );
};

export default OrderRow;