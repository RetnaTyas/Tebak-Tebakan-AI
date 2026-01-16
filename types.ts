
export type Category = 'Acak';

export interface Riddle {
  id: string; // Unique ID for DB
  question: string;
  answer: string;
  acceptedAnswers: string[]; // List variasi jawaban untuk validasi instan
  hint: string;
  funFact: string;
  createdAt?: number;
}

export interface Attempt {
  id?: number;
  riddleId: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback: string;
  timestamp: number;
}

export interface UserProfile {
  persona: string; // Description of user style (e.g. "Suka singkatan", "Logis")
  lastUpdated: number;
}

export interface AnswerValidation {
  isCorrect: boolean;
  isClose: boolean;
  feedback: string;
  similarityScore?: number;
}

export enum GameState {
  MENU = 'MENU',
  SETTINGS = 'SETTINGS',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  CHECKING = 'CHECKING',
  RESULT = 'RESULT',
  GAME_OVER = 'GAME_OVER'
}

export interface PlayerStats {
  score: number;
  streak: number;
  lives: number;
  highScore: number;
}

export interface GameLogEntry {
  id: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  status: 'CORRECT' | 'CLOSE' | 'WRONG';
  timestamp: number;
}
