import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { InputManager } from './game/InputManager';
import { GameUI } from './components/GameUI';
import { MobileControls } from './components/MobileControls';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER'>('MENU');
  const [level, setLevel] = useState(1);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<InputManager>(new InputManager());

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = new Game(inputRef.current, {
      onStateChange: (state, newLevel) => {
        setGameState(state);
        if (newLevel) setLevel(newLevel);
      }
    });
    gameRef.current = game;

    let lastTime = performance.now();
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      game.resize(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Cap dt to prevent huge leaps if tab is inactive
      const safeDt = Math.min(dt, 0.1);

      game.update(safeDt);
      game.render(ctx, canvas.width, canvas.height);

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
    gameRef.current?.startLevel(gameRef.current.currentLevel);
  };

  const nextLevel = () => {
    gameRef.current?.startLevel(gameRef.current.currentLevel + 1);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-zinc-950 touch-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />
      
      <GameUI 
        gameState={gameState} 
        level={level} 
        onStart={startGame} 
        onRestart={restartLevel}
        onNextLevel={nextLevel}
      />

      {gameState === 'PLAYING' && (
        <MobileControls inputManager={inputRef.current} />
      )}
    </div>
  );
}
