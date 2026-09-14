export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD_ID = __APP_BUILD_ID__;

export function getAppBuildLabel(): string {
  return APP_BUILD_ID && APP_BUILD_ID !== APP_VERSION
    ? `${APP_VERSION} · ${APP_BUILD_ID}`
    : APP_VERSION;
}
