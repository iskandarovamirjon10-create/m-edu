declare module 'connect-pg-simple' {
  import type session from 'express-session';

  interface PgStoreOptions {
    pool?: unknown;
    conString?: string;
    tableName?: string;
    createTableIfMissing?: boolean;
    pruneSessionInterval?: number;
    schemaName?: string;
  }

  interface PgStoreFactory {
    (session: typeof session): new (options?: PgStoreOptions) => session.Store;
  }

  const factory: PgStoreFactory;
  export default factory;
}
