import Airtable from 'airtable'

const base = new Airtable({
  apiKey: import.meta.env.VITE_AIRTABLE_API_KEY,
}).base(import.meta.env.VITE_AIRTABLE_BASE_ID)

const TABLE = import.meta.env.VITE_AIRTABLE_USUARIOS_TABLE || 'usuarios'

/**
 * Busca un usuario en Airtable por nombre_usuario y verifica la password.
 * Retorna { id, nombre_usuario, rol } si las credenciales son correctas, null si no.
 */
export async function loginWithAirtable(username, password) {
  return new Promise((resolve, reject) => {
    const results = []

    base(TABLE)
      .select({
        filterByFormula: `{nombre_usuario} = "${username}"`,
        maxRecords: 1,
      })
      .eachPage(
        (records, fetchNextPage) => {
          records.forEach((record) => results.push(record))
          fetchNextPage()
        },
        (err) => {
          if (err) {
            reject(err)
            return
          }

          if (results.length === 0) {
            resolve(null)
            return
          }

          const record = results[0]
          const storedPassword = record.get('password')

          if (storedPassword !== password) {
            resolve(null)
            return
          }

          resolve({
            id: record.id,
            nombre_usuario: record.get('nombre_usuario'),
            rol: record.get('rol'),
          })
        }
      )
  })
}
