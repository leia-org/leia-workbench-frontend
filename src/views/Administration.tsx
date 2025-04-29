import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import axios from 'axios';
import {
  ClockIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/solid';

interface Replication {
  id: string;
  name: string;
  isActive: boolean;
  duration: number;
  isRepeatable: boolean;
  code: string;
  createdAt: string;
  updatedAt: string;
  experiment: { name: string };
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} year${interval === 1 ? '' : 's'} ago`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} month${interval === 1 ? '' : 's'} ago`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} day${interval === 1 ? '' : 's'} ago`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} hour${interval === 1 ? '' : 's'} ago`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} minute${interval === 1 ? '' : 's'} ago`;
  
  if (seconds > 0) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  
  return `Now`;
};

export const Administration: React.FC = () => {
  const navigate = useNavigate();
  const [replications, setReplications] = useState<Replication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReplications = async () => {
      try {
        const adminSecret = localStorage.getItem('adminSecret');
        if (!adminSecret) {
          navigate('/login');
          return;
        }
        const response = await axios.get<Replication[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications`,
          {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }
        );
        setReplications(response.data);
        console.log('Replications:', response.data);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setTimeout(() => navigate('/login'), 2000);
        } else {
          console.error('Failed to load replications:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReplications();
  }, [navigate]);

  const handleView = (id: string) => {
    navigate(`/replications/${id}`);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 4000);
  };

  if (loading) {
    return <div className="text-center py-20">Loading replications...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar/>
      <div className="m-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {replications.map(rep => {
          const id = rep.id;
          return (
            <div key={id} className="relative bg-white rounded-2xl shadow p-6 flex flex-col justify-between hover:shadow-lg transition duration-200">
              <span
                className={
                  rep.isActive
                    ? 'rounded-full px-2 py-1 text-xs font-semibold absolute top-4 right-4 bg-green-100 text-green-800'
                    : 'rounded-full px-2 py-1 text-xs font-semibold absolute top-4 right-4 bg-red-100 text-red-800'
                }
              >
                {rep.isActive ? 'Active' : 'Inactive'}
              </span>

              {/* Title */}
              <h2 className="text-lg font-bold truncate">
                {rep.name}
              </h2>
              <div className="flex items-center justify-between">
                <div 
                  className="flex flex-col cursor-pointer"
                  onClick={() => handleCopy(rep.code, id)}
                  title="Copy code to clipboard"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition duration-200">
                      {rep.code}
                    </span>
                    {copiedId === id && (
                    <span className="text-xs font-bold text-green-600 mt-1">
                      Copied!
                    </span>
                  )}
                  </div>
                </div>
                <span className="ml-2 text-sm text-gray-400">
                  <CalendarDaysIcon className="w-4 h-4 inline-block" />
                  {new Date(rep.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-gray-700">
                <span className="flex items-center">
                  <InformationCircleIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Experiment:</strong>
                  <p className="ml-2">{rep.experiment.name}</p>
                </span>
                <span className="flex items-center">
                  <ClockIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Duration:</strong>
                  <p className="ml-2">
                    {Math.floor(rep.duration / 60)}m {rep.duration % 60}s
                  </p>
                </span>
                <span className="flex items-center">
                  <ArrowPathIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Repeatable:</strong>
                  <p className="ml-2">{rep.isRepeatable ? 'yes' : 'no'}</p>
                </span>
                <span className="flex items-center">
                  <PencilSquareIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Last Updated:</strong>
                  <p className="ml-2">{formatTimeAgo(rep.updatedAt)}</p>
                </span>
              </div>

              <button 
                className="mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200"
                onClick={() => handleView(id)}
              >
                Details
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
