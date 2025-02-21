import React, { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultExpanded?: string[];
  className?: string;
}

export const Accordion = ({
  items,
  allowMultiple = false,
  defaultExpanded = [],
  className = '',
}: AccordionProps) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpanded);

  const toggleItem = (itemId: string) => {
    if (allowMultiple) {
      setExpandedItems(
        expandedItems.includes(itemId)
          ? expandedItems.filter(id => id !== itemId)
          : [...expandedItems, itemId]
      );
    } else {
      setExpandedItems(
        expandedItems.includes(itemId) ? [] : [itemId]
      );
    }
  };

  return (
    <div className={`divide-y divide-gray-200 ${className}`}>
      {items.map((item) => {
        const isExpanded = expandedItems.includes(item.id);

        return (
          <div key={item.id} className="py-2">
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="text-sm font-medium text-gray-900">
                  {item.title}
                </span>
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  isExpanded ? 'transform rotate-180' : ''
                }`}
              />
            </button>
            
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="py-3 px-4">
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 