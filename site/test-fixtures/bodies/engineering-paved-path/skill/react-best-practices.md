# React best practices

Prefer function components and hooks. Keep components small and typed.

## Components

- One component per file; name the file after the component.
- Props are typed with an `interface`; avoid `any`.

## State

- Keep state as close to where it is used as possible.
- Derive values during render instead of syncing them with `useEffect`.

## Accessibility

- Every interactive element is reachable by keyboard and has an accessible name.
- Use semantic HTML before ARIA.

## Performance

- Measure before memoising. See `references/hooks.md` for `useMemo` and `useCallback` guidance.
