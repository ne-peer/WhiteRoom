import { readFileSync } from 'fs'
import initSqlJs, { type SqlJsStatic } from 'sql.js'

let sqlJsPromise: Promise<SqlJsStatic> | null = null

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs()
  }
  return sqlJsPromise
}

export type SutMaterialRow = {
  pwId: string
  fileData: Uint8Array
}

/**
 * Read Clip Studio `MaterialFile` rows from a `.sut` SQLite file.
 * Returns empty array if the file is unreadable or the table/query fails.
 */
export async function readSutMaterialRows(sutPath: string): Promise<SutMaterialRow[]> {
  let SQL: SqlJsStatic
  try {
    SQL = await loadSqlJs()
  } catch (e) {
    console.warn('[sut] sql.js init failed:', e)
    return []
  }

  let fileBuf: Buffer
  try {
    fileBuf = readFileSync(sutPath)
  } catch (e) {
    console.warn('[sut] read failed:', sutPath, e)
    return []
  }

  const db = new SQL.Database(fileBuf)
  try {
    const stmt = db.prepare('SELECT _PW_ID, FileData FROM MaterialFile')
    const rows: SutMaterialRow[] = []
    while (stmt.step()) {
      const o = stmt.getAsObject() as Record<string, unknown>
      const idRaw = o._PW_ID
      const blob = o.FileData
      if (blob === null || blob === undefined) continue
      const fileData =
        blob instanceof Uint8Array
          ? blob
          : Buffer.isBuffer(blob)
            ? new Uint8Array(blob)
            : typeof blob === 'object' && blob !== null && 'buffer' in (blob as ArrayBufferView)
              ? new Uint8Array((blob as ArrayBufferView).buffer)
              : null
      if (!fileData?.byteLength) continue
      const pwId = idRaw === null || idRaw === undefined ? String(rows.length) : String(idRaw)
      rows.push({ pwId, fileData })
    }
    stmt.free()
    return rows
  } catch (e) {
    console.warn('[sut] MaterialFile query failed:', sutPath, e)
    return []
  } finally {
    db.close()
  }
}
