import * as assert from 'assert';
import type { MockedFunction } from 'jest-mock';

/**
 * Extend Jest types to include our custom properties for jest-when integration
 * @internal
 */
declare global {
  namespace jest {
    interface Mock {
      __whenMock__?: WhenMock<any>;
    }
    
    interface SpyInstance {
      __whenMock__?: WhenMock<any>;
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
 * Utility type to unwrap a Promise type
 * @internal
 */
type Unpromisify<T> = T extends Promise<infer U> ? U : T;

/**
 * A function that can be used as a matcher for jest-when
 */
type FunctionMatcher = Function & { 
  _isFunctionMatcher?: boolean; 
  _isAllArgsFunctionMatcher?: boolean 
};

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

/**
 * Interface defining all the mock functions available on a WhenMock instance
 * @template TReturn The return type of the mocked function
 */
interface MockFunctions<TReturn> {
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
  mockReturnValue: (returnValue: TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockReturnValueOnce: (returnValue: TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockResolvedValue: (returnValue: Unpromisify<TReturn>) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockResolvedValueOnce: (returnValue: Unpromisify<TReturn>) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockRejectedValue: (err: unknown) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockRejectedValueOnce: (err: unknown) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockImplementation: (implementation: (...args: any[]) => TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockImplementationOnce: (implementation: (...args: any[]) => TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  defaultImplementation: (implementation: (...args: any[]) => TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  defaultReturnValue: (returnValue: TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  defaultRejectedValue: (err: unknown) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  mockReset: () => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  resetWhenMocks: () => void;
  
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
  calledWith: (...matchers: Matcher[]) => WhenMock<TReturn> & MockFunctions<TReturn>;
  
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
  expectCalledWith: (...matchers: Matcher[]) => WhenMock<TReturn> & MockFunctions<TReturn>;
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

/** @internal Symbol used to identify default implementations */
const NO_CALLED_WITH_YET = Symbol('NO_CALLED_WITH');

/**
 * The main WhenMock class that provides jest-when functionality
 * 
 * @example
 * ```typescript
 * const mock = jest.fn();
 * const whenMock = when(mock);
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
export class WhenMock<TReturn = any> {
  /** @internal Next ID for call mocks */
  private nextCallMockId = 0;
  
  /** The underlying Jest mock or spy function */
  public fn: jest.Mock | jest.SpyInstance;
  
  /** Array of configured call mocks */
  public callMocks: CallMock[] = [];
  
  /** Original mock implementation before jest-when modifications */
  public _origMock: ((...args: any[]) => any) | undefined;
  
  /** @internal Default implementation for unmatched calls */
  private _defaultImplementation: ((...args: any[]) => any) | null = null;

  /** Set a custom implementation for the mock (default behavior) */
  public mockImplementation: (implementation: (...args: any[]) => TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a return value for the mock (default behavior) */
  public mockReturnValue: (returnValue: TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a resolved Promise value for the mock (default behavior) */
  public mockResolvedValue: (returnValue: Unpromisify<TReturn>) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a rejected Promise value for the mock (default behavior) */
  public mockRejectedValue: (err: any) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a default implementation for the mock (fallback behavior) */
  public defaultImplementation: (implementation: (...args: any[]) => TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a default return value for the mock (fallback behavior) */
  public defaultReturnValue: (returnValue: TReturn) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a default resolved Promise value for the mock (fallback behavior) */
  public defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /** Set a default rejected Promise value for the mock (fallback behavior) */
  public defaultRejectedValue: (err: any) => WhenMock<TReturn> & MockFunctions<TReturn>;

  /**
   * Create a new WhenMock instance
   * @param fn The Jest mock or spy function to wrap
   */
  constructor(fn: jest.Mock | jest.SpyInstance) {
    this.fn = fn;
    fn.__whenMock__ = this;
    this._origMock = fn.getMockImplementation() || undefined;

    const _mockImplementation = (matchers: Matcher[], expectCall: boolean, once = false) => (mockImplementation: (...args: any[]) => any) => {
      if (matchers[0] === NO_CALLED_WITH_YET) {
        this._defaultImplementation = mockImplementation;
      }
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !equals(callMock.matchers, matchers))
        .concat({ matchers, mockImplementation, expectCall, once, called: false, id: this.nextCallMockId, callLines: getCallLines() })
        .sort((a, b) => {
          // Once mocks should appear before the rest
          if (a.once !== b.once) {
            return a.once ? -1 : 1;
          }
          return a.id - b.id;
        });

      this.nextCallMockId++;

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
        if (typeof instance.fn.__whenMock__?._origMock === 'function') {
          return instance.fn.__whenMock__._origMock.call(this, ...args);
        }
        return undefined;
      });

      return {
        ...this,
        ...mockFunctions(matchers, expectCall)
      } as WhenMock<TReturn> & MockFunctions<TReturn>;
    };

    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<TReturn> => ({
      mockReturnValue: (returnValue: TReturn) => _mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: TReturn) => _mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: Unpromisify<TReturn>) => _mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: Unpromisify<TReturn>) => _mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => _mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => _mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => TReturn) => _mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => TReturn) => _mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => TReturn) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: TReturn) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => this.defaultResolvedValue(returnValue),
      defaultRejectedValue: (err: any) => this.defaultRejectedValue(err),
      calledWith: (...newMatchers: Matcher[]) => this.calledWith(...newMatchers),
      expectCalledWith: (...newMatchers: Matcher[]) => this.expectCalledWith(...newMatchers),
      resetWhenMocks: () => this.resetWhenMocks(),
      mockReset: () => {
        this.callMocks = this.callMocks
          .filter((callMock) => !equals(callMock.matchers, matchers));
        return {
          ...this,
          ...mockFunctions(matchers, expectCall)
        } as WhenMock<TReturn> & MockFunctions<TReturn>;
      }
    });

    // These four functions are only used when the dev has not used `.calledWith` before calling one of the mock return functions
    this.defaultImplementation = (mockImplementation: (...args: any[]) => TReturn) => {
      // Set up an implementation with a special matcher that can never be matched because it uses a private symbol
      // Additionally the symbols existence can be checked to see if a calledWith was omitted.
      return _mockImplementation([NO_CALLED_WITH_YET], false)(mockImplementation);
    };
    this.defaultReturnValue = (returnValue: TReturn) => this.defaultImplementation(() => returnValue);
    this.defaultResolvedValue = (returnValue: Unpromisify<TReturn>) => this.defaultReturnValue(Promise.resolve(returnValue) as TReturn);
    this.defaultRejectedValue = (err: unknown) => this.defaultReturnValue(Promise.reject(err) as TReturn);
    this.mockImplementation = this.defaultImplementation;
    this.mockReturnValue = this.defaultReturnValue;
    this.mockResolvedValue = this.defaultResolvedValue;
    this.mockRejectedValue = this.defaultRejectedValue;
  }

  /**
   * Specify the arguments that should trigger this mock behavior
   * 
   * @example
   * ```typescript
   * when(mock)
   *   .calledWith('hello')
   *   .mockReturnValue('world')
   *   .calledWith('goodbye')
   *   .mockReturnValue('cruel world');
   * 
   * mock('hello'); // Returns: "world"
   * mock('goodbye'); // Returns: "cruel world"
   * ```
   * 
   * @param matchers The argument matchers (literals, objects, Jest matchers, or function matchers)
   * @returns The WhenMock instance for chaining
   */
  calledWith(...matchers: Matcher[]): WhenMock<TReturn> & MockFunctions<TReturn> {
    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<TReturn> => ({
      mockReturnValue: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => TReturn) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: TReturn) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => this.defaultResolvedValue(returnValue),
      defaultRejectedValue: (err: any) => this.defaultRejectedValue(err),
      calledWith: (...newMatchers: Matcher[]) => this.calledWith(...newMatchers),
      expectCalledWith: (...newMatchers: Matcher[]) => this.expectCalledWith(...newMatchers),
      resetWhenMocks: () => this.resetWhenMocks(),
      mockReset: () => {
        this.callMocks = this.callMocks
          .filter((callMock) => !equals(callMock.matchers, matchers));
        return {
          ...this,
          ...mockFunctions(matchers, expectCall)
        } as WhenMock<TReturn> & MockFunctions<TReturn>;
      }
    });

    return { ...this, ...mockFunctions(matchers, false) } as WhenMock<TReturn> & MockFunctions<TReturn>;
  }

  /**
   * Specify the arguments that should trigger this mock behavior and assert they are called
   * 
   * @example
   * ```typescript
   * when(mock)
   *   .expectCalledWith('hello')
   *   .mockReturnValue('world');
   * 
   * mock('hello'); // Returns: "world" ✅
   * mock('goodbye'); // Throws assertion error ❌
   * ```
   * 
   * @param matchers The argument matchers (literals, objects, Jest matchers, or function matchers)
   * @returns The WhenMock instance for chaining
   */
  expectCalledWith(...matchers: Matcher[]): WhenMock<TReturn> & MockFunctions<TReturn> {
    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<TReturn> => ({
      mockReturnValue: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => TReturn) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: TReturn) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => this.defaultResolvedValue(returnValue),
      defaultRejectedValue: (err: any) => this.defaultRejectedValue(err),
      calledWith: (...newMatchers: Matcher[]) => this.calledWith(...newMatchers),
      expectCalledWith: (...newMatchers: Matcher[]) => this.expectCalledWith(...newMatchers),
      resetWhenMocks: () => this.resetWhenMocks(),
      mockReset: () => {
        this.callMocks = this.callMocks
          .filter((callMock) => !equals(callMock.matchers, matchers));
        return {
          ...this,
          ...mockFunctions(matchers, expectCall)
        } as WhenMock<TReturn> & MockFunctions<TReturn>;
      }
    });

    return { ...this, ...mockFunctions(matchers, true) } as WhenMock<TReturn> & MockFunctions<TReturn>;
  }

  /**
   * Reset all when mocks for this function, restoring the original implementation
   * 
   * @example
   * ```typescript
   * when(mock).calledWith('hello').mockReturnValue('world');
   * 
   * mock('hello'); // Returns: "world"
   * 
   * mock.resetWhenMocks();
   * mock('hello'); // Returns: undefined (back to original behavior)
   * ```
   */
  resetWhenMocks(): void {
    resetWhenMocksOnFn(this.fn);
  }

  private _mockImplementation(matchers: Matcher[], expectCall: boolean, once = false) {
    return (mockImplementation: (...args: any[]) => any) => {
      if (matchers[0] === NO_CALLED_WITH_YET) {
        this._defaultImplementation = mockImplementation;
      }
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !equals(callMock.matchers, matchers))
        .concat({ matchers, mockImplementation, expectCall, once, called: false, id: this.nextCallMockId, callLines: getCallLines() })
        .sort((a, b) => {
          // Once mocks should appear before the rest
          if (a.once !== b.once) {
            return a.once ? -1 : 1;
          }
          return a.id - b.id;
        });

      this.nextCallMockId++;

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
        if (typeof instance.fn.__whenMock__?._origMock === 'function') {
          return instance.fn.__whenMock__._origMock.call(this, ...args);
        }
        return undefined;
      });

      const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<TReturn> => ({
        mockReturnValue: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall)(() => returnValue),
        mockReturnValueOnce: (returnValue: TReturn) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
        mockResolvedValue: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
        mockResolvedValueOnce: (returnValue: Unpromisify<TReturn>) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
        mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
        mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
        mockImplementation: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall)(implementation),
        mockImplementationOnce: (implementation: (...args: any[]) => TReturn) => this._mockImplementation(matchers, expectCall, true)(implementation),
        defaultImplementation: (implementation: (...args: any[]) => TReturn) => this.defaultImplementation(implementation),
        defaultReturnValue: (returnValue: TReturn) => this.defaultReturnValue(returnValue),
        defaultResolvedValue: (returnValue: Unpromisify<TReturn>) => this.defaultResolvedValue(returnValue),
        defaultRejectedValue: (err: any) => this.defaultRejectedValue(err),
        calledWith: (...newMatchers: Matcher[]) => this.calledWith(...newMatchers),
        expectCalledWith: (...newMatchers: Matcher[]) => this.expectCalledWith(...newMatchers),
        resetWhenMocks: () => this.resetWhenMocks(),
        mockReset: () => {
          this.callMocks = this.callMocks
            .filter((callMock) => !equals(callMock.matchers, matchers));
          return {
            ...this,
            ...mockFunctions(matchers, expectCall)
          } as WhenMock<TReturn> & MockFunctions<TReturn>;
        }
      });

      return {
        ...this,
        ...mockFunctions(matchers, expectCall)
      } as WhenMock<TReturn> & MockFunctions<TReturn>;
    };
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
  | ((...args: TArgs) => TReturn);

