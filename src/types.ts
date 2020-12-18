enum GameStatus {
  SELECT_GIF,
  PRESENT,
  VOTE,
  FINSIHED,
}

export interface GameRound {
  order: number;
  status: GameStatus;
  caption: string;
  presentImage: string;
  images: Image[];
}

export interface Image {
  id: number;
  url: string;
  playerId: number;
  votes: number;
}

enum PlayerStatus {
  JOINED,
  READY,
}

export interface Player {
  id: number;
  status: PlayerStatus;
  name: string;
  points: number;
}
