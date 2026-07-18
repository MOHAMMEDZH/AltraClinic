import { QueryHandlerInterface } from '../../common/query-handler.interface';

export abstract class BaseQueryHandler<Q, R> implements QueryHandlerInterface<Q, R> {
  abstract execute(query: Q): Promise<R>;
}
