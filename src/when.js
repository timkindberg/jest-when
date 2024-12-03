const assert = require('assert')

let registry = new Set()

const getCallLines = () => (new Error()).stack.split('\n').slice(4).join('\n')

/**
 * A hack to capture a reference to the `equals` jasmineUtil
 */
let equals = () => {}
expect.extend({
  __capture_equals__ () {
    equals = this.equals
    return { pass: true }
  }
})
expect().__capture_equals__()
let JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object')
// Hackily reset assertionCalls back to zero incase dev's tests are using expect.assertions()
global[JEST_MATCHERS_OBJECT].state.assertionCalls = 0
// Hackily delete the custom matcher that we added
delete global[JEST_MATCHERS_OBJECT].matchers.__capture_equals__
/**
 * End hack
 */

const checkArgumentMatchers = (expectCall, args) => (match, matcher, i) => {
  // Propagate failure to the end
  if (!match) {
    return false
  }

  const arg = args[i]

  const isFunctionMatcher = typeof matcher === 'function' && matcher._isFunctionMatcher

  // Assert the match for better messaging during a failure
  if (expectCall) {
    if (isFunctionMatcher) {
      const isMatch = matcher(arg)
      const msg = `Failed function matcher within expectCalledWith: ${matcher.name}(${JSON.stringify(arg)}) did not return true\n\n\n...rest of the stack...`
      assert.equal(isMatch, true, msg)
    } else {
      expect(arg).toEqual(matcher)
    }
  }

  if (isFunctionMatcher) {
    return matcher(arg, equals)
  }

  return equals(arg, matcher)
}

const NO_CALLED_WITH_YET = Symbol('NO_CALLED_WITH')

class WhenMock {
  constructor (fn) {
    // Incrementing ids assigned to each call mock to help with sorting as new mocks are added
    this.nextCallMockId = 0
    this.fn = fn
    fn.__whenMock__ = this
    this.callMocks = []
    this._origMock = fn.getMockImplementation()
    this._defaultImplementation = null

    const _mockImplementation = (matchers, expectCall, once = false) => (mockImplementation) => {
      if (matchers[0] === NO_CALLED_WITH_YET) {
        this._defaultImplementation = mockImplementation
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
            return a.once ? -1 : 1
          }
          return a.id - b.id
        })

      this.nextCallMockId++

      const instance = this
      this.fn.mockImplementation(function (...args) {
        for (let i = 0; i < instance.callMocks.length; i++) {
          const { matchers, mockImplementation, expectCall, once, called } = instance.callMocks[i]

          // Do not let a once mock match more than once
          if (once && called) continue

          let isMatch = false

          if (matchers && matchers[0] &&
            // is a possible all args matcher object
            (typeof matchers[0] === 'function' || typeof matchers[0] === 'object') &&
            // ensure not a proxy
            '_isAllArgsFunctionMatcher' in matchers[0] &&
            // check for the special property name
            matchers[0]._isAllArgsFunctionMatcher === true
          ) {
            if (matchers.length > 1) throw new Error('When using when.allArgs, it must be the one and only matcher provided to calledWith. You have incorrectly provided other matchers along with when.allArgs.')
            isMatch = checkArgumentMatchers(expectCall, [args])(true, matchers[0], 0)
          } else {
            isMatch =
              args.length === matchers.length &&
              matchers.reduce(checkArgumentMatchers(expectCall, args), true)
          }

          if (isMatch && typeof mockImplementation === 'function') {
            instance.callMocks[i].called = true
            return mockImplementation.call(this, ...args)
          }
        }

        if (instance._defaultImplementation) {
          return instance._defaultImplementation.call(this, ...args)
        }
        if (typeof fn.__whenMock__._origMock === 'function') {
          return fn.__whenMock__._origMock.call(this, ...args)
        }
        return undefined
      })

