# Arc Code

Architecture analyzer for TypeScript/JavaScript projects. Reads the real source code and generates Mermaid diagrams describing the architecture **that exists**, not an invented ideal architecture.

```bash
npx arc-code generate-diagrams
```

## What it is — and what it isn't

- **No AI.** No network calls, no API keys, no models.
- **100% static analysis**, via the TypeScript Compiler API. The analyzed project's code is never executed.
- **Deterministic**: running it twice on the same code produces the same result (ignoring the manifest's timestamp).
- When something can't be determined statically, Arc Code shows `unknown` or omits it — it never invents.

AI is a future consumer of Arc Code, not a dependency of it. The `.arch/` format is meant to be read by tools like Claude Code, Cursor, etc. — not to replace human judgment about architecture.

## Usage

```bash
cd your-project
npx arc-code generate-diagrams
```

Generates an `.arch/` folder at the root of the analyzed project:

```
.arch/
  architecture.mmd    # detected layers (or the real directory graph, if no known layers are found)
  routes.mmd           # HTTP routes (Express) -> handler -> direct calls -> return (flowchart)
  sequence.mmd         # the same routes, as a sequenceDiagram (who calls whom, in order)
  classes.mmd          # classes/interfaces, members, and extends/implements/uses relations
  dependencies.mmd     # import graph, with cycles and layer violations flagged
  functions.mmd        # every function/method, with estimated Big-O complexity and a call graph
  manifest.json        # version, language, analyzed files, timestamp, and an INDEX (see below)
  domains/             # one subfolder per detected resource (see "Per-resource sub-flows" below)
    <resource>/         # e.g. customer/, deal/ — the same 6 .mmd files, scoped to that resource
      architecture.mmd
      routes.mmd
      classes.mmd
      dependencies.mmd
      functions.mmd
      sequence.mmd
  routes/              # one .mmd per route, flowchart (see "Mini-flows" below)
  sequence/            # the same route, as a sequenceDiagram
  functions/           # one .mmd per function/method
  classes/             # one .mmd per class/interface
  dependencies/        # one .mmd per module
```

**`manifest.json` has an `index`** mapping each route/function/class/module straight to its mini-flow file (e.g. `index.routes["POST /customers"] -> "routes/00_POST__customers.mmd"`) — to answer "show me the flow for X" without listing the folder and guessing the filename first.

Other commands:

```bash
npx arc-code --help
npx arc-code --version
```

The `.mmd` files are plain [Mermaid](https://mermaid.js.org/) — open them with the VSCode preview extension, paste into [mermaid.live](https://mermaid.live), or render with `@mermaid-js/mermaid-cli`.

## The 6 diagrams

### architecture.mmd
Looks for known folder names (`controllers`, `services`, `domain`, `repositories`, `database`, ...) at any depth in the project. If it finds 2 or more, it draws the chain in canonical order (e.g. `Controller → Service → Domain → Repository`). If not, it shows the real dependency graph between directories — it never invents a layer that doesn't exist.

### routes.mmd
Detects Express-style routes (`app.get/post/put/delete/patch`). For each route: method, path, resolved handler, calls made directly inside the handler (depth 1, including inside `async`/`await`), and return type when annotated.

**Known limitation:** Express only. NestJS decorators (`@Get`, `@Controller`) aren't supported in this version.

### sequence.mmd
The same routes from `routes.mmd`, as a `sequenceDiagram` instead of a `flowchart` — `Client->>Handler: POST /customers`, `Handler->>customerService: create()`, `Handler-->>Client: returns void`. It's Mermaid's native format for "who calls whom, in what order," so it reads denser/clearer than the equivalent flowchart for this kind of information.

**Technical note:** sequence diagram messages use raw text (`Promise<void>` unescaped), unlike `routes.mmd`/`architecture.mmd`/`dependencies.mmd`, which escape `<`/`>` as HTML entities. This isn't an inconsistency — Mermaid's `sequenceDiagram` parser decodes entities back to literal characters before re-tokenizing, so an escaped `&lt;` breaks the parser worse than a raw `<` would (verified against the real parser, not assumed).

### classes.mmd
Classes and interfaces, with methods, properties, visibility, and types. Three kinds of relation:
- `--|> : extends`
- `..|> : implements`
- `--> : uses` — derived from any known class/interface referenced in a constructor parameter, property, or method signature (e.g. `CustomerService --> CustomerRepository` because it's injected in the constructor).

### dependencies.mmd
Import graph between the project's files, plus external packages. Flags:
- **cycles** (`A --> B` labeled `cycle`)
- **layer violations** (`A --> B` labeled `violation`) — only when `architecture.mmd` detected known layers, and only in the wrong direction (e.g. `Service` importing `Controller`). Foundational layers (`domain`/`model`/`entity`) can be imported by any layer without triggering a violation — that's the expected pattern, not an error.

### functions.mmd
Every function, method, and object-literal handler, with:
- a simplified signature (Mermaid doesn't accept arbitrary TypeScript types in a `classDiagram`, so parameters show only the name, and the return type goes through sanitization: generics `Promise<T>` → `Promise~T~`, unions `A | B` → `A or B`, object-literal types → `object`);
- **estimated Big-O complexity** (heuristic — see below);
- **call graph** (`--> : calls`), resolved via the type checker (not by variable name), restricted to calls into other functions Arc Code itself analyzed.

## Per-resource sub-flows

Besides the 6 files at the root of `.arch/` (whole-project view), Arc Code detects **resources** by filename and generates a subfolder with the same 6 diagrams, scoped to just that slice — useful when a project has several features and the overall diagram gets hard to read.

A resource is a group of 2+ files that share the same name prefix, ignoring the role suffix (`Controller`, `Service`, `Repository`, `Repo`, `Dao`, `Model`, `Entity`):

```
customerController.ts + customerService.ts + customerRepository.ts + domain/customer.ts
  -> resource "customer" -> .arch/domains/customer/*.mmd
```

Infrastructure files (`app.ts`, `index.ts`, `main.ts`, `server.ts`, `cli.ts`) and resources with only one file are skipped — they don't represent a flow crossing layers.

**A sub-flow isn't limited to just the resource's own files.** If a resource's file imports something from another resource (e.g. `historyService.ts` uses `DealRepository` and `PaymentRepository`), that direct neighbor (1 hop, no recursion) is pulled into the scope too — otherwise the `history` diagram would look like it depends on nothing, which would be false. Routes are assigned to the resource that implements the handler (resolved via the same type checker), not to the file where the route is registered — so routes centralized in `app.ts` still show up in the right resource's `routes.mmd`.

**Known limitation:** it's a naming convention (`resourceController.ts`, `resourceService.ts`, ...). Projects that don't prefix files by resource name (e.g. a generic `controller.ts`, or NestJS's `resource.controller.ts` convention) won't group — only the 6 root files are generated.

## Mini-flows

Inside `routes/`, `sequence/`, `functions/`, `classes/`, and `dependencies/`, each file is the smallest "navigable" unit of that diagram — the idea is to be able to open one route, one function, or one class in isolation without loading the whole project's giant diagram:

- **`routes/<n>_<METHOD>_<path>.mmd`** — one isolated route: `request → handler → calls → return`, as a flowchart. The numeric index guarantees a unique name even if two routes have similar paths.
- **`sequence/<n>_<METHOD>_<path>.mmd`** — the same isolated route, as a `sequenceDiagram`.
- **`functions/<Name>.mmd`** — one function/method plus its direct neighbors **in both directions**: who it calls, and who calls it. Without that, looking at an isolated function wouldn't say anything about its role in the flow.
- **`classes/<Name>.mmd`** — one class/interface plus its direct relations (extends/implements/uses), also in both directions — includes who uses that class, not just what it uses.
- **`dependencies/<module>.mmd`** — one file plus its direct imports (what it imports and who imports it), with cycles/violations already filtered to only the ones touching that module.

These folders **don't replace** the 6 root files — they're a complementary, granular view for when the single combined file gets too large to read at once. To find the right file without listing the folder, use `manifest.json`'s `index`.

## About Big-O complexity

It's a **pattern-recognition heuristic over the AST**, not a mathematical proof or a real measurement (Arc Code never executes code to measure time). It recognizes:

- loop nesting depth (`for`/`while`/`do`, and array methods like `.map`/`.forEach`/`.filter`/`.sort`) → `O(1)`, `O(n)`, `O(n²)`, ...
- loops with a geometric counter (`i *= 2`, `n = n >> 1`) and the classic binary-search idiom (`low`/`high`/`mid`) → `O(log n)`
- simple recursion vs. recursion with multiple calls (e.g. naive Fibonacci) → `(recursive)` / `O(2^n) (recursive, multiple self-calls)`
- divide-and-conquer recursion with calls over half the input (e.g. merge sort) → `O(n log n) (recursive, divide-and-conquer)`

**This proves nothing.** An algorithm written in an unconventional way, or a division by a constant other than 2, can escape detection and show up as `O(n)`/`O(1)` by default. Treat it as a first signal for human review, not as absolute truth.

## Static analysis limitations

- Routes: Express pattern only (`app.method(path, handler)`); no decorator support (NestJS) in this version.
- Call chain in `routes.mmd`: depth 1 (only what the handler calls directly).
- `functions.mmd`: the call graph only connects functions Arc Code itself analyzed — calls into external libraries (Stripe, Express, etc.) are omitted from the graph, not invented.
- TypeScript generics: single level only (`Promise<Array<T>>` loses its inner brackets when becoming Mermaid-safe).
- Architecture layers: recognizes a fixed list of English folder names (`controller`, `service`, `domain`, `repository`, `model`, `entity`, `route`, `middleware`, `dao`, `database`, `db`). Projects with different naming fall back to the real directory graph.

## Development

```bash
npm install
npm test     # build + tests (built-in node:test)
npm run build
```

`examples/sample-project/` is a CRM API (Customer/Deal/Payment with Stripe + aggregated history) used to manually validate the generated diagrams.
