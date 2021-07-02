import { expect } from 'chai';
import { InMemoryGameDb } from '../src/services/db';
import { GameService } from '../src/services/gameService';
import { Game, GameStatus } from '../src/types';
import { createRounds } from '../src/controllers/games';

const createGame = (code: number): Game => ({
  code,
  players: [],
  status: GameStatus.ACTIVE,
  totalRounds: 2,
  totalPlayers: 3,
  rounds: createRounds(2),
  currentRound: 1,
  revision: 1,
});

describe('Game Service', () => {
  describe('addGame', () => {
    it('add a game', async () => {
      const db = new InMemoryGameDb();
      const gameService = new GameService(db);
      const code = 1234;
      const game = createGame(code);

      await gameService.addGame(game);
      const result = await db.getGame(code);

      expect(result).to.have.property('code', code);
    });
  });
});
