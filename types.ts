export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  WAITING_FOR_CLARIFICATION = 'WAITING_FOR_CLARIFICATION',
  GENERATING_FINAL = 'GENERATING_FINAL',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string (without data prefix)
}

export type Theme = 'light' | 'dark' | 'system';

// New structured interface for the analysis phase
export interface AnalysisData {
  understanding: string;
  reasoning: string;
  gaps: string[];
  strategy: string;
}

export interface PromptState {
  originalRequest: string;
  attachments: Attachment[];
  analysisOutput: AnalysisData | null; // Changed from string to object
  gapAnswers: string[]; // Store answers corresponding to gaps
  finalPrompt: string;
}