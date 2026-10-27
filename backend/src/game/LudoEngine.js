/**
 * LudoEngine.js
 * Core game logic for Ludoline. Pure functions / class — no I/O.
 * Used by both backend (Socket.IO handlers) and shared logic.
 */

const {
  COLORS,
  START_SQUARES,
  HOME_ENTRY_SQUARES,
  SAFE_SQUARES,
  PIECES_PER_PLAYER,
  BOARD_SIZE,
  HOME_COLUMN_SIZE,
  PIECE_STATE,
  GAME_STATE,
  SCORING,
  MAX_SKIP_COUNT
} = require('./constants');

class LudoEngine {
  /**
   * Creates a fresh game state.
   * @param {string[]} playerIds - ordered array of player IDs (2–4)
   * @param {string[]} playerColors - color assigned per player (same index)
   */
  static createInitialState(playerIds, playerColors) {
    if (playerIds.length < 2 || playerIds.length > 4) {
      throw new Error('Ludo requires 2–4 players');
    }

    const players = {};
    playerIds.forEach((id, index) => {
      const color = playerColors[index];
      players[id] = {
        id,
        color,
        pieces: Array.from({ length: PIECES_PER_PLAYER }, (_, i) => ({
          id: i,
          state: PIECE_STATE.HOME,
          position: -1,        // -1 = in yard
          homeColumnPos: -1    // position in home column (0–5), -1 = not there
        })),
        score: 0,
        finishOrder: null,    // 1st, 2nd, 3rd, null
        skipCount: 0,
        isActive: true
      };
    });

    return {
      gameState: GAME_STATE.PLAYING,
      players,
      playerOrder: playerIds,
      currentPlayerIndex: 0,
      currentPlayerId: playerIds[0],
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      finishCount: 0,          // how many players have finished
      totalFinishSlots: playerIds.length - 1,  // last player loses, no prize
      turnStartedAt: Date.now(),
      moveHistory: []
    };
  }

  /**
   * Roll the dice — returns 1–6 (cryptographically random is handled upstream;
   * this uses Math.random for pure logic).
   */
  static rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Returns list of pieces that can legally move given dice value.
   * @param {object} state - game state
   * @param {string} playerId
   * @param {number} diceValue
   * @returns {number[]} array of piece IDs that can move
   */
  static getMovablePieces(state, playerId, diceValue) {
    const player = state.players[playerId];
    const movable = [];

    for (const piece of player.pieces) {
      if (piece.state === PIECE_STATE.FINISHED) continue;

      if (piece.state === PIECE_STATE.HOME) {
        // Can only enter board on a 6
        if (diceValue === 6) movable.push(piece.id);
        continue;
      }

      if (piece.state === PIECE_STATE.ACTIVE) {
        const newPos = (piece.position + diceValue) % BOARD_SIZE;
        const distToEntry = LudoEngine._distanceToHomeEntry(player.color, piece.position);

        if (diceValue === distToEntry + 1) {
          // Enters home column at position 0
          movable.push(piece.id);
        } else if (diceValue < distToEntry + 1) {
          // Stays on main path
          movable.push(piece.id);
        }
        // If diceValue > distToEntry + HOME_COLUMN_SIZE, can't move (overshoots home)
        continue;
      }

      if (piece.state === PIECE_STATE.SAFE_ZONE) {
        const newHomePos = piece.homeColumnPos + diceValue;
        if (newHomePos <= HOME_COLUMN_SIZE - 1) {
          movable.push(piece.id);
        }
        // newHomePos === HOME_COLUMN_SIZE means finish (exactly)
        if (newHomePos === HOME_COLUMN_SIZE) {
          movable.push(piece.id);
        }
      }
    }

    return [...new Set(movable)];
  }

