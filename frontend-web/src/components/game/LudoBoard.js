import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Color theme
const COLOR_THEME = {
  red:    { bg: '#e53e3e', light: '#fed7d7', piece: '#c53030', text: 'white' },
  green:  { bg: '#38a169', light: '#c6f6d5', piece: '#276749', text: 'white' },
  yellow: { bg: '#d69e2e', light: '#fefcbf', piece: '#b7791f', text: 'white' },
  blue:   { bg: '#3182ce', light: '#bee3f8', piece: '#2b6cb0', text: 'white' }
};

// Safe square indices (for visual indication)
const SAFE_SQUARES = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

// Build a 15x15 logical grid for classic Ludo
// Each cell: { type: 'empty'|'path'|'home_yard'|'home_col'|'center', color, safeIndex }
function buildBoardCells() {
  const grid = Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 15 }, (_, col) => ({ type: 'empty', color: null, safe: false }))
  );

  // Home yards (6x6 in corners)
  const yards = [
    { color: 'red',    rows: [0,5],   cols: [0,5] },
    { color: 'green',  rows: [0,5],   cols: [9,14] },
    { color: 'yellow', rows: [9,14],  cols: [9,14] },
    { color: 'blue',   rows: [9,14],  cols: [0,5] }
  ];
  yards.forEach(({ color, rows, cols }) => {
    for (let r = rows[0]; r <= rows[1]; r++) {
      for (let c = cols[0]; c <= cols[1]; c++) {
        grid[r][c] = { type: 'home_yard', color };
      }
    }
  });

  // Home columns (6 cells each)
  // Red: col 7, rows 1–6
  for (let r = 1; r <= 6; r++) grid[r][7] = { type: 'home_col', color: 'red' };
  // Green: row 7, cols 8–13
  for (let c = 8; c <= 13; c++) grid[7][c] = { type: 'home_col', color: 'green' };
  // Yellow: col 7, rows 8–13
  for (let r = 8; r <= 13; r++) grid[r][7] = { type: 'home_col', color: 'yellow' };
  // Blue: row 7, cols 1–6
  for (let c = 1; c <= 6; c++) grid[7][c] = { type: 'home_col', color: 'blue' };

  // Center
  grid[7][7] = { type: 'center', color: null };

  // Main path squares (mark the 52 path cells)
  const pathCells = getPathCells();
  pathCells.forEach(([r, c], i) => {
    grid[r][c] = { type: 'path', color: null, safe: SAFE_SQUARES.has(i + 1) };
  });

  return grid;
}

// The 52 main path squares in order, as [row, col]
function getPathCells() {
  return [
    // Red start → going right
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    // Top middle going right
    [0,7],[0,8],
    // Right column going down
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    // Right middle going down
    [7,14],[8,14],
    // Bottom right going left
    [9,13],[10,13],[11,13],[12,13],[13,13],
    [14,8],[14,7],[14,6],
    // Bottom left going up
    [13,5],[12,5],[11,5],[10,5],[9,5],
    [8,4],[8,3],[8,2],[8,1],[8,0],
    // Left middle going up
    [7,0],[6,0],
    // Top left going right
    [5,1],[4,1],[3,1],[2,1],[1,1],[1,2]
  ];
}

const BOARD_CELLS = buildBoardCells();

function Cell({ cell, pieces, onPieceClick, isHighlighted }) {
  const theme = cell.color ? COLOR_THEME[cell.color] : null;

  let bg = '#f0f0f0';
  if (cell.type === 'home_yard') bg = theme.light;
  if (cell.type === 'home_col') bg = theme.light;
  if (cell.type === 'center') bg = 'linear-gradient(135deg, #e53e3e 25%, #38a169 25%, #38a169 50%, #d69e2e 50%, #d69e2e 75%, #3182ce 75%)';
  if (cell.type === 'empty') bg = '#e2e8f0';
  if (cell.safe) bg = '#ffd700';
  if (isHighlighted) bg = '#90ee90';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        border: '0.5px solid #ccc',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: pieces?.length && onPieceClick ? 'pointer' : 'default'
      }}
      onClick={() => pieces?.length && onPieceClick && onPieceClick(pieces[0])}
    >
      {pieces?.map((piece) => (
        <motion.div
          key={`${piece.playerId}-${piece.pieceId}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            background: COLOR_THEME[piece.color]?.piece,
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            cursor: 'pointer'
          }}
        />
      ))}
    </div>
  );
}

export default function LudoBoard({ gameState, currentUserId, movablePieces, onPieceSelect }) {
  // Build piece position map: cellIndex → [{ playerId, pieceId, color }]
  const pieceMap = useMemo(() => {
    if (!gameState) return {};
    const map = {};

    Object.values(gameState.players).forEach((player) => {
      player.pieces.forEach((piece) => {
        if (piece.state === 'active') {
          const key = `path:${piece.position}`;
          if (!map[key]) map[key] = [];
          map[key].push({ playerId: player.id, pieceId: piece.id, color: player.color });
        } else if (piece.state === 'home') {
          const key = `yard:${player.color}:${piece.id}`;
          map[key] = [{ playerId: player.id, pieceId: piece.id, color: player.color }];
        } else if (piece.state === 'safe_zone') {
          const key = `homecol:${player.color}:${piece.homeColumnPos}`;
          if (!map[key]) map[key] = [];
          map[key].push({ playerId: player.id, pieceId: piece.id, color: player.color });
        }
      });
    });

    return map;
  }, [gameState]);

  const movableSet = useMemo(() => new Set(
    (movablePieces || []).map((pid) => `${currentUserId}:${pid}`)
  ), [movablePieces, currentUserId]);

  const pathCells = getPathCells();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(15, 1fr)',
      gridTemplateRows: 'repeat(15, 1fr)',
      width: '100%',
      maxWidth: 600,
      aspectRatio: '1',
      border: '3px solid #2d3748',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      {BOARD_CELLS.flat().map((cell, index) => {
        const row = Math.floor(index / 15);
        const col = index % 15;

        // Determine piece key
        let pieces = [];
        let isHighlighted = false;

        if (cell.type === 'path') {
          const pathIndex = pathCells.findIndex(([r, c]) => r === row && c === col);
          if (pathIndex >= 0) {
            pieces = pieceMap[`path:${pathIndex + 1}`] || [];
            isHighlighted = pieces.some(
              (p) => p.playerId === currentUserId && movableSet.has(`${p.playerId}:${p.pieceId}`)
            );
          }
        } else if (cell.type === 'home_yard') {
          // Show yard pieces (max 4)
          ['0','1','2','3'].forEach((pid) => {
            const key = `yard:${cell.color}:${pid}`;
            if (pieceMap[key]) pieces.push(...pieceMap[key]);
          });
          isHighlighted = pieces.some(
            (p) => p.playerId === currentUserId && movableSet.has(`${p.playerId}:${p.pieceId}`)
          );
        } else if (cell.type === 'home_col') {
          const homeColIndex = cell.color === 'red' ? row - 1
            : cell.color === 'green' ? col - 8
            : cell.color === 'yellow' ? row - 8
            : col - 1;
          pieces = pieceMap[`homecol:${cell.color}:${homeColIndex}`] || [];
        }

        return (
          <Cell
            key={index}
            cell={cell}
            pieces={pieces}
            isHighlighted={isHighlighted}
            onPieceClick={isHighlighted ? (p) => onPieceSelect(p.pieceId) : null}
          />
        );
      })}
    </div>
  );
}
