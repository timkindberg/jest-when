/**
 * Type tests for jest-when - Issue #109
 * These tests verify TypeScript type inference for Promise unwrapping
 * Run with: npm run test:types
 */

import { expectType, expectError } from 'tsd';
import { when, WhenMock } from '..';

// ============================================================================
// Test: mockResolvedValue ACCEPTS unwrapped Promise type (the fix for #109)
// ============================================================================

// Should accept boolean when mock returns Promise<boolean>
{
  const fn = jest.fn<Promise<boolean>, []>();

  // This should compile and accept boolean (not Promise<boolean>)
  when(fn).mockResolvedValue(true);
  when(fn).mockResolvedValue(false);

  // Should REJECT Promise<boolean> - we want the unwrapped type
  expectError(when(fn).mockResolvedValue(Promise.resolve(true)));
}

// Should accept string when mock returns Promise<string>
{
  const fn = jest.fn<Promise<string>, [number]>();

  when(fn).calledWith(1).mockResolvedValue('test');

  // Should reject wrong types
  expectError(when(fn).calledWith(1).mockResolvedValue(123));
  expectError(when(fn).calledWith(1).mockResolvedValue(Promise.resolve('test')));
}

// Should accept number when mock returns Promise<number>
{
  const fn = jest.fn<Promise<number>, []>();

  when(fn).defaultResolvedValue(42);

  // Should reject wrong types
  expectError(when(fn).defaultResolvedValue('wrong'));
  expectError(when(fn).defaultResolvedValue(Promise.resolve(42)));
}

// ============================================================================
// Test: mockResolvedValueOnce also accepts unwrapped type
// ============================================================================

{
  const fn = jest.fn<Promise<string>, []>();

  when(fn).calledWith().mockResolvedValueOnce('once');

  // Should reject Promise<string>
  expectError(when(fn).calledWith().mockResolvedValueOnce(Promise.resolve('once')));
}

// ============================================================================
// Test: Complex object types
// ============================================================================

{
  interface User {
    id: number;
    name: string;
  }

  const fn = jest.fn<Promise<User>, [number]>();

  // Should accept User object
  when(fn).calledWith(1).mockResolvedValue({ id: 1, name: 'Alice' });

  // Should reject incomplete objects
  expectError(when(fn).calledWith(2).mockResolvedValue({ id: 2 }));
  expectError(when(fn).calledWith(3).mockResolvedValue({ name: 'Bob' }));

  // Should reject Promise<User>
  expectError(when(fn).calledWith(4).mockResolvedValue(Promise.resolve({ id: 4, name: 'Charlie' })));
}

// ============================================================================
// Test: jest.spyOn with async methods
// ============================================================================

{
  const obj = {
    asyncMethod: async (): Promise<boolean> => false
  };

  const spy = jest.spyOn(obj, 'asyncMethod');

  // Should accept boolean
  when(spy).mockResolvedValue(true);

  // Should reject Promise<boolean>
  expectError(when(spy).mockResolvedValue(Promise.resolve(true)));
}

// ============================================================================
// Test: Chaining works correctly with type preservation
// ============================================================================

{
  const fn = jest.fn<Promise<string>, [number]>();

  // Chaining should work and maintain types
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
// Test: mockRejectedValueOnce accepts any error type
// ============================================================================

{
  const fn = jest.fn<Promise<boolean>, []>();

  when(fn).calledWith().mockRejectedValueOnce(new Error('once'));
}

// ============================================================================
// Test: Non-Promise types still work correctly
// ============================================================================

{
  const fn = jest.fn<string, []>();

  // Regular mockReturnValue should still work
  when(fn).mockReturnValue('test');

  // Should reject wrong types
  expectError(when(fn).mockReturnValue(123));
}

// ============================================================================
// Test: mockResolvedValue on non-Promise function
// (Unpromisify should pass through non-Promise types)
// ============================================================================

{
  const fn = jest.fn<string, []>();

  // When TReturn is not a Promise, mockResolvedValue should still accept the type
  when(fn).mockResolvedValue('test');

  // Should reject wrong types
  expectError(when(fn).mockResolvedValue(123));
}

// ============================================================================
// Test: Nested Promises (should only unwrap one level)
// ============================================================================

{
  const fn = jest.fn<Promise<Promise<string>>, []>();

  // Should accept Promise<string> (unwraps one level)
  when(fn).mockResolvedValue(Promise.resolve('test'));

  // Should reject bare string
  expectError(when(fn).mockResolvedValue('test'));
}

// ============================================================================
// Test: expectCalledWith works with resolved values
// ============================================================================

{
  const fn = jest.fn<Promise<boolean>, [string]>();

  when(fn).expectCalledWith('test').mockResolvedValue(true);

  // Should reject Promise<boolean>
  expectError(when(fn).expectCalledWith('test').mockResolvedValue(Promise.resolve(true)));
}

// ============================================================================
// Test: Union types work correctly
// ============================================================================

{
  const fn = jest.fn<Promise<string | number>, []>();

  when(fn).mockResolvedValue('string');
  when(fn).mockResolvedValue(42);

  // Should reject types not in the union
  expectError(when(fn).mockResolvedValue(true));
  expectError(when(fn).mockResolvedValue(Promise.resolve('string')));
}
