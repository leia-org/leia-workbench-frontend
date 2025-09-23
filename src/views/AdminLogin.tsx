import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import axios from "axios";

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim()) {
      setSuccess(false);
      setMessage("Please enter the administrator code");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/secret`,
        { secret: adminCode.trim() }
      );

      if (response.status === 200 && response.data) {
        setSuccess(true);
        setMessage("Authentication successful! Redirecting...");

        // Save to localStorage
        localStorage.setItem("adminSecret", adminCode.trim());

        // Redirect after a short delay
        setTimeout(() => {
          navigate("/administration");
        }, 1000);
      } else {
        setSuccess(false);
        setMessage("Invalid code. Please try again.");
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      setSuccess(false);
      setMessage(
        error.response?.data?.message ||
          "Authentication error. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="w-full max-w-md px-8 py-12 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg">
              <Cog6ToothIcon className="w-10 h-10 text-white transform -rotate-12" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="adminCode"
              className="block text-sm font-medium text-gray-700"
            >
              Administrator Code
            </label>
            <div className="relative group">
              <input
                type="password"
                id="adminCode"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white"
                placeholder="Enter admin code"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-50">
                <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`${
                success
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              } text-sm rounded-lg p-3 flex items-center transition-all duration-200 ease-in-out`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5 mr-2 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-sm hover:shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        Powered by the LEIA team
      </p>
    </div>
  );
};
