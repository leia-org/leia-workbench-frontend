import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { scrollUtils, mobileUtils, touchUtils } from '../lib/utils';

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
  isLeia: boolean;
  id?: string; // Agregar ID único para anclas
}

interface Exercise {
  description: string;
}

interface Configuration {
  mode: string;
  askSolution: boolean;
  evaluateSolution: boolean;
}

interface Replication {
  name: string;
  duration: number;
  isActive: boolean;
  isRepeatable: boolean;
  code: string;
  form: string;
}

interface Session {
  isTest: boolean;
  startedAt: string;
  finishedAt: string | null | undefined;
  isRunnerInitialized: boolean;
  result: string | null | undefined;
  evaluation: string | null | undefined;
  score: number | null | undefined;
}

export const Chat = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [replication, setReplication] = useState<Replication | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [redirectingIn, setRedirectingIn] = useState(6);
  const [showTooltip, setShowTooltip] = useState(true);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastLeiaMessageRef = useRef<HTMLDivElement>(null);

  // Función mejorada para scroll automático usando utilidades
  const scrollToBottom = useCallback((smooth = true) => {
    scrollUtils.scrollToBottom(chatMessagesRef, smooth);
  }, []);

  // Función para scroll a un mensaje específico de Leia
  const scrollToLeiaMessage = useCallback((messageId: string) => {
    scrollUtils.scrollToElement(`message-${messageId}`, {
      behavior: 'smooth',
      block: 'center' as ScrollLogicalPosition
    });
  }, []);

  // Función para generar ID único para mensajes
  const generateMessageId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Función para copiar texto al input
  const copyToInput = (text: string) => {
    setNewMessageText(text);
    setShowTooltip(false);
    inputRef.current?.focus();
  };

  const loadData = useCallback(async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}`
      );

      if (response.status === 200) {
        setExercise(response.data.leia.leia.spec.problem.spec);
        setConfiguration(response.data.leia.configuration);
        setReplication(response.data.replication);
        setSession(response.data.session);
        localStorage.setItem('sessionId', response.data.session.id);
        localStorage.setItem('exercise', JSON.stringify(response.data.leia.leia.spec.problem.spec));
        localStorage.setItem('configuration', JSON.stringify(response.data.leia.configuration));
        localStorage.setItem('replication', JSON.stringify(response.data.replication));
        localStorage.setItem('session', JSON.stringify(response.data.session));
        console.log('session', response.data.session);
        if (response.data.leia.configuration?.mode === 'transcription') {
          console.log('test')
          navigate('/edit');
        }

        const sortedMessages = response.data.messages.sort((a: Message, b: Message) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ).map((msg: Message) => ({
          ...msg,
          id: msg.id || generateMessageId()
        }));
        setMessages(sortedMessages);

      }
    } catch (error: any) {
      setLoadError(error.response?.data?.error || 'An unexpected error occurred');
    }
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [sessionId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mejorar la experiencia móvil al cargar el componente
  useEffect(() => {
    // Habilitar scroll suave en iOS
    touchUtils.enableSmoothScroll();
    
    // Prevenir zoom en inputs
    const preventZoom = (e: TouchEvent) => touchUtils.preventZoom(e);
    document.addEventListener('touchstart', preventZoom, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', preventZoom);
    };
  }, []);



  // Scroll automático cuando aparece una nueva respuesta de Leia
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].isLeia) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id) {
        // Pequeño delay para asegurar que el DOM se ha actualizado
        setTimeout(() => {
          scrollToLeiaMessage(lastMessage.id!);
        }, 150);
      }
    }
  }, [messages, scrollToLeiaMessage]);

  // Scroll automático mejorado para móviles
  useEffect(() => {
    if (messages.length > 0) {
      // Scroll suave al final cuando se cargan mensajes inicialmente
      setTimeout(() => {
        scrollToBottom(false);
      }, 100);
    }
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configuration?.mode === 'transcription') return;

    const messageText = newMessageText.trim();
    if (!messageText) return;

    // Ocultar el tooltip cuando se envía el primer mensaje
    setShowTooltip(false);

    setNewMessageText('');
    const newMessage: Message = {
      text: messageText,
      timestamp: new Date(),
      isLeia: false,
      id: generateMessageId()
    };

    setMessages(prev => [...prev, newMessage]);
    setSendingMessage(true);
    scrollToBottom();

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/messages`,
        {
          message: messageText
        }
      );

      if (response.status === 200) {
        const leiaMessage: Message = {
          text: response.data.message,
          timestamp: new Date(),
          isLeia: true,
          id: generateMessageId()
        };

        setMessages(prev => [...prev, leiaMessage]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          text: 'Your message is taking a bit longer to send. Retry?',
          timestamp: new Date(),
          isLeia: true,
          id: generateMessageId()
        },
      ]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFinishConversation = async () => {
    if (!messages.length) return;
    setConcluding(true);
    if (configuration?.askSolution) {
      navigate('/edit');
    } else {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/finish`
        );

        if (response.status === 200) {
          const updatedSession = response.data;
          setSession(updatedSession);
          setShowSuccessModal(true);
        }
      } catch (error: any) {
        setLoadError(error.response?.data?.error || 'An unexpected error occurred');
      } finally {
        setConcluding(false);
      }
    }
    
  };

  useEffect(() => {
    if (session?.finishedAt && !showSuccessModal) {
      // Start countdown and redirect
      const timer = setInterval(() => {
        setRedirectingIn(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [session, showSuccessModal, navigate]);

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
    <div className="flex flex-col h-screen bg-white chat-container">
      {/* Meta viewport para móviles */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
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

      <header className="flex justify-between items-center px-4 py-3 border-b bg-white sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInstructions(true)}
            className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Instructions</span>
          </button>
          <button 
            onClick={handleFinishConversation}
            disabled={concluding || !messages.length}
            className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {concluding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Processing...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Finish Session</span>
                <span className="sm:hidden">Finish Session</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Área de mensajes con mejor layout móvil */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-40 scroll-smooth bg-gray-50 chat-messages"
        style={{ 
          height: mobileUtils.isMobile() ? `${mobileUtils.getMobileViewportHeight() - 180}px` : 'auto',
          minHeight: '400px',
          maxHeight: mobileUtils.isMobile() ? 'calc(100vh - 200px)' : 'none'
        }}
      >
        <div ref={chatMessagesRef} className="max-w-3xl mx-auto space-y-4 py-4">
          {messages.map((msg, index) => (
            <div
              key={msg.id || index}
              id={`message-${msg.id || index}`}
              ref={msg.isLeia && index === messages.length - 1 ? lastLeiaMessageRef : null}
              className={`flex items-end gap-2 ${msg.isLeia ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.isLeia ? 'bg-blue-50' : 'bg-blue-600'
              }`}>
                {msg.isLeia ? (
                  <UserCircleIcon className="w-5 h-5 text-blue-700" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                )}
              </div>
              <div
                className={`max-w-[85%] sm:max-w-[80%] px-4 py-2 break-words ${
                  msg.isLeia
                    ? 'bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md shadow-sm'
                    : 'bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md shadow-sm'
                }`}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {sendingMessage && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UserCircleIcon className="w-5 h-5 text-blue-700" />
              </div>
              <div className="min-w-[60px] bg-white border border-gray-200 rounded-t-2xl rounded-r-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <TypingAnimation />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Espacio para evitar que el input tape el contenido */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 bg-gray-50 z-10 chat-input">
        <div className="max-w-3xl mx-auto relative">
          {/* Tooltip de mensaje de ejemplo */}
          {showTooltip && messages.length === 0 && (
            <div className="absolute bottom-full mb-2 left-0 right-0 z-20">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg max-w-sm mx-auto">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Message example:</strong>
                    </p>
                    <button
                      onClick={() => copyToInput("Hi, my name is (...) and I am here to (...), nice to meet you!")}
                      className="text-sm text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 rounded px-3 py-1.5 transition-colors w-full text-left"
                    >
                      "Hi, my name is (...) and I am here to (...), nice to meet you!"
                    </button>
                    <p className="text-xs text-blue-600 mt-1">
                      Click to copy to input
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTooltip(false)}
                    className="flex-shrink-0 text-blue-400 hover:text-blue-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form 
            onSubmit={handleSubmit}
            className="flex gap-2 bg-white rounded-lg p-3 shadow-lg border border-gray-200"
          >
            <input
              ref={inputRef}
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-transparent border-none focus:outline-none text-[15px] min-w-0"
              disabled={configuration?.mode === 'transcription'}
            />
            <button
              type="submit"
              disabled={configuration?.mode === 'transcription' || !newMessageText.trim()}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Session Completed</h2>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Success!</h3>
              <p className="text-gray-600 text-center mb-4">
                {replication?.form 
                  ? "Your session has been successfully completed. Please fill out the form to provide your feedback."
                  : "Your session has been successfully completed."
                }
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/');
                }}
                className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </button>
              {replication?.form && (
                <button
                  onClick={() => window.open(replication.form, '_blank')}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Open Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {session?.finishedAt && !showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl">
            <div className="px-6 py-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Session Already Completed</h3>
              <p className="text-gray-600 text-center mb-4">
                This session has already been completed. You will be redirected to the home page in {redirectingIn} seconds.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};