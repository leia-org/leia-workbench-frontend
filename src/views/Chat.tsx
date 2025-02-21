import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useDiagram } from '../context/DiagramContext';

const TypingAnimation = () => (
  <div className="flex items-center space-x-1.5">
    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" 
         style={{ animationDuration: '0.6s' }}></div>
    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" 
         style={{ animationDuration: '0.6s', animationDelay: '0.2s' }}></div>
    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" 
         style={{ animationDuration: '0.6s', animationDelay: '0.4s' }}></div>
  </div>
);

interface Message {
  text: string;
  timestamp: Date;
  leia: boolean;
}

interface Exercise {
  title: string;
  description: string;
  mode: string;
  data?: {
    linkEs?: string;
    linkEn?: string;
  };
}

export const Chat = () => {
  const navigate = useNavigate();
  const { experimentCode, studentCode } = useParams();
  const { concludeProblem } = useDiagram();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  const loadData = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/interactions/data/experiment/${experimentCode}/student/${studentCode}`
      );

      if (response.status === 200) {
        setMessages(response.data.messages);
        setExercise(response.data.exercise);
        localStorage.setItem('sessionId', response.data.sessionId);
        
        if (response.data.exercise.mode === 'predefined-chat') {
          navigate('/edit');
        }
      }
    } catch (error: any) {
      setLoadError(error.response?.data?.error || 'An unexpected error occurred');
    }
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  useEffect(() => {
    loadData();
  }, [experimentCode, studentCode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exercise?.mode === 'predefined-chat') return;

    const messageText = newMessageText.trim();
    if (!messageText) return;

    setNewMessageText('');
    const timestamp = new Date();
    const newMessage: Message = {
      text: messageText,
      timestamp,
      leia: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setSendingMessage(true);
    scrollToBottom();

    try {
      const sessionId = localStorage.getItem('sessionId');
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/interactions/message/${sessionId}`,
        {
          text: messageText,
          timestamp,
        }
      );

      if (response.status === 200) {
        setMessages(prev => [...prev, response.data.message]);
        scrollToBottom();
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => 
        !(msg.text === newMessage.text && msg.timestamp === newMessage.timestamp)
      ));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFinishInterview = async () => {
    if (!messages.length) return;
    
    setConcluding(true);
    try {
      const lastUserMessage = [...messages]
        .reverse()
        .find(msg => !msg.leia);

      if (!lastUserMessage) {
        throw new Error('No se encontró código para enviar');
      }

      await concludeProblem(lastUserMessage.text);
      navigate('/edit');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setConcluding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md p-6 bg-red-50 rounded-xl">
          <h1 className="text-2xl font-bold text-red-700 mb-2">Error loading the exercise</h1>
          <p className="text-red-600 mb-4">{loadError}</p>
          <p className="font-semibold text-red-700 mb-4">Try again or contact the person in charge</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Instructions</h2>
              <button 
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600">{exercise?.description}</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue Task
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center px-4 py-3 border-b">
        <h1 className="text-lg font-semibold text-gray-900">{exercise?.title} Interview</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInstructions(true)}
            className="px-4 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            Instructions
          </button>
          <button 
            onClick={handleFinishInterview}
            disabled={concluding || !messages.length}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {concluding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              'Finish Interview'
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 scroll-smooth">
        <div ref={chatMessagesRef} className="max-w-3xl mx-auto space-y-4 py-4">
          {messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${msg.leia ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                msg.leia ? 'bg-blue-50' : 'bg-blue-600'
              }`}>
                {msg.leia ? (
                  <SparklesIcon className="w-5 h-5 text-blue-700" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-2 ${
                  msg.leia
                    ? 'bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md'
                    : 'bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md'
                }`}
              >
                <p className="text-[15px] leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {sendingMessage && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-blue-700" />
              </div>
              <div className="min-w-[60px] bg-white border border-gray-200 rounded-t-2xl rounded-r-2xl rounded-bl-md px-4 py-3">
                <TypingAnimation />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-[72px] left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="flex gap-2 bg-white rounded-lg p-3 shadow-[0_0_10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(0,0,0,0.15)] transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-2 py-1.5 bg-transparent border-none focus:outline-none text-[15px]"
              disabled={exercise?.mode === 'predefined-chat'}
            />
            <button
              type="submit"
              disabled={exercise?.mode === 'predefined-chat' || !newMessageText.trim()}
              className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}; 