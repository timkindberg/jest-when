import * as assert from 'assert';
import type { MockedFunction } from 'jest-mock';

// Extend Jest types to include our custom properties
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

let registry = new Set<jest.Mock | jest.SpyInstance>();

const getCallLines = (): string => (new Error()).stack!.split('\n').slice(4).join('\n');

/**
 * A hack to capture a reference to the `equals` jasmineUtil
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

type Matcher = any;
type FunctionMatcher = Function & { _isFunctionMatcher?: boolean; _isAllArgsFunctionMatcher?: boolean };

interface CallMock {
  matchers: Matcher[];
  mockImplementation: Function;
  expectCall: boolean;
  once: boolean;
  called: boolean;
  id: number;
  callLines: string;
}

interface MockFunctions<T> {
  mockReturnValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  mockReturnValueOnce: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  mockResolvedValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  mockResolvedValueOnce: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  mockRejectedValue: (err: unknown) => WhenMock<T> & MockFunctions<T>;
  mockRejectedValueOnce: (err: unknown) => WhenMock<T> & MockFunctions<T>;
  mockImplementation: (implementation: (...args: any[]) => T) => WhenMock<T> & MockFunctions<T>;
  mockImplementationOnce: (implementation: (...args: any[]) => T) => WhenMock<T> & MockFunctions<T>;
  defaultImplementation: (implementation: (...args: any[]) => T) => WhenMock<T> & MockFunctions<T>;
  defaultReturnValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  defaultResolvedValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  defaultRejectedValue: (err: unknown) => WhenMock<T> & MockFunctions<T>;
  mockReset: () => WhenMock<T> & MockFunctions<T>;
  resetWhenMocks: () => void;
  calledWith: (...matchers: Matcher[]) => WhenMock<T> & MockFunctions<T>;
  expectCalledWith: (...matchers: Matcher[]) => WhenMock<T> & MockFunctions<T>;
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

const NO_CALLED_WITH_YET = Symbol('NO_CALLED_WITH');

export class WhenMock<T = any> {
  private nextCallMockId = 0;
  public fn: jest.Mock | jest.SpyInstance;
  public callMocks: CallMock[] = [];
  public _origMock: ((...args: any[]) => any) | undefined;
  private _defaultImplementation: ((...args: any[]) => any) | null = null;

  public mockImplementation: (implementation: (...args: any[]) => T) => WhenMock<T> & MockFunctions<T>;
  public mockReturnValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  public mockResolvedValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  public mockRejectedValue: (err: any) => WhenMock<T> & MockFunctions<T>;
  public defaultImplementation: (implementation: (...args: any[]) => T) => WhenMock<T> & MockFunctions<T>;
  public defaultReturnValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  public defaultResolvedValue: (returnValue: T) => WhenMock<T> & MockFunctions<T>;
  public defaultRejectedValue: (err: any) => WhenMock<T> & MockFunctions<T>;

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
      } as WhenMock<T> & MockFunctions<T>;
    };

    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<T> => ({
      mockReturnValue: (returnValue: T) => _mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: T) => _mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: T) => _mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: T) => _mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => _mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => _mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => T) => _mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => T) => _mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => T) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: T) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: T) => this.defaultResolvedValue(returnValue),
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
        } as WhenMock<T> & MockFunctions<T>;
      }
    });

    // These four functions are only used when the dev has not used `.calledWith` before calling one of the mock return functions
    this.defaultImplementation = (mockImplementation: (...args: any[]) => T) => {
      // Set up an implementation with a special matcher that can never be matched because it uses a private symbol
      // Additionally the symbols existence can be checked to see if a calledWith was omitted.
      return _mockImplementation([NO_CALLED_WITH_YET], false)(mockImplementation);
    };
    this.defaultReturnValue = (returnValue: T) => this.defaultImplementation(() => returnValue);
    this.defaultResolvedValue = (returnValue: T) => this.defaultReturnValue(Promise.resolve(returnValue) as T);
    this.defaultRejectedValue = (err: unknown) => this.defaultReturnValue(Promise.reject(err) as T);
    this.mockImplementation = this.defaultImplementation;
    this.mockReturnValue = this.defaultReturnValue;
    this.mockResolvedValue = this.defaultResolvedValue;
    this.mockRejectedValue = this.defaultRejectedValue;
  }

  calledWith(...matchers: Matcher[]): WhenMock<T> & MockFunctions<T> {
    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<T> => ({
      mockReturnValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => T) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: T) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: T) => this.defaultResolvedValue(returnValue),
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
        } as WhenMock<T> & MockFunctions<T>;
      }
    });

    return { ...this, ...mockFunctions(matchers, false) } as WhenMock<T> & MockFunctions<T>;
  }

  expectCalledWith(...matchers: Matcher[]): WhenMock<T> & MockFunctions<T> {
    const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<T> => ({
      mockReturnValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: (implementation: (...args: any[]) => T) => this.defaultImplementation(implementation),
      defaultReturnValue: (returnValue: T) => this.defaultReturnValue(returnValue),
      defaultResolvedValue: (returnValue: T) => this.defaultResolvedValue(returnValue),
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
        } as WhenMock<T> & MockFunctions<T>;
      }
    });

    return { ...this, ...mockFunctions(matchers, true) } as WhenMock<T> & MockFunctions<T>;
  }

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

      const mockFunctions = (matchers: Matcher[], expectCall: boolean): MockFunctions<T> => ({
        mockReturnValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => returnValue),
        mockReturnValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => returnValue),
        mockResolvedValue: (returnValue: T) => this._mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
        mockResolvedValueOnce: (returnValue: T) => this._mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
        mockRejectedValue: (err: any) => this._mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
        mockRejectedValueOnce: (err: any) => this._mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
        mockImplementation: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall)(implementation),
        mockImplementationOnce: (implementation: (...args: any[]) => T) => this._mockImplementation(matchers, expectCall, true)(implementation),
        defaultImplementation: (implementation: (...args: any[]) => T) => this.defaultImplementation(implementation),
        defaultReturnValue: (returnValue: T) => this.defaultReturnValue(returnValue),
        defaultResolvedValue: (returnValue: T) => this.defaultResolvedValue(returnValue),
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
          } as WhenMock<T> & MockFunctions<T>;
        }
      });

      return {
        ...this,
        ...mockFunctions(matchers, expectCall)
      } as WhenMock<T> & MockFunctions<T>;
    };
  }
}

type MockableFunction = jest.Mock | jest.SpyInstance | ((...args: any[]) => any);

// Type guard to check if a function is a Jest mock
function isJestMock(fn: unknown): fn is jest.Mock | jest.SpyInstance {
  return fn != null && typeof fn === 'function' && '_isMockFunction' in fn && (fn as any)._isMockFunction;
}

interface WhenFunction {
  <T = any, Y extends any[] = any[]>(fn: jest.Mock<T, Y> | jest.SpyInstance<T, Y>): WhenMock<T>;
  <T extends (...args: any[]) => any>(fn: T): T & FunctionMatcher;
  <T>(fn: T): T;
  allArgs: <T extends (...args: any[]) => any>(fn: T) => T & FunctionMatcher;
  resetAllWhenMocks: () => void;
  verifyAllWhenMocksCalled: () => void;
}

export const when: WhenFunction = <T = any>(fn: MockableFunction): WhenMock<T> | FunctionMatcher | T => {
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

when.allArgs = <T extends (...args: any[]) => any>(fn: T): T & FunctionMatcher => {
  (fn as FunctionMatcher)._isFunctionMatcher = true;
  (fn as FunctionMatcher)._isAllArgsFunctionMatcher = true;
  return fn as T & FunctionMatcher;
};

export const resetAllWhenMocks = (): void => {
  registry.forEach(resetWhenMocksOnFn);
  registry = new Set();
};

function resetWhenMocksOnFn(fn: jest.Mock | jest.SpyInstance): void {
  const whenMock = fn.__whenMock__;
  if (whenMock) {
    fn.mockImplementation(whenMock._origMock);
    fn.__whenMock__ = undefined;
  }
  registry.delete(fn);
}

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
