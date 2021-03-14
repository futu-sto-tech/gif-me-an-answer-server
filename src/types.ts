import { ClientNotifier } from './services/clientNotifier';
import { GameService } from './services/gameService';

export enum GameStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}

export interface Game {
  code: number;
  players: Player[];
  status: GameStatus;
  totalRounds: number;
  currentRound: number;
  totalPlayers: number;
  rounds: GameRound[];
  revision: number;
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
  PlayerDeselectedGif = 'playerdeselectedgif',
  PlayerVoted = 'playervoted',

  GameReady = 'gameready',
  GameFinished = 'gamefinished',

  RoundStarted = 'roundstarted',
  RoundStateChanged = 'roundstatechanged',
  RoundImagePresented = 'roundimagepresented',
}

export interface Services {
  gameService: GameService;
  notifier: ClientNotifier;
}
