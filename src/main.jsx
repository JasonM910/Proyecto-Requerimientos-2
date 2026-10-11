import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: 'easeOut' }}>
    <App />
  </MotionConfig>,
)
