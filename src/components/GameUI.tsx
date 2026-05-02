import { useEffect, useState } from 'react';

interface GameUIProps {
  gameState: 'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED';
  level: number;
  onStart: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
}

export function GameUI({ gameState, level, onStart, onRestart, onNextLevel }: GameUIProps) {
  if (gameState === 'PLAYING') {
    return (
      <div className="absolute top-4 left-4 pointer-events-none select-none z-40">
        <div className="text-white font-mono text-xl text-shadow font-bold">LEVEL {level}</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
        {gameState === 'MENU' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter" style={{ fontFamily: 'Anton, sans-serif' }}>Neon Dash</h1>
            <p className="text-zinc-400 mb-8 text-sm">Use Arrow Keys to move, Space to Jump, Shift to Dash.</p>
            <button
              onClick={onStart}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Play Game
            </button>
          </>
        )}

        {gameState === 'GAMEOVER' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-red-500" style={{ fontFamily: 'Anton, sans-serif' }}>Wasted</h1>
            <p className="text-zinc-400 mb-8 text-sm">You died on Level {level}.</p>
            <button
              onClick={onRestart}
              className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Try Again
            </button>
          </>
        )}

        {gameState === 'WIN' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-emerald-400" style={{ fontFamily: 'Anton, sans-serif' }}>Level Cleared!</h1>
            <p className="text-zinc-400 mb-8 text-sm">Great job on Level {level}.</p>
            <button
              onClick={onNextLevel}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Next Level
            </button>
          </>
        )}
        
        {gameState === 'ALL_CLEARED' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-yellow-400" style={{ fontFamily: 'Anton, sans-serif' }}>You Win!</h1>
            <p className="text-zinc-400 mb-8 text-sm">You completed all levels.</p>
            <button
              onClick={onStart}
              className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Play Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
