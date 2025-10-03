import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { ArrowDownTrayIcon, ArrowLeftIcon, UserCircleIcon } from '@heroicons/react/24/solid';

interface Message {
  id: string;
  text: string;
  isLeia: boolean;
  timestamp: string;
}

interface Session {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  result: string | null;
  evaluation: string | null;
  score: number | null;
  messages: Message[];
  user: {
    email: string;
  } | null;
}

export const Conversations: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Session[]>([]);
  const [replicationName, setReplicationName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const adminSecret = localStorage.getItem('adminSecret');

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        // Fetch replication info
        const repResp = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setReplicationName(repResp.data.name);

        // Fetch conversations
        const convResp = await axios.get<Session[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        setConversations(convResp.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate('/login');
        } else {
          console.error('Load error:', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [id, adminSecret, navigate]);

  const handleDownloadCSV = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations/csv`,
        {
          headers: { Authorization: `Bearer ${adminSecret}` },
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${replicationName.replace(/\s+/g, '_')}_conversations.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/replications/${id}`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
              <p className="text-gray-600">{replicationName}</p>
            </div>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{conversations.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {conversations.filter(c => c.finishedAt).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Avg Score</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {conversations.filter(c => c.score !== null).length > 0
                ? (conversations.reduce((acc, c) => acc + (c.score || 0), 0) /
                    conversations.filter(c => c.score !== null).length).toFixed(1)
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {conversations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No conversations yet
            </div>
          ) : (
            conversations.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Session Header */}
                <div
                  className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <UserCircleIcon className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.user?.email || 'Anonymous'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Started: {formatDate(session.startedAt)}
                          {session.finishedAt && ` • Finished: ${formatDate(session.finishedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {session.score !== null && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          Score: {session.score}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        session.finishedAt
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {session.finishedAt ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages (Expandable) */}
                {expandedSession === session.id && (
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {session.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isLeia ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-lg px-4 py-2 rounded-lg ${
                            message.isLeia
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                          <p className={`text-xs mt-1 ${
                            message.isLeia ? 'text-gray-500' : 'text-blue-200'
                          }`}>
                            {formatDate(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {session.evaluation && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">Evaluation</h4>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{session.evaluation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
