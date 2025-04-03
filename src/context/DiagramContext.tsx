import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

interface DiagramContextType {
  diagramCode: string;
  formUrl: string;
  interactionId: string;
  setDiagramData: (code: string, formUrl: string, interactionId: string) => void;
  concludeProblem: (code: string) => Promise<void>;
  isLoading: boolean;
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined);

export const DiagramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [diagramCode, setDiagramCode] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [interactionId, setInteractionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const setDiagramData = (code: string, url: string, id: string) => {
    setDiagramCode(code);
    setFormUrl(url);
    setInteractionId(id);
  };

  const concludeProblem = async (code: string) => {
    setIsLoading(true);
    try {
      const sessionId = localStorage.getItem('sessionId');
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/result`,
        {
          result: code,
        }
      );

      if (response.status === 200) {
        const { exerciseSolution, formUrl: newFormUrl } = response.data;
        setDiagramCode(exerciseSolution);
        setFormUrl(newFormUrl);
      }
    } catch (error) {
      console.error('Failed to conclude the problem:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DiagramContext.Provider
      value={{
        diagramCode,
        formUrl,
        interactionId,
        setDiagramData,
        concludeProblem,
        isLoading,
      }}
    >
      {children}
    </DiagramContext.Provider>
  );
};

export const useDiagram = () => {
  const context = useContext(DiagramContext);
  if (context === undefined) {
    throw new Error('useDiagram must be used within a DiagramProvider');
  }
  return context;
}; 