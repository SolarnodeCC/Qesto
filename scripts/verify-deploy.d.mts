export function bindingProbeDecision(
  missingRequired: unknown,
  env?: NodeJS.ProcessEnv,
): { action: 'ok' | 'warn' | 'fail'; missing: string[] }
