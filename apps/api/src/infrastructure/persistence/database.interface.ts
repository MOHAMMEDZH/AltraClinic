export interface DatabaseInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
