export {};

declare global {
  // Explicitly extend Express Request to have our context property
  export namespace Express {
    export interface Request {
      id: string;
    }
  }
}
