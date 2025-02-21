import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange: (tabId: string) => void;
  variant?: 'line' | 'pill';
  className?: string;
}

export const Tabs = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'line',
  className = '',
}: TabsProps) => {
  const activeTabId = activeTab || tabs[0]?.id;

  return (
    <div className={className}>
      <div className={`border-b border-gray-200 ${variant === 'pill' ? 'mb-4' : ''}`}>
        <nav className="-mb-px flex space-x-4">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isDisabled = tab.disabled;

            const baseClasses = "py-2 px-3 text-sm font-medium flex items-center gap-2 transition-colors";
            const variantClasses = variant === 'line'
              ? `border-b-2 ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              : `rounded-full ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`;
            const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && onTabChange(tab.id)}
                disabled={isDisabled}
                className={`${baseClasses} ${variantClasses} ${disabledClasses}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="mt-4">
        {tabs.find((tab) => tab.id === activeTabId)?.content}
      </div>
    </div>
  );
}; 