/**
 * Debug script to test notification sound playback
 *
 * Run with: npx tsx scripts/test-notification-sound.ts
 */

import { exec } from 'child_process'

console.log('Testing notification sound playback...')

const soundName = 'Hero'
const soundPath = `/System/Library/Sounds/${soundName}.aiff`

console.log('Sound path:', soundPath)
console.log('Platform:', process.platform)

// Test 1: Direct exec call
console.log('\n--- Test 1: Direct exec ---')
exec(`afplay "${soundPath}"`, (error: Error | null, stdout: string, stderr: string) => {
  if (error) {
    console.error('Error:', error)
    console.error('stderr:', stderr)
  } else {
    console.log('Success!')
    console.log('stdout:', stdout)
  }
})

// Test 2: With promise wrapper
console.log('\n--- Test 2: Promise wrapper ---')
const playSound = (path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    exec(`afplay "${path}"`, (error: Error | null) => {
      if (error) {
        console.error('Promise error:', error)
        reject(error)
      } else {
        console.log('Promise success!')
        resolve()
      }
    })
  })
}

playSound(soundPath)
  .then(() => console.log('Promise resolved'))
  .catch((err) => console.error('Promise rejected:', err))

// Keep process alive for a few seconds to allow async callbacks to complete
setTimeout(() => {
  console.log('\n--- Tests complete ---')
  process.exit(0)
}, 3000)
