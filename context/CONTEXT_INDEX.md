# Context Discovery Index

**🎯 Read this first. Then read only what you need for your task.**

This index helps you discover relevant documentation without reading thousands of lines upfront. Use the decision tree below to find what you need.

---

## Quick Start

**Project**: Proxy-WASM Test Runner for FastEdge CDN binaries
**Purpose**: Postman-like test runner for debugging proxy-wasm binaries locally
**Tech Stack**: Node.js + Express + TypeScript (backend) | React + Vite + TypeScript + Zustand (frontend)
**WASM Runtime**: Node WebAssembly API with WASI preview1
**Port**: 5179

**Current Branch**: See git status
**Philosophy**: Production parity, no over-engineering, type safety, modular architecture

---

## 📚 Documentation Map

### 🏗️ Architecture (read when modifying structure)

**When to read**: Adding modules, refactoring, structural changes, understanding system design

- `architecture/BACKEND_ARCHITECTURE.md` (994 lines) - Server architecture, file organization, module responsibilities
- `architecture/FRONTEND_ARCHITECTURE.md` (1,500 lines) - React components, state management, UI organization
- `architecture/STATE_MANAGEMENT.md` (1,969 lines) - Zustand implementation, state sync, persistence
- `architecture/ZUSTAND_ARCHITECTURE.md` (1,300 lines) - Zustand design document, slices pattern, architecture decisions

### ✨ Features (read when working on specific features)

**When to read**: Implementing, debugging, or modifying a specific feature

- `features/HTTP_WASM_IMPLEMENTATION.md` (~400 lines) - ✅ HTTP WASM runner support, FastEdge-run CLI integration, process management
- `features/HTTP_WASM_UI.md` (~1,200 lines) - ✅ Postman-like UI for HTTP WASM, adaptive UI architecture, component organization (NEW - Feb 10, 2026)
- `WEBSOCKET_IMPLEMENTATION.md` (586 lines) - Real-time sync between clients, event broadcasting
- `FASTEDGE_IMPLEMENTATION.md` (645 lines) - FastEdge CDN integration, secrets, env vars
- `PROPERTY_IMPLEMENTATION_COMPLETE.md` (495 lines) - Property system, runtime calculation
- `PRODUCTION_PARITY_HEADERS.md` (421 lines) - Header serialization, G-Core SDK format
- `CONFIG_SHARING.md` (281 lines) - test-config.json sharing system
- `DOTENV.md` (169 lines) - Environment variable system
- `DOTENV_TOGGLE_IMPLEMENTATION.md` (294 lines) - UI toggle for .env variables
- `LOG_FILTERING.md` (147 lines) - Log filtering and display
- `PROPERTY_TESTING.md` (285 lines) - Property system testing patterns

### 🧪 Development (read when implementing/testing)

**When to read**: Writing code, following patterns, testing changes

- `IMPLEMENTATION_GUIDE.md` (1,102 lines) - Coding patterns, conventions, best practices
- `TESTING_GUIDE.md` (350 lines) - How to test your changes
- `development/INTEGRATION_TESTING.md` (450 lines) - ✅ Integration testing with compiled WASM applications
- `TEST_PATTERNS.md` (825 lines) - Testing patterns and examples
- `AI_AGENT_API_GUIDE.md` (601 lines) - API endpoint documentation
- `COMPONENT_STYLING_PATTERN.md` (355 lines) - React component UI patterns

### 📖 Reference (search on-demand, don't read linearly)

**When to read**: Debugging, understanding past decisions, historical context

- `CHANGELOG.md` (3,138 lines) - **Use grep to search**, don't read all
- `PROJECT_OVERVIEW.md` (100 lines) - Lightweight project essentials
- `PROJECT_DETAILS.md` (400 lines) - Deep dive into project details

### 🔧 WASM/Technical (read when working with WASM)

**When to read**: Debugging WASM, implementing host functions, understanding proxy-wasm ABI

- `wasm/wasm-host-functions.md` (58 lines) - Host function implementations
- `wasm/wasm-properties-code.md` (81 lines) - Property system WASM details
- `wasm/wasm-change-header-code.md` (218 lines) - Header modification in WASM
- `wasm/wasm-print-debugger.md` (132 lines) - Debug tools for WASM

### 🗄️ Legacy/Archived (rarely needed)

- `legacy/starter.md` (20 lines) - Old starter documentation
- `legacy/backend-server.md` (27 lines) - Old backend notes

---

## 🧭 Decision Tree: What Should I Read?

### Adding a New Feature
1. Read `IMPLEMENTATION_GUIDE.md` (patterns and conventions)
2. Read relevant architecture doc section (`BACKEND_ARCHITECTURE.md` or `FRONTEND_ARCHITECTURE.md`)
3. Grep `CHANGELOG.md` for similar past features
4. Read related feature docs if building on existing features

### Fixing a Bug
1. Read feature-specific doc for the broken feature
2. Grep `CHANGELOG.md` for the feature name or bug keywords
3. Read `TESTING_GUIDE.md` if you need to add tests
4. Check relevant architecture doc section if the bug involves system structure

### Refactoring Code
1. Read relevant architecture doc (`BACKEND_ARCHITECTURE.md` or `FRONTEND_ARCHITECTURE.md`)
2. Read `IMPLEMENTATION_GUIDE.md` for current patterns
3. If refactoring UI components: Read `COMPONENT_STYLING_PATTERN.md`
4. Grep `CHANGELOG.md` to understand past refactoring decisions

