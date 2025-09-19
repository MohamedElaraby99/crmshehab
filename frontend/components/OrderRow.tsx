
import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { SUPPLIER_EDITABLE_FIELDS } from '../data/mockData';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig } from '../data/orderFieldConfig';

interface OrderRowProps {
  order: Order & { rowNumber?: number };
  onUpdate: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onViewHistory: (itemNumber: string) => void;
  onConfirm?: (orderId: string) => void;
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
}> = ({ value, onChange, isEditable, userIsAdmin, type = 'text', width, isSelected }) => {
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
    if (isEditable) {
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

  if (!isEditable && !isEditing) {
    return (
      <td 
        className={cellClasses}
        style={{ width, minWidth: width }}
      >
        <div className="flex items-center h-full">
          {formatDisplayValue(value, type)}
        </div>
      </td>
    );
  }

  return (
    <td 
      className={cellClasses}
      style={{ width, minWidth: width }}
      onClick={handleClick}
    >
      {isEditing ? (
        <input
            type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          autoFocus
        />
      ) : (
        <div className="flex items-center h-full">
          {formatDisplayValue(value, type)}
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
  onConfirm,
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

  const canEditField = (fieldName: keyof Order): boolean => {
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
    // Prevent non-admins from changing protected fields
    if (!canEditField(field as keyof Order)) return;

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
          updatedOrder.items[0].quantity = parsedValue as number;
          updatedOrder.items[0].totalPrice = updatedOrder.items[0].quantity * updatedOrder.items[0].unitPrice;
        } else if (field === 'price') {
          updatedOrder.items[0].unitPrice = parsedValue as number;
          updatedOrder.items[0].totalPrice = updatedOrder.items[0].quantity * updatedOrder.items[0].unitPrice;
        }
        // Recalculate total amount
        updatedOrder.totalAmount = updatedOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
      }
    } else {
      // Regular field update
      updatedOrder = { ...editableOrder, [field]: parsedValue };
    }
    
    setEditableOrder(updatedOrder);
    onUpdate(updatedOrder);
  };

  // Get the first item for display (assuming single item orders for now)
  const firstItem = editableOrder.items && editableOrder.items[0] ? editableOrder.items[0] : null;

  const getCellValue = (columnKey: string) => {
    switch (columnKey) {
      case 'itemNumber':
        return firstItem?.itemNumber || 'N/A';
      case 'quantity':
        return firstItem?.quantity || 0;
      case 'price':
        return firstItem?.unitPrice || 0;
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
           editableOrder.status !== 'shipped' && 
           editableOrder.status !== 'delivered';
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
                {canConfirm() && onConfirm && (
                  <button
                    onClick={() => onConfirm(order.id)}
                    className="text-xs text-green-600 hover:text-green-800 px-1"
                    title="Confirm Order"
                  >
                    ✅
                  </button>
                )}
                
                <button
                  onClick={() => onDelete(order.id)}
                  className="text-xs text-red-600 hover:text-red-800 px-1"
                  title="Delete"
                >
                  🗑️
                </button>
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
          />
        );
      })}
    </tr>
  );
};

export default OrderRow;