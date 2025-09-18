
import React, { useState } from 'react';
import { Order } from '../types';
import { SUPPLIER_EDITABLE_FIELDS } from '../data/mockData';

interface OrderRowProps {
  order: Order;
  onUpdate: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onViewHistory: (itemNumber: string) => void;
  userIsAdmin: boolean;
}

const EditableCell: React.FC<{ value: string | number | null; onChange: (newValue: string) => void; isEditable: boolean; userIsAdmin: boolean; type?: string; }> = ({ value, onChange, isEditable, userIsAdmin, type = 'text' }) => {
    if (!isEditable) {
      return <>{value}</>;
    }
    
    const inputClasses = "w-full border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 py-1 text-sm rounded-sm";
    const supplierEditableClass = !userIsAdmin ? "bg-green-50" : "bg-transparent";

    return (
        <input
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClasses} ${supplierEditableClass}`}
        />
    );
};


const OrderRow: React.FC<OrderRowProps> = ({ order, onUpdate, onDelete, onViewHistory, userIsAdmin }) => {
  const [editableOrder, setEditableOrder] = useState<Order>(order);

  const canEditField = (fieldName: keyof Order): boolean => {
    if (userIsAdmin) {
      return true;
    }
    return SUPPLIER_EDITABLE_FIELDS.includes(fieldName);
  };

  const handleChange = (field: keyof Order, value: string) => {
    // Prevent non-admins from changing protected fields
    if (!canEditField(field)) return;

    let parsedValue: string | number | null = value;
    if (field === 'quantity' || field === 'price' || field === 'transferAmount') {
        parsedValue = value === '' ? null : parseFloat(value);
        if(isNaN(parsedValue as number)) parsedValue = 0;
    }
    const updatedOrder = { ...editableOrder, [field]: parsedValue };
    setEditableOrder(updatedOrder);
    onUpdate(updatedOrder);
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => onViewHistory(order.itemNumber)}>
        {order.itemNumber}
        <div className="text-xs text-gray-500">{order.productName}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.quantity} onChange={(val) => handleChange('quantity', val)} isEditable={canEditField('quantity')} type="number" /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.price} onChange={(val) => handleChange('price', val)} isEditable={canEditField('price')} type="number" /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.confirmFormShehab} onChange={(val) => handleChange('confirmFormShehab', val)} isEditable={canEditField('confirmFormShehab')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.estimatedDateReady} onChange={(val) => handleChange('estimatedDateReady', val)} isEditable={canEditField('estimatedDateReady')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.invoiceNumber} onChange={(val) => handleChange('invoiceNumber', val)} isEditable={canEditField('invoiceNumber')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.transferAmount} onChange={(val) => handleChange('transferAmount', val)} isEditable={canEditField('transferAmount')} type="number"/></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.shippingDateToAgent} onChange={(val) => handleChange('shippingDateToAgent', val)} isEditable={canEditField('shippingDateToAgent')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.shippingDateToSaudi} onChange={(val) => handleChange('shippingDateToSaudi', val)} isEditable={canEditField('shippingDateToSaudi')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.arrivalDate} onChange={(val) => handleChange('arrivalDate', val)} isEditable={canEditField('arrivalDate')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><EditableCell userIsAdmin={userIsAdmin} value={editableOrder.notes} onChange={(val) => handleChange('notes', val)} isEditable={canEditField('notes')} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button onClick={() => onDelete(order.id)} className="text-red-600 hover:text-red-900">Delete</button>
      </td>
    </tr>
  );
};

export default OrderRow;