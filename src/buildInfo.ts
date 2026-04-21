declare const __QESTO_FRONTEND_COMMIT__: string
declare const __QESTO_FRONTEND_BUILD_TIME__: string

export const BUILD_INFO = {
  frontendCommit: __QESTO_FRONTEND_COMMIT__,
  frontendBuildTime: __QESTO_FRONTEND_BUILD_TIME__,
} as const
