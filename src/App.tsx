import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { InputManager } from './game/InputManager';
import { GameUI } from './components/GameUI';
import { MobileControls } from './components/MobileControls';
import { MapEditor } from './components/MapEditor';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED' | 'PAUSED' | 'LEVEL_SELECT' | 'SHOP' | 'MAP_EDITOR'>('MENU');
  const [level, setLevel] = useState(1);
  const [gameData, setGameData] = useState<any>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<InputManager>(new InputManager());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = new Game(inputRef.current, {
      onStateChange: (state, newLevel, data) => {
        setGameState(state);
        if (newLevel) setLevel(newLevel);
        if (data) setGameData(data);
      }
    });
    gameRef.current = game;

    let lastTime = performance.now();
    let animationFrameId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      
      // Ensure the canvas display size matches the window size
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      
      // Scale context to ensure crisp rendering
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      
      // Give the logical size to the game
      game.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resize);
    resize();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Cap dt to prevent huge leaps if tab is inactive
      const safeDt = Math.min(dt, 0.1);

      game.update(safeDt);
      game.render(ctx, window.innerWidth, window.innerHeight);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const startGame = () => {
    gameRef.current?.startLevel(1);
  };

  const restartLevel = () => {
    if (gameRef.current?.currentLevel === -1 && gameRef.current?.levelData) {
      gameRef.current.startCustomLevel(gameRef.current.levelData.grid);
    } else {
      gameRef.current?.startLevel(gameRef.current.currentLevel);
    }
  };

  const nextLevel = () => {
    if (gameRef.current?.currentLevel === -1) {
      setGameState('MAP_EDITOR');
    } else {
      gameRef.current?.startLevel(gameRef.current.currentLevel + 1);
    }
  };

  const resumeGame = () => {
    gameRef.current?.setState('PLAYING');
  };

  const pauseGame = () => {
    gameRef.current?.setState('PAUSED');
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-zinc-950 touch-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />
      
      {gameState === 'MAP_EDITOR' ? (
        <MapEditor onBack={() => setGameState('MENU')} onPlay={(grid) => {
          gameRef.current?.startCustomLevel(grid);
          setGameState('PLAYING');
        }} />
      ) : (
        <GameUI 
          gameState={gameState} 
          level={level} 
          gameData={gameData}
          gameRef={gameRef}
          onStart={startGame} 
          onRestart={restartLevel}
          onNextLevel={nextLevel}
          onResume={resumeGame}
          onPause={pauseGame}
          onNavigate={(state) => setGameState(state)}
          onSelectLevel={(levelNum) => gameRef.current?.startLevel(levelNum)}
          onFullscreen={toggleFullscreen}
        />
      )}

      {gameState === 'PLAYING' && (
        <MobileControls inputManager={inputRef.current} />
      )}
    </div>
  );
}
