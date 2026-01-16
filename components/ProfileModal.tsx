
import React from 'react';
import { UserCog, Sparkles, XCircle } from 'lucide-react';
import Button from './Button';
import { PlayerStats } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  persona: string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, stats, persona }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden transform scale-100 transition-transform" onClick={e => e.stopPropagation()}>
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 blur-[50px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white shadow-lg">
                      <UserCog size={28} />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-white leading-none">Profil Pemain</h3>
                      <p className="text-slate-400 text-sm mt-1">Analisa AI Gemini</p>
                  </div>
              </div>
              <button onClick={onClose} className="bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full text-slate-300 hover:text-white transition-colors">
                  <XCircle size={20} />
              </button>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-indigo-500"></div>
              <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                 <Sparkles size={12} /> Persona Kamu
              </h4>
              <p className="text-slate-200 leading-relaxed text-lg font-medium">
                  "{persona || "Belum ada cukup data. Terus mainkan game untuk membuka analisa gaya bermainmu!"}"
              </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-700/30 p-4 rounded-xl text-center border border-slate-600/30">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Skor</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-orange-400">{stats.score}</div>
               </div>
               <div className="bg-slate-700/30 p-4 rounded-xl text-center border border-slate-600/30">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-1">High Score</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-violet-300 to-fuchsia-400">{stats.highScore}</div>
               </div>
          </div>
          
          <div className="text-[10px] text-slate-500 text-center px-4">
              AI menganalisa pola jawabanmu setiap 5 pertanyaan untuk menyesuaikan tingkat kesulitan dan gaya bahasa tebakan selanjutnya.
          </div>

          <Button onClick={onClose} className="w-full">Tutup</Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
