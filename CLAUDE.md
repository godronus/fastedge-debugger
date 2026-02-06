# AI Agent Instructions for Proxy-WASM Test Runner

## Critical Working Practices

### ⚡ ALWAYS CREATE TASK CHECKLISTS ⚡

When starting any non-trivial task (multi-step, multiple files, refactoring, features, etc.):
1. **First action**: Use TaskCreate to break down the work into trackable tasks
2. Update task status as you work (`in_progress` → `completed`)
3. This gives the user real-time visibility into progress

### 🚀 USE PARALLEL AGENTS FOR INDEPENDENT TASKS 🚀

When tasks are independent (different files, different components, no dependencies):
1. **Spawn multiple agents in parallel** using multiple Task tool calls in a **single message**
2. Each agent works concurrently on its task
3. **Massive time savings**: 10-15x faster than sequential processing

**Example**: Refactoring 13 components
- ❌ Sequential: ~6-8 minutes
- ✅ Parallel (13 agents at once): ~30-45 seconds

## Getting Started in This Repository

When you start working in this repository, **you MUST follow this sequence**:

### 1. Read Core Context Files First (REQUIRED)

Before making ANY changes or answering questions, read these files in order:

```
context/PROJECT_OVERVIEW.md          # Start here - complete project understanding
context/CHANGELOG.md                 # Recent changes and evolution
context/BACKEND_ARCHITECTURE.md      # Server-side architecture
context/FRONTEND_ARCHITECTURE.md     # Client-side architecture
```

**Why this order?**
- PROJECT_OVERVIEW gives you the big picture, goals, and current status
- CHANGELOG shows what's been done recently and patterns of change
- Architecture docs provide technical depth

### 2. Read Additional Context as Needed

After the core files, read these based on your task:

**For Feature Implementation:**
- `context/IMPLEMENTATION_GUIDE.md` - Development patterns and conventions
- `context/TESTING_GUIDE.md` - How to test your changes
- Feature-specific docs (WEBSOCKET_IMPLEMENTATION.md, DOTENV.md, etc.)

**For Bug Fixes:**
- Relevant feature documentation
- `context/TESTING_GUIDE.md`
- `context/CHANGELOG.md` for historical context

**For Architecture Questions:**
- `context/BACKEND_ARCHITECTURE.md`
- `context/FRONTEND_ARCHITECTURE.md`
- Component-specific docs (COMPONENT_STYLING_PATTERN.md, etc.)

**For FastEdge/WASM Work:**
- `context/FASTEDGE_IMPLEMENTATION.md`
- `context/wasm-host-functions.md`
- `context/wasm-properties-code.md`
- `context/wasm-change-header-code.md`

## Documentation Maintenance Protocol

### When to Update Context Files

You MUST update context files in these scenarios:

#### 1. After Completing Major Features

