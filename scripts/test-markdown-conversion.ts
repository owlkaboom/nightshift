/**
 * Manual test script to verify markdown conversion in voice transcripts
 * Run with: npx tsx scripts/test-markdown-conversion.ts
 */

import { markdownToHtml, isMarkdown } from '../src/renderer/src/lib/markdown-to-html'

const testCases = [
  {
    name: 'Header with body',
    input: '# Fix authentication bug\n\nUpdate login validation',
    expectedPatterns: ['<h1>', 'Fix authentication bug', '<p>', 'Update login validation']
  },
  {
    name: 'Unordered list',
    input: '- Add user authentication\n- Update database schema\n- Write tests',
    expectedPatterns: ['<ul>', '<li>', 'Add user authentication', 'Update database schema', 'Write tests']
  },
  {
    name: 'Code block',
    input: 'Fix the function\n\n```typescript\nfunction test() {\n  return true\n}\n```',
    expectedPatterns: ['<pre>', '<code', 'language-typescript', 'function test()']
  },
  {
    name: 'Bold and italic',
    input: 'Make **bold changes** to the *important* parts',
    expectedPatterns: ['<strong>', 'bold changes', '<em>', 'important']
  },
  {
    name: 'Inline code',
    input: 'Update the `getUserData` function to handle errors',
    expectedPatterns: ['<code>', 'getUserData', '</code>']
  },
  {
    name: 'Plain text (no markdown)',
    input: 'Just a simple task description without any markdown',
    expectedPatterns: ['Just a simple task'] // Plain text is passed through as-is
  },
  {
    name: 'Complex markdown',
    input: `# Authentication Task

Update the login system:

- Add **two-factor authentication**
- Update *password validation*
- Add tests

## Implementation

\`\`\`typescript
function validate(password: string): boolean {
  return password.length >= 8
}
\`\`\`

> Remember to update docs`,
    expectedPatterns: [
      '<h1>',
      'Authentication Task',
      '<h2>',
      'Implementation',
      '<ul>',
      '<strong>',
      'two-factor authentication',
      '<em>',
      'password validation',
      '<pre>',
      '<code',
      'function validate',
      '<blockquote>',
      'Remember to update docs'
    ]
  }
]

console.log('🧪 Testing Markdown Conversion for Voice Transcripts\n')

let passed = 0
let failed = 0

for (const testCase of testCases) {
  console.log(`\n📝 Test: ${testCase.name}`)
  console.log(`Input: ${testCase.input.substring(0, 50)}${testCase.input.length > 50 ? '...' : ''}`)

  const isMarkdownDetected = isMarkdown(testCase.input)
  console.log(`Markdown detected: ${isMarkdownDetected}`)

  const htmlOutput = isMarkdown(testCase.input)
    ? markdownToHtml(testCase.input)
    : testCase.input

  console.log(`\nHTML Output:\n${htmlOutput}\n`)

  let testPassed = true
  const missingPatterns: string[] = []

  for (const pattern of testCase.expectedPatterns) {
    if (!htmlOutput.includes(pattern)) {
      testPassed = false
      missingPatterns.push(pattern)
    }
  }

  if (testPassed) {
    console.log('✅ PASSED')
    passed++
  } else {
    console.log(`❌ FAILED - Missing patterns: ${missingPatterns.join(', ')}`)
    failed++
  }

  console.log('─'.repeat(80))
}

console.log(`\n\n📊 Test Summary:`)
console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)
console.log(`Total: ${testCases.length}`)

if (failed === 0) {
  console.log('\n🎉 All tests passed!')
  process.exit(0)
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`)
  process.exit(1)
}
