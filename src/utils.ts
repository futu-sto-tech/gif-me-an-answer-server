export type Result<T, E> = Ok<T> | Err<E>;

export type Ok<T> = T;

export interface Err<E> {
  error: E;
}

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => {
  return result && Boolean((result as Err<E>).error);
};
