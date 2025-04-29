import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

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

export const Experiment: React.FC = () => {
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState<Experiment>();
  const [loading, setLoading] = useState<boolean>(true);
  const { id } = useParams<{ id: string }>();

  const [isCreateReplicationModalOpen, setIsCreateReplicationModalOpen] = useState(false);
  const [replicationName, setReplicationName] = useState('');

  useEffect(() => {
    const fetchExperiment = async () => {
      try {
        const adminSecret = localStorage.getItem('adminSecret');
        if (!adminSecret) {
          navigate('/login');
          return;
        }
        const response = await axios.get<Experiment>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/manager/experiments/${id}`,
          {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }
        );
        setExperiment(response.data);
        console.log('Experiment:', response.data);
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

    fetchExperiment();
  }, [id, navigate]);

  const handleCreateReplication = async () => {
    try {
      const adminSecret = localStorage.getItem('adminSecret');
      if (!adminSecret) {
        navigate('/login');
        return;
      }
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications`,
        {
          name: replicationName,
          experiment: id,
        },
        {
          headers: {
            Authorization: `Bearer ${adminSecret}`,
          },
        }
      );
      console.log('Replication created:', response.data);
      setIsCreateReplicationModalOpen(false);
      setReplicationName('');
      navigate(`/replications/${response.data.id}`);
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setTimeout(() => navigate('/login'), 2000);
      } else {
        console.error('Failed to create replication:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-20">Loading experiment...</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 w-full bg-white shadow-lg z-50 overflow-auto">
          <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white">
            <h2 className="text-lg font-semibold">Experiment preview</h2>
            <div>
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition duration-200"
              >
                Go back
              </button>
              <button
                onClick={() => setIsCreateReplicationModalOpen(true)}
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
              >
                Create Replication
              </button>
            </div>
          </div>
          <SyntaxHighlighter 
            language="json" 
            style={docco}
            customStyle={{ backgroundColor: "white" }}
            className="p-4"
          >
            {JSON.stringify(experiment, null, 2)}
          </SyntaxHighlighter>
        </div>
        {/* Modals */}
        {isCreateReplicationModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCreateReplicationModalOpen(false);
              setReplicationName('');
            }
          }}
        > 
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Create Replication</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Replication Name
            </label>
            <input
              type="text"
              value={replicationName}
              onChange={(e) => setReplicationName(e.target.value)}
              placeholder='name'
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsCreateReplicationModalOpen(false);
                  setReplicationName('');
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReplication}
                disabled={!replicationName.trim()}
                className={`px-4 py-2 rounded-md ${
                  replicationName.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-300 text-white cursor-not-allowed'
                }`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};