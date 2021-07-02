import { expect } from 'chai';
import { InMemoryGameDb } from '../src/services/db';
import { GameService } from '../src/services/gameService';
import { Game, GameStatus } from '../src/types';
import { createRounds } from '../src/controllers/games';
import { isErr } from '../src/utils';

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
    let db: InMemoryGameDb;
    let gameService: GameService;
    beforeEach(() => {
      db = new InMemoryGameDb();
      gameService = new GameService(db);
    });

    it('add a game', async () => {
      const code = 1234;
      const game = createGame(code);

      await gameService.addGame(game);
      const result = await db.getGame(code);

      expect(result).to.have.property('code', code);
    });

    it("can't add a game with a code that is taken", async () => {
      const code = 1234;
      const game = createGame(code);

      await gameService.addGame(game);
      await db.getGame(code);

      const result = await gameService.addGame(game);
      expect(result).to.have.property('error', 'game-exists');
    });
  });

  describe('addPlayer', () => {
    let db: InMemoryGameDb;
    let gameService: GameService;
    const code = 1234;

    beforeEach(async () => {
      db = new InMemoryGameDb();
      gameService = new GameService(db);
      const game = createGame(code);

      await gameService.addGame(game);
    });

    it('a player should be able to join a game', async () => {
      const result = await gameService.addPlayer(code, 'Perry', false);

      expect(isErr(result)).to.be.false;
      expect(result).to.have.property('name', 'Perry');
      const { players } = (await db.getGame(code)) as Game;
      expect(players).to.contain(result);
    });

    it("a player can't join a game that doesn't exists", async () => {
      const result = await gameService.addPlayer(1337, 'Perry', false);
      expect(isErr(result)).to.be.true;
    });

    it('an identical player name can no join the game', async () => {
      await gameService.addPlayer(code, 'Perry', false);
      const result = await gameService.addPlayer(code, 'Perry', false);
      expect(isErr(result)).to.be.true;
      expect(result).to.have.property('error', 'player-exists');
    });
  });
});
