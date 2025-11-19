export interface Appointment {
  id: string;
  title: string; // Reason for visit / Appointment Type
  doctorName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  notes: string; // Symptoms / History
  recordings: Recording[];
  createdAt: number;
}

export interface DialogueTurn {
  speaker: string;
  text: string;
}

export interface Recording {
  id: string;
  timestamp: number;
  audioData: string; // Base64
  mimeType: string;
  transcript?: string | DialogueTurn[];
  summary?: string;
  isProcessing: boolean;
  error?: string;
}

export interface AnalysisResult {
  transcript: DialogueTurn[];
  summary: string;
}