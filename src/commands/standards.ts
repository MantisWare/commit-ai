import { intro, outro, select, confirm, text, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { COMMANDS } from './ENUMS';

const STANDARDS_FILE = '.commit-ai-standards';

interface StandardsTemplate {
  name: string;
  description: string;
  standards: string;
}

const POPULAR_STANDARDS: Record<string, StandardsTemplate> = {
  'react': {
    name: 'React + TypeScript (Airbnb)',
    description: 'Airbnb React/JSX Style Guide with TypeScript best practices',
    standards: `# React + TypeScript Code Standards (Airbnb Style Guide)

## Component Structure
- Use functional components with hooks (avoid class components)
- One component per file
- Use PascalCase for component names
- Place interfaces/types above component definition

## TypeScript
- Explicitly type all props, state, and function returns
- Avoid 'any' type - use 'unknown' if type is truly unknown
- Use interfaces for object shapes, types for unions/intersections
- Prefer type inference for simple variables

## Hooks
- Follow Rules of Hooks (only call at top level, only in React functions)
- Custom hooks must start with 'use' prefix
- Use useMemo/useCallback only when necessary (avoid premature optimization)
- Dependency arrays must be complete and accurate

## Props & State
- Destructure props in function parameters
- Use default parameters for optional props
- Keep state as local as possible
- Lift state up only when needed by multiple components

## Naming Conventions
- Boolean props/variables: is*, has*, should* prefix
- Event handlers: handle* prefix (e.g., handleClick)
- Event handler props: on* prefix (e.g., onClick)
- Avoid single letter names except for iterators

## Code Quality
- Components should be under 250 lines (extract smaller components)
- Functions should do one thing (Single Responsibility)
- Avoid nested ternaries (max 1 level)
- Use early returns to reduce nesting
- Extract complex conditions into named variables

## Performance
- Avoid creating objects/arrays in render (causes re-renders)
- Use keys properly in lists (stable, unique IDs - not index)
- Lazy load routes and heavy components
- Debounce/throttle expensive operations

## Security
- Sanitize user input before rendering (XSS prevention)
- Never use dangerouslySetInnerHTML without sanitization
- Validate and sanitize form inputs
- Use Content Security Policy headers
`
  },
  'angular': {
    name: 'Angular + TypeScript',
    description: 'Official Angular Style Guide best practices',
    standards: `# Angular + TypeScript Code Standards

## Project Structure
- Follow Angular CLI structure
- One component/service/module per file
- Use feature modules to organize related functionality
- Keep shared code in a shared/core module

## Naming Conventions
- Components: feature.component.ts (kebab-case)
- Services: feature.service.ts
- Modules: feature.module.ts
- Use suffixes: .component, .service, .directive, .pipe, .module

## Components
- Use OnPush change detection when possible
- Unsubscribe from observables in ngOnDestroy
- Implement lifecycle hooks as interfaces (implements OnInit)
- Keep logic out of templates (move to component methods)
- Components should be under 400 lines

## Services
- Mark services as @Injectable({ providedIn: 'root' }) when possible
- Use dependency injection (constructor injection)
- Services should be stateless when possible
- One responsibility per service

## RxJS & Observables
- Always unsubscribe (use takeUntil, async pipe, or takeWhile)
- Prefer async pipe in templates over manual subscription
- Use Subject/BehaviorSubject appropriately
- Chain operators efficiently (map, filter, switchMap, etc.)

## TypeScript
- Enable strict mode in tsconfig
- Explicitly type public APIs
- Use readonly for immutable properties
- Avoid any type - use unknown or proper types

## Templates
- Use safe navigation operator (?.) for nullable properties
- Keep template logic simple (move complex logic to component)
- Use trackBy with *ngFor for performance
- Prefer structural directives over ngIf with else blocks

## Performance
- Use OnPush change detection strategy
- Lazy load feature modules
- Use pure pipes when possible
- Avoid function calls in templates

## Security
- Trust Angular's built-in XSS protection
- Sanitize data when using bypassSecurityTrust methods
- Validate all user inputs
- Use HttpInterceptor for authentication tokens
`
  },
  'vue': {
    name: 'Vue 3 + TypeScript',
    description: 'Vue 3 Composition API with TypeScript best practices',
    standards: `# Vue 3 + TypeScript Code Standards

## Component Structure
- Use Composition API with <script setup>
- One component per file (Single File Components)
- Use PascalCase for component names
- Order: template, script, style

## Script Setup
- Use <script setup lang="ts"> for all components
- Define props with defineProps<PropsInterface>()
- Define emits with defineEmits<EmitsInterface>()
- Use ref() for primitives, reactive() for objects

## TypeScript
- Explicitly type props, emits, and refs
- Use interfaces for complex types
- Avoid any type
- Use Ref<T> type for ref values

## Reactivity
- Use ref() for primitives, reactive() for objects
- Always .value when accessing refs in script
- Use computed() for derived state
- Use watch/watchEffect appropriately

## Props & Emits
- Validate props with runtime validators
- Use TypeScript interfaces for prop types
- Emit events for parent communication
- Use v-model for two-way binding

## Composables
- Extract reusable logic into composables
- Composables should start with 'use' prefix
- Return reactive values and methods
- One responsibility per composable

## Templates
- Use v-if for conditional rendering (not v-show for initial render)
- Use v-show for frequent toggling
- Always use :key with v-for (unique, stable IDs)
- Keep template expressions simple

## Performance
- Use v-once for static content
- Use v-memo for expensive subtrees
- Lazy load routes with dynamic imports
- Debounce/throttle event handlers

## Code Quality
- Components under 300 lines
- Extract complex logic to composables
- Use early returns to reduce nesting
- Descriptive variable and function names

## Security
- Sanitize user input before v-html
- Avoid v-html when possible (use text interpolation)
- Validate form inputs
- Use environment variables for sensitive data
`
  },
  'nodejs': {
    name: 'Node.js + Express',
    description: 'Node.js and Express.js backend best practices',
    standards: `# Node.js + Express Code Standards

## Project Structure
- Separate routes, controllers, services, and models
- Use environment variables for configuration
- Keep business logic in services (not controllers)
- One responsibility per module

## Error Handling
- Always use try-catch for async operations
- Create custom error classes
- Use centralized error handling middleware
- Never swallow errors (always log or rethrow)
- Return appropriate HTTP status codes

## Async/Await
- Always use async/await (avoid callback hell)
- Handle promise rejections
- Use Promise.all for parallel operations
- Avoid blocking the event loop

## Security
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Implement rate limiting
- Use helmet.js for security headers
- Never expose stack traces in production
- Store secrets in environment variables (never commit)
- Use HTTPS in production
- Implement CSRF protection
- Use bcrypt/argon2 for password hashing

## Express Middleware
- Keep middleware focused (single responsibility)
- Always call next() or send response
- Use error handling middleware (4 parameters)
- Order middleware correctly
- Use express.json() and express.urlencoded()

## Database
- Use connection pooling
- Always close connections
- Use transactions for multi-step operations
- Index frequently queried fields
- Avoid N+1 queries

## API Design
- Use RESTful conventions
- Version your APIs (/v1/resource)
- Return consistent error responses
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Implement pagination for lists

## Performance
- Use caching (Redis) for frequently accessed data
- Implement database query optimization
- Use compression middleware
- Stream large files (don't load in memory)
- Use worker threads for CPU-intensive tasks

## Code Quality
- Use ESLint and Prettier
- Functions under 50 lines
- Descriptive naming (no single letters except iterators)
- Use async/await consistently
- Log appropriately (use logging library like Winston)
`
  },
  'python': {
    name: 'Python (PEP 8)',
    description: 'Python PEP 8 style guide with best practices',
    standards: `# Python Code Standards (PEP 8)

## Naming Conventions
- snake_case for functions, variables, and methods
- PascalCase for classes
- UPPER_CASE for constants
- Prefix private members with single underscore
- Avoid single letter names (except i, j, k for loops)

## Code Layout
- 4 spaces for indentation (never tabs)
- Max line length: 79 characters (120 acceptable)
- 2 blank lines before top-level functions/classes
- 1 blank line between methods
- Imports at top, grouped: standard lib, third-party, local

## Functions
- Functions should do one thing
- Use type hints for parameters and return values
- Keep functions under 50 lines
- Use docstrings for public functions
- Return early to reduce nesting

## Classes
- Use dataclasses for data containers
- Implement __repr__ for debugging
- Use @property for computed attributes
- Prefer composition over inheritance
- Keep classes focused (Single Responsibility)

## Error Handling
- Use specific exceptions (not bare except)
- Create custom exceptions when appropriate
- Always clean up resources (use context managers)
- Don't catch exceptions you can't handle
- Log exceptions with traceback

## Type Hints
- Use type hints for function signatures
- Use Optional for nullable values
- Use Union for multiple types
- Use List, Dict, Set from typing module
- Run mypy for type checking

## Data Structures
- Use list comprehensions when readable
- Use generator expressions for large sequences
- Use dict.get() with default values
- Use sets for membership testing
- Use namedtuple or dataclass for structured data

## Security
- Never use eval() or exec() with user input
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Don't store passwords in plain text (use bcrypt/argon2)
- Use secrets module for tokens/passwords
- Validate file paths to prevent traversal attacks

## Performance
- Use generators for large datasets
- Cache expensive computations
- Use set/dict for O(1) lookups
- Avoid premature optimization
- Profile before optimizing

## Best Practices
- Use f-strings for formatting
- Use enumerate() instead of range(len())
- Use with statements for file handling
- Use any() and all() for boolean checks
- Follow the Zen of Python (import this)
`
  },
  'java': {
    name: 'Java (Google Style)',
    description: 'Google Java Style Guide with Spring Boot practices',
    standards: `# Java Code Standards (Google Style Guide)

## Naming Conventions
- camelCase for methods and variables
- PascalCase for classes and interfaces
- UPPER_SNAKE_CASE for constants
- Package names: lowercase, no underscores
- Boolean variables: is*, has*, should* prefix

## Code Organization
- One top-level class per file
- Class members order: static fields, instance fields, constructors, methods
- Group overloaded methods together
- Keep related code together

## Classes & Interfaces
- Classes should be under 500 lines
- Use interfaces for abstraction
- Prefer composition over inheritance
- Make classes immutable when possible
- Use final for variables that don't change

## Methods
- Methods should be under 50 lines
- One responsibility per method
- Descriptive names (no abbreviations)
- Validate parameters at method entry
- Use @Override annotation

## Error Handling
- Use specific exception types
- Don't catch generic Exception
- Always clean up resources (try-with-resources)
- Don't ignore exceptions
- Log exceptions with context

## Null Safety
- Avoid null when possible
- Use Optional<T> for nullable returns
- Validate parameters for null (Objects.requireNonNull)
- Document when null is acceptable (@Nullable)
- Use @NonNull annotation

## Collections
- Use interfaces for declarations (List, Set, Map)
- Use diamond operator for generics (<>)
- Use isEmpty() not size() == 0
- Use Collections.emptyList() for empty collections
- Prefer immutable collections when possible

## Streams & Lambdas
- Use streams for collection processing
- Keep lambdas short (1-3 lines)
- Extract complex lambdas to methods
- Use method references when appropriate
- Don't overuse streams (readability matters)

## Spring Boot Specifics
- Use constructor injection (not field injection)
- Use @Service, @Repository, @Controller appropriately
- Keep controllers thin (delegate to services)
- Use @Transactional for database operations
- Validate inputs with @Valid and Bean Validation

## Security
- Validate all user inputs
- Use parameterized queries (PreparedStatement)
- Don't log sensitive data
- Use BCryptPasswordEncoder for passwords
- Implement proper authentication/authorization
- Sanitize data before rendering (XSS prevention)

## Performance
- Use StringBuilder for string concatenation
- Lazy load collections when appropriate
- Use caching for expensive operations
- Close resources properly (try-with-resources)
- Avoid premature optimization

## Testing
- Write unit tests for all public methods
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for 80%+ code coverage
`
  },
  'go': {
    name: 'Go (Golang)',
    description: 'Effective Go and common Go best practices',
    standards: `# Go Code Standards

## Naming Conventions
- Use mixedCase or MixedCase (not snake_case)
- Exported names start with capital letter
- Unexported names start with lowercase letter
- Short names for short scope (i, j for loops)
- Longer names for wider scope
- Acronyms should be all caps (HTTP, ID, URL)

## Package Structure
- One package per directory
- Package name should be short, lowercase, single word
- Avoid generic names (util, common, base)
- Keep related code in same package
- Use internal/ for private packages

## Error Handling
- Always check errors (if err != nil)
- Return errors (don't panic except for unrecoverable)
- Wrap errors with context (fmt.Errorf with %w)
- Create custom errors when appropriate
- Don't ignore errors

## Interfaces
- Keep interfaces small (1-2 methods ideal)
- Accept interfaces, return concrete types
- Define interfaces where they're used (not where implemented)
- Name single-method interfaces with -er suffix (Reader, Writer)

## Concurrency
- Don't communicate by sharing memory; share memory by communicating
- Always close channels when done writing
- Use select for multiple channel operations
- Use context for cancellation and timeouts
- Avoid goroutine leaks (ensure goroutines exit)
- Use sync.WaitGroup for waiting on goroutines
- Protect shared state with sync.Mutex

## Pointers & Values
- Use pointers for large structs
- Use pointers when you need to modify
- Use values for immutable data
- Don't use pointers for slices, maps, channels (already references)

## Functions & Methods
- Functions should be under 50 lines
- One responsibility per function
- Return error as last return value
- Use named return values for documentation (not always)
- Receiver name: 1-2 characters (not 'this' or 'self')

## Code Organization
- Use gofmt (automatic formatting)
- Group imports: standard library, third-party, local
- Declare variables close to usage
- Use blank line to separate logical blocks
- Keep functions short and focused

## Common Patterns
- Use defer for cleanup (close, unlock, etc.)
- Prefer := for variable declaration
- Use range for iterating slices and maps
- Use _ to ignore unused values
- Check for empty slice: len(s) == 0 (not s == nil)

## Security
- Validate all inputs
- Use parameterized queries (SQL injection prevention)
- Don't log sensitive data
- Use crypto/rand for random numbers (not math/rand)
- Hash passwords with bcrypt
- Use HTTPS for production

## Performance
- Use make() with capacity for slices and maps
- Use sync.Pool for frequently allocated objects
- Use strings.Builder for string concatenation
- Profile before optimizing (pprof)
- Use buffered channels appropriately

## Testing
- Test files end with _test.go
- Test functions start with Test
- Use table-driven tests
- Use t.Helper() for test helpers
- Use testify for assertions (optional)
`
  },
  'rust': {
    name: 'Rust',
    description: 'Rust official style guide and best practices',
    standards: `# Rust Code Standards

## Naming Conventions
- snake_case for variables, functions, modules, macros
- PascalCase for types, traits, enums
- SCREAMING_SNAKE_CASE for constants and statics
- Use 'r#' prefix for reserved keywords
- Lifetime names: short, lowercase ('a, 'b)

## Ownership & Borrowing
- Prefer borrowing (&T) over ownership (T)
- Use &mut only when necessary
- Keep borrows short-lived
- Avoid multiple mutable borrows
- Use Clone strategically (not everywhere)
- Prefer references in function parameters

## Error Handling
- Use Result<T, E> for recoverable errors
- Use panic! only for unrecoverable errors
- Propagate errors with ? operator
- Create custom error types for libraries
- Use thiserror or anyhow for error handling
- Add context to errors

## Option & Result
- Use match for exhaustive handling
- Use if let for single pattern matching
- Use unwrap_or and unwrap_or_else appropriately
- Avoid unwrap() in production code
- Use ok_or and ok_or_else for conversions

## Traits
- Keep traits focused (Single Responsibility)
- Use trait bounds for generic constraints
- Implement standard traits (Debug, Clone, etc.)
- Use associated types when appropriate
- Prefer trait objects for runtime polymorphism

## Structs & Enums
- Use struct for data with named fields
- Use tuple struct for simple wrappers
- Use enums for variants
- Implement builder pattern for complex construction
- Derive common traits (#[derive(Debug, Clone)])

## Functions & Methods
- Keep functions under 50 lines
- Use descriptive parameter names
- Return Result for operations that can fail
- Use impl Trait for return types when appropriate
- Take &self for methods that don't modify

## Pattern Matching
- Use match for exhaustive matching
- Use _ for catch-all patterns
- Use if let for single pattern
- Use while let for loops with pattern
- Avoid nested matches (extract to functions)

## Modules & Privacy
- Use pub selectively (keep implementation private)
- Organize code into modules
- Re-export important types at crate root
- Use pub(crate) for internal APIs
- Use pub(super) for parent module access

## Lifetimes
- Let the compiler infer when possible
- Use explicit lifetimes when needed
- Keep lifetimes simple
- Use 'static for constant data
- Avoid overly complex lifetime bounds

## Concurrency
- Use Arc for shared ownership across threads
- Use Mutex or RwLock for shared mutable state
- Use channels for communication (mpsc)
- Use async/await for I/O-bound tasks
- Prefer message passing over shared state

## Unsafe Code
- Minimize unsafe blocks
- Document safety requirements
- Encapsulate unsafe in safe APIs
- Use #[safety] comments
- Prefer safe alternatives

## Performance
- Use Vec with capacity when size is known
- Use &str instead of String when possible
- Use Cow for clone-on-write scenarios
- Use inline for small functions in hot paths
- Profile before optimizing

## Security
- Validate all inputs at boundaries
- Use constant-time comparisons for secrets
- Zero sensitive data after use
- Use type system for compile-time guarantees
- Avoid buffer overflows (use safe APIs)

## Testing
- Unit tests in same file with #[cfg(test)]
- Integration tests in tests/ directory
- Use #[test] attribute
- Use assert!, assert_eq!, assert_ne!
- Test edge cases and error conditions
`
  },
  'typescript': {
    name: 'TypeScript (Strict)',
    description: 'TypeScript with strict mode and best practices',
    standards: `# TypeScript Code Standards (Strict Mode)

## TypeScript Configuration
- Enable strict mode in tsconfig.json
- Enable noImplicitAny, strictNullChecks
- Use exactOptionalPropertyTypes
- Enable noUncheckedIndexedAccess
- Use ESLint with TypeScript plugin

## Type Annotations
- Explicitly type function parameters and return values
- Let TypeScript infer simple variable types
- Use type inference for const declarations
- Avoid any type (use unknown instead)
- Use never for functions that never return

## Types vs Interfaces
- Use interfaces for object shapes and API contracts
- Use types for unions, intersections, and mapped types
- Use type for function types
- Prefer interface for extending (better error messages)
- Be consistent within a project

## Generics
- Use descriptive type parameter names (not just T)
- Constrain generics with extends when appropriate
- Use default type parameters when useful
- Keep generic signatures readable

## Null & Undefined
- Use strict null checks
- Use optional chaining (?.) for nullable properties
- Use nullish coalescing (??) for defaults
- Avoid explicit null (prefer undefined)
- Type with | undefined for optional values

## Utility Types
- Use Partial<T> for partial object updates
- Use Required<T> for required properties
- Use Readonly<T> for immutable objects
- Use Pick<T, K> and Omit<T, K> for subsets
- Use Record<K, V> for key-value objects

## Type Guards
- Use type predicates (x is Type) for narrowing
- Use typeof for primitive type guards
- Use instanceof for class instance checks
- Create custom type guards when needed
- Use discriminated unions with literal types

## Enums
- Prefer const enums for better tree-shaking
- Use string enums for clarity and debugging
- Consider union of string literals instead
- Don't mix string and number enum members

## Functions
- Type all parameters and return values
- Use optional parameters (?) sparingly
- Use rest parameters with proper types
- Use function overloads when necessary
- Prefer arrow functions for callbacks

## Classes
- Use access modifiers (private, protected, public)
- Use readonly for immutable properties
- Use abstract classes for base classes
- Implement interfaces explicitly
- Use parameter properties for constructor assignment

## Modules
- Use ES6 module syntax (import/export)
- Export types and interfaces
- Use default exports sparingly
- Organize imports: types, values
- Use index files for re-exports

## Async/Await
- Always type async function return as Promise<T>
- Handle promise rejections
- Use try-catch for error handling
- Type error objects in catch blocks
- Use Promise.all for parallel operations

## Type Assertions
- Avoid type assertions (as Type) when possible
- Use type assertions only when you know better than TypeScript
- Prefer type guards over assertions
- Never use as any
- Use non-null assertion (!) sparingly

## Best Practices
- Enable all strict compiler options
- Use const for immutable values
- Use let only when reassignment is needed
- Avoid var completely
- Use destructuring for objects and arrays
- Use template literals for string concatenation

## Security
- Validate and sanitize all user inputs
- Type external API responses properly
- Don't trust any data without validation
- Use branded types for sensitive values
- Avoid eval and Function constructor

## Performance
- Use const enums for better tree-shaking
- Avoid large unions (impacts compile time)
- Use type aliases for complex types
- Enable skipLibCheck for faster compilation
- Use project references for large codebases
`
  },
  'csharp': {
    name: 'C# (.NET)',
    description: 'C# and .NET best practices with modern features',
    standards: `# C# (.NET) Code Standards

## Naming Conventions
- PascalCase for classes, methods, properties, events
- camelCase for parameters and local variables
- _camelCase for private fields (with underscore prefix)
- PascalCase for constants
- IPascalCase for interfaces (I prefix)

## Code Organization
- One type per file
- File name matches type name
- Namespace matches folder structure
- Order: fields, constructors, properties, methods
- Group by access modifier: public, protected, private

## Classes & Objects
- Keep classes under 500 lines
- Use sealed when inheritance not intended
- Prefer composition over inheritance
- Make classes immutable when possible
- Use primary constructors (C# 12+)

## Properties
- Use auto-properties when no logic needed
- Use init for immutable properties (C# 9+)
- Use required for mandatory initialization (C# 11+)
- Keep property getters/setters simple
- Use expression-bodied properties for simple cases

## Methods
- Methods should be under 50 lines
- One responsibility per method
- Use expression-bodied methods for simple cases
- Use async suffix for async methods
- Return Task<T> for async methods

## Null Safety
- Enable nullable reference types
- Use ? for nullable value types
- Use ?. for null-conditional operators
- Use ?? for null-coalescing
- Avoid null returns (use Option pattern or throw)

## LINQ
- Use LINQ for collection operations
- Prefer method syntax over query syntax
- Use meaningful variable names in queries
- Don't nest complex queries (extract to methods)
- Use async LINQ for async operations

## Async/Await
- Use async/await for I/O operations
- Don't block on async code (no .Result or .Wait())
- Use Task.WhenAll for parallel operations
- Use ConfigureAwait(false) in libraries
- Handle cancellation with CancellationToken

## Error Handling
- Use specific exception types
- Don't catch Exception (use specific types)
- Use using statements for IDisposable
- Log exceptions with context
- Don't swallow exceptions

## Dependency Injection
- Use constructor injection
- Register services in Program.cs/Startup
- Use IServiceProvider sparingly
- Keep services focused (Single Responsibility)
- Use scoped services for per-request state

## Collections
- Use interfaces for declarations (IList, IEnumerable)
- Use List<T> over ArrayList
- Use Dictionary<K,V> over Hashtable
- Use collection initializers
- Use ImmutableCollections when appropriate

## Modern C# Features
- Use records for immutable data (C# 9+)
- Use pattern matching (switch expressions)
- Use null-coalescing assignment (??=)
- Use range operators (..)
- Use target-typed new expressions

## ASP.NET Core
- Keep controllers thin (delegate to services)
- Use model validation attributes
- Use middleware for cross-cutting concerns
- Return IActionResult from controller actions
- Use routing attributes

## Entity Framework Core
- Use async operations
- Use LINQ for queries
- Avoid N+1 queries (use Include)
- Use transactions for multi-step operations
- Don't track entities unnecessarily (AsNoTracking)

## Security
- Validate all inputs
- Use parameterized queries
- Don't log sensitive data
- Use Identity for authentication
- Implement authorization policies
- Hash passwords (never store plain text)

## Performance
- Use StringBuilder for string concatenation
- Use async for I/O-bound operations
- Cache expensive operations
- Use value types appropriately (struct)
- Dispose resources properly

## Testing
- Use xUnit, NUnit, or MSTest
- Name tests descriptively (MethodName_Scenario_ExpectedResult)
- Follow AAA pattern (Arrange, Act, Assert)
- Use mocking frameworks (Moq, NSubstitute)
- Test edge cases and error conditions
`
  }
};

export function getStandardsFilePath(): string {
  return join(process.cwd(), STANDARDS_FILE);
}

export function standardsFileExists(): boolean {
  return existsSync(getStandardsFilePath());
}

export function getStandards(): string | null {
  const filePath = getStandardsFilePath();
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf-8');
}

export function writeStandards(content: string): void {
  const filePath = getStandardsFilePath();
  writeFileSync(filePath, content, 'utf-8');
}

export const standardsSetCommand = command(
  {
    name: 'set',
    help: {
      description: 'Interactively configure code standards for review'
    }
  },
  async () => {
    intro(chalk.bold.cyan('CommitAI Code Standards Setup'));

    if (standardsFileExists()) {
      const overwrite = await confirm({
        message: chalk.yellow(`${STANDARDS_FILE} already exists. Do you want to overwrite it?`),
        initialValue: false
      });

      if (isCancel(overwrite)) {
        outro(chalk.red('Standards setup cancelled'));
        process.exit(1);
      }

      if (!overwrite) {
        outro(chalk.yellow('Keeping existing standards file'));
        process.exit(0);
      }
    }

    const customOrImport = (await select({
      message: 'How would you like to set up code standards?',
      options: [
        { value: 'import', label: 'Import from popular style guide' },
        { value: 'custom', label: 'Write custom standards' }
      ]
    })) as string;

    if (isCancel(customOrImport)) {
      outro(chalk.red('Standards setup cancelled'));
      process.exit(1);
    }

    if (customOrImport === 'import') {
      // Redirect to import command
      outro(chalk.cyan('Use: cmt standards import'));
      process.exit(0);
    }

    // Custom standards entry
    outro(chalk.cyan('\nEnter your code standards (press Ctrl+D or Ctrl+Z when done):\n'));
    outro(chalk.gray('Tip: Include language-specific conventions, security rules, and quality guidelines.'));

    const customStandards = await text({
      message: 'Custom standards (markdown format):',
      placeholder: '# My Code Standards\n\n## Security\n- ...\n\n## Code Quality\n- ...',
      validate: (value) => {
        if (!value || value.trim().length < 50) {
          return 'Standards must be at least 50 characters';
        }
      }
    });

    if (isCancel(customStandards)) {
      outro(chalk.red('Standards setup cancelled'));
      process.exit(1);
    }

    writeStandards(customStandards as string);
    outro(chalk.green(`✓ Standards saved to ${STANDARDS_FILE}`));
  }
);

export const standardsImportCommand = command(
  {
    name: 'import',
    help: {
      description: 'Import code standards from popular style guides'
    }
  },
  async () => {
    intro(chalk.bold.cyan('Import Code Standards'));

    if (standardsFileExists()) {
      const overwrite = await confirm({
        message: chalk.yellow(`${STANDARDS_FILE} already exists. Do you want to overwrite it?`),
        initialValue: false
      });

      if (isCancel(overwrite)) {
        outro(chalk.red('Standards import cancelled'));
        process.exit(1);
      }

      if (!overwrite) {
        outro(chalk.yellow('Keeping existing standards file'));
        process.exit(0);
      }
    }

    const options = Object.keys(POPULAR_STANDARDS).map(key => ({
      value: key,
      label: POPULAR_STANDARDS[key].name,
      hint: POPULAR_STANDARDS[key].description
    }));

    const selectedStandard = (await select({
      message: 'Select a style guide to import:',
      options: options
    })) as string;

    if (isCancel(selectedStandard)) {
      outro(chalk.red('Standards import cancelled'));
      process.exit(1);
    }

    const template = POPULAR_STANDARDS[selectedStandard];
    writeStandards(template.standards);

    outro(chalk.green(`✓ Imported ${template.name} standards to ${STANDARDS_FILE}`));
    outro(chalk.gray(`\nYou can edit ${STANDARDS_FILE} to customize the standards for your project.`));
  }
);

export const standardsViewCommand = command(
  {
    name: 'view',
    help: {
      description: 'View current code standards configuration'
    }
  },
  async () => {
    intro(chalk.bold.cyan('View Code Standards'));

    if (!standardsFileExists()) {
      outro(chalk.yellow(`No standards file found at ${STANDARDS_FILE}`));
      outro(chalk.gray('\nRun: cmt standards import (to import a popular style guide)'));
      outro(chalk.gray('  or: cmt standards set (to create custom standards)'));
      process.exit(1);
    }

    const standards = getStandards();
    if (standards) {
      console.log('');
      console.log(chalk.gray('─'.repeat(80)));
      console.log(standards);
      console.log(chalk.gray('─'.repeat(80)));
      console.log('');
      outro(chalk.green(`Standards loaded from ${STANDARDS_FILE}`));
    }
  }
);

export const standardsCommand = command(
  {
    name: COMMANDS.standards,
    commands: [standardsSetCommand, standardsImportCommand, standardsViewCommand],
    help: {
      description: 'Manage code review standards configuration'
    }
  },
  () => {
    // Show help when no subcommand is provided
    console.log(chalk.bold.cyan('\nCommitAI Code Standards Management\n'));
    console.log(chalk.white('Available commands:'));
    console.log(chalk.gray('  cmt standards import') + '  - Import from popular style guides');
    console.log(chalk.gray('  cmt standards set') + '     - Create custom standards interactively');
    console.log(chalk.gray('  cmt standards view') + '    - View current standards');
    console.log('');
  }
);
