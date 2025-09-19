import React, { useState, useEffect, useRef } from 'react';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig } from '../data/orderFieldConfig';
import { getAllFieldConfigs, bulkUpdateFieldConfigs, resetFieldConfigs, FieldConfig } from '../services/api';

interface FieldConfigManagerProps {
  onConfigChange?: (configs: OrderFieldConfig[]) => void;
}

const FieldConfigManager: React.FC<FieldConfigManagerProps> = ({ onConfigChange }) => {
  const [configs, setConfigs] = useState<OrderFieldConfig[]>(ORDER_FIELD_CONFIGS);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const apiConfigs = await getAllFieldConfigs();
      if (apiConfigs.length > 0) {
        // Convert API configs to OrderFieldConfig format
        const convertedConfigs = apiConfigs.map((config: FieldConfig) => ({
          name: config.name,
          label: config.label,
          type: config.type,
          required: config.required,
          editableBy: config.editableBy,
          visibleTo: config.visibleTo,
          placeholder: config.placeholder,
          options: config.options,
          validation: config.validation
        }));
        setConfigs(convertedConfigs);
        if (onConfigChange) {
          onConfigChange(convertedConfigs);
        }
      } else {
        // Fallback to localStorage if no API configs
        const savedConfigs = localStorage.getItem('orderFieldConfigs');
        if (savedConfigs) {
          try {
            const parsed = JSON.parse(savedConfigs);
            setConfigs(parsed);
            if (onConfigChange) {
              onConfigChange(parsed);
            }
          } catch (error) {
            console.error('Error loading field configurations from localStorage:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading field configurations:', error);
      // Fallback to localStorage
      const savedConfigs = localStorage.getItem('orderFieldConfigs');
      if (savedConfigs) {
        try {
          const parsed = JSON.parse(savedConfigs);
          setConfigs(parsed);
          if (onConfigChange) {
            onConfigChange(parsed);
          }
        } catch (error) {
          console.error('Error loading field configurations from localStorage:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Convert to API format and save to backend
      const apiConfigs = configs.map(config => ({
        name: config.name,
        editableBy: config.editableBy,
        visibleTo: config.visibleTo,
        required: config.required,
        order: configs.indexOf(config) + 1
      }));

      await bulkUpdateFieldConfigs(apiConfigs);
      
      // Also save to localStorage as backup
      localStorage.setItem('orderFieldConfigs', JSON.stringify(configs));
      
      if (onConfigChange) {
        onConfigChange(configs);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving field configurations:', error);
      // Fallback to localStorage
      localStorage.setItem('orderFieldConfigs', JSON.stringify(configs));
      if (onConfigChange) {
        onConfigChange(configs);
      }
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const resetConfigs = await resetFieldConfigs();
      if (resetConfigs.length > 0) {
        // Convert reset configs to OrderFieldConfig format
        const convertedConfigs = resetConfigs.map((config: FieldConfig) => ({
          name: config.name,
          label: config.label,
          type: config.type,
          required: config.required,
          editableBy: config.editableBy,
          visibleTo: config.visibleTo,
          placeholder: config.placeholder,
          options: config.options,
          validation: config.validation
        }));
        setConfigs(convertedConfigs);
        localStorage.setItem('orderFieldConfigs', JSON.stringify(convertedConfigs));
        if (onConfigChange) {
          onConfigChange(convertedConfigs);
        }
      } else {
        // Fallback to default configs
        setConfigs(ORDER_FIELD_CONFIGS);
        localStorage.setItem('orderFieldConfigs', JSON.stringify(ORDER_FIELD_CONFIGS));
        if (onConfigChange) {
          onConfigChange(ORDER_FIELD_CONFIGS);
        }
      }
    } catch (error) {
      console.error('Error resetting field configurations:', error);
      // Fallback to default configs
      setConfigs(ORDER_FIELD_CONFIGS);
      localStorage.removeItem('orderFieldConfigs');
      if (onConfigChange) {
        onConfigChange(ORDER_FIELD_CONFIGS);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateFieldConfig = (fieldName: string, updates: Partial<OrderFieldConfig>) => {
    // Preserve scroll position using ref
    const scrollTop = modalRef.current?.scrollTop || 0;
    
    setConfigs(prev => prev.map(field => 
      field.name === fieldName ? { ...field, ...updates } : field
    ));
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (modalRef.current) {
        modalRef.current.scrollTop = scrollTop;
      }
    });
  };

  const FieldConfigRow: React.FC<{ config: OrderFieldConfig }> = ({ config }) => {
    const handleEditableByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.preventDefault();
      e.stopPropagation();
      updateFieldConfig(config.name, { editableBy: e.target.value as 'admin' | 'vendor' | 'both' });
    };

    const handleVisibleToChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.preventDefault();
      e.stopPropagation();
      updateFieldConfig(config.name, { visibleTo: e.target.value as 'admin' | 'vendor' | 'both' });
    };

    const handleRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      updateFieldConfig(config.name, { required: e.target.checked });
    };

    return (
      <>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="text-sm font-medium text-gray-900">{config.label}</div>
            <div className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {config.name}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <select
            value={config.editableBy}
            onChange={handleEditableByChange}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
          >
            <option value="admin">Admin Only</option>
            <option value="vendor">Vendor Only</option>
            <option value="both">Both</option>
          </select>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <select
            value={config.visibleTo}
            onChange={handleVisibleToChange}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
          >
            <option value="admin">Admin Only</option>
            <option value="vendor">Vendor Only</option>
            <option value="both">Both</option>
          </select>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-center">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={config.required}
              onChange={handleRequiredChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {config.type}
          </span>
        </td>
      </>
    );
  };

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Configure Fields
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div 
        ref={modalRef}
        className="relative top-10 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white field-config-modal" 
        style={{ 
          maxHeight: '90vh', 
          overflowY: 'auto',
          scrollBehavior: 'auto'
        }}
      >
        <div className="mt-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Configure Order Fields</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Field Configuration Guide:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Admin Only:</strong> Only you (admin) can edit these fields</li>
              <li><strong>Vendor Only:</strong> Only vendors can edit these fields</li>
              <li><strong>Both:</strong> Both you and vendors can edit these fields</li>
              <li><strong>Visibility:</strong> Controls who can see the field</li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Field Name</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Editable By</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Visible To</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Required</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>Type</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {configs.map((config, index) => (
                    <tr key={config.name} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <FieldConfigRow config={config} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            <div className="flex justify-between items-center pt-6 border-t mt-6">
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset to Default'}
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FieldConfigManager;
