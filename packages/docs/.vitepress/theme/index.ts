import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import CurveCanvas from './components/CurveCanvas.vue'
import HeroSpec from './components/HeroSpec.vue'
import Addr from './components/Addr.vue'
import DeployedAddr from './components/DeployedAddr.vue'
import ActiveVersion from './components/ActiveVersion.vue'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(CurveCanvas),
      'home-hero-actions-after': () => h(HeroSpec),
    }),
  enhanceApp({ app }) {
    app.component('Addr', Addr)
    app.component('DeployedAddr', DeployedAddr)
    app.component('ActiveVersion', ActiveVersion)
  },
}
