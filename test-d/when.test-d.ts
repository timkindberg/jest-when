/**
 * Type tests for jest-when - Issue #109
 * These tests verify TypeScript type inference for Promise unwrapping
 * Run with: npm run test:types
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd';
import { when } from '..';

// ============================================================================
// Test: mockResolvedValue accepts unwrapped Promise type (the fix)
// ============================================================================

{
  const fn = jest.fn<Promise<boolean>, []>();
  when(fn).mockResolvedValue(true); // Should accept boolean ✓
  expectAssignable<boolean>(true);
}

{
  const fn = jest.fn<Promise<string>, [number]>();
  when(fn).calledWith(1).mockResolvedValue('test'); // Should accept string ✓
}

{
  const fn = jest.fn<Promise<number>, []>();
  when(fn).defaultResolvedValue(42); // Should accept number ✓
}

// ============================================================================
// Test: mockResolvedValueOnce also accepts unwrapped type
// ============================================================================

{
  const fn = jest.fn<Promise<string>, []>();
  when(fn).calledWith().mockResolvedValueOnce('once'); // Should accept string ✓
}

// ============================================================================
// Test: Complex types work correctly
// ============================================================================

{
  interface User {
    id: number;
    name: string;
  }

  const fn = jest.fn<Promise<User>, [number]>();
  when(fn).calledWith(1).mockResolvedValue({ id: 1, name: 'Alice' }); // Should accept User ✓
}

// ============================================================================
// Test: jest.spyOn with async methods
// ============================================================================

{
  const obj = {
    asyncMethod: async (): Promise<boolean> => false
  };

  const spy = jest.spyOn(obj, 'asyncMethod');
  when(spy).mockResolvedValue(true); // Should accept boolean ✓
}

// ============================================================================
// Test: Chaining works with correct types
// ============================================================================

{
  const fn = jest.fn<Promise<string>, [number]>();
  when(fn)
    .calledWith(1).mockResolvedValue('one')
    .calledWith(2).mockResolvedValue('two')
    .defaultResolvedValue('default');
}

// ============================================================================
// Test: mockRejectedValue accepts any error type
// ============================================================================

{
  const fn = jest.fn<Promise<string>, []>();
  when(fn).calledWith().mockRejectedValue(new Error('test'));
  when(fn).calledWith().mockRejectedValue('string error');
  when(fn).calledWith().mockRejectedValue({ custom: 'error' });
}

// ============================================================================
// Test: Non-Promise types still work (edge case)
// ============================================================================

{
  const fn = jest.fn<string, []>();
  when(fn).mockReturnValue('test'); // Regular mockReturnValue ✓
}

// ============================================================================
// Test: mockResolvedValue on non-Promise function
// (Unpromisify should return the type as-is)
// ============================================================================

{
  const fn = jest.fn<string, []>();
  when(fn).mockResolvedValue('test'); // Should still accept string
}