  /**
   * Applies a move to the game state (immutably — returns new state).
   * @param {object} state
   * @param {string} playerId
   * @param {number} pieceId
   * @param {number} diceValue
   * @returns {{ newState: object, events: object[] }}
   */
  static applyMove(state, playerId, pieceId, diceValue) {
    // Deep clone to avoid mutation
    const newState = JSON.parse(JSON.stringify(state));
    const player = newState.players[playerId];
    const piece = player.pieces[pieceId];
    const events = [];
    let extraTurn = false;

    if (diceValue === 6) {
      newState.consecutiveSixes++;
      if (newState.consecutiveSixes >= 3) {
        // 3 sixes in a row: forfeit turn, no move
        events.push({ type: 'THREE_SIXES', playerId });
        newState.consecutiveSixes = 0;
        newState.diceRolled = false;
        LudoEngine._advanceTurn(newState);
        return { newState, events };
      }
      extraTurn = true;
      player.score += SCORING.SAFE_ROLL_SIX;
    } else {
      newState.consecutiveSixes = 0;
    }

    if (piece.state === PIECE_STATE.HOME && diceValue === 6) {
      // Enter the board
      piece.state = PIECE_STATE.ACTIVE;
      piece.position = START_SQUARES[player.color];
      events.push({ type: 'PIECE_ENTERED', playerId, pieceId, position: piece.position });

      // Check if landing on opponent (kill)
      const killed = LudoEngine._checkKill(newState, playerId, piece.position, null);
      killed.forEach((k) => {
        events.push({ type: 'PIECE_KILLED', ...k });
        newState.players[k.killedPlayerId].score -= 0; // no score penalty on killed
        player.score += SCORING.KILL_OPPONENT;
      });

    } else if (piece.state === PIECE_STATE.ACTIVE) {
      const distToEntry = LudoEngine._distanceToHomeEntry(player.color, piece.position);

      if (diceValue === distToEntry + 1) {
        // Move into home column at position 0
        piece.state = PIECE_STATE.SAFE_ZONE;
        piece.position = -1;
        piece.homeColumnPos = 0;
        events.push({ type: 'PIECE_ENTERED_HOME_COLUMN', playerId, pieceId });

      } else if (diceValue < distToEntry + 1) {
        const newPos = (piece.position + diceValue) % BOARD_SIZE;
        piece.position = newPos;
        events.push({ type: 'PIECE_MOVED', playerId, pieceId, from: state.players[playerId].pieces[pieceId].position, to: newPos });

        // Check kill
        const killed = LudoEngine._checkKill(newState, playerId, newPos, null);
        killed.forEach((k) => {
          events.push({ type: 'PIECE_KILLED', ...k });
          player.score += SCORING.KILL_OPPONENT;
        });
      }

    } else if (piece.state === PIECE_STATE.SAFE_ZONE) {
      const newHomePos = piece.homeColumnPos + diceValue;

      if (newHomePos === HOME_COLUMN_SIZE) {
        // Piece finishes!
        piece.state = PIECE_STATE.FINISHED;
        piece.homeColumnPos = HOME_COLUMN_SIZE;
        player.score += SCORING.PIECE_FINISH;
        events.push({ type: 'PIECE_FINISHED', playerId, pieceId });

        // Check if player finished all pieces
        const allDone = player.pieces.every((p) => p.state === PIECE_STATE.FINISHED);
        if (allDone) {
          newState.finishCount++;
          player.finishOrder = newState.finishCount;
          events.push({ type: 'PLAYER_FINISHED', playerId, position: newState.finishCount });

          // Check game over
          const activePlayers = Object.values(newState.players).filter((p) => p.isActive && p.finishOrder === null);
          if (activePlayers.length <= 1) {
            // Last remaining player is the loser
            if (activePlayers.length === 1) {
              const loser = activePlayers[0];
              loser.finishOrder = newState.finishCount + 1;
              events.push({ type: 'PLAYER_FINISHED', playerId: loser.id, position: loser.finishOrder });
            }
            newState.gameState = GAME_STATE.FINISHED;
            events.push({ type: 'GAME_OVER', finishOrder: LudoEngine._getFinishOrder(newState) });
            return { newState, events };
          }
        }
      } else if (newHomePos < HOME_COLUMN_SIZE) {
        piece.homeColumnPos = newHomePos;
        events.push({ type: 'PIECE_MOVED_HOME_COLUMN', playerId, pieceId, homeColumnPos: newHomePos });
      }
    }

    // Record move in history
    newState.moveHistory.push({
      playerId,
      pieceId,
      diceValue,
      timestamp: Date.now()
    });

    newState.diceRolled = false;

    if (!extraTurn) {
      LudoEngine._advanceTurn(newState);
    } else {
      events.push({ type: 'EXTRA_TURN', playerId });
      newState.turnStartedAt = Date.now();
    }

    return { newState, events };
  }

