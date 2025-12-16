import React, { useState, useEffect, useRef } from 'react';
import { Brain, Star, Trophy, RefreshCw, ChevronRight, HelpCircle, Lightbulb, Volume2, Home, Flame, Image as ImageIcon, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

import Layout from './components/Layout';
import Button from './components/Button';
import { generateRiddle, checkAnswer, generateAppLogo } from './services/geminiService';
import { GameState, Category, Riddle, PlayerStats } from './types';

// Categories config
const CATEGORIES: { id: Category; icon: React.ReactNode; color: string }[] = [
  { id: 'Lucu', icon: <span className="text-2xl">😂</span>, color: 'from-yellow-400 to-orange-500' },
  { id: 'Logika', icon: <span className="text-2xl">🧠</span>, color: 'from-blue-400 to-indigo-500' },
  { id: 'Hewan', icon: <span className="text-2xl">🦁</span>, color: 'from-green-400 to-emerald-600' },
  { id: 'Benda', icon: <span className="text-2xl">📦</span>, color: 'from-purple-400 to-violet-600' },
  { id: 'Pengetahuan Umum', icon: <span className="text-2xl">📚</span>, color: 'from-red-400 to-rose-600' },
  { id: 'Acak', icon: <span className="text-2xl">🎲</span>, color: 'from-pink-400 to-fuchsia-600' },
];

const INITIAL_STATS: PlayerStats = {
  score: 0,
  streak: 0,
  lives: 9999, // Unlimited
  highScore: 0
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [category, setCategory] = useState<Category>('Acak');
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [currentRiddle, setCurrentRiddle] = useState<Riddle | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  
  // Load high score and history from local storage
  useEffect(() => {
    const savedHigh = localStorage.getItem('tebak_ai_highscore');
    if (savedHigh) {
      setStats(prev => ({ ...prev, highScore: parseInt(savedHigh) }));
    }

    const savedHistory = localStorage.getItem('tebak_ai_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedLogo = localStorage.getItem('tebak_ai_logo');
    if (savedLogo) {
      setAppLogo(savedLogo);
    }
  }, []);

  useEffect(() => {
    if (stats.score > stats.highScore) {
      setStats(prev => ({ ...prev, highScore: stats.score }));
      localStorage.setItem('tebak_ai_highscore', stats.score.toString());
    }
  }, [stats.score]);

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem('tebak_ai_history', JSON.stringify(history));
  }, [history]);

  const handleGenerateLogo = async () => {
    if (isGeneratingLogo) return;
    setIsGeneratingLogo(true);
    try {
      const logo = await generateAppLogo();
      setAppLogo(logo);
      localStorage.setItem('tebak_ai_logo', logo);
    } catch (error) {
      console.error("Failed to generate logo", error);
      alert("Gagal membuat logo. Coba lagi nanti!");
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const startGame = async (selectedCategory: Category) => {
    setCategory(selectedCategory);
    setStats({ ...INITIAL_STATS, highScore: stats.highScore });
    setGameState(GameState.LOADING);
    await loadNewRiddle(selectedCategory);
  };

  const loadNewRiddle = async (cat: Category) => {
    try {
      setGameState(GameState.LOADING);
      setShowHint(false);
      setUserAnswer('');
      setFeedback('');
      
      // Pass history to avoid duplicates
      const riddle = await generateRiddle(cat, history);
      
      setCurrentRiddle(riddle);
      
      // Add new riddle to history (store question + answer to be specific)
      setHistory(prev => {
        const newItem = `${riddle.question} (${riddle.answer})`;
        // Keep history size manageable (last 50 items)
        const newHistory = [...prev, newItem];
        if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
        return newHistory;
      });

      setGameState(GameState.PLAYING);
    } catch (e) {
      console.error(e);
      setFeedback("Gagal memuat pertanyaan. Coba lagi ya.");
      setGameState(GameState.MENU);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || !currentRiddle) return;

    setGameState(GameState.CHECKING);
    const result = await checkAnswer(currentRiddle, userAnswer);

    setFeedback(result.feedback);

    if (result.isCorrect) {
      handleSuccess();
    } else {
      handleFailure();
    }
  };

  const handleSuccess = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#ec4899', '#3b82f6']
    });
    
    setStats(prev => ({
      ...prev,
      score: prev.score + 10 + (prev.streak * 2),
      streak: prev.streak + 1
    }));
    setGameState(GameState.RESULT);
  };

  const handleFailure = () => {
    setStats(prev => ({
      ...prev,
      // Lives are unlimited, so we don't decrement them
      streak: 0
    }));
    
    // Game never ends due to failure
    setGameState(GameState.RESULT);
  };

  const handleNext = () => {
    loadNewRiddle(category);
  };

  const handleExit = () => {
    setGameState(GameState.MENU);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Render Functions ---

  const renderMenu = () => (
    <div className="w-full max-w-2xl flex flex-col gap-8 animate-fade-in items-center">
      <div className="text-center space-y-4 w-full flex flex-col items-center">
        {appLogo ? (
           <div className="relative group w-48 h-48 mx-auto mb-4">
             <img src={appLogo} alt="App Logo" className="w-full h-full object-contain rounded-3xl shadow-2xl shadow-violet-500/20" />
             <button 
                onClick={handleGenerateLogo}
                disabled={isGeneratingLogo}
                className="absolute bottom-2 right-2 p-2 bg-slate-900/80 backdrop-blur text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 hover:bg-violet-600"
                title="Generate Logo Baru"
             >
               {isGeneratingLogo ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
             </button>
           </div>
        ) : (
          <div className="mb-4">
             <Button variant="secondary" onClick={handleGenerateLogo} isLoading={isGeneratingLogo} className="text-sm py-2 px-4 rounded-full">
               <Sparkles size={16} /> Bikin Logo AI
             </Button>
          </div>
        )}

        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400 drop-shadow-sm tracking-tight py-2">
          Tebak AI
        </h1>
        <p className="text-lg text-slate-300 max-w-md mx-auto">
          Mode Tanpa Batas! Pilih kategori dan main sepuasnya tanpa takut Game Over.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => startGame(cat.id)}
            className={`
              relative group overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-105 active:scale-95
              bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600
              flex flex-col items-center justify-center gap-3 shadow-xl
            `}
          >
            <div className={`
              absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300
              bg-gradient-to-br ${cat.color}
            `} />
            <div className="transform transition-transform group-hover:-translate-y-1 duration-300">
              {cat.icon}
            </div>
            <span className="font-bold text-slate-200 group-hover:text-white transition-colors">
              {cat.id}
            </span>
          </button>
        ))}
      </div>

      {stats.highScore > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-4 flex items-center justify-center gap-2 text-yellow-400 border border-yellow-500/20">
          <Trophy size={20} />
          <span className="font-bold">Skor Tertinggi: {stats.highScore}</span>
        </div>
      )}
    </div>
  );

  const renderPlaying = () => (
    <div className="w-full max-w-xl flex flex-col gap-6">
      {/* HUD */}
      <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-orange-400 font-bold bg-slate-900/50 px-3 py-1 rounded-full">
            <Flame size={18} fill="currentColor" /> {stats.streak}
          </div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold bg-slate-900/50 px-3 py-1 rounded-full">
            <Star size={18} fill="currentColor" /> {stats.score}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm font-semibold tracking-wider uppercase hidden md:block">
            {category}
          </div>
          <button 
            onClick={handleExit}
            className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Ke Menu Utama"
          >
            <Home size={18} />
          </button>
        </div>
      </div>

      {/* Riddle Card */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
         {/* Decorative quotes */}
         <div className="absolute top-4 left-6 text-6xl text-white/5 font-serif select-none">“</div>
         <div className="absolute bottom-4 right-6 text-6xl text-white/5 font-serif select-none transform rotate-180">“</div>

        <div className="relative z-10 flex flex-col gap-6 items-center text-center">
          <div className="flex items-center gap-3">
             <Brain size={32} className="text-violet-400" />
             <h3 className="text-xl font-bold text-violet-200">Pertanyaan</h3>
             <button onClick={() => currentRiddle && speak(currentRiddle.question)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                <Volume2 size={20} />
             </button>
          </div>
          
          <p className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
            {currentRiddle?.question}
          </p>

          {showHint && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2">
              <Lightbulb size={16} className="text-yellow-400 shrink-0" />
              {currentRiddle?.hint}
            </div>
          )}
        </div>
      </div>

      {/* Inputs */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Ketik jawabanmu..."
          className="w-full bg-slate-800/50 border-2 border-slate-700 focus:border-violet-500 text-white placeholder-slate-500 rounded-2xl px-6 py-4 text-lg outline-none transition-all shadow-inner text-center"
          autoFocus
          disabled={gameState === GameState.CHECKING}
        />
        
        <div className="grid grid-cols-4 gap-3">
            <Button
                type="button"
                variant="secondary"
                className="col-span-1"
                onClick={() => setShowHint(true)}
                disabled={showHint || gameState === GameState.CHECKING}
                title="Lihat Petunjuk"
            >
                <HelpCircle size={24} />
            </Button>
            <Button 
                type="submit" 
                isLoading={gameState === GameState.CHECKING}
                className="col-span-3 text-lg"
            >
                Jawab
            </Button>
        </div>
      </form>
    </div>
  );

  const renderResult = () => {
    const isCorrect = feedback.toLowerCase().includes("benar") || feedback.toLowerCase().includes("hebat") || feedback.toLowerCase().includes("tepat") || feedback.toLowerCase().includes("mantap");
    
    return (
      <div className="w-full max-w-lg flex flex-col gap-6 animate-scale-in">
        <div className={`
          relative rounded-3xl p-8 md:p-10 shadow-2xl text-center overflow-hidden
          ${isCorrect ? 'bg-gradient-to-br from-emerald-500/20 to-green-600/20 border-emerald-500/30' : 'bg-gradient-to-br from-rose-500/20 to-red-600/20 border-rose-500/30'}
          border backdrop-blur-md
        `}>
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg mb-2
              ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}
            `}>
              {isCorrect ? '🎉' : '😓'}
            </div>

            <h2 className="text-3xl font-black text-white">
              {isCorrect ? 'Mantap Betul!' : 'Yah, Kurang Tepat!'}
            </h2>
            
            <p className="text-slate-200 text-lg leading-relaxed">
              {feedback}
            </p>

            <div className="w-full h-px bg-white/10 my-2"></div>

            <div className="bg-slate-900/40 rounded-xl p-4 w-full">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Jawaban Benar</div>
              <div className="text-xl font-bold text-white">{currentRiddle?.answer}</div>
            </div>

            {currentRiddle?.funFact && (
               <div className="text-sm text-slate-300 mt-2 bg-white/5 p-3 rounded-lg border border-white/5">
                 <span className="font-bold text-violet-300">Fun Fact:</span> {currentRiddle.funFact}
               </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
            <Button onClick={handleNext} className="w-full py-4 text-lg">
            Lanjut <ChevronRight size={24} />
            </Button>
            <Button onClick={handleExit} variant="secondary" className="w-full py-3">
                <Home size={20} /> Kembali ke Menu
            </Button>
        </div>
      </div>
    );
  };

  // Although unreachable in Unlimited mode, kept for compatibility if logic changes
  const renderGameOver = () => (
    <div className="w-full max-w-lg flex flex-col items-center gap-8 animate-scale-in text-center">
      <div className="relative">
         <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-20 animate-pulse"></div>
         <Trophy size={80} className="text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-5xl font-black text-white">Selesai</h2>
        <p className="text-slate-400 text-lg">Permainan berakhir. Usaha yang bagus!</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase font-bold">Skor Akhir</span>
          <span className="text-4xl font-black text-white">{stats.score}</span>
        </div>
        <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
           <span className="text-slate-400 text-sm uppercase font-bold">High Score</span>
           <span className="text-4xl font-black text-yellow-400">{stats.highScore}</span>
        </div>
      </div>

      <div className="flex flex-col w-full gap-3">
        <Button onClick={() => setGameState(GameState.MENU)} variant="primary" className="w-full py-4 text-lg">
            <RefreshCw size={20} /> Main Lagi
        </Button>
        <Button onClick={() => { setHistory([]); localStorage.removeItem('tebak_ai_history'); }} variant="ghost" className="w-full text-sm text-slate-500">
            Reset Riwayat Soal (Agar Fresh)
        </Button>
      </div>
    </div>
  );

  return (
    <Layout>
      {gameState === GameState.MENU && renderMenu()}
      {gameState === GameState.LOADING && (
         <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-violet-200 font-medium">Sedang memikirkan tebak-tebakan...</p>
         </div>
      )}
      {(gameState === GameState.PLAYING || gameState === GameState.CHECKING) && renderPlaying()}
      {gameState === GameState.RESULT && renderResult()}
      {gameState === GameState.GAME_OVER && renderGameOver()}
    </Layout>
  );
}