      return {
        ...this,
        ...mockFunctions(matchers, expectCall)
      }
    }

    const mockFunctions = (matchers, expectCall) => ({
      mockReturnValue: returnValue => _mockImplementation(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: returnValue => _mockImplementation(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: returnValue => _mockImplementation(matchers, expectCall)(() => Promise.resolve(returnValue)),
      mockResolvedValueOnce: returnValue => _mockImplementation(matchers, expectCall, true)(() => Promise.resolve(returnValue)),
      mockRejectedValue: err => _mockImplementation(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: err => _mockImplementation(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: implementation => _mockImplementation(matchers, expectCall)(implementation),
      mockImplementationOnce: implementation => _mockImplementation(matchers, expectCall, true)(implementation),
      defaultImplementation: implementation => this.defaultImplementation(implementation),
      defaultReturnValue: returnValue => this.defaultReturnValue(returnValue),
      defaultResolvedValue: returnValue => this.defaultResolvedValue(returnValue),
      defaultRejectedValue: err => this.defaultRejectedValue(err),
      mockReset: () => {
        this.callMocks = this.callMocks
          .filter((callMock) => !equals(callMock.matchers, matchers))
        return {
          ...this,
          ...mockFunctions(matchers, expectCall)
        }
      }
    })

    // These four functions are only used when the dev has not used `.calledWith` before calling one of the mock return functions
    this.defaultImplementation = mockImplementation => {
      // Set up an implementation with a special matcher that can never be matched because it uses a private symbol
      // Additionally the symbols existence can be checked to see if a calledWith was omitted.
      return _mockImplementation([NO_CALLED_WITH_YET], false)(mockImplementation)
    }
    this.defaultReturnValue = returnValue => this.defaultImplementation(() => returnValue)
    this.defaultResolvedValue = returnValue => this.defaultReturnValue(Promise.resolve(returnValue))
    this.defaultRejectedValue = err => this.defaultReturnValue(Promise.reject(err))
    this.mockImplementation = this.defaultImplementation
    this.mockReturnValue = this.defaultReturnValue
    this.mockResolvedValue = this.defaultResolvedValue
    this.mockRejectedValue = this.defaultRejectedValue

    this.calledWith = (...matchers) => ({ ...mockFunctions(matchers, false) })
    this.expectCalledWith = (...matchers) => ({ ...mockFunctions(matchers, true) })

    this.resetWhenMocks = () => {
      resetWhenMocksOnFn(fn)
    }
  }
}

const when = (fn) => {
  // This bit is for when you use `when` to make a WhenMock
  // when(fn) <-- This one
  //     .calledWith(when(numberIsGreaterThanZero)) <-- Not this one
  if (fn._isMockFunction) {
    if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__
    const whenMock = new WhenMock(fn)
    registry.add(fn)
    fn._origMockReset = fn.mockReset
    fn.mockReset = () => {
      resetWhenMocksOnFn(fn)
      fn.mockReset = fn._origMockReset
      fn._origMockReset = undefined
      fn.mockReset()
    }
    return whenMock
  }

  // This bit is for when you use `when` as a function matcher
  // when(fn) <-- Not this one
  //     .calledWith(when(numberIsGreaterThanZero)) <-- This one
  if (typeof fn === 'function') {
    fn._isFunctionMatcher = true
    return fn
  }
}

when.allArgs = (fn) => {
  fn._isFunctionMatcher = true
  fn._isAllArgsFunctionMatcher = true
  return fn
}

const resetAllWhenMocks = () => {
  registry.forEach(resetWhenMocksOnFn)
  registry = new Set()
}

function resetWhenMocksOnFn (fn) {
  fn.mockImplementation(fn.__whenMock__._origMock)
  fn.__whenMock__ = undefined
  registry.delete(fn)
}

const verifyAllWhenMocksCalled = () => {
  const [allMocks, calledMocks, uncalledMocks] = Array.from(registry).reduce((acc, fn) => {
    const mocks = fn.__whenMock__.callMocks
    const [calledMocks, uncalledMocks] = mocks.reduce((memo, mock) => {
      memo[mock.called ? 0 : 1].push(mock)
      return memo
    }, [[], []])
    return [[...acc[0], ...mocks], [...acc[1], ...calledMocks], [...acc[2], ...uncalledMocks]]
  }, [[], [], []])

  const callLines = uncalledMocks
    .filter(m => Boolean(m.callLines))
    .map(m => `\n  ${String(m.callLines).trim()}`)
    .join('')

  const msg = `Failed verifyAllWhenMocksCalled: ${uncalledMocks.length} not called: ${callLines}\n\n\n...rest of the stack...`

  assert.equal(`called mocks: ${calledMocks.length}`, `called mocks: ${allMocks.length}`, msg)
}

when.resetAllWhenMocks = resetAllWhenMocks
when.verifyAllWhenMocksCalled = verifyAllWhenMocksCalled

module.exports = {
  when,
  resetAllWhenMocks,
  verifyAllWhenMocksCalled,
  WhenMock
}
