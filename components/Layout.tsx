import React from 'react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen w-full relative bg-slate-900 overflow-hidden flex flex-col">
      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[100px] animate-float opacity-50 mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-float opacity-40 mix-blend-screen pointer-events-none" style={{ animationDelay: '-3s' }}></div>
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-pink-500/20 rounded-full blur-[80px] animate-float opacity-30 mix-blend-screen pointer-events-none" style={{ animationDelay: '-1.5s' }}></div>
      
      {/* Content */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 md:p-6 w-full max-w-4xl mx-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-slate-500 text-sm">
        Powered by Gemini AI • Tebak-Tebakan Seru
      </footer>
    </div>
  );
};

export default Layout;