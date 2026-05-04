import { useEffect, useState } from 'react';

interface GameUIProps {
  gameState: 'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED' | 'PAUSED' | 'LEVEL_SELECT' | 'SHOP' | 'MAP_EDITOR';
  level: number;
  gameData?: any;
  gameRef?: any;
  onStart: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onResume: () => void;
  onPause: () => void;
  onNavigate: (state: 'MENU' | 'LEVEL_SELECT' | 'SHOP' | 'MAP_EDITOR') => void;
  onSelectLevel: (levelNum: number) => void;
  onFullscreen: () => void;
}

export function GameUI({ gameState, level, gameData, gameRef, onStart, onRestart, onNextLevel, onResume, onPause, onNavigate, onSelectLevel, onFullscreen }: GameUIProps) {
  if (gameState === 'PLAYING') {
    return (
      <div className="absolute inset-0 pointer-events-none select-none z-40 touch-none">
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start">
          <div className="text-white font-mono text-xl text-shadow font-bold">{level === -1 ? 'CUSTOM LEVEL' : `LEVEL ${level}`}</div>
          <button 
            onClick={onPause}
            className="pointer-events-auto bg-black/40 hover:bg-black/60 text-white font-mono px-4 py-2 rounded-lg border border-zinc-700 transition"
          >
            PAUSE
          </button>
        </div>
      </div>
    );
  }

  const handleBuy = (type: string, color: string, cost: number) => {
    if (gameRef?.current) {
      if (gameRef.current.totalCoins >= cost) {
        if (cost > 0) gameRef.current.totalCoins -= cost;
        if (type === 'player') gameRef.current.aesthetics.playerColor = color;
        if (type === 'trail') gameRef.current.aesthetics.trailColor = color;
        gameRef.current.saveGame();
      } else {
        alert("Not enough coins!");
      }
    }
  };

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4 flex flex-col">
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={onFullscreen}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-sm px-4 py-2 rounded-lg border border-zinc-700 transition"
        >
          [ ] FULLSCREEN
        </button>
      </div>

      <div className="my-auto mx-auto bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center flex-shrink-0">
        {gameState === 'MENU' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter" style={{ fontFamily: 'Anton, sans-serif' }}>Neon Dash</h1>
            <p className="text-zinc-400 mb-8 text-sm">Jump, dash, and survive.</p>
            <button
              onClick={onStart}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4 shadow-lg shadow-emerald-500/20"
            >
              Play
            </button>
            <button
              onClick={() => onNavigate('LEVEL_SELECT')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Level Select
            </button>
            <button
              onClick={() => onNavigate('MAP_EDITOR')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Map Builder
            </button>
            <button
              onClick={() => onNavigate('SHOP')}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Cosmetics Shop
            </button>
          </>
        )}

        {gameState === 'LEVEL_SELECT' && (
          <>
            <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter" style={{ fontFamily: 'Anton, sans-serif' }}>Select Level</h1>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {Array.from({length: 12}).map((_, i) => (
                <button 
                  key={i}
                  disabled={!gameRef?.current || gameRef.current.unlockedLevels < i + 1}
                  onClick={() => onSelectLevel(i + 1)}
                  className={`py-3 rounded-lg font-bold ${gameRef?.current && gameRef.current.unlockedLevels >= i + 1 ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Back
            </button>
          </>
        )}

        {gameState === 'SHOP' && (
          <>
            <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter" style={{ fontFamily: 'Anton, sans-serif' }}>The Shop</h1>
            <p className="text-yellow-400 mb-6 font-bold">Total Coins: {gameRef?.current?.totalCoins || 0}</p>
            
            <div className="space-y-4 mb-6 text-left">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-white text-sm mb-2">Player Colors (Cost: 100)</p>
                <div className="flex space-x-2">
                  <button onClick={() => handleBuy('player', '#FF00FF', 100)} className="w-8 h-8 bg-[#FF00FF] rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('player', '#00FF00', 100)} className="w-8 h-8 bg-[#00FF00] rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('player', '#FF0000', 100)} className="w-8 h-8 bg-[#FF0000] rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('player', '#00FFFF', 0)} className="w-8 h-8 bg-[#00FFFF] rounded border border-white hover:scale-110 transition" title="Default"></button>
                </div>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-white text-sm mb-2">Trail Colors (Cost: 50)</p>
                <div className="flex space-x-2">
                  <button onClick={() => handleBuy('trail', 'rgba(255, 0, 255, 0.5)', 50)} className="w-8 h-8 bg-[#FF00FF] opacity-50 rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('trail', 'rgba(0, 255, 0, 0.5)', 50)} className="w-8 h-8 bg-[#00FF00] opacity-50 rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('trail', 'rgba(255, 0, 0, 0.5)', 50)} className="w-8 h-8 bg-[#FF0000] opacity-50 rounded border border-white hover:scale-110 transition"></button>
                  <button onClick={() => handleBuy('trail', 'rgba(0, 255, 255, 0.5)', 0)} className="w-8 h-8 bg-[#00FFFF] opacity-50 rounded border border-white hover:scale-110 transition"></button>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Back
            </button>
          </>
        )}

        {gameState === 'PAUSED' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter" style={{ fontFamily: 'Anton, sans-serif' }}>Paused</h1>
            <p className="text-zinc-400 mb-8 text-sm">Take a breather.</p>
            <button
              onClick={onResume}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Resume
            </button>
            <button
              onClick={onRestart}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Restart Level
            </button>
            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Main Menu
            </button>
          </>
        )}

        {gameState === 'GAMEOVER' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-red-500" style={{ fontFamily: 'Anton, sans-serif' }}>Wasted</h1>
            <p className="text-zinc-400 mb-8 text-sm">You touched something pointy.</p>
            <button
              onClick={onRestart}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Try Again
            </button>
            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Main Menu
            </button>
          </>
        )}

        {gameState === 'WIN' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-emerald-500" style={{ fontFamily: 'Anton, sans-serif' }}>Level Clear!</h1>
            
            <div className="bg-zinc-800 rounded-lg p-4 mb-6 mt-4 grid grid-cols-2 gap-4 text-left">
              <div className="text-zinc-400 text-sm">Time Taken</div>
              <div className="text-white font-mono text-right">{gameData?.timeTaken || '0.0'}s</div>
              
              <div className="text-zinc-400 text-sm">Level Score</div>
              <div className="text-white font-mono text-right">{gameData?.score || 0}</div>
              
              <div className="text-zinc-400 text-sm">Coins Mined</div>
              <div className="text-yellow-400 font-mono text-right">{gameData?.coinsCollected || 0}</div>
            </div>

            <button
              onClick={onNextLevel}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide mb-4"
            >
              Next Level
            </button>
            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Main Menu
            </button>
          </>
        )}

        {gameState === 'ALL_CLEARED' && (
          <>
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter text-blue-500" style={{ fontFamily: 'Anton, sans-serif' }}>You Rock!</h1>
            <p className="text-zinc-400 mb-8 text-sm">You beat every level.</p>
            <button
              onClick={() => onNavigate('MENU')}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-xl transition-colors text-lg uppercase tracking-wide"
            >
              Back to Menu
            </button>
          </>
        )}
      </div>
    </div>
  );
}