// Type guard to check if a function is a Jest mock
/**
 * Type guard to check if a function is a Jest mock or spy
 * @param fn The function to check
 * @returns True if the function is a Jest mock or spy
 * @internal
 */
function isJestMock(fn: unknown): fn is jest.Mock | jest.SpyInstance {
  return fn != null && typeof fn === 'function' && '_isMockFunction' in fn && (fn as any)._isMockFunction;
}

/**
 * The main when function interface with overloads for different use cases
 */
interface WhenFunction {
  /**
   * Create a WhenMock for a Jest mock or spy function
   * @template TReturn The return type of the mocked function
   * @template TArgs The argument types of the mocked function
   * @param fn The Jest mock or spy function to wrap
   * @returns A WhenMock instance for configuring mock behavior
   */
  <TReturn = any, TArgs extends any[] = any[]>(fn: MockableFunction<TReturn, TArgs>): WhenMock<TReturn>;
  
  /**
   * Create a function matcher for use with when.calledWith()
   * @template TFunc The function type to create a matcher for
   * @param fn The function to use as a matcher
   * @returns The function with matcher properties
   */
  <TFunc extends (...args: any[]) => any>(fn: TFunc): TFunc & FunctionMatcher;
  
  /**
   * Pass through any other value unchanged
   * @template T The type of the value
   * @param fn The value to pass through
   * @returns The value unchanged
   */
  <T>(fn: T): T;
  
