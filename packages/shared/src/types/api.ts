export type ApiErrorBody = {
  error: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessBody<T> = {
  data: T;
};
