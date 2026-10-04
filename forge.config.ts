// [CAPSTONE INTEGRATION TARGET] Package the validated, sandboxed Plato reference app.
import type { ForgeConfig } from '@electron-forge/shared-types';
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'plato',
    ignore: [/^\/(?!dist(?:\/|$)|package\.json$)/],
  },
  makers: [{ name: '@electron-forge/maker-zip', config: {}, platforms: ['linux', 'win32', 'darwin'] }],
};
export default config;
