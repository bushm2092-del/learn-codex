import DefaultTheme from 'vitepress/theme'
import HarnessFlow from '../../components/HarnessFlow.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HarnessFlow', HarnessFlow)
  },
}
