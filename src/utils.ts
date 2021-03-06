export type Result<T, E> = T | Err<E>;

export interface Err<E> {
  error: E;
}

export const isErr = <T, E>(result: Result<Exclude<T, Promise<any>>, E>): result is Err<E> => {
  return result && Boolean((result as Err<E>).error);
};
