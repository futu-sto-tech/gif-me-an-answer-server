import { Game, Player } from '../types';

interface GameService {
  [code: number]: Game;
}

const GAMES: GameService = {};

export function getGame(code: number) {
  return GAMES[code];
}

export function addGame(game: Game) {
  if (game.code in GAMES) {
    throw Error('Game with same code already exists!');
  }

  GAMES[game.code] = game;
}

export function addPlayer(code: number, player: Player) {
  const game = getGame(code);
  if (game.players.some((p) => p.name === player.name)) {
    throw Error('Player with this name already exists!');
  }

  const players = [...game.players, player];
  GAMES[code] = { ...game, players };
}
