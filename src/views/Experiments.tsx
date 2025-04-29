import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import axios from 'axios';
import {
  InformationCircleIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/solid';

interface Experiment {
  id: string;
  isPublished: boolean;
  name: string;
  leias: [{
    configuration: {
      mode: string;
    }
    leia: string;
  }];
  createdAt: string;
  updatedAt: string;
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

export const Experiments: React.FC = () => {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const adminSecret = localStorage.getItem('adminSecret');
        if (!adminSecret) {
          navigate('/login');
          return;
        }
        const response = await axios.get<Experiment[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/manager/experiments`,
          {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }
        );
        setExperiments(response.data);
        console.log('Experiments:', response.data);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setTimeout(() => navigate('/login'), 2000);
        } else {
          console.error('Failed to load experiments:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExperiments();
  }, [navigate]);

  const handleView = (id: string) => {
    navigate(`/experiments/${id}`);
  };

  if (loading) {
    return <div className="text-center py-20">Loading experiments...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar/>
      <h1 className="text-2xl font-bold text-center m-6">
        <span className="text-blue-400">Select an experiment to </span>
        <span className="text-blue-600">replicate</span>
      </h1>
      <div className="m-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {experiments.map(exp => {
          const id = exp.id;
          return (
            <div key={id} className="relative bg-white rounded-2xl shadow p-4 flex flex-col justify-between hover:shadow-lg transition duration-200">
              <div className='flex justify-between'>
                {/* Title */}
                <h2 className="text-lg font-bold truncate my-auto">
                  {exp.name}
                </h2>
                <div>
                  <span
                    className={
                      exp.isPublished
                        ? 'rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-800'
                        : 'rounded-full px-2 py-1 text-xs font-semibold bg-red-100 text-red-800'
                    }
                  >
                    {exp.isPublished ? 'Published' : 'Unpublished'}
                  </span>
                </div>
              </div>

              <div className="flex w-full items-center justify-end">
                <span className="ml-2 text-sm text-gray-400">
                  <CalendarDaysIcon className="w-4 h-4 inline-block" />
                  {new Date(exp.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-gray-700">
                <span className="flex items-center">
                  <InformationCircleIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Leias: </strong>
                  <p className="ml-2">{exp.leias.length}</p>
                </span>
                <span className="flex items-center">
                  <Squares2X2Icon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Modes: </strong>
                  <p className="ml-2">
                    {[...new Set(exp.leias.map(leia => leia.configuration.mode))].join(', ')}
                  </p>
                </span>
                <span className="flex items-center">
                  <PencilSquareIcon className="w-5 h-5 text-gray-500 mr-1" />
                  <strong>Last Updated:</strong>
                  <p className="ml-2">{formatTimeAgo(exp.updatedAt)}</p>
                </span>
              </div>

              <button 
                className="mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200"
                onClick={() => handleView(id)}
              >
                Preview
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};