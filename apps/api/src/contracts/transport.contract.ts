export interface TransportContract {
  transportType: 'http' | 'grpc' | 'event';
  route: string;
  payloadSchema?: Record<string, unknown>;
}
