import React from 'react';
import { motion } from 'framer-motion';

const DOT_POSITIONS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
};

export default function Dice({ value, rolling, canRoll, onRoll }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <motion.div
        animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5 }}
        onClick={canRoll && !rolling ? onRoll : undefined}
        style={{
          width: 70,
          height: 70,
          background: 'white',
          borderRadius: 12,
          border: `3px solid ${canRoll ? '#3182ce' : '#cbd5e0'}`,
          position: 'relative',
          cursor: canRoll && !rolling ? 'pointer' : 'default',
          boxShadow: canRoll ? '0 4px 12px rgba(49,130,206,0.4)' : '0 2px 6px rgba(0,0,0,0.1)',
          transition: 'box-shadow 0.2s'
        }}
      >
        {value && DOT_POSITIONS[value]?.map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#2d3748',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
        {!value && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#a0aec0', fontSize: 12, fontWeight: 600
          }}>
            {canRoll ? 'TAP' : '—'}
          </div>
        )}
      </motion.div>

      {canRoll && !rolling && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRoll}
          style={{
            background: '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          🎲 ROLL
        </motion.button>
      )}
    </div>
  );
}
