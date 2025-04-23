import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HomeIcon, PlusIcon, ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/solid';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminSecret');
    navigate('/login');
  };

  return (
    <nav className="w-full bg-white shadow">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            <span className="text-xl font-semibold text-gray-800">Administration</span>
            <Link
              to="/"
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition duration-200"
            >
              <HomeIcon className="h-5 w-5 mr-1" />
              Home
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <Link
              to="/replications/new"
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition duration-200"
            >
              <PlusIcon className="h-5 w-5 mr-1" />
              New Replication
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition duration-200"
            >
              <ArrowRightEndOnRectangleIcon className="h-5 w-5 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};