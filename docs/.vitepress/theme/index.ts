import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import CurveCanvas from './components/CurveCanvas.vue'
import HeroSpec from './components/HeroSpec.vue'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(CurveCanvas),
      'home-hero-actions-after': () => h(HeroSpec),
    }),
}
