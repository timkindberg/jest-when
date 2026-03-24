import * as assert from 'assert';

/**
 * Extend Jest types to include our custom properties for jest-when integration
 * @internal
 */
declare global {
  namespace jest {
    interface Mock {
      /** @internal */
      __whenMock__?: WhenMock<any, any[]>;
    }
    
    interface SpyInstance {
      /** @internal */
      __whenMock__?: WhenMock<any, any[]>;
    }
  }
}

/** @internal Registry of all jest-when managed mocks */
let registry = new Set<jest.Mock | jest.SpyInstance>();

/**
 * Get call stack lines for error reporting
 * @internal
 * @returns Formatted stack trace string
 */
const getCallLines = (): string => (new Error()).stack!.split('\n').slice(4).join('\n');

/**
 * A hack to capture a reference to the `equals` jasmineUtil
 * @internal
 */
let equals: jest.MatcherUtils['equals'] = () => false;
expect.extend({
  __capture_equals__() {
    equals = this.equals;
    return { pass: true, message: () => '' };
  }
});
(expect as any)().__capture_equals__();
let JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object');
// Hackily reset assertionCalls back to zero incase dev's tests are using expect.assertions()
(global as any)[JEST_MATCHERS_OBJECT].state.assertionCalls = 0;
// Hackily delete the custom matcher that we added
delete (global as any)[JEST_MATCHERS_OBJECT].matchers.__capture_equals__;
/**
 * End hack
 */

/**
 * A matcher that can be used to match function arguments
 * Can be literals, objects, arrays, Jest asymmetric matchers, or function matchers
 */
type Matcher = any;

/**
 * A function that can be used as a matcher for jest-when
 */
type FunctionMatcher<TFunc extends (...args: any[]) => any> = TFunc & {
  _isFunctionMatcher?: boolean;
  _isAllArgsFunctionMatcher?: boolean;
};

export type AllArgsMatcher<Y extends any[]> = ((args: Y, equals: jest.MatcherUtils['equals']) => boolean) & {
  _isAllArgsFunctionMatcher?: true;
  _isFunctionMatcher?: true;
};

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true ? false : [unknown] extends [T] ? ([T] extends [unknown] ? true : false) : false;
type NormalizeReturn<T> = IsAny<T> extends true ? any : IsUnknown<T> extends true ? any : T;
type NormalizeArgs<TArgs extends any[]> = number extends TArgs['length']
  ? IsAny<TArgs[number]> extends true
    ? any[]
    : IsUnknown<TArgs[number]> extends true
      ? any[]
      : TArgs
  : { [K in keyof TArgs]: IsAny<TArgs[K]> extends true ? any : IsUnknown<TArgs[K]> extends true ? any : TArgs[K] };
type ResolvedValue<T> = IsAny<T> extends true ? any : IsUnknown<T> extends true ? unknown : T extends PromiseLike<infer U> ? U | T : T;
type RejectedValue<T> = IsAny<T> extends true ? any : IsUnknown<T> extends true ? unknown : T extends PromiseLike<any> ? any : never;

export type ArgumentOrMatcher<ArgTypes extends any[]> = {
  [Index in keyof ArgTypes]: ArgTypes[Index] | jest.AsymmetricMatcher | WhenMock<boolean, [ArgTypes[Index]]>;
};

