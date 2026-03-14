use super::personas::BundledUnit;

pub static BUNDLED_SKILLS: &[BundledUnit] = &[
    // 1. Code Review Guidelines
    BundledUnit {
        slug: "code-review-guidelines",
        name: "Code Review Guidelines",
        unit_type: "skill",
        l0_summary: "Structured guidelines for conducting effective, constructive code reviews.",
        l1_overview: "\
## Code Review Guidelines

**Purpose:** Provide a consistent framework for reviewing code changes effectively.

**Covers:**
- Review priorities and what to look for
- How to give constructive, actionable feedback
- Common anti-patterns to flag
- Approval criteria and when to request changes
- Review etiquette and communication style

**When to use:** When reviewing pull requests, merge requests, or any code changes before they reach the main branch.",
        l2_content: "\
# Code Review Guidelines

## Review Checklist

### Before Starting
- Read the PR description and linked issues to understand intent
- Check the scope: is this PR focused on one concern or doing too much?
- Run the code locally if the change is non-trivial

### Correctness
- Does the code do what the PR description says?
- Are edge cases handled (null inputs, empty collections, boundary values)?
- Are error conditions handled, not just the happy path?
- Is concurrent/async code safe from race conditions?

### Security
- Is user input validated and sanitized?
- Are SQL queries parameterized?
- Are secrets or credentials hardcoded?
- Are authorization checks in place for new endpoints?

### Design
- Does the change fit the existing architecture and patterns?
- Is the abstraction level appropriate (not too generic, not too specific)?
- Are new dependencies justified and well-maintained?
- Is there duplicated logic that should be extracted?

### Readability
- Are names descriptive and consistent with the codebase?
- Are functions focused and reasonably sized?
- Is complex logic commented with the reasoning (the why)?
- Would a new team member understand this code?

### Testing
- Are there tests for new functionality?
- Do tests cover error cases and edge cases?
- Are tests independent and deterministic?
- Do test names describe the scenario?

## Giving Feedback
- Use severity prefixes: `[must-fix]`, `[suggestion]`, `[nit]`, `[question]`
- Explain the problem and suggest a solution; do not just point out issues
- Praise good code: acknowledge clever solutions, clean refactors, thorough tests
- Ask questions when you do not understand rather than assuming the code is wrong
- Keep feedback about the code, never about the author
- For large PRs, summarize your overall impression before line-level comments

## Approval Criteria
- No `[must-fix]` items remain unresolved
- Tests pass and cover the new behavior
- The code compiles and runs without warnings
- The change is scoped appropriately and does not introduce unnecessary risk",
    },
    // 2. Testing Best Practices
    BundledUnit {
        slug: "testing-best-practices",
        name: "Testing Best Practices",
        unit_type: "skill",
        l0_summary: "Comprehensive testing strategies covering unit, integration, and end-to-end testing.",
        l1_overview: "\
## Testing Best Practices

**Purpose:** Guide the implementation of effective, maintainable test suites.

**Covers:**
- Testing pyramid and when to use each test type
- Writing clear, focused test cases
- Mocking and stubbing strategies
- Test data management and fixtures
- CI integration and test pipeline optimization

**When to use:** When writing tests, designing test architecture, or improving an existing test suite.",
        l2_content: "\
# Testing Best Practices

## Testing Pyramid
- **Unit tests (majority):** Test functions and methods in isolation. Fast, focused, many.
- **Integration tests:** Test component interactions, database queries, API endpoints. Medium speed.
- **End-to-end tests (few):** Test complete user flows. Slow, broad, only for critical paths.

## Writing Good Tests
- One assertion per test concept; multiple asserts are fine if testing one behavior
- Use descriptive names: `test_login_with_expired_token_returns_401`
- Follow Arrange-Act-Assert: set up state, perform action, verify result
- Tests must be independent: no shared mutable state, no execution order dependency
- Test behavior, not implementation: assert on outputs, not internal method calls

## Test Data
- Use factory functions or builders to create test data with sensible defaults
- Override only the fields relevant to each test case
- Avoid shared fixtures that many tests depend on; they become fragile
- Use realistic but deterministic data; avoid randomness in tests
- Clean up test data between tests to prevent interference

## Mocking
- Mock at boundaries: external APIs, databases, file system, clock
- Prefer fakes (in-memory implementations) over mocks for complex interfaces
- Do not mock the code under test or its close collaborators
- Keep mock setup simple; complex mock setup indicates the code needs refactoring
- Verify mock interactions sparingly; prefer asserting on outputs

## What to Test
- Happy paths: normal expected behavior
- Error paths: invalid input, missing data, service failures
- Edge cases: empty collections, null values, maximum lengths, concurrent access
- State transitions: before and after operations that change state
- Regression cases: add a test for every bug fix to prevent recurrence

## CI Integration
- Run tests on every commit and pull request
- Keep the test suite fast; aim for under 5 minutes for the full suite
- Parallelize test execution where possible
- Fail the build on any test failure; do not allow skipping
- Track and fix flaky tests immediately; they erode trust in the suite",
    },
    // 3. Git Workflow
    BundledUnit {
        slug: "git-workflow",
        name: "Git Workflow",
        unit_type: "skill",
        l0_summary: "Git best practices for branching, commits, pull requests, and conflict resolution.",
        l1_overview: "\
## Git Workflow

**Purpose:** Standardize Git practices for clean history, smooth collaboration, and reliable releases.

**Covers:**
- Branch naming and management strategies
- Commit message conventions
- Pull request workflow and review process
- Conflict resolution techniques
- Release and hotfix procedures

**When to use:** When working with Git repositories, creating branches, writing commits, or resolving merge conflicts.",
        l2_content: "\
# Git Workflow

## Branch Strategy
- Use a main branch that is always deployable
- Create feature branches from main: `feature/short-description`
- Use prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`
- Keep branches short-lived: merge within days, not weeks
- Delete branches after merging; they are in the history if needed

## Commit Messages
- Use conventional commits format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
- Write in imperative mood: \"add feature\" not \"added feature\"
- Keep the subject line under 72 characters
- Add a body for non-trivial changes explaining why, not what
- Reference issue numbers: `feat(auth): add token refresh (#123)`

## Pull Requests
- Keep PRs focused: one feature, one fix, or one refactor per PR
- Write a clear description: what changed, why, and how to test
- Include screenshots or recordings for UI changes
- Link related issues and previous PRs for context
- Respond to all review comments; resolve or discuss, do not ignore
- Squash commits when merging if the intermediate commits are not meaningful

## Conflict Resolution
- Rebase feature branches on main regularly to reduce merge conflicts
- When resolving conflicts, understand both changes before choosing
- After resolving, verify the code compiles and tests pass
- If a conflict is complex, discuss with the other author before resolving
- Use `git rerere` to remember conflict resolutions for recurring conflicts

## Release Process
- Tag releases with semantic versioning: `v1.2.3`
- Write release notes summarizing changes, fixes, and breaking changes
- For hotfixes, branch from the release tag, fix, and create a new patch release
- Automate version bumping and changelog generation where possible

## Common Operations
- `git stash` to temporarily save uncommitted changes
- `git rebase -i` to clean up commit history before merging
- `git bisect` to find the commit that introduced a bug
- `git blame` to understand the history of specific lines
- `git cherry-pick` to apply specific commits to other branches",
    },
    // 4. Error Handling Patterns
    BundledUnit {
        slug: "error-handling-patterns",
        name: "Error Handling Patterns",
        unit_type: "skill",
        l0_summary: "Structured error handling patterns for logging, recovery, and user-facing error messages.",
        l1_overview: "\
## Error Handling Patterns

**Purpose:** Implement consistent, robust error handling across the application.

**Covers:**
- Error type design and classification
- Logging strategies for errors
- User-facing vs internal error messages
- Recovery and retry patterns
- Error propagation and chaining

**When to use:** When implementing error handling, designing error response formats, or debugging error-related issues.",
        l2_content: "\
# Error Handling Patterns

## Error Classification
- **Operational errors:** Expected failures like network timeouts, invalid input, missing files. Handle gracefully.
- **Programmer errors:** Bugs like null reference, out of bounds, type errors. Fix the code.
- **Fatal errors:** Unrecoverable situations like out of memory, corrupted state. Log and exit.

## Error Type Design
- Define a structured error type with: error code (machine-readable), message (human-readable), details (optional context)
- Use error enums or sealed classes to represent all known error cases
- Include enough context to diagnose without exposing internals
- Map internal errors to appropriate user-facing messages at API boundaries
- Chain errors to preserve the original cause while adding context at each layer

## Error Propagation
- Propagate errors up to the layer responsible for handling them
- Add context at each layer: \"failed to load user\" wrapping \"database connection timeout\"
- Do not catch errors you cannot handle meaningfully
- Use language-specific patterns: Result types, try/catch, error returns
- Convert between error types at module boundaries

## Logging
- Log errors with full context: what operation failed, what input caused it, what the state was
- Use structured logging with consistent fields: error_code, operation, user_id, request_id
- Log at ERROR level for failures requiring attention, WARN for recoverable issues
- Never log sensitive data: passwords, tokens, personal information
- Include correlation IDs to trace errors across services

## Recovery Patterns
- **Retry with backoff:** For transient failures (network, rate limits). Use exponential backoff with jitter.
- **Circuit breaker:** Stop calling a failing service temporarily. Fail fast instead of timing out.
- **Fallback:** Return cached data, default values, or degraded functionality.
- **Graceful degradation:** Disable non-critical features when dependencies fail.
- **Dead letter queue:** Capture failed messages for later processing or investigation.

## User-Facing Errors
- Show actionable messages: tell the user what happened and what they can do
- Never expose stack traces, SQL errors, or internal paths to users
- Use consistent error formats across the application
- Provide error codes that users can reference when seeking help
- Distinguish between \"try again\" errors and \"contact support\" errors",
    },
    // 5. Performance Optimization
    BundledUnit {
        slug: "performance-optimization",
        name: "Performance Optimization",
        unit_type: "skill",
        l0_summary: "Techniques for profiling, caching, lazy loading, and benchmarking application performance.",
        l1_overview: "\
## Performance Optimization

**Purpose:** Systematically identify and resolve performance bottlenecks.

**Covers:**
- Profiling methodology and tools
- Caching strategies and invalidation
- Lazy loading and code splitting
- Database query optimization
- Benchmarking and regression prevention

**When to use:** When investigating performance issues, optimizing critical paths, or setting up performance monitoring.",
        l2_content: "\
# Performance Optimization

## Methodology
1. **Measure:** Establish baselines with realistic data and load
2. **Profile:** Use profiling tools to identify the actual bottleneck
3. **Optimize:** Make a targeted change to address the specific issue
4. **Validate:** Measure again to confirm improvement
5. **Monitor:** Set up alerts to catch regressions

## Profiling
- Use sampling profilers for CPU analysis; flame graphs for visualization
- Monitor memory allocation patterns; look for excessive allocations in hot paths
- Trace I/O operations: database queries, network calls, file reads
- Profile under realistic load; idle profiling misses concurrency issues
- Focus on the top bottleneck; do not optimize code that accounts for 1% of time

## Caching
- Cache expensive computations, frequent database queries, and external API responses
- Choose the right cache level: in-process, distributed (Redis), CDN, browser
- Define TTL based on data freshness requirements
- Implement cache invalidation: time-based, event-based, or write-through
- Monitor hit rates; below 80% may indicate the cache key design is wrong
- Use cache-aside pattern: check cache, on miss query source, populate cache

## Lazy Loading
- Load resources only when needed: images below the fold, routes not yet visited, data not yet requested
- Use code splitting to reduce initial bundle size
- Implement virtual scrolling for long lists instead of rendering all items
- Defer non-critical initialization to after the main content is interactive
- Prefetch likely-needed resources during idle time

## Database Optimization
- Analyze slow queries with EXPLAIN/EXPLAIN ANALYZE
- Add indexes for columns in WHERE, JOIN, and ORDER BY clauses
- Eliminate N+1 queries: use JOINs or batch loading
- Use connection pooling to reduce connection overhead
- Consider read replicas for read-heavy workloads

## Benchmarking
- Write micro-benchmarks for critical code paths
- Run benchmarks in consistent environments; avoid noisy neighbors
- Compare against baselines; track performance over time
- Include benchmark runs in CI to catch regressions
- Benchmark with production-like data volumes, not tiny test datasets",
    },
    // 6. Security Checklist
    BundledUnit {
        slug: "security-checklist",
        name: "Security Checklist",
        unit_type: "skill",
        l0_summary: "Security checklist covering input validation, authentication, OWASP, and secrets management.",
        l1_overview: "\
## Security Checklist

**Purpose:** Systematic security review checklist for code changes and deployments.

**Covers:**
- Input validation and sanitization
- Authentication and session management
- Authorization and access control
- Secrets and credential management
- Dependency vulnerability management
- HTTP security headers and CORS

**When to use:** Before deploying new features, during security reviews, or when implementing authentication and authorization.",
        l2_content: "\
# Security Checklist

## Input Validation
- [ ] All user input validated for type, length, format, and range
- [ ] SQL queries use parameterized statements (no string concatenation)
- [ ] File uploads validated for type, size; stored outside web root
- [ ] HTML output encoded to prevent XSS
- [ ] URLs and redirects validated against an allowlist
- [ ] JSON/XML parsers configured to reject oversized or deeply nested input

## Authentication
- [ ] Passwords hashed with bcrypt, scrypt, or argon2id (not MD5/SHA)
- [ ] Brute force protection: rate limiting or account lockout
- [ ] Session tokens are cryptographically random and sufficiently long (128+ bits)
- [ ] Sessions expire after inactivity and are invalidated on logout
- [ ] Password reset tokens expire after single use and within 1 hour
- [ ] Multi-factor authentication available for sensitive accounts

## Authorization
- [ ] Every endpoint checks authorization, not just authentication
- [ ] Resource access verified: users can only access their own data
- [ ] Admin/privileged endpoints have additional access controls
- [ ] CORS configured to allow only trusted origins
- [ ] API keys scoped to minimum required permissions

## Secrets Management
- [ ] No secrets, API keys, or credentials in source code or version control
- [ ] Secrets loaded from environment variables or a secrets manager
- [ ] Credentials rotated on a regular schedule
- [ ] Separate credentials for each environment (dev, staging, production)
- [ ] Git history scanned for accidentally committed secrets

## Dependencies
- [ ] Dependencies scanned for known vulnerabilities (npm audit, cargo audit, etc.)
- [ ] Dependency versions pinned with lock files
- [ ] Critical vulnerability patches applied promptly
- [ ] Unused dependencies removed
- [ ] No dependencies pulled from untrusted or unverified sources

## HTTP Security
- [ ] HTTPS enforced for all traffic (HSTS header set)
- [ ] Content-Security-Policy header configured
- [ ] X-Content-Type-Options: nosniff header set
- [ ] X-Frame-Options header set to prevent clickjacking
- [ ] Referrer-Policy header configured to limit information leakage
- [ ] Cookies use Secure, HttpOnly, and SameSite attributes

## Logging & Monitoring
- [ ] Security events logged: logins, failed attempts, access denied, privilege changes
- [ ] Sensitive data excluded from logs (passwords, tokens, PII)
- [ ] Logs protected from tampering and unauthorized access
- [ ] Alerts configured for suspicious activity patterns",
    },
    // 7. API Design
    BundledUnit {
        slug: "api-design",
        name: "API Design",
        unit_type: "skill",
        l0_summary: "RESTful API design principles covering versioning, pagination, error responses, and contracts.",
        l1_overview: "\
## API Design

**Purpose:** Design consistent, developer-friendly APIs that are easy to consume and maintain.

**Covers:**
- RESTful resource modeling and URL design
- Request and response format conventions
- Pagination, filtering, and sorting
- Error response structure
- Versioning and backward compatibility
- Rate limiting and throttling

**When to use:** When designing new APIs, extending existing ones, or reviewing API design decisions.",
        l2_content: "\
# API Design

## Resource Modeling
- Identify the core resources (nouns) in your domain
- Use plural nouns for endpoints: `/users`, `/orders`, `/products`
- Express relationships through nesting: `/users/{id}/orders` (keep shallow, max 2 levels)
- Use HTTP methods for actions: GET (list/get), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- For actions that do not map to CRUD, use sub-resources: `POST /orders/{id}/cancel`

## Request Conventions
- Accept JSON as the primary content type
- Use snake_case or camelCase consistently for field names (pick one, stick with it)
- Require Content-Type header on requests with bodies
- Validate all fields: type, format, length, range, required vs optional
- Return 400 Bad Request with details for validation failures

## Response Conventions
- Use consistent response envelopes: `{ data: ..., meta: ... }` for success
- Include pagination metadata: `{ data: [...], meta: { total, page, per_page, has_next } }`
- Return the created/updated resource in mutation responses
- Use ISO 8601 for all dates and timestamps
- Include a `request_id` in responses for debugging and support

## Error Responses
- Use a consistent error format: `{ error: { code: \"...\", message: \"...\", details: [...] } }`
- Map errors to appropriate HTTP status codes
- Provide machine-readable error codes for programmatic handling
- Include actionable human-readable messages
- Add field-level details for validation errors

## Pagination
- Default to cursor-based pagination for feeds and large collections
- Use offset-based pagination when random page access is needed
- Return: items, total count (if affordable), next cursor/page, has_more boolean
- Set sensible defaults (20 items) and maximum limits (100 items)
- Document pagination parameters and response format

## Versioning
- Version from day one: `/v1/resources`
- Prefer URL versioning for simplicity; use header versioning for complex needs
- Never remove or rename fields in existing versions
- Add new fields with defaults; do not break existing consumers
- Communicate deprecation timelines clearly; support at least two versions

## Rate Limiting
- Implement rate limits on all endpoints; stricter for auth and write operations
- Return rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Return 429 Too Many Requests when limits are exceeded
- Use sliding window or token bucket algorithms
- Document rate limits in API documentation",
    },
    // 8. Documentation Standards
    BundledUnit {
        slug: "documentation-standards",
        name: "Documentation Standards",
        unit_type: "skill",
        l0_summary: "Standards for code comments, README files, API docs, changelogs, and project documentation.",
        l1_overview: "\
## Documentation Standards

**Purpose:** Establish consistent documentation practices across the project.

**Covers:**
- Code comments and doc comments
- README structure and content
- API documentation with OpenAPI/Swagger
- Changelog and release notes format
- Architecture decision records (ADRs)

**When to use:** When writing documentation, setting up a new project, or standardizing existing docs.",
        l2_content: "\
# Documentation Standards

## Code Comments
- Comment the why, not the what; code should be self-explanatory for the what
- Write doc comments for all public functions, types, modules, and constants
- Include parameter descriptions, return values, error conditions, and examples
- Keep comments up to date; outdated comments are worse than no comments
- Use TODO/FIXME/HACK with a name or issue number: `// TODO(#123): handle timeout`

## README Structure
Every project README should include:
1. **Title and description:** What this project does in one or two sentences
2. **Quick start:** Minimum steps to get running (install, configure, run)
3. **Prerequisites:** Required tools, versions, and system dependencies
4. **Installation:** Step-by-step setup instructions
5. **Usage:** Common commands and basic examples
6. **Configuration:** Environment variables, config files, and options
7. **Contributing:** How to set up the dev environment, run tests, and submit changes
8. **License:** The project license

## API Documentation
- Use OpenAPI/Swagger specification for REST APIs
- Document every endpoint: method, path, description, parameters, request body, responses
- Include working examples with realistic data for every endpoint
- Document authentication requirements and error response formats
- Generate interactive documentation (Swagger UI, Redoc) from the spec
- Keep the spec in version control and validate it in CI

## Changelogs
- Follow Keep a Changelog format (keepachangelog.com)
- Categories: Added, Changed, Deprecated, Removed, Fixed, Security
- Write entries from the user's perspective, not the developer's
- Link entries to PRs or issues for additional context
- Update the changelog as part of the PR, not after merging
- Tag releases with semantic versioning: MAJOR.MINOR.PATCH

## Architecture Decision Records
- Record significant technical decisions in ADR format
- Include: title, status (proposed/accepted/deprecated), context, decision, consequences
- Number ADRs sequentially; do not modify accepted ADRs, supersede them with new ones
- Store ADRs in the repository: `docs/adr/0001-use-postgresql.md`
- Review ADRs periodically; mark outdated ones as deprecated

## General Principles
- Write for the reader, not the writer; assume intelligence but not context
- Use short paragraphs and bullet points for scanability
- Include working code examples; test them as part of CI
- Keep documentation close to the code it describes
- Review documentation changes as part of code review",
    },
];
