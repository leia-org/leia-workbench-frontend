import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Editor } from '@monaco-editor/react';
import { LeiaCard } from '../components/LeiaCard';
import { CreateSidebar } from '../components/CreateSidebar';

interface LeiaItem {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    version: string;
  };
  spec: {
    description?: string;
    fullName?: string;
    [key: string]: any;
  };
}

interface LeiaConfig {
  persona: LeiaItem | null;
  problem: LeiaItem | null;
  behaviour: LeiaItem | null;
}

// Datos de ejemplo - En una implementación real, estos vendrían de una API o archivo
const samplePersonas: LeiaItem[] = [
  {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'john-experienced',
      version: '1.0.0'
    },
    spec: {
      fullName: 'John Smith',
      description: 'A seasoned individual in his mid-50s. He is straightforward, practical, and clear in his approach.'
    }
  }
];

const sampleProblems: LeiaItem[] = [
  {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'tickets',
      version: '1.0.0'
    },
    spec: {
      description: 'You have been hired to gather the requirements for an online ticket platform.'
    }
  }
];

const sampleBehaviours: LeiaItem[] = [
  {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'customer-information-requirements-interview',
      version: '1.0.0'
    },
    spec: {
      description: 'Requirements elicitation interview simulation for gathering customer information.'
    }
  }
];

const exampleTemplates = {
  persona: {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'sarah-developer',
      version: '1.0.0'
    },
    spec: {
      fullName: 'Sarah Johnson',
      description: 'A senior software developer with 8 years of experience in web development. She is detail-oriented, innovative, and passionate about clean code.',
      traits: [
        'Detail-oriented',
        'Problem solver',
        'Team player'
      ],
      background: 'Computer Science degree with focus on software engineering',
      expertise: 'Web development, JavaScript, React, Node.js'
    }
  },
  problem: {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'e-commerce-platform',
      version: '1.0.0'
    },
    spec: {
      description: 'Design and implement a modern e-commerce platform with focus on user experience',
      context: 'A retail company looking to expand their online presence',
      objectives: [
        'Create a user-friendly shopping experience',
        'Implement secure payment processing',
        'Design a scalable product catalog'
      ],
      constraints: [
        'Must be mobile-responsive',
        'Should handle high traffic loads',
        'Must comply with data protection regulations'
      ]
    }
  },
  behaviour: {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'technical-requirements-gathering',
      version: '1.0.0'
    },
    spec: {
      description: 'Technical requirements gathering session for a new software project',
      approach: 'Collaborative discussion with focus on technical details and system architecture',
      topics: [
        'System architecture overview',
        'Technical constraints and limitations',
        'Integration requirements',
        'Performance expectations'
      ],
      expectedOutcomes: [
        'Detailed technical specifications',
        'System architecture diagram',
        'Integration points documentation'
      ]
    }
  }
} as const;

