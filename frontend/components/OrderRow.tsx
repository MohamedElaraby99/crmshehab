
import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import { SUPPLIER_EDITABLE_FIELDS } from '../data/mockData';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig } from '../data/orderFieldConfig';
import { uploadOrderImage, getApiOrigin } from '../services/api';

interface OrderRowProps {
  order: Order & { rowNumber?: number };
  onUpdate: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onViewHistory: (itemNumber: string) => void;
  userIsAdmin: boolean;
  isSelected: boolean;
  onSelect: () => void;
  rowNumber?: number;
  columns: Array<{ key: string; label: string; width: number; type: string }>;
  isEven: boolean;
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
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(value ?? ''));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log('OrderRow: handleSelectChange called with value:', e.target.value);
    console.log('OrderRow: Field being changed: priceApprovalStatus');
    setEditValue(e.target.value);
    // For select elements, immediately save the change
    onChange(e.target.value);
    setIsEditing(false);
    
    // Test: Send only the priceApprovalStatus field
    console.log('OrderRow: Testing direct API call with only priceApprovalStatus');
    const testUpdate = { priceApprovalStatus: e.target.value };
    console.log('OrderRow: Test update object:', testUpdate);
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

  // Get color classes for priceApprovalStatus
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
    // Apply color coding for priceApprovalStatus field
    const statusClasses = fieldName === 'priceApprovalStatus' ? getStatusColorClasses(value) : '';
    const finalCellClasses = fieldName === 'priceApprovalStatus' 
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

  // Apply color coding for priceApprovalStatus field when editing
  const statusClasses = fieldName === 'priceApprovalStatus' ? getStatusColorClasses(value) : '';
  const finalCellClasses = fieldName === 'priceApprovalStatus' 
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
            <option value="pending">PENDING</option>
            <option value="approved">APPROVED</option>
            <option value="rejected">REJECTED</option>
          </select>
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
  isEven 
}) => {
  const [editableOrder, setEditableOrder] = useState<Order>(order);
  const [fieldConfigs, setFieldConfigs] = useState<OrderFieldConfig[]>(ORDER_FIELD_CONFIGS);

  // Load saved field configurations
  useEffect(() => {
    const savedConfigs = localStorage.getItem('orderFieldConfigs');
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs);
        setFieldConfigs(parsed);
      } catch (error) {
        console.error('Error loading field configurations:', error);
      }
    }
  }, []);

  const canEditField = (fieldName: keyof Order | 'priceApprovalStatus'): boolean => {
    if (userIsAdmin) {
      return true;
    }
    
    // Use dynamic configuration if available, fallback to static config
    const fieldConfig = fieldConfigs.find(config => config.name === fieldName);
    if (fieldConfig) {
      return fieldConfig.editableBy === 'vendor' || fieldConfig.editableBy === 'both';
    }
    
    // Fallback to static configuration
    return SUPPLIER_EDITABLE_FIELDS.includes(fieldName);
  };

  const handleChange = (field: string, value: string) => {
    console.log('OrderRow: handleChange called with field:', field, 'value:', value);
    console.log('OrderRow: userIsAdmin:', userIsAdmin);
    console.log('OrderRow: canEditField result:', canEditField(field as keyof Order));
    console.log('OrderRow: Current priceApprovalStatus before change:', editableOrder.priceApprovalStatus);
    // Prevent non-admins from changing protected fields
    if (!canEditField(field as keyof Order)) {
      console.log('OrderRow: Field not editable for this user:', field);
      return;
    }

    let parsedValue: string | number | null = value;
    if (field === 'transferAmount') {
        parsedValue = value === '' ? null : parseFloat(value);
        if(isNaN(parsedValue as number)) parsedValue = 0;
    }
    
    // Handle special cases for fields that might be in the order or items
    let updatedOrder = { ...editableOrder };
    
    if (field === 'quantity' || field === 'price') {
      // Update the first item in the items array
      if (updatedOrder.items && updatedOrder.items[0]) {
        if (field === 'quantity') {
          const numValue = value === '' ? 0 : parseFloat(value);
          updatedOrder.items[0].quantity = isNaN(numValue) ? 0 : numValue;
          updatedOrder.items[0].totalPrice = updatedOrder.items[0].quantity * updatedOrder.items[0].unitPrice;
        } else if (field === 'price') {
          const numValue = value === '' ? 0 : parseFloat(value);
          updatedOrder.items[0].unitPrice = isNaN(numValue) ? 0 : numValue;
          updatedOrder.items[0].totalPrice = updatedOrder.items[0].quantity * updatedOrder.items[0].unitPrice;
        }
        // Recalculate total amount
        updatedOrder.totalAmount = updatedOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
      }
      
      console.log('OrderRow: Updated field', field, 'to', parsedValue);
    } else {
      // Regular field update
      updatedOrder = { ...editableOrder, [field]: parsedValue };
      console.log('OrderRow: Updated field', field, 'to', parsedValue);
    }
    
    setEditableOrder(updatedOrder);
    console.log('OrderRow: Sending updated order to parent:', updatedOrder);
    console.log('OrderRow: priceApprovalStatus in updated order:', updatedOrder.priceApprovalStatus);
    
    // For priceApprovalStatus, send only the specific field that changed
    if (field === 'priceApprovalStatus') {
      console.log('OrderRow: Sending only priceApprovalStatus field:', { [field]: parsedValue });
      // Create a partial order with the ID and the changed field
      const partialUpdate = { 
        id: editableOrder.id,
        [field]: parsedValue 
      };
      onUpdate(partialUpdate as any);
    } else {
      // For vendor updates, send only the specific field that changed
      if (!userIsAdmin) {
        // Create a minimal update object with only the changed field and order ID
        const vendorUpdate = {
          id: editableOrder.id,
          [field]: parsedValue
        };
        
        // For price changes, also include the items array
        if (field === 'price' || field === 'quantity') {
          (vendorUpdate as any).items = updatedOrder.items;
          (vendorUpdate as any).totalAmount = updatedOrder.totalAmount;
        }
        
        console.log('OrderRow: Vendor update - sending only changed field:', vendorUpdate);
        onUpdate(vendorUpdate as any);
      } else {
        console.log('OrderRow: Admin update - sending full order object');
        onUpdate(updatedOrder);
      }
    }
  };

  // Get the first item for display (assuming single item orders for now)
  const firstItem = editableOrder.items && editableOrder.items[0] ? editableOrder.items[0] : null;

  const getCellValue = (columnKey: string) => {
    switch (columnKey) {
      case 'itemImage':
        return editableOrder.itemImageUrl || '';
      case 'itemNumber':
        return firstItem?.itemNumber || 'N/A';
      case 'quantity':
        return firstItem?.quantity || 0;
      case 'price':
        return firstItem?.unitPrice || 0;
      case 'total':
        return firstItem ? (firstItem.unitPrice || 0) * (firstItem.quantity || 0) : 0;
      case 'confirmFormShehab':
        return editableOrder.confirmFormShehab || '';
      case 'estimatedDateReady':
        return editableOrder.estimatedDateReady || '';
      case 'invoiceNumber':
        return editableOrder.invoiceNumber || '';
      case 'transferAmount':
        return editableOrder.transferAmount || 0;
      case 'shippingDateToAgent':
        return editableOrder.shippingDateToAgent || '';
      case 'shippingDateToSaudi':
        return editableOrder.shippingDateToSaudi || '';
      case 'arrivalDate':
        return editableOrder.arrivalDate || '';
      case 'notes':
        return editableOrder.notes || '';
      case 'status':
        return editableOrder.status || 'pending';
      case 'priceApprovalStatus':
        return editableOrder.priceApprovalStatus || 'pending';
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
      case 'priceApprovalStatus':
        return 'select';
      case 'itemImage':
        return 'image';
      case 'confirmFormShehab':
      case 'estimatedDateReady':
      case 'shippingDateToAgent':
      case 'shippingDateToSaudi':
      case 'arrivalDate':
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

  return (
    <tr className={`${isEven ? 'bg-white' : 'bg-gray-50'} ${isSelected ? 'bg-blue-100' : ''} ${isVendorFieldsCompleted() ? 'border-l-4 border-l-green-500' : ''} hover:bg-blue-50`}>
      {/* Row number and selection */}
      <td className="w-12 h-8 border border-gray-300 bg-gray-100 text-center text-xs">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-3 h-3"
        />
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
                
                <button
                  onClick={() => onDelete(order.id)}
                  className="text-xs text-red-600 hover:text-red-800 px-1"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h12a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM5 8a1 1 0 011-1h8a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </td>
          );
        }

        // Image column rendering with vendor upload capability
  if (column.key === 'itemImage') {
    const canUpload = !userIsAdmin; // vendors only
    const fileInputRef = useRef<HTMLInputElement | null>(null);
          return (
            <td
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-center"
              style={{ width: column.width, minWidth: column.width }}
            >
              <div className="flex items-center justify-center space-x-2">
          {editableOrder.itemImageUrl ? (
            <a
              href={`${getApiOrigin()}${editableOrder.itemImageUrl}`}
              target="_blank"
              rel="noreferrer"
              title="Open full image"
            >
              <img
                src={`${getApiOrigin()}${editableOrder.itemImageUrl}`}
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
                title={editableOrder.itemImageUrl ? 'Change image' : 'Upload image'}
              >
                {editableOrder.itemImageUrl ? 'Change' : 'Upload'}
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
                    const updated = await uploadOrderImage(editableOrder.id, file);
                    if (updated) {
                      setEditableOrder(prev => ({ ...prev, itemImageUrl: updated.itemImageUrl }));
                    }
                  } catch (err) {
                    console.error(err);
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
        const isEditable = canEditField(column.key as keyof Order);

        // Special handling for status column
        if (column.key === 'status') {
          const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            confirmed: 'bg-green-100 text-green-800',
            shipped: 'bg-blue-100 text-blue-800',
            delivered: 'bg-gray-100 text-gray-800',
            cancelled: 'bg-red-100 text-red-800'
          };
          
          return (
            <td 
              key={column.key}
              className="h-8 border border-gray-300 px-2 text-center"
              style={{ width: column.width, minWidth: column.width }}
            >
              <div className="flex items-center justify-center h-full">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[editableOrder.status as keyof typeof statusColors] || statusColors.pending}`}>
                  {editableOrder.status?.toUpperCase() || 'PENDING'}
                </span>
              </div>
      </td>
          );
        }

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
      })}
    </tr>
  );
};

export default OrderRow;