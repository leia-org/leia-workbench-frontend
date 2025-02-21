import React from 'react';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps) => {
  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`}>
      <a
        href="/"
        className="text-gray-500 hover:text-gray-700 flex items-center"
      >
        <HomeIcon className="w-4 h-4" />
      </a>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRightIcon className="w-4 h-4 text-gray-400 mx-2" />
          {item.href ? (
            <a
              href={item.href}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              {item.icon}
              {item.label}
            </a>
          ) : (
            <span className="text-gray-900 font-medium flex items-center gap-1">
              {item.icon}
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}; 