  /**
   * Create a function matcher that receives all arguments as an array
   * @template TFunc The function type to create a matcher for
   * @param fn The function that receives all arguments as an array
   * @returns The function with all-args matcher properties
   */
  allArgs: <TFunc extends (...args: any[]) => any>(fn: TFunc) => TFunc & FunctionMatcher;
  
  /**
   * Reset all when mocks across all functions
   */
  resetAllWhenMocks: () => void;
  
  /**
   * Verify that all when mocks have been called
   * @throws Error if any when mocks were not called
   */
  verifyAllWhenMocksCalled: () => void;
}

/**
 * The main jest-when function for creating mocks and function matchers
 * 
 * @example
 * ```typescript
 * // Create a mock
 * const mock = jest.fn();
 * when(mock).calledWith('hello').mockReturnValue('world');
 * mock('hello'); // Returns: "world"
 * 
 * // Create a function matcher
 * const isEven = when((n: number) => n % 2 === 0);
 * when(mock).calledWith(isEven).mockReturnValue('even number');
 * mock(4); // Returns: "even number"
 * ```
 */
export const when: WhenFunction = (fn: any): any => {
  // This bit is for when you use `when` to make a WhenMock
  // when(fn) <-- This one
  //     .calledWith(when(numberIsGreaterThanZero)) <-- Not this one
  if (isJestMock(fn)) {
    if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__;
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
  if (typeof fn === 'function') {
    (fn as FunctionMatcher)._isFunctionMatcher = true;
    return fn as FunctionMatcher;
  }

  return fn;
};

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
when.allArgs = <TFunc extends (...args: any[]) => any>(fn: TFunc): TFunc & FunctionMatcher => {
  (fn as FunctionMatcher)._isFunctionMatcher = true;
  (fn as FunctionMatcher)._isAllArgsFunctionMatcher = true;
  return fn as TFunc & FunctionMatcher;
};

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
    fn.mockImplementation(whenMock._origMock);
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

when.resetAllWhenMocks = resetAllWhenMocks;
when.verifyAllWhenMocksCalled = verifyAllWhenMocksCalled;

export default {
  when,
  resetAllWhenMocks,
  verifyAllWhenMocksCalled,
  WhenMock
};
