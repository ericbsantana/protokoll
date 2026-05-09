import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'src/abis.ts',
  plugins: [
    foundry({
      project: '../protokoll',
      include: [
        'MonadVRFAdapter.sol/MonadVRFAdapter.json',
        'MonadVRFVerifier.sol/MonadVRFVerifier.json',
        'IRandomnessAdapter.sol/IRandomnessAdapter.json',
      ],
    }),
  ],
})
