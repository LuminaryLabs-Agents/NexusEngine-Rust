export const PROJECT_COMPILER_VERSION = "0.1.0";
export const PROJECT_IR_SCHEMA = "nexus-project-ir/v1";

export const projectCompilerDomainKit = Object.freeze({
  id: "project-compiler-domain-kit",
  domain: "project-compiler",
  path: "n:project-compiler",
  scope: "host-support-domain",
  version: PROJECT_COMPILER_VERSION,
  extendsBase: "DomainServiceKit",
  ownsLoop: false,
  snapshotPolicy: "serializable",
  resetPolicy: "engine-reset-aware",
  provides: Object.freeze([
    "n:project.compiler",
    "n:project.source.analysis",
    "n:project.module.graph",
    "n:project.ir",
    "n:project.target.plan"
  ]),
  requires: Object.freeze(["n:project.bundle"]),
  ownedState: Object.freeze([
    "ProjectCompilerState",
    "ProjectModuleGraphState",
    "ProjectCompilerDiagnosticLedger"
  ]),
  commands: Object.freeze([
    "project.compiler.inspect.request",
    "project.compiler.parse.request",
    "project.compiler.analyze.request",
    "project.compiler.lower.request",
    "project.compiler.target-plan.request",
    "project.compiler.validate-target.request"
  ]),
  events: Object.freeze([
    "project.compiler.inspected",
    "project.compiler.parsed",
    "project.compiler.lowered",
    "project.compiler.target-planned",
    "project.compiler.rejected"
  ]),
  descriptors: Object.freeze([
    "ProjectSourceDescriptor",
    "ProjectModuleGraphDescriptor",
    "NexusProjectIrDescriptor",
    "ProjectTargetPlanDescriptor",
    "ProjectCompilerDiagnosticDescriptor"
  ]),
  diagnostics: Object.freeze([
    "entryHtml",
    "entryModules",
    "moduleCount",
    "kitCount",
    "warningCount",
    "errorCount"
  ])
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePath(value) {
  const parts = String(value || "")
    .replaceAll("\\", "/")
    .split("/");
  const output = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function dirname(value) {
  const normalized = normalizePath(value);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}

function resolveRelative(from, specifier) {
  if (!specifier.startsWith(".")) return specifier;
  return normalizePath(`${dirname(from)}/${specifier}`);
}

function parseAttributes(source = "") {
  const attributes = {};
  const pattern = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return attributes;
}

function parseHtml(source) {
  const entryModules = [];
  const surfaces = [];
  const screens = [];
  const commands = [];
  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";

  for (const match of source.matchAll(/<script\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1]);
    if (String(attributes.type || "").toLowerCase() === "module" && typeof attributes.src === "string") {
      entryModules.push(normalizePath(attributes.src));
    }
  }

  for (const match of source.matchAll(/<canvas\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1]);
    const id = String(attributes["data-nexus-surface"] || attributes.id || `surface-${surfaces.length + 1}`);
    surfaces.push({ id, kind: "primary-presentation", tag: "canvas" });
  }

  for (const match of source.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attributes = parseAttributes(match[2]);
    if (typeof attributes["data-nexus-screen"] === "string") {
      screens.push({ id: attributes["data-nexus-screen"], tag });
    }
    if (typeof attributes["data-nexus-command"] === "string") {
      commands.push({ command: attributes["data-nexus-command"], tag, id: attributes.id || null });
    }
  }

  return {
    title,
    entryModules: [...new Set(entryModules)],
    surfaces,
    screens,
    commands
  };
}

function extractModuleSpecifiers(source) {
  const specifiers = [];
  const pattern = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return [...new Set(specifiers)];
}

function scanBalanced(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function propertyObjectSource(source, property) {
  const match = new RegExp(`\\b${property}\\s*:`).exec(source);
  if (!match) return null;
  const start = source.indexOf("{", match.index + match[0].length);
  return start < 0 ? null : scanBalanced(source, start, "{", "}");
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if ("([{".includes(character)) depth += 1;
    else if (")]}".includes(character)) depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseLiteral(source) {
  const value = source.trim();
  if (!value) return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\([\\"'])/g, "$1");
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    return splitTopLevel(value.slice(1, -1)).map(parseLiteral);
  }
  if (value.startsWith("{") && value.endsWith("}")) return parseObjectLiteral(value);
  return { expression: value };
}

function parseObjectLiteral(source) {
  const body = source.trim().replace(/^\{/, "").replace(/\}$/, "");
  const result = {};
  for (const entry of splitTopLevel(body)) {
    const separator = entry.indexOf(":");
    if (separator < 0) continue;
    const rawKey = entry.slice(0, separator).trim();
    const key = rawKey.replace(/^['"]|['"]$/g, "");
    result[key] = parseLiteral(entry.slice(separator + 1));
  }
  return result;
}

function extractDefineCalls(source, name) {
  const calls = [];
  const pattern = new RegExp(`\\b${name}\\s*\\(`, "g");
  for (const match of source.matchAll(pattern)) {
    const start = source.indexOf("(", match.index);
    const call = scanBalanced(source, start, "(", ")");
    if (call) calls.push(call.slice(1, -1).trim());
  }
  return calls;
}

function parseArgumentList(source) {
  return splitTopLevel(source).map((value) => value.trim()).filter(Boolean);
}

function extractOperations(systemSource) {
  const operations = [];
  const knownCalls = [
    ["input.axis", /ctx\.input\.axis\s*\(([^)]*)\)/g],
    ["motion.move-player", /ctx\.motion\.movePlayer\s*\(([^)]*)\)/g],
    ["events.emit", /ctx\.events\.emit\s*\(([^)]*)\)/g],
    ["world.spawn", /ctx\.world\.spawn\s*\(([^)]*)\)/g]
  ];
  for (const [op, pattern] of knownCalls) {
    for (const match of systemSource.matchAll(pattern)) {
      operations.push({ index: match.index, op, arguments: parseArgumentList(match[1]) });
    }
  }
  return operations
    .sort((left, right) => left.index - right.index)
    .map(({ index: _index, ...operation }) => operation);
}

function analyzeModule(path, source) {
  const imports = extractModuleSpecifiers(source);
  const kits = [];
  for (const kitSource of extractDefineCalls(source, "defineKit")) {
    const id = kitSource.match(/\bid\s*:\s*["']([^"']+)["']/)?.[1];
    if (!id) continue;
    const resourcesSource = propertyObjectSource(kitSource, "resources");
    const systems = extractDefineCalls(kitSource, "defineSystem").map((systemSource) => ({
      phase: systemSource.match(/\bphase\s*:\s*["']([^"']+)["']/)?.[1] || "simulation",
      operations: extractOperations(systemSource)
    }));
    kits.push({
      id,
      sourceModule: path,
      resources: resourcesSource ? parseObjectLiteral(resourcesSource) : {},
      systems
    });
  }

  const diagnostics = [];
  if (/\bimport\s*\(/.test(source)) {
    diagnostics.push({ code: "PROJECT_DYNAMIC_IMPORT", severity: "error", path, message: "Dynamic imports are not supported by native compilation." });
  }
  if (/\beval\s*\(/.test(source)) {
    diagnostics.push({ code: "PROJECT_EVAL_USAGE", severity: "error", path, message: "eval is not supported by native compilation." });
  }
  const webOnly = /\b(?:document|window|HTMLElement)\b|\bnew\s+THREE\./.test(source);
  if (webOnly) {
    diagnostics.push({ code: "PROJECT_WEB_ONLY_MODULE", severity: "warning", path, message: "Browser-specific code will remain on the web target and is not lowered into native Rust." });
  }

  return {
    path,
    imports,
    classification: webOnly ? "web-only" : "portable-candidate",
    kits,
    diagnostics
  };
}

async function resolveModulePath(provider, from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const candidate = typeof provider.resolve === "function"
    ? normalizePath(await provider.resolve(from, specifier))
    : resolveRelative(from, specifier);
  const candidates = [candidate];
  if (!/\.[a-z0-9]+$/i.test(candidate)) candidates.push(`${candidate}.mjs`, `${candidate}.js`, `${candidate}/index.mjs`, `${candidate}/index.js`);
  for (const path of candidates) {
    if (await provider.exists(path)) return path;
  }
  return candidate;
}

export function createMemoryProjectSourceProvider(files = {}) {
  const normalized = new Map(Object.entries(files).map(([path, source]) => [normalizePath(path), String(source)]));
  return {
    async listFiles() {
      return [...normalized.keys()].sort();
    },
    async readText(path) {
      const key = normalizePath(path);
      if (!normalized.has(key)) throw new Error(`missing project file: ${key}`);
      return normalized.get(key);
    },
    async exists(path) {
      return normalized.has(normalizePath(path));
    },
    resolve(from, specifier) {
      return resolveRelative(from, specifier);
    }
  };
}

export function createProjectCompiler({ sourceProvider } = {}) {
  if (!sourceProvider) throw new TypeError("sourceProvider is required");
  let state = { status: "idle", projectIR: null, diagnostics: [] };

  async function inspectProject({ entryHtml = "index.html" } = {}) {
    const files = await sourceProvider.listFiles();
    const normalizedEntry = normalizePath(entryHtml);
    const diagnostics = [];
    if (!(await sourceProvider.exists(normalizedEntry))) {
      diagnostics.push({ code: "PROJECT_ENTRY_HTML_MISSING", severity: "error", path: normalizedEntry, message: "Project entry HTML was not found." });
    }
    const inspection = {
      schema: "nexus-project-source/v1",
      entryHtml: normalizedEntry,
      files,
      assets: files.filter((path) => path.startsWith("assets/")),
      diagnostics
    };
    state = { ...state, status: "inspected", diagnostics: clone(diagnostics) };
    return inspection;
  }

  async function createModuleGraph(entryModules) {
    const modules = [];
    const diagnostics = [];
    const pending = [...entryModules];
    const visited = new Set();
    while (pending.length) {
      const path = normalizePath(pending.shift());
      if (!path || visited.has(path)) continue;
      visited.add(path);
      if (!(await sourceProvider.exists(path))) {
        diagnostics.push({ code: "PROJECT_MODULE_MISSING", severity: "error", path, message: "Imported module was not found." });
        continue;
      }
      const source = await sourceProvider.readText(path);
      const module = analyzeModule(path, source);
      modules.push(module);
      diagnostics.push(...module.diagnostics);
      for (const specifier of module.imports) {
        const resolved = await resolveModulePath(sourceProvider, path, specifier);
        if (resolved) pending.push(resolved);
      }
    }
    return { schema: "nexus-project-module-graph/v1", entryModules: [...entryModules], modules, diagnostics };
  }

  async function createProjectIR({ entryHtml = "index.html", projectId, projectName } = {}) {
    const inspection = await inspectProject({ entryHtml });
    if (inspection.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      const error = new Error("project inspection failed");
      error.diagnostics = inspection.diagnostics;
      throw error;
    }
    const htmlSource = await sourceProvider.readText(inspection.entryHtml);
    const html = parseHtml(htmlSource);
    const graph = await createModuleGraph(html.entryModules);
    const diagnostics = [...inspection.diagnostics, ...graph.diagnostics];
    const fallbackId = normalizePath(projectId || inspection.entryHtml.replace(/\/[^/]+$/, "") || "nexus-project").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "nexus-project";
    const ir = {
      schema: PROJECT_IR_SCHEMA,
      compilerVersion: PROJECT_COMPILER_VERSION,
      project: {
        id: projectId || fallbackId,
        name: projectName || html.title || projectId || fallbackId,
        entryHtml: inspection.entryHtml
      },
      entryModules: html.entryModules,
      modules: graph.modules,
      kits: graph.modules.flatMap((module) => module.kits),
      surfaces: html.surfaces,
      screens: html.screens.map((screen) => ({ ...screen, commands: html.commands.filter((command) => command.id === screen.id || command.id === null) })),
      assets: inspection.assets,
      diagnostics
    };
    state = { status: "lowered", projectIR: clone(ir), diagnostics: clone(diagnostics) };
    return ir;
  }

  function planTarget(projectIR, target) {
    if (!projectIR || projectIR.schema !== PROJECT_IR_SCHEMA) throw new TypeError(`expected ${PROJECT_IR_SCHEMA}`);
    const errors = projectIR.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    const supportedTargets = new Set(["web", "web-static", "native-rust-headless"]);
    const supported = supportedTargets.has(target) && errors.length === 0;
    const plan = {
      schema: "nexus-project-target-plan/v1",
      target,
      supported,
      stages: target === "native-rust-headless"
        ? ["project-ir", "rust-source", "cargo-build", "artifact"]
        : ["source-copy", "web-bundle", "artifact"],
      diagnostics: supportedTargets.has(target)
        ? clone(projectIR.diagnostics)
        : [{ code: "PROJECT_TARGET_UNKNOWN", severity: "error", message: `Unknown target: ${target}` }]
    };
    state = { ...state, status: "target-planned" };
    return plan;
  }

  return Object.freeze({
    domain: projectCompilerDomainKit,
    inspectProject,
    createModuleGraph,
    createProjectIR,
    planTarget,
    getDiagnostics: () => clone(state.diagnostics),
    snapshot: () => clone(state),
    reset() {
      state = { status: "idle", projectIR: null, diagnostics: [] };
      return clone(state);
    }
  });
}

export default createProjectCompiler;
