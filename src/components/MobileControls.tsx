import React, { useEffect } from 'react';
import { InputManager } from '../game/InputManager';

interface MobileControlsProps {
  inputManager: InputManager;
}

export function MobileControls({ inputManager }: MobileControlsProps) {
  // We use standard empty touch listeners on buttons but handle logic inside Game?
  // Let's directly feed into inputManager
  
  const handleTouchStart = (key: string) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    inputManager.setKey(key, true);
  };

  const handleTouchEnd = (key: string) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    inputManager.setKey(key, false);
  };

  // Prevent default context menu
  useEffect(() => {
    const preventContext = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventContext);
    return () => document.removeEventListener('contextmenu', preventContext);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 md:hidden select-none pointer-events-none z-50 flex justify-between items-end">
      {/* Directional */}
      <div className="flex gap-2 pointer-events-auto">
        <button
          className="w-16 h-16 bg-black/50 active:bg-zinc-800 rounded-none border-2 border-[#00FF00] flex items-center justify-center backdrop-blur-md shadow-[0_0_15px_rgba(0,255,0,0.3)] active:shadow-[0_0_30px_rgba(0,255,0,0.6)] text-[#00FF00]"
          onTouchStart={handleTouchStart('ArrowLeft')}
          onTouchEnd={handleTouchEnd('ArrowLeft')}
          onMouseDown={handleTouchStart('ArrowLeft')}
          onMouseUp={handleTouchEnd('ArrowLeft')}
          onMouseLeave={handleTouchEnd('ArrowLeft')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button
          className="w-16 h-16 bg-black/50 active:bg-zinc-800 rounded-none border-2 border-[#00FF00] flex items-center justify-center backdrop-blur-md shadow-[0_0_15px_rgba(0,255,0,0.3)] active:shadow-[0_0_30px_rgba(0,255,0,0.6)] text-[#00FF00]"
          onTouchStart={handleTouchStart('ArrowDown')}
          onTouchEnd={handleTouchEnd('ArrowDown')}
          onMouseDown={handleTouchStart('ArrowDown')}
          onMouseUp={handleTouchEnd('ArrowDown')}
          onMouseLeave={handleTouchEnd('ArrowDown')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        </button>
        <button
          className="w-16 h-16 bg-black/50 active:bg-zinc-800 rounded-none border-2 border-[#00FF00] flex items-center justify-center backdrop-blur-md shadow-[0_0_15px_rgba(0,255,0,0.3)] active:shadow-[0_0_30px_rgba(0,255,0,0.6)] text-[#00FF00]"
          onTouchStart={handleTouchStart('ArrowRight')}
          onTouchEnd={handleTouchEnd('ArrowRight')}
          onMouseDown={handleTouchStart('ArrowRight')}
          onMouseUp={handleTouchEnd('ArrowRight')}
          onMouseLeave={handleTouchEnd('ArrowRight')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pointer-events-auto">
        <button
          className="w-16 h-16 bg-black/50 active:bg-zinc-800 rounded-none border-2 border-[#00FFFF] flex items-center justify-center backdrop-blur-md shadow-[0_0_15px_rgba(0,255,255,0.3)] active:shadow-[0_0_30px_rgba(0,255,255,0.6)] text-[#00FFFF]"
          onTouchStart={handleTouchStart('ShiftLeft')}
          onTouchEnd={handleTouchEnd('ShiftLeft')}
          onMouseDown={handleTouchStart('ShiftLeft')}
          onMouseUp={handleTouchEnd('ShiftLeft')}
          onMouseLeave={handleTouchEnd('ShiftLeft')}
        >
          <span className="font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Anton' }}>Dash</span>
        </button>
        <button
          className="w-20 h-20 bg-black/50 active:bg-zinc-800 rounded-none border-2 border-[#FF00FF] flex items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(255,0,255,0.4)] active:shadow-[0_0_40px_rgba(255,0,255,0.8)] text-[#FF00FF] mb-2"
          onTouchStart={handleTouchStart('Space')}
          onTouchEnd={handleTouchEnd('Space')}
          onMouseDown={handleTouchStart('Space')}
          onMouseUp={handleTouchEnd('Space')}
          onMouseLeave={handleTouchEnd('Space')}
        >
          <span className="font-bold text-lg uppercase tracking-wider" style={{ fontFamily: 'Anton' }}>Jump</span>
        </button>
      </div>
    </div>
  );
}
