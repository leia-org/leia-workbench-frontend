import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useAuth } from '../context';
import {
  getActivityReplicationBlocker,
  type ActivityLeiaRef,
  type ActivityOrchestration,
  type ActivityStage,
} from '../lib/activityStages';

interface Experiment {
  id: string;
  isPublished: boolean;
  name: string;
  leias: ActivityLeiaRef[];
  orchestration?: ActivityOrchestration;
  stages?: ActivityStage[];
  createdAt: string;
  updatedAt: string;
}

export const Experiment: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [experiment, setExperiment] = useState<Experiment>();
  const [loading, setLoading] = useState<boolean>(true);
  const { id } = useParams<{ id: string }>();

  const [isCreateReplicationModalOpen, setIsCreateReplicationModalOpen] = useState(false);
  const [replicationName, setReplicationName] = useState('');
  const [createError, setCreateError] = useState('');
  const replicationBlocker = experiment ? getActivityReplicationBlocker(experiment) : null;

  useEffect(() => {
    const fetchExperiment = async () => {
      try {
        const response = await axios.get<Experiment>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/manager/experiments/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setExperiment(response.data);
        console.log('Experiment:', response.data);
      } catch (error: unknown) {
        console.error('Failed to load experiments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiment();
  }, [id, token]);

  useEffect(() => {
    if (experiment && experiment.name) {
      setReplicationName(`${experiment.name}`);
    }
  }, [experiment]);

  const handleCreateReplication = async () => {
    if (replicationBlocker) return;
    setCreateError('');
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications`,
        {
          name: replicationName,
          experiment: id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('Replication created:', response.data);
      setIsCreateReplicationModalOpen(false);
      setReplicationName('');
      navigate(`/replications/${response.data.id}`);
    } catch (error: unknown) {
      console.error('Failed to create replication:', error);
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string } | undefined)?.message ||
          error.message;
        setCreateError(message || 'Failed to create replication');
      } else {
        setCreateError('Failed to create replication');
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
              onClick={() => navigate('/experiments')}
              className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition duration-200"
            >
              Go back
            </button>
            <button
              onClick={() => {
                setCreateError('');
                setIsCreateReplicationModalOpen(true);
              }}
              disabled={!experiment || Boolean(replicationBlocker)}
              title={replicationBlocker ?? undefined}
              className={`ml-2 px-4 py-2 text-white rounded-md transition duration-200 ${
                !experiment || replicationBlocker
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Create Replication
            </button>
          </div>
        </div>
        {replicationBlocker && (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Cannot replicate this activity: {replicationBlocker}
          </div>
        )}
        <SyntaxHighlighter
          language="json"
          style={docco}
          wrapLongLines={true}
          showLineNumbers={true}
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
              setCreateError('');
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
            {createError && (
              <p role="alert" className="mb-4 text-sm text-red-600">
                {createError}
              </p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsCreateReplicationModalOpen(false);
                  setReplicationName('');
                  setCreateError('');
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReplication}
                disabled={!replicationName.trim() || Boolean(replicationBlocker)}
                className={`px-4 py-2 rounded-md ${
                  replicationName.trim() && !replicationBlocker
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