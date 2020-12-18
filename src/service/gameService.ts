import { Game, Player } from '../types';

interface GameService {
  [code: number]: Game;
}

const GAMES: GameService = {};

export function getGame(code: number) {
  if (!(code in GAMES)) {
    throw Error('Game could not be found');
  }
  return GAMES[code];
}

export function addGame(game: Game) {
  GAMES[game.code] = game;
}

export function addPlayer(code: number, player: Player) {
  const game = getGame(code);
  // TODO: Check if player is already added?
  const players = [...game.players, player];
  GAMES[code] = { ...game, players };
}
