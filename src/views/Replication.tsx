import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import Switch from "react-switch";
import { ToastContainer, toast } from 'react-toastify';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  PencilIcon,
  ClockIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  EyeIcon,
  LockClosedIcon,
  InformationCircleIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  TrashIcon,
  DocumentTextIcon,
  LightBulbIcon
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
  form: string | undefined | null;
  experiment: {
    name: string;
    leias: Array<{
      configuration: { mode: string; data?: any; askSolution: boolean; evaluateSolution: boolean };
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
  const [localReplication, setLocalReplication] = useState<Replication | null>(null);
  const [loading, setLoading] = useState(true);
  const adminSecret = localStorage.getItem('adminSecret');
  const [copied, setCopied] = useState<boolean>(false);

  // Modals
  const [newName, setNewName] = useState<string>('');
  const [newDuration, setNewDuration] = useState<string>('');
  const [newForm, setNewForm] = useState<string>('');
  const [isNewNameModalOpen, setIsNewNameModalOpen] = useState<boolean>(false);
  const [isNewDurationModalOpen, setIsNewDurationModalOpen] = useState<boolean>(false);
  const [isNewFormModalOpen, setIsNewFormModalOpen] = useState<boolean>(false);

  // Side bar
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sideBarData, setSideBarData] = useState<any>(null);

  // Fetch replication on mount
  useEffect(() => {
    const fetchReplication = async () => {
      try {
        const resp = await axios.get<Replication>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(replication?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  const handleRename = async () => {
    if (replication && newName.trim()) {
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/name`,
          { name: newName.trim() },
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewName('');
        setIsNewNameModalOpen(false);
        toast.success('Replication renamed successfully', {
          position: "bottom-right",
          autoClose: 5000
        });
      } catch (err) {
        toast.error('Error renaming replication', {
          position: "bottom-right",
          autoClose: 5000
        });
        console.error('Rename error:', err);
      }
    }
  };

  const handleChangeDuration = async () => {
    if (replication && !isNaN(Number(newDuration)) && Number(newDuration) > 0 && Number.isInteger(Number(newDuration))) {
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/duration`,
          { duration: Number(newDuration) },
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewDuration('');
        setIsNewDurationModalOpen(false);
        toast.success('Replication duration updated successfully', {
          position: "bottom-right",
          autoClose: 5000
        });
      } catch (err) {
        toast.error('Error updating replication duration', {
          position: "bottom-right",
          autoClose: 5000
        });
        console.error('Update error:', err);
      }
    }
  };

  const handleChangeForm = async () => {
    if (replication && newForm.trim()) {
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
          { form: newForm.trim() },
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewForm('');
        setIsNewFormModalOpen(false);
        toast.success('Replication form updated successfully', {
          position: "bottom-right",
          autoClose: 5000
        });
      } catch (err) {
        toast.error('Error updating replication form', {
          position: "bottom-right",
          autoClose: 5000
        });
        console.error('Update error:', err);
      }
    }
  };

  const handleDeleteForm = async () => {
    if (replication) {
      try {
        const resp = await axios.delete(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewForm('');
        setIsNewFormModalOpen(false);
        toast.success('Replication form deleted successfully', {
          position: "bottom-right",
          autoClose: 5000
        });
      } catch (err) {
        toast.error('Error deleting replication form', {
          position: "bottom-right",
          autoClose: 5000
        });
        console.error('Delete error:', err);
      }
    }
  };

  // Regenerate code
  const regenerateCode = async () => {
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/regenerate-code`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success('Code regenerated successfully', {
        position: "bottom-right",
        autoClose: 5000
      });
    } catch (err) {
      toast.error('Error regenerating code', {
        position: "bottom-right",
        autoClose: 5000
      });
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
      setLocalReplication(structuredClone(resp.data));
      const message = replication.isActive ? 'Replication is now inactive' : 'Replication is now active';
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000
      });
    } catch (err) {
      toast.error('Error toggling active state', {
        position: "bottom-right",
        autoClose: 5000
      });
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
      setLocalReplication(structuredClone(resp.data));
      const message = replication.isRepeatable ? 'Replication is now non-repeatable' : 'Replication is now repeatable';
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000
      });
    } catch (err) {
      toast.error('Error toggling repeatable state', {
        position: "bottom-right",
        autoClose: 5000
      });
      console.error('Update error:', err);
    }
  };

  const toggleAskSolution = async (idx: number) => {
    if (!replication) return;
    const leiaId = replication.experiment.leias[idx].id
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/leia/${leiaId}/toggle-ask-solution`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = 'Leia configuration updated';
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000
      });
    } catch (err) {
      toast.error('Error toggling ask solution state', {
        position: "bottom-right",
        autoClose: 5000
      });
      console.error('Update error:', err);
    }
  }

  const toggleEvaluateSolution = async (idx: number) => {
    if (!replication) return;
    const leiaId = replication.experiment.leias[idx].id
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/leia/${leiaId}/toggle-evaluate-solution`,
        {},
        { headers: { Authorization: `Bearer ${adminSecret}` } }
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = 'Leia configuration updated';
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000
      });
    } catch (err) {
      toast.error('Error toggling evaluate solution state', {
        position: "bottom-right",
        autoClose: 5000
      });
      console.error('Update error:', err);
    }
  }

  const handleLocalLeiaChange = (idx: number, key: string, value: any) => {
    if (localReplication) {
      const keys = key.split(".")
      const localReplicationCopy = structuredClone(localReplication) as any
      let property = localReplicationCopy?.experiment.leias[idx]
      for (let i = 0; i < keys.length -1; i++) {
        if (property[keys[i]] === undefined) {
          console.log("Property "+keys[i]+" not found")
          return
        }
        property = property[keys[i]]
      }

      const lastKey = keys.at(-1)
      if (lastKey) {
        property[lastKey] = value;
        setLocalReplication(localReplicationCopy)
      }
    }
  }

  const handleLocalLeiaReset = (idx: number) => {
    if (localReplication && replication) {
      console.log("replication: "+replication.experiment.leias[idx].runnerConfiguration.provider)
      const localReplicationCopy = structuredClone(localReplication)
      localReplicationCopy.experiment.leias[idx] = replication.experiment.leias[idx]
      console.log("copy: "+localReplicationCopy.experiment.leias[idx].runnerConfiguration.provider)
      setLocalReplication(localReplicationCopy)
    }
  }

  const handleLeiaUpdate = async (idx: number) => {
    if (replication && localReplication) {
      const replicationId = replication.id
      const localLeiaId = localReplication.experiment.leias[idx].id
      const localLeiaRunnerConfiguration = localReplication.experiment.leias[idx].runnerConfiguration
      
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${replicationId}/leia/${localLeiaId}/runner-configuration`,
          localLeiaRunnerConfiguration,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        toast.success('Leia configuration updated successfully', {
          position: "bottom-right",
          autoClose: 5000
        });
      } catch (err) {
        toast.error('Error updating leia configuration', {
          position: "bottom-right",
          autoClose: 5000
        });
        console.error('Update error:', err);
      }
    }
  };

  if (loading || !replication || !localReplication) {
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
      <ToastContainer />
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-800 mr-2">{replication.name}</h1>
            <button
              onClick={() => setIsNewNameModalOpen(true)}
              className="flex text-center items-center space-x-1 text-blue-600 hover:underline"
            >
              <PencilIcon className="h-4 w-4" />
              <span className="text-sm">Rename</span>
            </button>
          </div>
          <div className="flex items-center space-x-8">
            <label className="text-center flex items-center">
              <LockClosedIcon className="h-4 w-4 text-gray-600" />
              <span className='text-sm text-gray-700 mx-2'>Active</span>
              <Switch
                checked={replication.isActive}
                onChange={toggleActive}
              ></Switch>
            </label>
            <label className="text-center flex items-center">
              <ArrowPathIcon className="h-4 w-4 text-gray-600" />
              <span className='text-sm text-gray-700 mx-2'>Repeatable</span>
              <Switch
                checked={replication.isRepeatable}
                onChange={toggleRepeatable}
              ></Switch>
            </label>
          </div>
        </div>

        {/*Information*/}
        <h3 className='text-lg font-semibold'>Replication information</h3>
        <div className="flex justify-between bg-white p-4 rounded-xl shadow mb-6 mt-2 items-center">
          <div className="text-sm text-gray-700 space-y-2">
            <div className='flex'>
              <CalendarDaysIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Created:
              </strong>
              <p className='ml-2'>
                {new Date(replication.createdAt).toLocaleString()}
              </p>
            </div>
            <div className='flex'>
              <PencilSquareIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Last updated:
              </strong>
              <p className='ml-2'>
                {formatTimeAgo(replication.updatedAt)}
              </p>
            </div>
            <div className='flex'>
              <InformationCircleIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Experiment:
              </strong>
              <p className='ml-2'>
                {replication.experiment.name}
              </p>
            </div>
          </div>
        </div>

        {/* Basic details */}
        <h3 className="text-lg font-semibold">Replication configuration</h3>
        <div className="flex justify-between bg-white p-4 rounded-xl shadow mb-6 mt-2 items-center">
          <div className="text-sm text-gray-700 space-y-2">
            <div className='flex'>
              <ClockIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Duration:
              </strong>
              <p className='mx-2'>
                {Math.floor(replication.duration / 60)}m {replication.duration % 60}s
              </p>
              <button
                onClick={() => setIsNewDurationModalOpen(true)}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm">Change</span>
              </button>
            </div>
            <div className='flex'>
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Form:
              </strong>
              {replication.form ? (
                <a href={replication.form} target="_blank" rel="noopener noreferrer" className='mx-2 text-blue-600 hover:underline max-w-xs overflow-hidden truncate'>
                  {replication.form}
                </a>
              ) : (
                <p className='mx-2 text-gray-500'>No form provided</p>
              )}
              <button
                onClick={() => setIsNewFormModalOpen(true)}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm">Change</span>
              </button>
              <button
                onClick={() => handleDeleteForm()}
                className="flex text-center items-center space-x-1 text-red-600 hover:underline"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="text-sm">Delete</span>
              </button>
            </div>
            <div className='flex'>
              <CodeBracketIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>
                Code:
              </strong>
              <div 
                className="flex flex-col cursor-pointer ml-2"
                onClick={() => handleCopyCode()}
                title="Copy code to clipboard"
              >
                <div className="flex items-center mr-2">
                  <span className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition duration-200">
                    {replication.code}
                  </span>
                </div>
              </div>
              <button
                onClick={() => regenerateCode()}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span className="text-sm">Regenerate</span>
              </button>
              {copied && (
                <span className="text-xs font-bold text-green-600 mt-1">
                  Copied!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Leias section */}
          <h3 className="text-lg font-semibold">Leia configurations</h3>
          <div className="space-y-4 bg-white p-4 rounded-xl shadow mb-6 mt-2">
          {localReplication.experiment.leias.map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl shadow flex flex-col space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{item.leia.metadata.name}</div>
                <button
                  onClick={() => {
                    setSideBarData(item.leia)
                    setIsSidebarOpen(true);
                  }}
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

              <div className="flex items-center space-x-8">
                <label className="text-center flex items-center">
                  <DocumentTextIcon className="h-4 w-4 text-gray-600" />
                  <span className='text-sm text-gray-700 mx-2'>Student solution</span>
                  <Switch
                    checked={item.configuration.askSolution}
                    onChange={() => toggleAskSolution(idx)}
                  ></Switch>
                </label>
                <label className="text-center flex items-center">
                  <LightBulbIcon className="h-4 w-4 text-gray-600" />
                  <span className='text-sm text-gray-700 mx-2'>Automatic evaluation</span>
                  <Switch
                    checked={item.configuration.evaluateSolution}
                    onChange={() => toggleEvaluateSolution(idx)}
                  ></Switch>
                </label>
              </div>
              
              <fieldset className='bg-white p-4 rounded-xl shadow border-solid border border-gray-400'>
                <legend>Runner</legend>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-700">
                    Provider: 
                  </div>
                    <select
                      value={item.runnerConfiguration.provider}
                      onChange={(e) => handleLocalLeiaChange(idx, "runnerConfiguration.provider", e.target.value)}
                      className="border border-gray-300 rounded-md p-2"
                    >
                      <option value="default">default</option>
                      <option value="openai-assistant">openai-assistant</option>
                    </select>
                </div>
                <div className='flex w-full gap-2'>
                  <button
                    onClick={() => handleLocalLeiaReset(idx)}
                    className="mt-2 bg-gray-400 text-white rounded-lg px-4 py-2 hover:bg-gray-500 transition duration-200 w-full"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => handleLeiaUpdate(idx)}
                    disabled={
                      JSON.stringify(localReplication.experiment.leias[idx]) ===
                      JSON.stringify(replication.experiment.leias[idx])
                    }
                    className={`mt-2 rounded-lg px-4 py-2 transition duration-200 w-full text-white ${
                      JSON.stringify(localReplication.experiment.leias[idx]) ===
                      JSON.stringify(replication.experiment.leias[idx])
                        ? 'bg-blue-300 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Save
                  </button>
                </div>
              </fieldset>
            </div>
          ))}
        </div>

        {/* Modals */}
        {isNewNameModalOpen&& (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewNameModalOpen(false);
              setNewName('');
            }
          }}
        > 
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Rename Replication</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='name'
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsNewNameModalOpen(false);
                  setNewName('');
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!newName.trim()}
                className={`px-4 py-2 rounded-md ${
                  newName.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-300 text-white cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewDurationModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewDurationModalOpen(false);
              setNewDuration('');
            }
          }}
        > 
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Change Replication Duration</h2>
            <input
              type="text"
              pattern='[0-9]*'
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder='1800'
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsNewDurationModalOpen(false);
                  setNewDuration('');
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeDuration}
                disabled={!newDuration || isNaN(Number(newDuration)) || Number(newDuration) <= 0 || !Number.isInteger(Number(newDuration))}
                className={`px-4 py-2 rounded-md ${
                  newDuration && !isNaN(Number(newDuration)) && Number(newDuration) > 0 && Number.isInteger(Number(newDuration))
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-300 text-white cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewFormModalOpen(false);
              setNewForm('');
            }
          }}
        >
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Change Replication Form</h2>
            <input
              type="text"
              value={newForm}
              onChange={(e) => setNewForm(e.target.value)}
              placeholder='https://example.com/form'
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsNewFormModalOpen(false);
                  setNewForm('');
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeForm}
                disabled={!newForm.trim()}
                className={`px-4 py-2 rounded-md ${
                  newForm.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-300 text-white cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-y-0 left-0 w-full bg-white shadow-lg z-50 overflow-auto">
          <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white">
            <h2 className="text-lg font-semibold">Leia Content</h2>
            <button onClick={() => setIsSidebarOpen(false)}>
              <XMarkIcon className="h-5 w-5 text-gray-600 hover:text-gray-800" />
            </button>
          </div>
          <SyntaxHighlighter 
            language="json" 
            style={docco}
            wrapLongLines={true}
            showLineNumbers={true}
          >
            {JSON.stringify(sideBarData, null, 2)}
          </SyntaxHighlighter>
        </div>
      )}
      </div>
    </div>
  );
};
