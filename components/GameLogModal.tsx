
import React from 'react';
import { History, XCircle, CheckCircle, X, AlertCircle } from 'lucide-react';
import Button from './Button';
import { GameLogEntry } from '../types';

interface GameLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
}

const GameLogModal: React.FC<GameLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-700/50 rounded-2xl text-slate-300">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-none">Riwayat Permainan</h3>
              <p className="text-slate-400 text-sm mt-1">Daftar tebakanmu sebelumnya</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full text-slate-300 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-3">
              <History size={40} className="opacity-20" />
              <p>Belum ada riwayat permainan.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
                <p className="text-white font-medium mb-3 text-sm md:text-base leading-relaxed">"{log.question}"</p>
                
                <div className="flex flex-col gap-2">
                  {/* User Answer */}
                  <div className={`flex items-center gap-2 text-sm p-2 rounded-lg border ${
                    log.status === 'CORRECT' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                      : log.status === 'CLOSE'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}>
                    {log.status === 'CORRECT' && <CheckCircle size={16} className="shrink-0" />}
                    {log.status === 'CLOSE' && <AlertCircle size={16} className="shrink-0" />}
                    {log.status === 'WRONG' && <X size={16} className="shrink-0" />}
                    
                    <span className="font-bold">Jawabanmu:</span>
                    <span className="break-all">{log.userAnswer}</span>
                  </div>

                  {/* Correct Answer (Only if wrong or close) */}
                  {log.status !== 'CORRECT' && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400">
                      <CheckCircle size={16} className="shrink-0 text-slate-500" />
                      <span className="font-bold">Jawaban Benar:</span>
                      <span className="text-slate-300">{log.correctAnswer}</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-600 mt-2 text-right">
                    {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-slate-700/50 shrink-0">
           <Button onClick={onClose} variant="ghost" className="w-full border border-slate-700">Tutup</Button>
        </div>

      </div>
    </div>
  );
};

export default GameLogModal;
