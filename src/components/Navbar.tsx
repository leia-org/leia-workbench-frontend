import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

import {
  HomeIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import {
  Bars3Icon,
  UserIcon,
  KeyIcon,
  ArrowRightEndOnRectangleIcon
} from "@heroicons/react/24/outline";

export const Navbar: React.FC = () => {
  const { logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
  };

  const handleProfile = () => {
    // TODO: Implementar navegación a perfil o acción correspondiente
    console.log("Navegar a Profile");
    setIsMenuOpen(false);
  };

  const handleApiKeys = () => {
    navigate("/administration/api-keys");
    setIsMenuOpen(false);
  };

  return (
    <nav className="w-full bg-white shadow">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img
                src="/logo/leia_main_dark.png"
                alt="LEIA Logo"
                className="w-6 h-6"
              />
              <span className="text-xl font-semibold text-gray-800">
                Administration
              </span>
            </div>
            <Link
              to="/administration"
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition duration-200"
            >
              <HomeIcon className="h-5 w-5 mr-1" />
              Home
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <Link
              to="/experiments"
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition duration-200"
            >
              <PlusIcon className="h-5 w-5 mr-1" />
              New Replication
            </Link>

            <span className="text-sm text-gray-700 hidden sm:block">
              {user?.email}
            </span>

            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-2 rounded-md border text-gray-600 hover:bg-gray-50 focus:outline-none transition duration-200 ${
                  isMenuOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
                }`}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100 z-50">
                  <button
                    onClick={handleProfile}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition duration-150"
                  >
                    <UserIcon className="h-4 w-4 mr-2 text-gray-500" />
                    Profile
                  </button>
                  <button
                    onClick={handleApiKeys}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition duration-150"
                  >
                    <KeyIcon className="h-4 w-4 mr-2 text-gray-500" />
                    My-Api keys
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition duration-150"
                  >
                    <ArrowRightEndOnRectangleIcon className="h-4 w-4 mr-2 text-gray-500" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};