export interface WhenMockWithMatchers<T = any, Y extends any[] = any[]> {
  mockReturnValue(value: T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockReturnValueOnce(value: T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockResolvedValue(value: ResolvedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockResolvedValueOnce(value: ResolvedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockRejectedValue(value: RejectedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockRejectedValueOnce(value: RejectedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockImplementation(fn: (...args: Y) => T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockImplementationOnce(fn?: (...args: Y) => T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  defaultImplementation(fn: (...args: Y) => T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  defaultReturnValue(value: T): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  defaultResolvedValue(value: ResolvedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  defaultRejectedValue(value: RejectedValue<T>): WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;
  mockReset(): WhenMock<T, Y>;
}

type WhenMockChain<T = any, Y extends any[] = any[]> = WhenMockWithMatchers<T, Y> & WhenMock<T, Y>;

/**
 * Internal representation of a mock call configuration
 * @internal
 */
interface CallMock {
  /** The matchers used to match function arguments */
  matchers: Matcher[];
  /** The implementation function to call when matched */
  mockImplementation: Function;
  /** Whether this mock expects to be called (for expectCalledWith) */
  expectCall: boolean;
  /** Whether this mock should only be called once */
  once: boolean;
  /** Whether this mock has been called */
  called: boolean;
  /** Unique identifier for this mock call */
  id: number;
  /** Stack trace lines for error reporting */
  callLines: string;
}


const checkArgumentMatchers = (expectCall: boolean, args: any[]) => (match: boolean, matcher: Matcher, i: number): boolean => {
  // Propagate failure to the end
  if (!match) {
    return false;
  }

  const arg = args[i];

  const isFunctionMatcher = typeof matcher === 'function' && matcher._isFunctionMatcher;

  // Assert the match for better messaging during a failure
  if (expectCall) {
    if (isFunctionMatcher) {
      const isMatch = matcher(arg);
      const msg = `Failed function matcher within expectCalledWith: ${matcher.name}(${JSON.stringify(arg)}) did not return true\n\n\n...rest of the stack...`;
      assert.equal(isMatch, true, msg);
    } else {
      expect(arg).toEqual(matcher);
    }
  }

  if (isFunctionMatcher) {
    return matcher(arg, equals);
  }

  return equals(arg, matcher);
};

/**
 * The main WhenMock class that provides jest-when functionality. Not used directly by users.
 * Users should use the `when()` function to create WhenMock instances.
 * 
 * @example
 * ```typescript
 * const mock = jest.fn();
 * const whenMock = when(mock); // This line creates a WhenMock instance
 * 
 * whenMock
 *   .calledWith('hello')
 *   .mockReturnValue('world')
 *   .calledWith('goodbye')
 *   .mockReturnValue('cruel world');
 * 
 * mock('hello'); // Returns: "world"
 * mock('goodbye'); // Returns: "cruel world"
 * ```
 * 
 * @template TReturn The return type of the mocked function
 */
export class WhenMock<TReturn = any, TArgs extends any[] = any[]> {
  /** @internal Next ID for call mocks */
  private nextCallMockId = 0;
  
  /** @internal The underlying Jest mock or spy function */
  public fn: jest.Mock<TReturn, TArgs> | jest.SpyInstance<TReturn, TArgs>;
  
  /** @internal Array of configured call mocks */
  public callMocks: CallMock[] = [];
  
  /** @internal Original mock implementation before jest-when modifications */
  public __origMock: ((...args: any[]) => any) | undefined;

  /** @internal Whether .calledWith() was already called on this mock since the last when() */
  public __noCalledWithYet: boolean = true;
  
  /** @internal Matchers for the mock */
  private _matchers: Matcher[] = [];

  /** @internal Whether to expect the mock to be called */
  private _expectCall: boolean = false;

  /** @internal Whether to only call the mock once */
  private _once: boolean = false;

  /** @internal The default implementation when no matchers are specified */
  private _defaultImplementation: ((...args: any[]) => any) | undefined;

  /**
   * Specify the arguments that should trigger this mock behavior
   * @param matchers The argument matchers (literals, objects, Jest matchers, or function matchers)
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo', 42).mockReturnValue('matched');
   * 
   * fn('foo', 42); // Returns: "matched"
   * fn('bar', 42); // Returns: undefined
   * ```
   */
  calledWith: {
    (allArgsMatcher: AllArgsMatcher<TArgs>): WhenMockWithMatchers<TReturn, TArgs>;
    (...matchers: ArgumentOrMatcher<TArgs>): WhenMockWithMatchers<TReturn, TArgs>;
  } = (...matchers: Matcher[]) => {
    this.__noCalledWithYet = false;
    this._matchers = matchers;
    this._expectCall = false;
    return this;
  }

  /**
   * Specify the arguments that should trigger this mock behavior and assert they are called
   * @param matchers The argument matchers (literals, objects, Jest matchers, or function matchers)
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).expectCalledWith('foo').mockReturnValue('success');
   * 
   * fn('foo'); // Returns: "success" ✅
   * fn('bar'); // Throws assertion error ❌
   * ```
   */
  expectCalledWith: {
    (allArgsMatcher: AllArgsMatcher<TArgs>): WhenMockWithMatchers<TReturn, TArgs>;
    (...matchers: ArgumentOrMatcher<TArgs>): WhenMockWithMatchers<TReturn, TArgs>;
  } = (...matchers: Matcher[]) => {
    this.__noCalledWithYet = false;
    this._matchers = matchers;
    this._expectCall = true;
    return this;
  }

  /**
   * Set a default implementation for the mock (fallback when no specific matchers match)
   * @param implementation The function to call
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValue('special').defaultImplementation(() => 'default');
   * 
   * fn('foo'); // Returns: "special"
   * fn('bar'); // Returns: "default"
   * ```
   */
  defaultImplementation: (mockImplementation: (...args: TArgs) => TReturn) => WhenMockChain<TReturn, TArgs> = (mockImplementation) => {
    this.__noCalledWithYet = true;
    this._matchers = [];
    this._expectCall = false;
    // Set up an implementation with a special matcher that can never be matched because it uses a private symbol
    // Additionally the symbols existence can be checked to see if a calledWith was omitted.
    this._mockImplementation(mockImplementation);
    return this
  };
  /**
   * Set a default return value for the mock (fallback when no specific matchers match)
   * @param returnValue The value to return
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValue('special').defaultReturnValue('default');
   * 
   * fn('foo'); // Returns: "special"
   * fn('bar'); // Returns: "default"
   * ```
   */
  defaultReturnValue: (returnValue: TReturn) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    this.defaultImplementation(() => returnValue);
    return this;
  }
  /**
   * Set a default resolved Promise value for the mock (fallback when no specific matchers match)
   * @param returnValue The value to resolve with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockResolvedValue('special').defaultResolvedValue('default');
   * 
   * await fn('foo'); // Returns: Promise that resolves to "special"
   * await fn('bar'); // Returns: Promise that resolves to "default"
   * ```
   */
  defaultResolvedValue: (returnValue: ResolvedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    this.defaultReturnValue(Promise.resolve(returnValue) as TReturn);
    return this;
  }
  /**
   * Set a default rejected Promise value for the mock (fallback when no specific matchers match)
   * @param err The error to reject with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockResolvedValue('special').defaultRejectedValue(new Error('default error'));
   * 
   * await fn('foo'); // Returns: Promise that resolves to "special"
   * await fn('bar'); // Returns: Promise that rejects with Error('default error')
   * ```
   */
  defaultRejectedValue: (err: RejectedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (err) => {
    this.defaultReturnValue(Promise.reject(err) as TReturn);
    return this;
  }

  /**
   * Set a return value for the mock when called with the specified arguments
   * @param returnValue The value to return
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValue('success');
   * 
   * fn('foo'); // Returns: "success"
   * ```
   */
  mockReturnValue: (returnValue: TReturn) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    if (this.__noCalledWithYet) {
      this.defaultReturnValue(returnValue);
    } else {
      this._mockImplementation(() => returnValue);
    }
    return this;
  }
  /**
   * Set a return value for the mock when called with the specified arguments (one-time only)
   * @param returnValue The value to return
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValueOnce('first').mockReturnValue('default');
   * 
   * fn('foo'); // Returns: "first"
   * fn('foo'); // Returns: "default"
   * ```
   */
  mockReturnValueOnce: (returnValue: TReturn) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    this._once = true;
    return this.mockReturnValue(returnValue);
  }

  /**
   * Set a resolved Promise value for the mock when called with the specified arguments
   * @param returnValue The value to resolve with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockResolvedValue('async success');
   * 
   * await fn('foo'); // Returns: Promise that resolves to "async success"
   * ```
   */
  mockResolvedValue: (returnValue: ResolvedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    if (this.__noCalledWithYet) {
      this.defaultResolvedValue(returnValue);
    } else {
      this._mockImplementation(() => Promise.resolve(returnValue));
    }
    return this;
  }
  /**
   * Set a resolved Promise value for the mock when called with the specified arguments (one-time only)
   * @param returnValue The value to resolve with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockResolvedValueOnce('first async');
   * 
   * await fn('foo'); // Returns: Promise that resolves to "first async"
   * await fn('foo'); // Returns: Promise that resolves to undefined
   * ```
   */
  mockResolvedValueOnce: (returnValue: ResolvedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (returnValue) => {
    this._once = true;
    return this.mockResolvedValue(returnValue);
  }

  /**
   * Set a rejected Promise value for the mock when called with the specified arguments
   * @param err The error to reject with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockRejectedValue(new Error('async error'));
   * 
   * await fn('foo'); // Returns: Promise that rejects with Error('async error')
   * ```
   */
  mockRejectedValue: (err: RejectedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (err) => {
    if (this.__noCalledWithYet) {
      this.defaultRejectedValue(err);
    } else {
      this._mockImplementation(() => Promise.reject(err));
    }
    return this;
  }
  /**
   * Set a rejected Promise value for the mock when called with the specified arguments (one-time only)
   * @param err The error to reject with
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockRejectedValueOnce(new Error('first error'));
   * 
   * await fn('foo'); // Returns: Promise that rejects with Error('first error')
   * await fn('foo'); // Returns: Promise that resolves to undefined
   * ```
   */
  mockRejectedValueOnce: (err: RejectedValue<TReturn>) => WhenMockChain<TReturn, TArgs> = (err) => {
    this._once = true;
    return this.mockRejectedValue(err);
  }

  /**
   * Set a custom implementation for the mock when called with the specified arguments
   * @param implementation The function to call
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockImplementation((arg) => `processed: ${arg}`);
   * 
   * fn('foo'); // Returns: "processed: foo"
   * ```
   */
  mockImplementation: (implementation: (...args: TArgs) => TReturn) => WhenMockChain<TReturn, TArgs> = (implementation) => {
    if (this.__noCalledWithYet) {
      this.defaultImplementation(implementation);
    } else {
      this._mockImplementation(implementation);
    }
    return this;
  }
  /**
   * Set a custom implementation for the mock when called with the specified arguments (one-time only)
   * @param implementation The function to call
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockImplementationOnce((arg) => `first: ${arg}`);
   * 
   * fn('foo'); // Returns: "first: foo"
   * fn('foo'); // Returns: undefined
   * ```
   */
  mockImplementationOnce: (implementation?: (...args: TArgs) => TReturn) => WhenMockChain<TReturn, TArgs> = (implementation) => {
    this._once = true;
    return this.mockImplementation(implementation ?? (() => undefined as unknown as TReturn));
  }

  /**
   * Reset all when mocks for this function
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValue('bar');
   * when(fn).calledWith('baz').mockReturnValue('qux');
   * 
   * fn.resetWhenMocks();
   * fn('foo'); // Returns: undefined
   * fn('baz'); // Returns: undefined
   * ```
   */
  resetWhenMocks = () => {
    resetWhenMocksOnFn(this.fn)
  }

  /**
   * Reset the mock for the specified arguments
   * @returns The WhenMock instance for chaining
   * @example
   * ```typescript
   * const fn = jest.fn();
   * when(fn).calledWith('foo').mockReturnValue('bar');
   * 
   * fn('foo'); // Returns: "bar"
   * 
   * when(fn).calledWith('foo').mockReset();
   * fn('foo'); // Returns: undefined
   * ```
   */
  mockReset: () => WhenMock<TReturn, TArgs> = () => {
      this.callMocks = this.callMocks.filter((callMock) => !equals(callMock.matchers, this._matchers));
      return this;
  }

  /**
   * Create a new WhenMock instance
   * @param fn The Jest mock or spy function to wrap
   */
  constructor(fn: jest.Mock<TReturn, TArgs> | jest.SpyInstance<TReturn, TArgs>) {
    this.fn = fn;
    fn.__whenMock__ = this;
    this.__origMock = fn.getMockImplementation() || undefined;
  }

  /** @internal The function to call when the mock is called */
  private _mockImplementation = (mockImplementation: (...args: any[]) => any) => {
    if (this.__noCalledWithYet) {
      this._defaultImplementation = mockImplementation;
    }
    // To enable dynamic replacement during a test:
    // * call mocks with equal matchers are removed
    // * `once` mocks are prioritized
    this.callMocks = this.callMocks
      .filter((callMock) => this._once || callMock.once || !equals(callMock.matchers, this._matchers))
      .concat({ 
          matchers: this._matchers, 
          mockImplementation, 
          expectCall: this._expectCall, 
          once: this._once, 
          called: false, 
          id: this.nextCallMockId, 
          callLines: getCallLines() 
      })
      .sort((a, b) => {
        // Once mocks should appear before the rest
        if (a.once !== b.once) {
          return a.once ? -1 : 1;
        }
        return a.id - b.id;
      });

    this.nextCallMockId++;
    this._once = false;

    const instance = this;
    this.fn.mockImplementation(function (this: any, ...args: any[]) {
      for (let i = 0; i < instance.callMocks.length; i++) {
        const { matchers, mockImplementation, expectCall, once, called } = instance.callMocks[i];

        // Do not let a once mock match more than once
        if (once && called) continue;

        let isMatch = false;

        if (matchers && matchers[0] &&
          // is a possible all args matcher object
          (typeof matchers[0] === 'function' || typeof matchers[0] === 'object') &&
          // ensure not a proxy
          '_isAllArgsFunctionMatcher' in matchers[0] &&
          // check for the special property name
          matchers[0]._isAllArgsFunctionMatcher === true
        ) {
          if (matchers.length > 1) throw new Error('When using when.allArgs, it must be the one and only matcher provided to calledWith. You have incorrectly provided other matchers along with when.allArgs.');
          isMatch = checkArgumentMatchers(expectCall, [args])(true, matchers[0], 0);
        } else {
          isMatch =
            args.length === matchers.length &&
            matchers.reduce(checkArgumentMatchers(expectCall, args), true);
        }

        if (isMatch && typeof mockImplementation === 'function') {
          instance.callMocks[i].called = true;
          return mockImplementation.call(this, ...args);
        }
      }

      if (instance._defaultImplementation) {
        return instance._defaultImplementation.call(this, ...args);
      }
      if (typeof instance.fn.__whenMock__?.__origMock === 'function') {
        return instance.fn.__whenMock__.__origMock.call(this, ...args);
      }
      return undefined;
    });
  }
}

/**
 * A function that can be used with jest-when (Jest mocks, spies, or regular functions)
 * @template TReturn The return type of the function
 * @template TArgs The argument types of the function
 */
type MockableFunction<TReturn = any, TArgs extends any[] = any[]> =
  | jest.Mock<TReturn, TArgs>
  | jest.SpyInstance<TReturn, TArgs>

type ExtractFunction<T> = Exclude<T, undefined> extends (...args: any[]) => any ? Exclude<T, undefined> : never;

type FunctionFromMockLike<T> = T extends { mockImplementation(fn?: infer TImplementation): any }
  ? ExtractFunction<TImplementation>
  : never;

type Whenified<T> = [FunctionFromMockLike<T>] extends [never]
  ? T extends (...args: infer TArgs) => infer TReturn
    ? WhenMock<NormalizeReturn<TReturn>, NormalizeArgs<TArgs>>
    : never
  : FunctionFromMockLike<T> extends (...args: infer TArgs) => infer TReturn
    ? WhenMock<NormalizeReturn<TReturn>, NormalizeArgs<TArgs>>
    : never;

/**
 * Type guard to check if a function is a Jest mock or spy
 * @param fn The function to check
 * @returns True if the function is a Jest mock or spy
 * @internal
 */
function isJestMock(fn: unknown): fn is MockableFunction {
  return fn != null && typeof fn === 'function' && '_isMockFunction' in fn && (fn as any)._isMockFunction;
}

/**
 * The main jest-when function for creating mocks
 * 
 * Can also be used to create function matchers (see below)
 * 
 * @example
 * ```typescript
 * // Create a mock
 * const mock = jest.fn();
 * when(mock).calledWith('hello').mockReturnValue('world');
 * mock('hello'); // Returns: "world"
 * ```
 * 
 * @example
 * ```typescript
 * // Create a function matcher
 * const isEven = when((n: number) => n % 2 === 0);
 * when(mock).calledWith(isEven).mockReturnValue('even number');
 * mock(4); // Returns: "even number"
 * ```
 */
export function when<T>(fn: T): Whenified<T>;
export function when(fn: any): any {
  // This bit is for when you use `when` to make a WhenMock
  // when(fn) <-- This one
  //     .calledWith(when(numberIsGreaterThanZero)) <-- Not this one
  if (isJestMock(fn)) {
    if (fn.__whenMock__ instanceof WhenMock) {
        fn.__whenMock__.__noCalledWithYet = true;
        return fn.__whenMock__;
    }
    const whenMock = new WhenMock(fn);
    registry.add(fn);
    const originalMockReset = fn.mockReset;
    fn.mockReset = () => {
      resetWhenMocksOnFn(fn);
      fn.mockReset = originalMockReset;
      fn.mockReset();
      return fn;
    };
    return whenMock;
  }

  // This bit is for when you use `when` as a function matcher
  // when(fn) <-- Not this one
  //     .calledWith(when(numberIsGreaterThanZero)) <-- This one
  fn._isFunctionMatcher = true;
  return fn;
}

/**
 * Create a function matcher that receives all arguments as an array
 * 
 * @example
 * ```typescript
 * const allNumbers = when.allArgs((args: any[]) => 
 *   args.every(arg => typeof arg === 'number')
 * );
 * 
 * when(mock).calledWith(allNumbers).mockReturnValue('all numbers');
 * mock(1, 2, 3, 4); // Returns: "all numbers"
 * ```
 * 
 * @template TFunc The function type to create a matcher for
 * @param fn The function that receives all arguments as an array
 * @returns The function with all-args matcher properties
 */
when.allArgs = function allArgs<Y extends any[]>(fn: (args: Y, equals: jest.MatcherUtils['equals']) => boolean): AllArgsMatcher<Y> {
  (fn as AllArgsMatcher<Y>)._isFunctionMatcher = true;
  (fn as AllArgsMatcher<Y>)._isAllArgsFunctionMatcher = true;
  return fn as AllArgsMatcher<Y>;
}

/**
 * Reset all when mocks across all functions, restoring their original implementations
 * 
 * @example
 * ```typescript
 * const mock1 = jest.fn();
 * const mock2 = jest.fn();
 * 
 * when(mock1).calledWith('hello').mockReturnValue('world');
 * when(mock2).calledWith('goodbye').mockReturnValue('cruel world');
 * 
 * resetAllWhenMocks();
 * mock1('hello'); // Returns: undefined (back to original behavior)
 * mock2('goodbye'); // Returns: undefined (back to original behavior)
 * ```
 */
export const resetAllWhenMocks = (): void => {
  registry.forEach(resetWhenMocksOnFn);
  registry = new Set();
};

/**
 * Reset when mocks for a specific function
 * @param fn The Jest mock or spy function to reset
 * @internal
 */
function resetWhenMocksOnFn(fn: jest.Mock | jest.SpyInstance): void {
  const whenMock = fn.__whenMock__;
  if (whenMock) {
    fn.mockImplementation(whenMock.__origMock);
    fn.__whenMock__ = undefined;
  }
  registry.delete(fn);
}

/**
 * Verify that all when mocks have been called, throwing an error if any were not called
 * 
 * @example
 * ```typescript
 * const mock = jest.fn();
 * when(mock).expectCalledWith('hello').mockReturnValue('world');
 * 
 * mock('hello'); // Returns: "world" (this mock was called)
 * 
 * verifyAllWhenMocksCalled(); // ✅ Passes - all mocks were called
 * ```
 * 
 * @throws Error if any when mocks were not called, with details about which mocks were missed
 */
export const verifyAllWhenMocksCalled = (): void => {
  const [allMocks, calledMocks, uncalledMocks] = Array.from(registry).reduce<[CallMock[], CallMock[], CallMock[]]>((acc, fn) => {
    const whenMock = fn.__whenMock__;
    if (!whenMock) return acc;
    
    const mocks = whenMock.callMocks;
    const [calledMocks, uncalledMocks] = mocks.reduce<[CallMock[], CallMock[]]>((memo: [CallMock[], CallMock[]], mock: CallMock) => {
      memo[mock.called ? 0 : 1].push(mock);
      return memo;
    }, [[], []]);
    return [[...acc[0], ...mocks], [...acc[1], ...calledMocks], [...acc[2], ...uncalledMocks]];
  }, [[], [], []]);

  const callLines = uncalledMocks
    .filter(m => Boolean(m.callLines))
    .map(m => `\n  ${String(m.callLines).trim()}`)
    .join('');

  const msg = `Failed verifyAllWhenMocksCalled: ${uncalledMocks.length} not called: ${callLines}\n\n\n...rest of the stack...`;

  assert.equal(`called mocks: ${calledMocks.length}`, `called mocks: ${allMocks.length}`, msg);
};

export default {
  when,
  resetAllWhenMocks,
  verifyAllWhenMocksCalled,
  WhenMock
};
