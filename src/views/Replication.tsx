import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import {
  PencilIcon,
  ClockIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  CalendarIcon,
  EyeIcon,
  CheckIcon,
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
  experiment: {
    name: string;
    leias: Array<{
      configuration: { mode: string; data?: any };
      leia: { metadata: { name: string }; spec: any };
      runnerConfiguration: { provider: string };
      sessionCount: number;
      id: string;
    }>;
  };
}

export const Replication: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replication, setReplication] = useState<Replication | null>(null);
  const [localLeias, setLocalLeias] = useState(replication?.experiment.leias || []);
  const [loading, setLoading] = useState(true);
  const adminSecret = localStorage.getItem('adminSecret');

  // Fetch replication on mount
  useEffect(() => {
    const fetchReplication = async () => {
      try {
        const resp = await axios.get<Replication>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalLeias(resp.data.experiment.leias);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setTimeout(() => navigate('/login'), 2000);
        } else {
          console.error('Load error:', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReplication();
  }, [id, adminSecret, navigate]);

  // Regenerate code
  const regenerateCode = async () => {
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/regenerate-code`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
    } catch (err) {
      console.error('Regenerate error:', err);
    }
  };

  // Toggle active state
  const toggleActive = async () => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/toggle-active`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  // Toggle repeatable state
  const toggleRepeatable = async () => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/toggle-repeatable`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  // Local leia runnerConfig change
  const handleLocalRunnerChange = (index: number, provider: string) => {
    const updated = [...localLeias];
    (updated[index] as any).runnerConfiguration = { provider };
    setLocalLeias(updated);
  };

  // Save runnerConfiguration for all leias
  const saveRunnerConfig = async (idx: number) => {
    if (!replication) return;
    const leiaId = localLeias[idx].id;
    const runnerConfiguration = localLeias[idx].runnerConfiguration;

    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/leia/${leiaId}/runner-configuration`,
        { runnerConfiguration },
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  if (loading || !replication) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="py-20 text-center">Loading replication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PencilIcon className="h-5 w-5 text-gray-600" />
            <input
              type="text"
              className="text-2xl font-bold border-b border-gray-300 focus:outline-none"
              value={replication.name}
              onChange={(e) => setReplication({ ...replication, name: e.target.value })}
            />
          </div>
          <div>
            <label className="flex items-center space-x-1">
              <CheckIcon className="h-5 w-5 text-green-500" />
              <input
                type="checkbox"
                checked={replication.isActive}
                onChange={() => toggleActive()}
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Basic details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <ClockIcon className="h-5 w-5 text-gray-600" />
            <input
              type="number"
              className="w-24 border-b border-gray-300 focus:outline-none"
              value={replication.duration}
              onChange={(e) => setReplication({ ...replication, duration: Number(e.target.value) })}
              onBlur={() => updateField('duration', replication.duration)}
            />
            <span className="text-sm text-gray-700">seconds</span>
          </div>
          <div className="flex items-center space-x-2">
            <ArrowPathIcon className="h-5 w-5 text-gray-600" />
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={replication.isRepeatable}
                onChange={() => toggleRepeatable()}
              />
              <span className="text-sm text-gray-700">Repeatable</span>
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <CodeBracketIcon className="h-5 w-5 text-gray-600" />
            <span className="font-mono">{replication.code}</span>
            <button onClick={regenerateCode}>
              <ArrowPathIcon className="h-5 w-5 text-blue-500 hover:text-blue-700" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-gray-600" />
            <div className="text-sm text-gray-700">
              <div>Created: {new Date(replication.createdAt).toLocaleString()}</div>
              <div>Updated: {new Date(replication.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Session count and experiment */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-800">
            Experiment: {replication.experiment.name}
          </div>
        </div>

        {/* Leias section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Leia Configurations</h3>
          {localLeias.map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl shadow flex flex-col space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{item.leia.metadata.name}</div>
                <button
                  onClick={() => alert('View leia content...')}
                  className="flex items-center space-x-1 text-blue-600 hover:underline"
                >
                  <EyeIcon className="h-4 w-4" />
                  <span className="text-sm">View Content</span>
                </button>
              </div>
              <div className="text-sm text-gray-700">
                Sessions: <strong>{item.sessionCount}</strong>
              </div>
              <div className="text-sm text-gray-700">
                Mode: <strong>{item.configuration.mode}</strong>
              </div>
              <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-700">
                Provider: 
              </div>
                <select
                  value={item.runnerConfiguration.provider}
                  onChange={(e) => handleLocalRunnerChange(idx, e.target.value)}
                  className="border border-gray-300 rounded-md p-2"
                >
                  <option value="default">default</option>
                  <option value="openai-assistant">openai-assistant</option>
                </select>
              </div>
              <button
                onClick={saveRunnerConfig(idx)}
                className="mt-2 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200"
              >
                Save Runner Config
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
