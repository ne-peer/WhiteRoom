declare module 'sql.js' {
  export interface Statement {
    bind(values?: unknown[] | Record<string, unknown>): boolean
    step(): boolean
    getAsObject(params?: null, config?: { useBigInt?: boolean }): Record<string, unknown>
    get(params?: null, config?: { useBigInt?: boolean }): unknown[]
    free(): boolean
    reset(): boolean
  }

  export interface Database {
    run(sql: string, params?: unknown): void
    exec(sql: string): { columns: string[]; values: unknown[][] }[]
    prepare(sql: string): Statement
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: number[] | Uint8Array | Buffer | null) => Database
  }

  function initSqlJs(moduleConfig?: Record<string, unknown>): Promise<SqlJsStatic>
  export default initSqlJs
}
