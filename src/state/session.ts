const SESSION_KEY = 'examos.session.v1'

let memoryToken: string | null = null

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

export function setSessionToken(token: string | null) {
  memoryToken = token
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // The current session still works if browser storage is unavailable.
  }
}
