// Guard: UI text lives in src/i18n/en.ts, never in components.
//
// Every .tsx under components/, routes/ and app/, plus App.tsx, is parsed and
// the test fails (listing file:line) when it finds a literal that a visitor
// would read:
//   - JSX text containing letters (whitespace and punctuation are fine);
//   - the string value of title, aria-label, aria-description, placeholder,
//     alt and label attributes;
//   - a string passed as the first argument of toast-style calls
//     (toast, showToast, notify, show);
//   - a letter-bearing string used as a JSX child expression, e.g. {'Hello'}
//     or {ok ? 'Yes' : 'No'}.
// Calls to t(...) and plural(...) are the sanctioned way to produce text.
//
// Parsing uses the TypeScript 7 syntax tree API (`typescript/unstable/*`);
// the classic `ts.createSourceFile` API does not exist in TypeScript 7.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, type Project } from 'typescript/unstable/sync';
import { SyntaxKind, type SourceFile } from 'typescript/unstable/ast';

/**
 * Letter-bearing JSX text that is NOT translatable copy. Keep this list tiny:
 * technical tokens only. Everything else belongs in en.ts.
 */
const ALLOWED_TEXT = new Set([
  // Brand and repository name, rendered as a mono identifier with translate="no".
  'test-ai-marketplace',
  // Directory name in "bin/<file>" links; a path, not prose.
  'bin/',
]);

const TEXT_ATTRIBUTES = new Set(['title', 'aria-label', 'aria-description', 'placeholder', 'alt', 'label']);
const TOAST_CALLS = new Set(['toast', 'showToast', 'notify', 'show']);

const SRC = join(process.cwd(), 'src');
const hasLetters = (text: string) => /\p{L}/u.test(text);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [path] : [];
  });
}

const FILES = [...['components', 'routes', 'app'].flatMap((d) => tsxFiles(join(SRC, d))), join(SRC, 'App.tsx')].sort();

// Loose view of a syntax node: this test only reads a few well-known fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** The literals whose text can reach the screen when `expr` is rendered or used as a value. */
function valueLiterals(expr: N): N[] {
  if (!expr) return [];
  switch (expr.kind) {
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
    case SyntaxKind.TemplateExpression:
      return [expr];
    case SyntaxKind.ParenthesizedExpression:
    case SyntaxKind.AsExpression:
    case SyntaxKind.NonNullExpression:
      return valueLiterals(expr.expression);
    case SyntaxKind.ConditionalExpression:
      return [...valueLiterals(expr.whenTrue), ...valueLiterals(expr.whenFalse)];
    case SyntaxKind.BinaryExpression: {
      const op = expr.operatorToken.kind;
      if (op === SyntaxKind.AmpersandAmpersandToken || op === SyntaxKind.BarBarToken || op === SyntaxKind.QuestionQuestionToken) {
        return [...valueLiterals(expr.left), ...valueLiterals(expr.right)];
      }
      return [];
    }
    default:
      return [];
  }
}

/** Static text of a literal: a template's fixed parts, ignoring ${...} holes. */
function staticText(literal: N): string {
  if (literal.kind !== SyntaxKind.TemplateExpression) return literal.text;
  return [literal.head.text, ...Array.from<N>(literal.templateSpans).map((s) => s.literal.text)].join('');
}

function calleeName(call: N): string | undefined {
  const callee = call.expression;
  if (callee.kind === SyntaxKind.Identifier) return callee.text;
  if (callee.kind === SyntaxKind.PropertyAccessExpression) return callee.name.text;
  return undefined;
}

function violations(sf: SourceFile, file: string): string[] {
  const found: string[] = [];
  const report = (node: N, what: string, text: string) => {
    // node.pos includes leading whitespace: point at the first visible character.
    const lead = Math.max(sf.text.slice(node.pos, node.end).search(/\S/), 0);
    const { line } = sf.getLineAndCharacterOfPosition(node.pos + lead);
    found.push(`${file.slice(SRC.length - 3)}:${line + 1}  ${what}: ${JSON.stringify(text.trim())}`);
  };

  const visit = (node: N) => {
    switch (node.kind) {
      case SyntaxKind.JsxText: {
        const text: string = node.text;
        if (hasLetters(text) && !ALLOWED_TEXT.has(text.trim())) report(node, 'JSX text', text);
        break;
      }
      case SyntaxKind.JsxAttribute: {
        const name: string = node.name.text ?? '';
        if (TEXT_ATTRIBUTES.has(name) && node.initializer) {
          const init = node.initializer;
          const literals = init.kind === SyntaxKind.JsxExpression ? valueLiterals(init.expression) : [init];
          for (const lit of literals) {
            const text = staticText(lit);
            if (hasLetters(text) && !ALLOWED_TEXT.has(text.trim())) report(lit, `attribute ${name}`, text);
          }
        }
        break;
      }
      case SyntaxKind.JsxExpression: {
        const parent = node.parent?.kind;
        if (parent === SyntaxKind.JsxElement || parent === SyntaxKind.JsxFragment) {
          for (const lit of valueLiterals(node.expression)) {
            const text = staticText(lit);
            if (hasLetters(text) && !ALLOWED_TEXT.has(text.trim())) report(lit, 'JSX child expression', text);
          }
        }
        break;
      }
      case SyntaxKind.CallExpression: {
        const name = calleeName(node);
        if (name && TOAST_CALLS.has(name) && node.arguments.length > 0) {
          for (const lit of valueLiterals(node.arguments[0])) {
            const text = staticText(lit);
            if (hasLetters(text)) report(lit, `${name}() message`, text);
          }
        }
        break;
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return found;
}

describe('no hardcoded UI text', () => {
  let api: API;
  let project: Project;

  beforeAll(() => {
    api = new API({ cwd: process.cwd() });
    const opened = api.updateSnapshot({ openProject: 'tsconfig.json' }).getProjects()[0];
    if (!opened) throw new Error('tsconfig.json did not open as a project');
    project = opened;
  });
  afterAll(() => api.close());

  it('scans the expected files', () => {
    expect(FILES.length).toBeGreaterThan(15);
  });

  it('components, routes and app contain no literal copy (use t() from src/i18n)', () => {
    const found = FILES.flatMap((file) => {
      const sf = project.program.getSourceFile(file);
      if (!sf) throw new Error(`${file} is not part of the TypeScript project`);
      return violations(sf, file);
    });
    expect(found, `Move these strings to src/i18n/en.ts and render them with t():\n${found.join('\n')}`).toEqual([]);
  });
});
