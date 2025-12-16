import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  enableAnimation?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, enableAnimation = true }) => {
  return (
    <div className="min-h-screen w-full relative bg-slate-900 overflow-hidden flex flex-col">
      {/* Animated Background Elements */}
      {enableAnimation && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-float opacity-40 mix-blend-screen pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-float opacity-30 mix-blend-screen pointer-events-none" style={{ animationDelay: '-5s' }}></div>
          <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-pink-500/10 rounded-full blur-[80px] animate-float opacity-20 mix-blend-screen pointer-events-none" style={{ animationDelay: '-2.5s' }}></div>
        </>
      )}
      
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