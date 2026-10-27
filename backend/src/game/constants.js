/**
 * Ludoline - Ludo Game Constants
 * Standard Ludo board with 52 main squares, home columns of 6 each,
 * and 4 home bases (yards) of 4 pieces each.
 */

const COLORS = ['red', 'green', 'yellow', 'blue'];

// Starting squares on main path (0-indexed, 52 total squares)
const START_SQUARES = {
  red:    1,
  green:  14,
  yellow: 27,
  blue:   40
};

// The square just before entering home column
const HOME_ENTRY_SQUARES = {
  red:    51,
  green:  12,
  yellow: 25,
  blue:   38
};

// Safe squares (stars + starting squares)
const SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48];

const PIECES_PER_PLAYER = 4;
const BOARD_SIZE = 52;       // main path squares
const HOME_COLUMN_SIZE = 6;  // squares in home stretch

// Piece states
const PIECE_STATE = {
  HOME: 'home',       // in yard, not yet on board
  ACTIVE: 'active',   // on main path
  SAFE_ZONE: 'safe_zone', // in home column
  FINISHED: 'finished'    // reached center
};

// Game states
const GAME_STATE = {
  WAITING: 'waiting',
  STARTING: 'starting',
  PLAYING: 'playing',
  FINISHED: 'finished',
  ABANDONED: 'abandoned'
};

// Turn timeout in seconds (player must act within this time)
const TURN_TIMEOUT_SECONDS = 30;

// Max consecutive skips before player is auto-removed
const MAX_SKIP_COUNT = 3;

// Scoring
const SCORING = {
  PIECE_FINISH: 10,     // piece reaches home
  KILL_OPPONENT: 5,     // send opponent piece back to yard
  SAFE_ROLL_SIX: 2,    // roll a six
  BONUS_EXTRA_TURN: 0  // no score for extra turn, just gameplay
};

module.exports = {
  COLORS,
  START_SQUARES,
  HOME_ENTRY_SQUARES,
  SAFE_SQUARES,
  PIECES_PER_PLAYER,
  BOARD_SIZE,
  HOME_COLUMN_SIZE,
  PIECE_STATE,
  GAME_STATE,
  TURN_TIMEOUT_SECONDS,
  MAX_SKIP_COUNT,
  SCORING
};
