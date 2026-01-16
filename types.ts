export type Category = 'Lucu' | 'Logika' | 'Hewan' | 'Benda' | 'Acak' | 'Pengetahuan Umum';

export interface Riddle {
  question: string;
  answer: string;
  hint: string;
  funFact: string;
}

export interface AnswerValidation {
  isCorrect: boolean;
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