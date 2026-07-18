export interface HttpTransportInterface {
  get<T>(route: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(route: string, body: unknown): Promise<T>;
  put<T>(route: string, body: unknown): Promise<T>;
  delete<T>(route: string): Promise<T>;
}
