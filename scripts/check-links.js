#!/usr/bin/env node

/**
 * Link checker for documentation site
 * Validates internal and external links in markdown files
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = resolve(__dirname, '..', 'docs')
const BASE_URL = 'https://github.com/cmpa/agentops-desktop'

// ANSI colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

let errors = 0
let warnings = 0
let checked = 0

/**
 * Recursively get all markdown files in a directory
 */
function getMarkdownFiles(dir) {
  const files = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      files.push(...getMarkdownFiles(fullPath))
    } else if (extname(entry) === '.md') {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extract links from markdown content
 */
function extractLinks(content, filePath) {
  const links = []
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  let match

  while ((match = linkRegex.exec(content)) !== null) {
    const [fullMatch, text, url] = match
    const line = content.substring(0, match.index).split('\n').length

    links.push({
      text,
      url,
      line,
      file: filePath,
    })
  }

  return links
}

/**
 * Check if an internal link is valid
 */
function checkInternalLink(link) {
  const { url, file, line } = link

  // Skip anchors and external links
  if (url.startsWith('#') || url.startsWith('http://') || url.startsWith('https://')) {
    return true
  }

  // Remove anchor from URL
  const [path, anchor] = url.split('#')

  // Resolve relative to the file location
  const baseDir = dirname(file)
  let targetPath

  if (path.startsWith('/')) {
    targetPath = join(DOCS_DIR, path)
  } else {
    targetPath = resolve(baseDir, path)
  }

  // Add .md extension if not present
  if (!extname(targetPath)) {
    targetPath += '.md'
  }

  // Check if file exists
  if (!existsSync(targetPath)) {
    console.error(`${RED}ERROR${RESET} ${file}:${line} - Broken internal link: ${url}`)
    errors++
    return false
  }

  // If there's an anchor, check if it exists in the target file
  if (anchor) {
    const content = readFileSync(targetPath, 'utf-8')
    const headingRegex = new RegExp(`#+\\s+.*${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    if (!headingRegex.test(content)) {
      console.warn(`${YELLOW}WARN${RESET} ${file}:${line} - Anchor #${anchor} may not exist in ${targetPath}`)
      warnings++
    }
  }

  checked++
  return true
}

/**
 * Check if an external link is valid (simplified - just validates format)
 */
function checkExternalLink(link) {
  const { url, file, line } = link

  try {
    new URL(url)
    checked++
    return true
  } catch {
    console.error(`${RED}ERROR${RESET} ${file}:${line} - Invalid URL format: ${url}`)
    errors++
    return false
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking documentation links...\n')

  if (!existsSync(DOCS_DIR)) {
    console.error(`${RED}ERROR${RESET} Docs directory not found: ${DOCS_DIR}`)
    process.exit(1)
  }

  const files = getMarkdownFiles(DOCS_DIR)
  console.log(`Found ${files.length} markdown files\n`)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const links = extractLinks(content, file)

    for (const link of links) {
      if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
        checkExternalLink(link)
      } else {
        checkInternalLink(link)
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Checked: ${checked} links`)
  console.log(`${GREEN}Passed:${RESET} ${checked - errors - warnings}`)

  if (warnings > 0) {
    console.log(`${YELLOW}Warnings:${RESET} ${warnings}`)
  }

  if (errors > 0) {
    console.log(`${RED}Errors:${RESET} ${errors}`)
    process.exit(1)
  }

  console.log(`\n${GREEN}✅ All links are valid!${RESET}`)
}

main()
