export function hasPermission(userPerms: string[], required: string): boolean {
  if (userPerms.includes('*')) return true
  if (userPerms.includes(required)) return true

  const [resource, action] = required.split(':', 2)
  if (!resource || !action) return false
  if (userPerms.includes(`${resource}:*`)) return true
  if (userPerms.includes(`*:${action}`)) return true
  return false
}

export function hasAnyPermission(userPerms: string[], required: string[]): boolean {
  if (!required.length) return true
  return required.some(perm => hasPermission(userPerms, perm))
}
