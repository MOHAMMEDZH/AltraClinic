export interface DomainRepositoryInterface<E> {
  find(id: string): Promise<E | null>;
  save(entity: E): Promise<void>;
  remove(id: string): Promise<void>;
}
