export enum GameStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
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
  NOT_STARTED = 'NOT_STARTED',
  SELECT_GIF = 'SELECT_GIF',
  VOTE = 'VOTE',
  PRESENT = 'PRESENT',
  FINSIHED = 'FINISHED',
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
  JOINED = 'JOINED',
  READY = 'READY',
  SELECTED_GIF = 'SELECTED_GIF',
  VOTED = 'VOTED',
}

export interface Player {
  id: string;
  status: PlayerStatus;
  name: string;
  points: number;
}

export enum Events {
  Init = 'init',

  PlayerJoined = 'playerjoined',
  PlayerReady = 'playerready',
  PlayerSelectedGif = 'playerselectedgif',
  PlayerVoted = 'playervoted',

  GameReady = 'gameready',

  RoundStarted = 'roundstarted',
  RoundStateChanged = 'roundstatechanged',
}
