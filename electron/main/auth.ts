export const AUTH_USER = 'admin'
export const AUTH_PASS = 'admin'

let authenticated = false

export function isAuthenticated(): boolean {
  return authenticated
}

export function tryLogin(username: string, password: string): boolean {
  if (username === AUTH_USER && password === AUTH_PASS) {
    authenticated = true
    return true
  }
  return false
}

export function logout(): void {
  authenticated = false
}
