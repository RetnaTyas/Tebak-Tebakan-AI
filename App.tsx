
import React, { useState, useEffect, useRef } from 'react';
import { Brain, Star, Trophy, RefreshCw, ChevronRight, HelpCircle, Lightbulb, Volume2, Home, Flame, Sparkles, EyeOff, Settings, Key, Lock, Eye, CheckCircle, AlertTriangle, XCircle, Play, UserCog } from 'lucide-react';
import confetti from 'canvas-confetti';

import Layout from './components/Layout';
import Button from './components/Button';
import { generateRiddle, checkAnswer, validateAnswerLocal, analyzeUserPattern } from './services/geminiService';
import { GameState, Riddle, PlayerStats, UserProfile } from './types';
import * as dbService from './services/storage';

const INITIAL_STATS: PlayerStats = {
  score: 0,
  streak: 0,
  lives: 9999, // Unlimited
  highScore: 0
};

type ResultStatus = 'CORRECT' | 'CLOSE' | 'WRONG';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [currentRiddle, setCurrentRiddle] = useState<Riddle | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const [resultStatus, setResultStatus] = useState<ResultStatus>('WRONG');
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [enableAnimation, setEnableAnimation] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userPersona, setUserPersona] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [inputApiKey, setInputApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const nextRiddlePromise = useRef<Promise<Riddle> | null>(null);
  const attemptCountRef = useRef(0);
  
  // Initialization
  useEffect(() => {
    // Load local storage
    const savedHigh = localStorage.getItem('tebak_ai_highscore');
    if (savedHigh) setStats(prev => ({ ...prev, highScore: parseInt(savedHigh) }));

    const savedHistory = localStorage.getItem('tebak_ai_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedKey = localStorage.getItem('tebak_ai_apikey');
    const keyToUse = savedKey || '';
    setApiKey(keyToUse);
    setInputApiKey(keyToUse);

    // Initialize DB and load Persona
    dbService.initDB().then(async () => {
      const persona = await dbService.getUserProfile();
      if (persona) setUserPersona(persona);
    });
  }, []);

  useEffect(() => {
    if (stats.score > stats.highScore) {
      setStats(prev => ({ ...prev, highScore: stats.score }));
      localStorage.setItem('tebak_ai_highscore', stats.score.toString());
    }
  }, [stats.score]);

  useEffect(() => {
    localStorage.setItem('tebak_ai_history', JSON.stringify(history));
  }, [history]);

  // Logic Analisa User Pattern
  const performAnalysis = async () => {
    if (isAnalyzing || !apiKey) return;
    
    setIsAnalyzing(true);
    try {
      const attempts = await dbService.getRecentAttempts(20);
      const newPersona = await analyzeUserPattern(apiKey, attempts);
      if (newPersona) {
        setUserPersona(newPersona);
        await dbService.saveUserProfile(newPersona);
        console.log("Updated Persona:", newPersona);
      }
    } catch (e) {
      console.error("Analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveApiKey = () => {
    if (inputApiKey.trim()) {
      localStorage.setItem('tebak_ai_apikey', inputApiKey.trim());
      setApiKey(inputApiKey.trim());
      setErrorMsg(null);
      setGameState(GameState.MENU);
      alert("API Key berhasil disimpan!");
    } else {
      localStorage.removeItem('tebak_ai_apikey');
      setApiKey('');
      alert("API Key dihapus.");
    }
  };

  const preloadNextRiddle = (currentHistory: string[], key: string, persona: string) => {
    if (!key) return;
    nextRiddlePromise.current = generateRiddle(key, currentHistory, persona).catch(e => {
        console.warn("Prefetch failed:", e);
        throw e;
    });
  };

  const startGame = async () => {
    if (!apiKey) {
        setGameState(GameState.SETTINGS);
        return;
    }
    setStats({ ...INITIAL_STATS, highScore: stats.highScore });
    setErrorMsg(null);
    nextRiddlePromise.current = null;
    attemptCountRef.current = 0;
    setGameState(GameState.LOADING);
    await loadNewRiddle();
  };

  const loadNewRiddle = async () => {
    try {
      setGameState(GameState.LOADING);
      setShowHint(false);
      setUserAnswer('');
      setFeedback('');
      setResultStatus('WRONG');
      setErrorMsg(null);
      
      let riddle: Riddle;

      if (nextRiddlePromise.current) {
        try {
            riddle = await nextRiddlePromise.current;
        } catch (e) {
            riddle = await generateRiddle(apiKey, history, userPersona);
        }
        nextRiddlePromise.current = null;
      } else {
        riddle = await generateRiddle(apiKey, history, userPersona);
      }
      
      // Save Riddle to DB immediately
      await dbService.saveRiddleToDB(riddle);
      
      setCurrentRiddle(riddle);
      
      const newItem = `${riddle.question} (${riddle.answer})`;
      const newHistory = [...history, newItem];
      if (newHistory.length > 50) newHistory.shift(); 
      setHistory(newHistory);

      preloadNextRiddle(newHistory, apiKey, userPersona);
      setGameState(GameState.PLAYING);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Gagal memuat pertanyaan.");
      setGameState(GameState.MENU);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || !currentRiddle) return;

    // 1. Check current RIDDLE object from state (fastest)
    let localValidation = validateAnswerLocal(currentRiddle, userAnswer);
    
    // 1b. Check DB for updated synonyms (if riddle was loaded from cache but synonyms updated)
    if (!localValidation) {
      const dbRiddle = await dbService.getRiddleFromDB(currentRiddle.id);
      if (dbRiddle) {
        localValidation = validateAnswerLocal(dbRiddle, userAnswer);
      }
    }

    // Save attempt function wrapper
    const saveAttempt = async (isCorrect: boolean, fb: string) => {
      await dbService.saveAttemptToDB({
        riddleId: currentRiddle.id,
        userAnswer,
        isCorrect,
        feedback: fb,
        timestamp: Date.now()
      });
      attemptCountRef.current += 1;

      // Check for analysis trigger strictly based on count
      if (attemptCountRef.current > 0 && attemptCountRef.current % 5 === 0) {
        performAnalysis(); // Fire and forget (background)
      }
    };

    if (localValidation) {
        setFeedback(localValidation.feedback);
        setResultStatus('CORRECT');
        await saveAttempt(true, localValidation.feedback);
        handleSuccess();
        return;
    }

    // 2. ASK AI (Slow path, but smart)
    setGameState(GameState.CHECKING);
    try {
        const result = await checkAnswer(apiKey, currentRiddle, userAnswer, userPersona);
        setFeedback(result.feedback);

        await saveAttempt(result.isCorrect, result.feedback);

        if (result.isCorrect) {
          // AI says correct, but it wasn't in our local synonyms.
          // TEACH THE SYSTEM: Update local synonyms for next time
          await dbService.updateRiddleSynonyms(currentRiddle.id, userAnswer);
          
          setResultStatus('CORRECT');
          handleSuccess();
        } else if (result.isClose) {
          setResultStatus('CLOSE');
          handleFailure();
        } else {
          setResultStatus('WRONG');
          handleFailure();
        }
    } catch (e: any) {
        alert(`Gagal menilai: ${e.message}`);
        setGameState(GameState.PLAYING);
    }
  };

  const handleSuccess = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#ec4899', '#3b82f6']
    });
    
    const basePoints = 10;
    const streakBonus = stats.streak * 2;
    setStats(prev => ({
      ...prev,
      score: prev.score + basePoints + streakBonus,
      streak: prev.streak + 1
    }));
    setGameState(GameState.RESULT);
  };

  const handleFailure = () => {
    setStats(prev => ({ ...prev, streak: 0 }));
    setGameState(GameState.RESULT);
  };

  const handleNext = () => loadNewRiddle();
  const handleExit = () => {
    setGameState(GameState.MENU);
    nextRiddlePromise.current = null;
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      window.speechSynthesis.speak(utterance);
    }
  };

  const renderSettings = () => (
    <div className="w-full max-w-md flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-3 text-slate-200 mb-2">
            <Button variant="ghost" className="p-2" onClick={() => setGameState(GameState.MENU)}>
                <Home size={20} />
            </Button>
            <h2 className="text-2xl font-bold">Pengaturan API Key</h2>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-md shadow-xl">
            <div className="flex flex-col gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200 flex gap-3">
                    <Key size={24} className="shrink-0 text-blue-400" />
                    <p>Aplikasi ini membutuhkan <strong>Gemini API Key</strong>. Key disimpan di browser (Local Storage).</p>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-slate-400 text-sm font-bold uppercase tracking-wider ml-1">Masukkan API Key</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Lock size={18} /></div>
                        <input 
                            type={showKey ? "text" : "password"}
                            value={inputApiKey}
                            onChange={(e) => setInputApiKey(e.target.value)}
                            placeholder="Contoh: AIzaSy..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 text-white rounded-xl pl-10 pr-10 py-3 outline-none transition-all"
                        />
                        <button type="button" onClick={() => setShowKey(!showKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300">
                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <Button onClick={handleSaveApiKey} className="w-full mt-2"><CheckCircle size={20} /> Simpan Key</Button>
            </div>
        </div>
    </div>
  );

  const renderMenu = () => (
    <div className="w-full max-w-2xl flex flex-col gap-8 animate-fade-in items-center">
      <div className="absolute top-4 right-4 z-20">
          <button onClick={() => setGameState(GameState.SETTINGS)} className={`p-3 rounded-full backdrop-blur-md transition-all border ${!apiKey ? 'bg-red-500/20 border-red-500 text-red-200 animate-pulse' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <Settings size={20} />
          </button>
      </div>
      <div className="text-center space-y-4 w-full flex flex-col items-center pt-8">
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400 drop-shadow-sm tracking-tight py-2">
          Tebak-Tebakan Seru
        </h1>
        <p className="text-lg text-slate-300 max-w-md mx-auto">Tantangan Tebak-tebakan Seru Tanpa Batas!</p>
        
        {userPersona && (
           <div className="flex items-center gap-2 text-xs bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full text-violet-300 animate-fade-in">
             <UserCog size={14} className="text-violet-400" />
             <span>AI: "{userPersona.substring(0, 35)}{userPersona.length > 35 ? '...' : ''}"</span>
           </div>
        )}

        {errorMsg && (
            <div className="w-full max-w-lg bg-rose-500/10 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertTriangle className="shrink-0 mt-1" size={20} />
                <div className="flex-1"><p className="font-bold text-sm">Terjadi Kesalahan</p><p className="text-sm opacity-90">{errorMsg}</p></div>
                <button onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white"><XCircle size={18} /></button>
            </div>
        )}
        
        {!apiKey && !errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-3 rounded-2xl flex items-center gap-3 max-w-md animate-bounce cursor-pointer hover:bg-red-500/20 transition-colors" onClick={() => setGameState(GameState.SETTINGS)}>
                <Key size={20} /> <span className="font-bold">Setup API Key dulu yuk!</span>
            </div>
        )}
        
        <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => setEnableAnimation(!enableAnimation)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${enableAnimation ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 hover:bg-indigo-500/30' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
              {enableAnimation ? <Sparkles size={18} /> : <EyeOff size={18} />} <span className="font-bold text-sm uppercase tracking-wider">Efek: {enableAnimation ? 'ON' : 'OFF'}</span>
            </button>
        </div>
      </div>

      <div className="w-full flex justify-center mt-8">
          <button onClick={startGame} disabled={!apiKey} className={`relative group overflow-hidden rounded-full p-8 md:p-10 transition-all duration-300 ${!apiKey ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]'} bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-xl flex flex-col items-center justify-center gap-2 w-64 h-64 border-4 border-white/20`}>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
            <Play size={64} fill="currentColor" className="text-white drop-shadow-md ml-2" />
            <span className="font-black text-2xl text-white tracking-wider mt-2">MULAI MAIN</span>
            <span className="text-white/80 text-sm font-medium">Mode Pintar</span>
          </button>
      </div>

      <div className="flex gap-4 w-full justify-center flex-wrap max-w-md mt-4">
        {stats.score > 0 && <div className="bg-slate-800/40 rounded-xl p-4 flex items-center justify-center gap-2 text-violet-400 border border-violet-500/20 flex-1 min-w-[140px]"><Star size={20} /><span className="font-bold">Skor: {stats.score}</span></div>}
        {stats.highScore > 0 && <div className="bg-slate-800/40 rounded-xl p-4 flex items-center justify-center gap-2 text-yellow-400 border border-yellow-500/20 flex-1 min-w-[140px]"><Trophy size={20} /><span className="font-bold">Rekor: {stats.highScore}</span></div>}
      </div>
    </div>
  );

  const renderPlaying = () => (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-orange-400 font-bold bg-slate-900/50 px-3 py-1 rounded-full"><Flame size={18} fill="currentColor" /> {stats.streak}</div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold bg-slate-900/50 px-3 py-1 rounded-full"><Star size={18} fill="currentColor" /> {stats.score}</div>
        </div>
        <div className="flex items-center gap-3">
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 animate-pulse bg-violet-500/10 px-2 py-1 rounded-md border border-violet-500/20">
              <UserCog size={12} className="text-violet-400" />
              <span className="text-xs font-semibold text-violet-300 tracking-wide">Menganalisa Gaya...</span>
            </div>
          )}
          <button onClick={handleExit} className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors" title="Ke Menu Utama"><Home size={18} /></button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
         <div className="absolute top-4 left-6 text-6xl text-white/5 font-serif select-none">“</div>
         <div className="absolute bottom-4 right-6 text-6xl text-white/5 font-serif select-none transform rotate-180">“</div>
        <div className="relative z-10 flex flex-col gap-6 items-center text-center">
          <div className="flex items-center gap-3">
             <Brain size={32} className="text-violet-400" />
             <h3 className="text-xl font-bold text-violet-200">Pertanyaan</h3>
             <button onClick={() => currentRiddle && speak(currentRiddle.question)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"><Volume2 size={20} /></button>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white leading-relaxed">{currentRiddle?.question}</p>
          {showHint && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2">
              <Lightbulb size={16} className="text-yellow-400 shrink-0" /> {currentRiddle?.hint}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Ketik jawabanmu..." className="w-full bg-slate-800/50 border-2 border-slate-700 focus:border-violet-500 text-white placeholder-slate-500 rounded-2xl px-6 py-4 text-lg outline-none transition-all shadow-inner text-center" autoFocus disabled={gameState === GameState.CHECKING} />
        <div className="grid grid-cols-4 gap-3">
            <Button type="button" variant="secondary" className="col-span-1" onClick={() => setShowHint(true)} disabled={showHint || gameState === GameState.CHECKING} title="Lihat Petunjuk"><HelpCircle size={24} /></Button>
            <Button type="submit" isLoading={gameState === GameState.CHECKING} className="col-span-3 text-lg">Jawab</Button>
        </div>
      </form>
    </div>
  );

  const renderResult = () => {
    let headerText = "Yah, Kurang Tepat!";
    let bgClass = "bg-gradient-to-br from-rose-500/20 to-red-600/20 border-rose-500/30";
    let icon = "😓";
    let iconClass = "bg-rose-500 text-white";

    if (resultStatus === 'CORRECT') {
      headerText = "Mantap Betul!";
      bgClass = "bg-gradient-to-br from-emerald-500/20 to-green-600/20 border-emerald-500/30";
      icon = "🎉";
      iconClass = "bg-emerald-500 text-white";
    } else if (resultStatus === 'CLOSE') {
      headerText = "Dikit Lagi!";
      bgClass = "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30";
      icon = "😬";
      iconClass = "bg-amber-500 text-white";
    }
    
    return (
      <div className="w-full max-w-lg flex flex-col gap-6 animate-scale-in">
        <div className={`relative rounded-3xl p-8 md:p-10 shadow-2xl text-center overflow-hidden ${bgClass} border backdrop-blur-md`}>
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg mb-2 ${iconClass}`}>{icon}</div>
            <h2 className="text-3xl font-black text-white">{headerText}</h2>
            <p className="text-slate-200 text-lg leading-relaxed">{feedback}</p>
            <div className="w-full h-px bg-white/10 my-2"></div>
            <div className="bg-slate-900/40 rounded-xl p-4 w-full">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Jawaban Benar</div>
              <div className="text-xl font-bold text-white">{currentRiddle?.answer}</div>
            </div>
            {currentRiddle?.funFact && (
               <div className="text-sm text-slate-300 mt-2 bg-white/5 p-3 rounded-lg border border-white/5"><span className="font-bold text-violet-300">Fun Fact:</span> {currentRiddle.funFact}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
            <Button onClick={handleNext} className="w-full py-4 text-lg">Lanjut <ChevronRight size={24} /></Button>
            <Button onClick={handleExit} variant="secondary" className="w-full py-3"><Home size={20} /> Kembali ke Menu</Button>
        </div>
      </div>
    );
  };

  const renderGameOver = () => (
    <div className="w-full max-w-lg flex flex-col items-center gap-8 animate-scale-in text-center">
      <div className="relative">
         <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-20 animate-pulse"></div>
         <Trophy size={80} className="text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
      </div>
      <div className="space-y-2"><h2 className="text-5xl font-black text-white">Selesai</h2><p className="text-slate-400 text-lg">Permainan berakhir. Usaha yang bagus!</p></div>
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/5 flex flex-col items-center"><span className="text-slate-400 text-sm uppercase font-bold">Skor Akhir</span><span className="text-4xl font-black text-white">{stats.score}</span></div>
        <div className="bg-slate-800/60 p-6 rounded-2xl border border-white/5 flex flex-col items-center"><span className="text-slate-400 text-sm uppercase font-bold">High Score</span><span className="text-4xl font-black text-yellow-400">{stats.highScore}</span></div>
      </div>
      <div className="flex flex-col w-full gap-3">
        <Button onClick={() => setGameState(GameState.MENU)} variant="primary" className="w-full py-4 text-lg"><RefreshCw size={20} /> Main Lagi</Button>
      </div>
    </div>
  );

  return (
    <Layout enableAnimation={enableAnimation}>
      {gameState === GameState.MENU && renderMenu()}
      {gameState === GameState.SETTINGS && renderSettings()}
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