### Understanding the System (New to Codebase)
1. Read `PROJECT_OVERVIEW.md` (lightweight, 100 lines)
2. Read `BACKEND_ARCHITECTURE.md` and `FRONTEND_ARCHITECTURE.md` (skim structure, read relevant sections)
3. Read `IMPLEMENTATION_GUIDE.md` (patterns you'll follow)
4. Optionally read `PROJECT_DETAILS.md` for deep dive

### Working with WebSocket/Real-time Features
1. Read `WEBSOCKET_IMPLEMENTATION.md`
2. Read `STATE_MANAGEMENT.md` (state sync patterns)
3. Grep `CHANGELOG.md` for "websocket" or "sync"

### Working with WASM/Proxy-WASM
1. Read relevant `wasm/*.md` file for your specific task
2. Read `FASTEDGE_IMPLEMENTATION.md` (FastEdge context)
3. Read `PRODUCTION_PARITY_HEADERS.md` if dealing with headers
4. Grep for examples in codebase

### Working with HTTP WASM (Component Model)
1. Read `features/HTTP_WASM_IMPLEMENTATION.md` (HTTP WASM runner architecture)
2. Read `BACKEND_ARCHITECTURE.md` (runner architecture section)
3. Read `TESTING_GUIDE.md` if adding tests
4. Run tests:
   - `pnpm run test:integration` - All tests (CDN + HTTP in parallel)
   - `pnpm run test:integration:http` - Only HTTP WASM tests (sequential)
   - `pnpm run test:integration:cdn` - Only CDN tests (parallel)

### Testing Changes
1. Read `TESTING_GUIDE.md` (how to test)
2. Read `TEST_PATTERNS.md` (testing patterns and examples)
3. Read feature-specific doc for the feature you're testing

### Working with Integration Tests
1. Read `development/INTEGRATION_TESTING.md` (comprehensive integration testing guide)
2. Read `TESTING_GUIDE.md` (overall testing approach)
3. Read `TEST_PATTERNS.md` (testing patterns and conventions)
4. Read relevant feature doc for what you're testing (e.g., `PROPERTY_IMPLEMENTATION_COMPLETE.md`)

### Working with Properties System
1. Read `PROPERTY_IMPLEMENTATION_COMPLETE.md`
2. Read `PROPERTY_TESTING.md` if testing
3. Read `wasm/wasm-properties-code.md` for WASM details

### API Changes or New Endpoints
1. Read `AI_AGENT_API_GUIDE.md` (current API documentation)
2. Read `BACKEND_ARCHITECTURE.md` (API layer architecture)
3. Grep `CHANGELOG.md` for similar API changes

---

## 🔍 Search Tips

### Don't Read CHANGELOG.md Linearly
It's 3,138 lines! Use grep instead:

```bash
# Find when feature was implemented
grep -i "feature-name" context/CHANGELOG.md

# Find bug fixes
grep -i "fix.*bug-keyword" context/CHANGELOG.md

# Find recent changes to a file
grep -i "filename" context/CHANGELOG.md
```

### Search Across Feature Docs
```bash
# Find all docs mentioning a topic
grep -r "websocket" context/*.md

# Find implementation patterns
grep -r "pattern-name" context/IMPLEMENTATION_GUIDE.md
```

### Use Section Headers in Large Docs
Large docs like `IMPLEMENTATION_GUIDE.md` and architecture docs have clear section headers. Use grep to find the section you need:

```bash
# Find specific section
grep -n "## Section Name" context/IMPLEMENTATION_GUIDE.md
```

---

## 📊 Documentation Size Reference

**Tiny** (read in full when needed):
- PROJECT_OVERVIEW.md: ~100 lines
- wasm-host-functions.md: ~58 lines

**Small** (quick read):
- DOTENV.md: ~169 lines
- LOG_FILTERING.md: ~147 lines
- CONFIG_SHARING.md: ~281 lines

**Medium** (read sections as needed):
- TESTING_GUIDE.md: ~350 lines
- COMPONENT_STYLING_PATTERN.md: ~355 lines
- PRODUCTION_PARITY_HEADERS.md: ~421 lines
- development/INTEGRATION_TESTING.md: ~450 lines
- PROPERTY_IMPLEMENTATION_COMPLETE.md: ~495 lines
- WEBSOCKET_IMPLEMENTATION.md: ~586 lines
- AI_AGENT_API_GUIDE.md: ~601 lines
- FASTEDGE_IMPLEMENTATION.md: ~645 lines

**Large** (search or read specific sections):
- TEST_PATTERNS.md: ~825 lines
- BACKEND_ARCHITECTURE.md: ~994 lines
- IMPLEMENTATION_GUIDE.md: ~1,102 lines
- ZUSTAND_ARCHITECTURE.md: ~1,300 lines
- FRONTEND_ARCHITECTURE.md: ~1,500 lines
- STATE_MANAGEMENT.md: ~1,969 lines

**Very Large** (use grep, never read linearly):
- CHANGELOG.md: ~3,138 lines

---

## ⚡ Quick Action Patterns

**Pattern 1: Feature Implementation**
```
Read: IMPLEMENTATION_GUIDE.md + relevant architecture doc section + feature doc
Grep: CHANGELOG.md for similar features
Time: 5-10 minutes of reading vs. 20-30 minutes reading everything
```

**Pattern 2: Bug Fix**
```
Read: Feature doc for broken feature + TESTING_GUIDE.md
Grep: CHANGELOG.md for feature history
Time: 3-5 minutes of reading
```

**Pattern 3: WASM Work**
```
Read: Relevant wasm/*.md file + FASTEDGE_IMPLEMENTATION.md sections
Grep: Codebase for examples
Time: 5-7 minutes of reading
```

---

**Last Updated**: February 2026
