// A value-style import that only carries a type. TypeScript erases it at compile time,
// so the bundler never resolves `type-fest` — but @module-federation/vite's expose scanner does.
import { JsonValue } from 'type-fest';

export function widget(): JsonValue {
  return { hello: 'world' };
}
