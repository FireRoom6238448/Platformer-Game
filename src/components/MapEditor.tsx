import React, { useState, useEffect, useRef } from 'react';
import { TILE_SIZE } from '../game/Levels';

interface MapEditorProps {
  onBack: () => void;
  onPlay: (grid: string[]) => void;
}

const TILE_TYPES = [
  { char: '.', name: 'Empty', color: '#000000' },
  { char: '#', name: 'Wall', color: '#00FF00' },
  { char: '@', name: 'Spawn', color: '#00FFFF' },
  { char: 'L', name: 'Goal', color: '#FF00FF' },
  { char: 'C', name: 'Coin', color: '#FFD700' },
  { char: 'E', name: 'Enemy', color: '#FF0000' },
  { char: '^', name: 'Spike Up', color: '#FF0000' },
  { char: 'v', name: 'Spike Down', color: '#FF0000' },
  { char: '<', name: 'Spike L', color: '#FF0000' },
  { char: '>', name: 'Spike R', color: '#FF0000' },
  { char: 'b', name: 'Bounce', color: '#FF00FF' }
];

export function MapEditor({ onBack, onPlay }: MapEditorProps) {
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(20);
  const [grid, setGrid] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState('#');
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [history, setHistory] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Initialize empty grid with borders
    const newGrid = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          row += '#';
        } else if (x === 2 && y === height - 2) {
          row += '@';
        } else if (x === width - 3 && y === 1) {
          row += 'L';
        } else {
          row += '.';
        }
      }
      newGrid.push(row);
    }
    
    // Load from local storage if exists
    const saved = localStorage.getItem('customMap');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.grid && parsed.grid.length > 0) {
          setGrid(parsed.grid);
          setWidth(parsed.grid[0].length);
          setHeight(parsed.grid.length);
          return;
        }
      } catch (e) {}
    }
    setGrid(newGrid);
  }, []);

  const saveMap = () => {
    localStorage.setItem('customMap', JSON.stringify({ grid }));
    alert('Map Saved!');
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, grid]);
    setGrid(previous);
    setHistory(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, grid]);
    setGrid(next);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handlePointerDown = (x: number, y: number, e: React.PointerEvent) => {
    if (mode === 'pan') return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId); // Prevent touch capture issues
    
    setHistory(prev => [...prev, grid]);
    setRedoStack([]);
    
    setIsDrawing(true);
    setTile(x, y);
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (mode === 'pan') {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (mode === 'pan' && isPanningRef.current && scrollRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      scrollRef.current.scrollLeft -= dx;
      scrollRef.current.scrollTop -= dy;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    setIsDrawing(false);
  };

  const handlePointerEnter = (x: number, y: number) => {
    if (isDrawing && mode === 'draw') {
      setTile(x, y);
    }
  };

  const setTile = (x: number, y: number) => {
    setGrid(prev => {
      const newGrid = [...prev];
      const row = newGrid[y];
      if (row) {
        newGrid[y] = row.substring(0, x) + selectedTile + row.substring(x + 1);
      }
      return newGrid;
    });
  };

  if (grid.length === 0) return <div>Loading...</div>;

  return (
    <div className="absolute inset-0 bg-zinc-950 flex flex-col text-white z-50">
      <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex-wrap gap-2 text-sm sm:text-base">
        <div className="flex gap-2 text-xs sm:text-sm">
          <button onClick={onBack} className="px-2 py-1 bg-red-600 rounded">Back</button>
          <button onClick={saveMap} className="px-2 py-1 bg-blue-600 rounded">Save</button>
          <button onClick={() => {
            saveMap();
            onPlay(grid);
          }} className="px-2 py-1 bg-green-600 rounded">Play</button>
        </div>
        <div className="flex gap-2 text-xs sm:text-sm">
          <button onClick={undo} disabled={history.length === 0} className={`px-2 py-1 rounded transition-colors ${history.length === 0 ? 'bg-zinc-700 opacity-50' : 'bg-yellow-600'}`}>Undo</button>
          <button onClick={redo} disabled={redoStack.length === 0} className={`px-2 py-1 rounded transition-colors ${redoStack.length === 0 ? 'bg-zinc-700 opacity-50' : 'bg-yellow-600'}`}>Redo</button>
          <button onClick={() => setMode('draw')} className={`px-2 py-1 rounded transition-colors ${mode === 'draw' ? 'bg-indigo-600' : 'bg-zinc-700'}`}>Draw</button>
          <button onClick={() => setMode('pan')} className={`px-2 py-1 rounded transition-colors ${mode === 'pan' ? 'bg-indigo-600' : 'bg-zinc-700'}`}>Pan</button>
        </div>
        <div className="font-mono hidden lg:block">Map Builder</div>
      </div>

      <div className="flex overflow-hidden flex-1">
        {/* Tools Palette */}
        <div className="w-20 bg-zinc-900 border-r border-zinc-800 flex flex-col p-2 space-y-2 overflow-y-auto">
          {TILE_TYPES.map(t => (
            <button
              key={t.char}
              onClick={() => { setSelectedTile(t.char); setMode('draw'); }}
              className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${selectedTile === t.char ? 'bg-zinc-700 outline outline-2 outline-[#00FFFF]' : 'hover:bg-zinc-800'}`}
            >
              <div
                className="w-8 h-8 flex items-center justify-center text-xl font-bold rounded"
                style={{ backgroundColor: t.char === '.' ? '#1a1a2e' : '#141414', color: t.color, border: `1px solid ${t.color}` }}
              >
                {t.char}
              </div>
              <span className="text-[10px] text-center leading-tight truncate w-full">{t.name}</span>
            </button>
          ))}
        </div>

        {/* Canvas Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-auto bg-[#0a0a0a] p-4 relative"
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerCancel={handleContainerPointerUp}
          onPointerLeave={handleContainerPointerUp}
        >
          <div 
            className="inline-flex flex-col bg-[#141414] border-2 border-zinc-700 shadow-2xl"
            style={{ touchAction: mode === 'draw' ? 'none' : 'none' }}
          >
            {grid.map((row, y) => (
              <div key={y} className="flex">
                {row.split('').map((char, x) => {
                  const type = TILE_TYPES.find(t => t.char === char) || TILE_TYPES[0];
                  return (
                    <div
                      key={x}
                      onPointerDown={(e) => handlePointerDown(x, y, e)}
                      onPointerEnter={() => handlePointerEnter(x, y)}
                      className="w-8 h-8 flex items-center justify-center select-none text-lg font-bold flex-shrink-0"
                      style={{
                        backgroundColor: char === '.' ? '#0a0a0a' : '#1c1c1c',
                        border: '1px solid #222',
                        color: type.color
                      }}
                    >
                      {char !== '.' ? char : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