  /**
   * Handle when a player skips their turn (timeout or no movable pieces).
   */
  static skipTurn(state, playerId) {
    const newState = JSON.parse(JSON.stringify(state));
    const player = newState.players[playerId];
    player.skipCount++;
    const events = [{ type: 'TURN_SKIPPED', playerId, skipCount: player.skipCount }];

    if (player.skipCount >= MAX_SKIP_COUNT) {
      // Remove player from game
      player.isActive = false;
      events.push({ type: 'PLAYER_REMOVED', playerId, reason: 'inactivity' });

      // Check if game can continue
      const activePlayers = Object.values(newState.players).filter((p) => p.isActive);
      if (activePlayers.length < 2) {
        newState.gameState = GAME_STATE.ABANDONED;
        events.push({ type: 'GAME_ABANDONED', reason: 'not_enough_players' });
        return { newState, events };
      }
    }

    newState.diceRolled = false;
    newState.consecutiveSixes = 0;
    LudoEngine._advanceTurn(newState);
    return { newState, events };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  static _distanceToHomeEntry(color, currentPos) {
    const entry = HOME_ENTRY_SQUARES[color];
    if (currentPos <= entry) return entry - currentPos;
    return BOARD_SIZE - currentPos + entry;
  }

  static _checkKill(state, attackerId, position, excludeId) {
    const killed = [];
    if (SAFE_SQUARES.includes(position)) return killed; // safe square, no kill

    for (const [pid, player] of Object.entries(state.players)) {
      if (pid === attackerId) continue;
      for (const piece of player.pieces) {
        if (piece.state === PIECE_STATE.ACTIVE && piece.position === position) {
          // Send piece back to yard
          piece.state = PIECE_STATE.HOME;
          piece.position = -1;
          killed.push({ killedPlayerId: pid, killedPieceId: piece.id });
        }
      }
    }
    return killed;
  }

  static _advanceTurn(state) {
    const activePlayerIds = state.playerOrder.filter((id) => {
      const p = state.players[id];
      return p.isActive && p.finishOrder === null;
    });

    if (activePlayerIds.length === 0) return;

    let nextIndex = (state.playerOrder.indexOf(state.currentPlayerId) + 1) % state.playerOrder.length;
    let attempts = 0;

    while (!activePlayerIds.includes(state.playerOrder[nextIndex])) {
      nextIndex = (nextIndex + 1) % state.playerOrder.length;
      attempts++;
      if (attempts > state.playerOrder.length) break;
    }

    state.currentPlayerIndex = nextIndex;
    state.currentPlayerId = state.playerOrder[nextIndex];
    state.diceRolled = false;
    state.turnStartedAt = Date.now();
  }

  static _getFinishOrder(state) {
    return Object.values(state.players)
      .sort((a, b) => (a.finishOrder || 99) - (b.finishOrder || 99))
      .map((p) => ({ playerId: p.id, position: p.finishOrder, score: p.score }));
  }

  /**
   * Check if it's valid for a player to roll (their turn & haven't rolled yet).
   */
  static canRoll(state, playerId) {
    return state.currentPlayerId === playerId && !state.diceRolled && state.gameState === GAME_STATE.PLAYING;
  }

  /**
   * Check if a move is valid.
   */
  static canMove(state, playerId, pieceId, diceValue) {
    if (state.currentPlayerId !== playerId) return false;
    if (!state.diceRolled) return false;
    const movable = LudoEngine.getMovablePieces(state, playerId, diceValue);
    return movable.includes(pieceId);
  }
}

module.exports = LudoEngine;
