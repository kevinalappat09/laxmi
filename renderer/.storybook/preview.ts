import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

document.documentElement.dataset.theme = 'dark'
document.documentElement.dataset.appearance = 'solid'

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
    backgrounds: { default: 'app' },
    controls: { expanded: true },
    layout: 'centered',
  },
}

export default preview
