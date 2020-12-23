export enum GameStatus {
  ACTIVE,
  FINISHED,
}

export interface Game {
  code: number;
  players: Player[];
  status: GameStatus;
  totalRounds: number;
  totalPlayers: number;
  rounds: GameRound[];
}

export enum GameRoundStatus {
  SELECT_GIF,
  PRESENT,
  VOTE,
  FINSIHED,
}

export interface GameRound {
  order: number;
  status: GameRoundStatus;
  caption: string;
  presentImage: string;
  images: Image[];
}

export interface Image {
  id: string;
  url: string;
  playerId: string;
  votes: number;
}

export enum PlayerStatus {
  JOINED,
  READY,
}

export interface Player {
  id: string;
  status: PlayerStatus;
  name: string;
  points: number;
}

export enum Events {
  PlayerJoined = 'playerjoined',
}