**Update these files:**
- `context/CHANGELOG.md` - Add detailed entry at the TOP (reverse chronological)
- `context/PROJECT_OVERVIEW.md` - Update feature lists, status sections
- Feature-specific doc (create new if doesn't exist)

**Changelog Entry Format:**
```markdown
## [Date] - [Feature Name]

### Overview
Brief description of what was accomplished

### 🎯 What Was Completed

#### 1. [Component/Feature Name]
- Detail 1
- Detail 2

**Files Modified:**
- path/to/file.ts - What changed

**Files Created:**
- path/to/file.ts - Purpose

### 🧪 Testing
How to test the changes

### 📝 Notes
Any important context, decisions, or gotchas
```

#### 2. After Architectural Changes

**Update these files:**
- `context/BACKEND_ARCHITECTURE.md` or `context/FRONTEND_ARCHITECTURE.md`
- `context/CHANGELOG.md`
- `context/PROJECT_OVERVIEW.md` (architecture section)

**What to document:**
- New patterns or conventions
- File structure changes
- Dependency additions
- Breaking changes

#### 3. After Bug Fixes

**For significant bugs:**
- `context/CHANGELOG.md` - Document the fix
- Relevant feature doc - Update Known Issues section
- `context/PROJECT_OVERVIEW.md` - Remove from known issues if fixed

**For minor bugs:**
- Only update if the bug revealed a pattern or important gotcha

#### 4. When Discovering Important Patterns

**Create or update:**
- Pattern-specific doc (like COMPONENT_STYLING_PATTERN.md)
- `context/IMPLEMENTATION_GUIDE.md` - Add to best practices
- `context/CHANGELOG.md` - Document the discovery/standardization

#### 5. When APIs Change

**Update:**
- `context/AI_AGENT_API_GUIDE.md` - API endpoint documentation
- `context/BACKEND_ARCHITECTURE.md` - API layer details
- `context/CHANGELOG.md` - Document the change

### What NOT to Document

**Don't create entries for:**
- Trivial typo fixes
- Code formatting changes
- Comment updates
- Routine dependency updates (unless they change functionality)
- Debug logging additions (unless part of a feature)

### File-Specific Guidelines

#### `context/CHANGELOG.md`
- **ALWAYS add to the TOP** (most recent first)
- Include date in format: `## February 6, 2026 - Feature Name`
- Be detailed but concise
- Always list modified/created files
- Group related changes together

#### `context/PROJECT_OVERVIEW.md`
- Keep "Current Status" section up to date
- Move completed items from "Not Yet Implemented" to "Working Features"
- Update "Known Issues" when bugs are fixed or discovered
- Update tech stack if dependencies change
- Keep "Last Updated" date current

#### `context/BACKEND_ARCHITECTURE.md` & `context/FRONTEND_ARCHITECTURE.md`
- Update when file structure changes
- Document new patterns or conventions
- Add new components/modules to relevant sections
- Update when major refactoring occurs

#### Feature-Specific Docs (WEBSOCKET_IMPLEMENTATION.md, etc.)
- Create when a feature is complex enough to need dedicated documentation
- Update when feature behavior changes
- Include code examples and usage patterns
- Document known limitations and gotchas

#### `context/IMPLEMENTATION_GUIDE.md`
- Add new patterns as they emerge
- Update coding conventions if they change
- Document architectural decisions
- Keep best practices section current

#### `context/TESTING_GUIDE.md`
- Update when test patterns change
- Add new testing scenarios
- Document test setup requirements
- Keep testing commands current

## Working with Test Configurations

The project uses `test-config.json` for sharing test configurations:

**Reading config:**
- Use `GET /api/config` to read current test configuration
- Useful for understanding current test state
- See `context/CONFIG_SHARING.md` for details

**Saving config:**
- Users save via UI
- Don't overwrite without explicit permission
- See `context/AI_AGENT_API_GUIDE.md` for API details

## Parallel Agents Pattern

### When to Use Multiple Agents in Parallel

Use parallel agents when you have **independent tasks** that can run concurrently:

✅ **Perfect for:**
- Refactoring multiple components (each component is independent)
- Testing multiple files
- Updating multiple documentation files
- Creating multiple similar features
- Researching different topics
- Any tasks that modify different files with no dependencies

❌ **Not suitable for:**
- Tasks with dependencies (Task B needs Task A's output)
- Tasks that modify the same file
- Tasks requiring sequential logic
- Tasks that share state

### How to Spawn Parallel Agents

**Critical**: All agents must be spawned in a **single message** with multiple Task tool calls.

**Example Pattern** (refactoring 3 components in parallel):

```
Call Task tool 3 times in one message:
- Agent 1: Refactor ComponentA to CSS modules
- Agent 2: Refactor ComponentB to CSS modules
- Agent 3: Refactor ComponentC to CSS modules

All 3 agents execute concurrently and return results when done.
```

### Best Practices for Parallel Agents

1. **Include full context in each prompt** - Each agent starts fresh, so provide:
   - Complete task description
   - Reference files (e.g., "Follow the Toggle pattern at /path/to/Toggle")
   - Any necessary context from the codebase

2. **Use descriptive task descriptions** - Helps track which agent is doing what

3. **Coordinate results** - After agents complete:
   - Review all changes
   - Update task statuses
   - Handle any conflicts (rare with independent files)

4. **Time savings are massive**:
   - 13 components refactored: ~30-45 seconds (vs. 6-8 minutes sequential)
   - **10-15x speedup** for independent tasks

### Real-World Example

**Task**: Refactor 13 React components to CSS modules

**Suboptimal approach** (what not to do):
- Manually refactor 4 components sequentially
- Spawn 1 agent for remaining 9 components
- Total time: ~6-8 minutes

**Optimal approach** (parallel agents):
- Spawn 13 agents in parallel (one per component)
- Each agent refactors independently
- Total time: ~30-45 seconds
- **Result**: 10-15x faster

### When to Use This Pattern in This Project

- Refactoring multiple React components
- Updating multiple context documentation files
- Testing multiple WASM binaries
- Creating multiple similar API endpoints
- Researching multiple features or technologies

## Development Workflow

### Starting a Task

**IMPORTANT: Always create a task checklist at the start of any non-trivial task using the TaskCreate tool.**

1. **Create task checklist** - Use TaskCreate for each step or component that needs work
2. **Consider parallel agents** - If tasks are independent, spawn multiple agents at once
3. Read relevant context files (see above)
4. Understand current state from PROJECT_OVERVIEW.md
5. Check CHANGELOG.md for recent related changes
6. Read architecture docs for technical context
7. Ask clarifying questions if needed

**When to create task checklists:**
- Multi-step tasks (3+ steps)
- Tasks involving multiple files or components
- Refactoring work
- Feature implementation
- Bug fixes that affect multiple areas
- Any task where tracking progress would be helpful

**Task checklist benefits:**
- User can see progress in real-time
- Clear visibility into what's being done
- Easy to track completion
- Helps break down complex work

### During Development

1. **Update task status** - Mark tasks as `in_progress` when starting, `completed` when done
2. **Use parallel agents when possible** - If you have multiple independent tasks, spawn agents in parallel for massive time savings
3. Follow patterns in IMPLEMENTATION_GUIDE.md
4. Maintain consistency with existing code
5. Don't over-engineer (see project philosophy in PROJECT_OVERVIEW.md)
6. Test according to TESTING_GUIDE.md

### Completing a Task

1. **Mark all tasks as completed** - Ensure all TaskCreate items are marked `completed`
2. Update CHANGELOG.md with detailed entry
3. Update PROJECT_OVERVIEW.md status sections
4. Update or create feature-specific documentation
5. Update architecture docs if structure changed
6. Commit with descriptive message referencing changes

## Important Project Context

### Philosophy
- **Production Parity**: Test runner must match FastEdge CDN behavior
- **No Over-Engineering**: Simple solutions over complex abstractions
- **Type Safety**: TypeScript throughout (frontend + backend)
- **Modular Architecture**: Clean separation of concerns

### Critical Technical Details
- Header serialization uses G-Core SDK format (see PROJECT_OVERVIEW.md)
- Isolated hook execution (each hook gets fresh WASM instance)
- WebSocket for real-time synchronization
- Property system with smart runtime calculation

### Known Patterns
- Configuration sharing via test-config.json
- Component styling patterns (see COMPONENT_STYLING_PATTERN.md)
- WebSocket event broadcasting (see WEBSOCKET_IMPLEMENTATION.md)
- FastEdge host functions (see FASTEDGE_IMPLEMENTATION.md)

## File Organization

```
context/
├── Core Documentation (read first):
│   ├── PROJECT_OVERVIEW.md           # Start here always
│   ├── CHANGELOG.md                  # Recent history
│   ├── BACKEND_ARCHITECTURE.md       # Server architecture
│   └── FRONTEND_ARCHITECTURE.md      # Client architecture
│
├── Implementation Guides:
│   ├── IMPLEMENTATION_GUIDE.md       # Development patterns
│   ├── TESTING_GUIDE.md              # Testing procedures
│   └── AI_AGENT_API_GUIDE.md         # API documentation
│
├── Feature Documentation:
│   ├── WEBSOCKET_IMPLEMENTATION.md   # Real-time sync
│   ├── CONFIG_SHARING.md             # Configuration system
│   ├── PRODUCTION_PARITY_HEADERS.md  # Header handling
│   ├── FASTEDGE_IMPLEMENTATION.md    # FastEdge features
│   ├── DOTENV.md                     # Environment config
│   ├── DOTENV_TOGGLE_IMPLEMENTATION.md
│   ├── PROPERTY_IMPLEMENTATION_COMPLETE.md
│   ├── PROPERTY_TESTING.md
│   └── LOG_FILTERING.md
│
├── Component Patterns:
│   └── COMPONENT_STYLING_PATTERN.md  # UI patterns
│
└── WASM/Technical:
    ├── wasm-host-functions.md        # Host function implementations
    ├── wasm-properties-code.md       # Property system details
    ├── wasm-change-header-code.md    # Header modification
    └── wasm-print-debugger.md        # Debug tools
```

## Quick Reference

### Files Modified Most Often
1. `context/CHANGELOG.md` - After every significant change
2. `context/PROJECT_OVERVIEW.md` - Status updates
3. Feature-specific docs - When features change
4. Architecture docs - When structure changes

### Files Created Rarely
- New feature docs - Only for complex features
- New pattern docs - Only when establishing new conventions

### Emergency Protocol
If unsure whether to update documentation:
1. Check if change is user-visible or architectural
2. Check if future developers would need to know about it
3. When in doubt, add to CHANGELOG.md with good detail
4. PROJECT_OVERVIEW.md should always reflect current state

## Final Notes

- **Always read before you write** - Understand context before making changes
- **Document as you go** - Don't defer documentation to later
- **Be detailed in CHANGELOG** - Future agents rely on this history
- **Keep PROJECT_OVERVIEW current** - It's the source of truth
- **Link between docs** - Use relative links to connect related information
- **Test your changes** - Follow TESTING_GUIDE.md procedures

The goal is to make every AI agent session as effective as the last one by maintaining a clear, up-to-date understanding of the project's current state.
