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

  logger.debug(`   matcher: ${matcher}`)
  logger.debug(`   arg: ${arg}`)

  // Assert the match for better messaging during a failure
  if (expectCall) {
    expect(arg).toEqual(matcher)
  }

  return utils.equals(arg, matcher)
}
class WhenMock {
  constructor (fn, defaultValue = { isSet: false, returnValue: undefined }) {
    // Incrementing ids assigned to each call mock to help with sorting as new mocks are added
    this.nextCallMockId = 0
    this.fn = fn
    this.callMocks = []
    this._origMock = fn.getMockImplementation()

    if (defaultValue.isSet) {
      this.fn.mockImplementation(() => {
        throw new Error('Unintended use: Only use default value in combination with .calledWith(..), ' +
          'or use standard mocking without jest-when.')
      })
    }

    const _mockReturnValue = (matchers, expectCall, once = false) => (returnValue) => {
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !utils.equals(callMock.matchers, matchers))
        .concat({ matchers, returnValue, expectCall, once, called: false, id: this.nextCallMockId, callLine: getCallLine() })
        .sort((a, b) => {
          // Reduce their id by 1000 if they are a once mock, to sort them at the front
          const aId = a.id - (a.once ? 1000 : 0)
          const bId = b.id - (b.once ? 1000 : 0)
          return aId - bId
        })

      this.nextCallMockId++

      this.fn.mockImplementation((...args) => {
        logger.debug('mocked impl', args)

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, returnValue, expectCall, once, called } = this.callMocks[i]

          // Do not let a once mock match more than once
          if (once && called) continue

          const isMatch = matchers.reduce(checkArgumentMatchers(expectCall, args), true)
          if (isMatch) {
            this.callMocks[i].called = true
            return typeof returnValue === 'function' ? returnValue(...args) : returnValue
          }
        }

        return defaultValue.returnValue
      })

      return {
        ...this,
        ...mockFunctions(matchers, expectCall)
      }
    }

    const mockFunctions = (matchers, expectCall) => ({
      mockReturnValue: returnValue => _mockReturnValue(matchers, expectCall)(() => returnValue),
      mockReturnValueOnce: returnValue => _mockReturnValue(matchers, expectCall, true)(() => returnValue),
      mockResolvedValue: returnValue => _mockReturnValue(matchers, expectCall)(Promise.resolve(returnValue)),
      mockResolvedValueOnce: returnValue => _mockReturnValue(matchers, expectCall, true)(Promise.resolve(returnValue)),
      mockRejectedValue: err => _mockReturnValue(matchers, expectCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: err => _mockReturnValue(matchers, expectCall, true)(() => Promise.reject(err)),
      mockImplementation: implementation => _mockReturnValue(matchers, expectCall)(implementation),
      mockImplementationOnce: implementation => _mockReturnValue(matchers, expectCall, true)(implementation)
    })

    this.mockReturnValue = returnValue => new WhenMock(fn, { isSet: true, returnValue })
    this.mockResolvedValue = returnValue => this.mockReturnValue(Promise.resolve(returnValue))
    this.mockRejectedValue = err => this.mockReturnValue(Promise.reject(err))

    this.calledWith = (...matchers) => ({ ...mockFunctions(matchers, false) })

    this.expectCalledWith = (...matchers) => ({ ...mockFunctions(matchers, true) })

    this.resetWhenMocks = () => {
      fn.mockImplementation(fn.__whenMock__._origMock)
      fn.__whenMock__ = undefined
      registry.delete(fn)
    }
  }
}

const when = (fn) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__
  fn.__whenMock__ = new WhenMock(fn)
  registry.add(fn)
  return fn.__whenMock__
}

const resetAllWhenMocks = () => {
  registry.forEach(fn => {
    fn.mockImplementation(fn.__whenMock__._origMock)
    fn.__whenMock__ = undefined
  })
  registry = new Set()
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