export const CreateLeia: React.FC = () => {
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>({
    persona: null,
    problem: null,
    behaviour: null
  });

  const [createSidebar, setCreateSidebar] = useState<{
    isOpen: boolean;
    type: keyof LeiaConfig | null;
    yaml: string;
  }>({
    isOpen: false,
    type: null,
    yaml: ''
  });

  const generateLeiaYaml = () => {
    if (!leiaConfig.persona || !leiaConfig.problem || !leiaConfig.behaviour) return '';
    
    return `kind: leia
apiVersion: v1
metadata:
  name: "${leiaConfig.problem.metadata.name}"
  version: "1.0.0"
spec:
  persona:
    name: "${leiaConfig.persona.metadata.name}"
    version: "${leiaConfig.persona.metadata.version}"
  problem:
    name: "${leiaConfig.problem.metadata.name}"
    version: "${leiaConfig.problem.metadata.version}"
  behaviour:
    name: "${leiaConfig.behaviour.metadata.name}"
    version: "${leiaConfig.behaviour.metadata.version}"`;
  };

  const generateItemYaml = (item: LeiaItem | null) => {
    if (!item) return '';
    return `kind: ${item.kind}
apiVersion: ${item.apiVersion}
metadata:
  name: "${item.metadata.name}"
  version: "${item.metadata.version}"
spec:
  ${Object.entries(item.spec)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n  ')}`;
  };

  const handleSelect = (type: keyof LeiaConfig, item: LeiaItem) => {
    setLeiaConfig(prev => ({
      ...prev,
      [type]: item
    }));
  };

  const handleCreateNew = (type: keyof LeiaConfig) => {
    const template = exampleTemplates[type];
    setCreateSidebar({
      isOpen: true,
      type,
      yaml: generateItemYaml(template)
    });
  };

  const handleSaveNewItem = (yamlString: string) => {
    try {
      const newItem = JSON.parse(yamlString) as LeiaItem;
      if (createSidebar.type) {
        handleSelect(createSidebar.type, newItem);
      }
    } catch (error) {
      console.error('Invalid YAML:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Create LEIA
              </h1>
              <p className="mt-2 text-gray-600">
                Configure your LEIA by selecting a Persona, Problem and Behaviour
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.persona ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">Persona</span>
              </div>
              <div className="h-px w-8 bg-gray-300" />
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.problem ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">Problem</span>
              </div>
              <div className="h-px w-8 bg-gray-300" />
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.behaviour ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">Behaviour</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 h-[calc(100vh-136px)]">
        {/* Left Panel - Selector */}
        <div className="w-[35%] bg-white border-r">
          <div className="h-full p-6">
            <Tabs defaultValue="persona" className="h-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="persona" className="data-[state=active]:bg-blue-50">Persona</TabsTrigger>
                <TabsTrigger value="problem" className="data-[state=active]:bg-blue-50">Problem</TabsTrigger>
                <TabsTrigger value="behaviour" className="data-[state=active]:bg-blue-50">Behaviour</TabsTrigger>
              </TabsList>
              <div className="overflow-y-auto h-[calc(100%-64px)]">
                <TabsContent value="persona" className="space-y-3 mt-0">
                  <div 
                    className="p-4 rounded-lg cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors group"
                    onClick={() => handleCreateNew('persona')}
                  >
                    <div className="flex items-center justify-center text-gray-500 group-hover:text-blue-500">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Create New Persona</span>
                    </div>
                  </div>
                  {samplePersonas.map(persona => (
                    <LeiaCard
                      key={persona.metadata.name}
                      title={persona.spec.fullName || persona.metadata.name}
                      description={persona.spec.description || ''}
                      version={persona.metadata.version}
                      selected={leiaConfig.persona?.metadata.name === persona.metadata.name}
                      yaml={generateItemYaml(persona)}
                      onClick={() => handleSelect('persona', persona)}
                    />
                  ))}
                </TabsContent>
                <TabsContent value="problem" className="space-y-3 mt-0">
                  <div 
                    className="p-4 rounded-lg cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors group"
                    onClick={() => handleCreateNew('problem')}
                  >
                    <div className="flex items-center justify-center text-gray-500 group-hover:text-blue-500">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Create New Problem</span>
                    </div>
                  </div>
                  {sampleProblems.map(problem => (
                    <LeiaCard
                      key={problem.metadata.name}
                      title={problem.metadata.name}
                      description={problem.spec.description || ''}
                      version={problem.metadata.version}
                      selected={leiaConfig.problem?.metadata.name === problem.metadata.name}
                      yaml={generateItemYaml(problem)}
                      onClick={() => handleSelect('problem', problem)}
                    />
                  ))}
                </TabsContent>
                <TabsContent value="behaviour" className="space-y-3 mt-0">
                  <div 
                    className="p-4 rounded-lg cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors group"
                    onClick={() => handleCreateNew('behaviour')}
                  >
                    <div className="flex items-center justify-center text-gray-500 group-hover:text-blue-500">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Create New Behaviour</span>
                    </div>
                  </div>
                  {sampleBehaviours.map(behaviour => (
                    <LeiaCard
                      key={behaviour.metadata.name}
                      title={behaviour.metadata.name}
                      description={behaviour.spec.description || ''}
                      version={behaviour.metadata.version}
                      selected={leiaConfig.behaviour?.metadata.name === behaviour.metadata.name}
                      yaml={generateItemYaml(behaviour)}
                      onClick={() => handleSelect('behaviour', behaviour)}
                    />
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Center Panel - Preview */}
        <div className="w-[35%] bg-white border-r p-6">
          <h2 className="text-xl font-semibold mb-6">LEIA Preview</h2>
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.persona?.spec.fullName || 'No persona selected'}
              </p>
              {leiaConfig.persona && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.persona.spec.description}</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.problem?.metadata.name || 'No problem selected'}
              </p>
              {leiaConfig.problem && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.problem.spec.description}</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Behaviour</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.behaviour?.metadata.name || 'No behaviour selected'}
              </p>
              {leiaConfig.behaviour && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.behaviour.spec.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - YAML */}
        <div className="w-[30%] bg-white p-6">
          <h2 className="text-xl font-semibold mb-6">Generated YAML</h2>
          <div className="h-[calc(100%-64px)]">
            <Editor
              height="100%"
              language="yaml"
              theme="vs-dark"
              value={generateLeiaYaml()}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
              }}
            />
          </div>
        </div>
      </div>

      <CreateSidebar
        isOpen={createSidebar.isOpen}
        onClose={() => setCreateSidebar({ isOpen: false, type: null, yaml: '' })}
        title={`Create New ${createSidebar.type ? createSidebar.type.charAt(0).toUpperCase() + createSidebar.type.slice(1) : ''}`}
        yaml={createSidebar.yaml}
        onSave={handleSaveNewItem}
      />
    </div>
  );
}; 