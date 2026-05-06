const GRADIENTS: [string, string][] = [
  ['#14B8A6', '#8B5CF6'],
  ['#3B82F6', '#14B8A6'],
  ['#8B5CF6', '#EC4899'],
  ['#F59E0B', '#EF4444'],
  ['#10B981', '#3B82F6'],
  ['#6366F1', '#8B5CF6'],
  ['#EF4444', '#F59E0B'],
  ['#0EA5E9', '#10B981'],
]

export function sessionGradient(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  const [a, b] = GRADIENTS[Math.abs(h) % GRADIENTS.length]
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}
