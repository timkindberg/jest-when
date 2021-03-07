const assert = require('assert')
const utils = require('expect/build/jasmineUtils')
const logger = require('./log')('when')

let registry = new Set()

const getCallLine = () => (new Error()).stack.split('\n')[4]

const checkArgumentMatchers = (expectCall, args) => (match, matcher, i) => {
  logger.debug(`matcher check, match: ${match}, index: ${i}`)

  // Propagate failure to the end
  if (!match) {
    return false
  }

  const arg = args[i]

  logger.debug(`   matcher: ${String(matcher)}`)
  logger.debug(`   arg: ${String(arg)}`)

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
    return matcher(arg)
  }

  return utils.equals(arg, matcher)
}
class WhenMock {
  constructor (fn, defaultImplementation = null) {
    // Incrementing ids assigned to each call mock to help with sorting as new mocks are added
    this.nextCallMockId = 0
    this.fn = fn
    fn.__whenMock__ = this
    this.callMocks = []
    this._origMock = fn.getMockImplementation()

    if (defaultImplementation) {
      this.fn.mockImplementation(() => {
        throw new Error('Unintended use: Only use default value in combination with .calledWith(..), ' +
          'or use standard mocking without jest-when.')
      })
    }

    const _mockImplementation = (matchers, expectCall, once = false) => (mockImplementation) => {
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !utils.equals(callMock.matchers, matchers))
        .concat({ matchers, mockImplementation, expectCall, once, called: false, id: this.nextCallMockId, callLine: getCallLine() })
        .sort((a, b) => {
          // Once mocks should appear before the rest
          if (a.once !== b.once) {
            return a.once ? -1 : 1
          }
          return a.id - b.id
        })

      this.nextCallMockId++

      this.fn.mockImplementation((...args) => {
        logger.debug('mocked impl', args)

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, mockImplementation, expectCall, once, called } = this.callMocks[i]

          // Do not let a once mock match more than once
          if (once && called) continue

          const isMatch =
            args.length === matchers.length &&
            matchers.reduce(checkArgumentMatchers(expectCall, args), true)

          if (isMatch) {
            this.callMocks[i].called = true
            return mockImplementation(...args)
          }
        }

        return defaultImplementation ? defaultImplementation(...args) : undefined
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
      mockImplementationOnce: implementation => _mockImplementation(matchers, expectCall, true)(implementation)
    })

    this.mockImplementation = mockImplementation => new WhenMock(fn, mockImplementation)
    this.mockReturnValue = returnValue => this.mockImplementation(() => returnValue)
    this.mockResolvedValue = returnValue => this.mockReturnValue(Promise.resolve(returnValue))
    this.mockRejectedValue = err => this.mockReturnValue(Promise.reject(err))

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
    .filter(m => Boolean(m.callLine))
    .map(m => `\n  ${String(m.callLine).trim()}`)
    .join('')

  const msg = `Failed verifyAllWhenMocksCalled: ${uncalledMocks.length} not called at:${callLines}\n\n\n...rest of the stack...`

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
