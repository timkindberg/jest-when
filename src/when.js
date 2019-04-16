const assert = require('assert')
const utils = require('expect/build/jasmine_utils')
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
          const { matchers, returnValue, expectCall } = this.callMocks[i]
          const match = matchers.reduce(checkArgumentMatchers(expectCall, args), true)

          if (match) {
            this.callMocks[i].called = true
            let removedOneItem = false
            this.callMocks = this.callMocks.filter(mock => {
              if (mock.once && utils.equals(mock.matchers, matchers) && !removedOneItem) {
                removedOneItem = true
                return false
              }
              return true
            })
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
      mockReturnValue: returnValue => _mockReturnValue(matchers, expectCall)(returnValue),
      mockReturnValueOnce: returnValue => _mockReturnValue(matchers, expectCall, true)(returnValue),
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
    fn.__whenMock__ = undefined
  })
  registry = new Set()
}

const verifyAllWhenMocksCalled = () => {
  registry.forEach(fn => {
    const allMocks = fn.__whenMock__.callMocks
    const [calledMocks, uncalledMocks] = allMocks.reduce((memo, mock) => {
      if (mock.called) {
        memo[0].push(mock)
      } else {
        memo[1].push(mock)
      }
      return memo
    }, [[], []])

    const callLines = uncalledMocks
      .filter(m => Boolean(m.callLine))
      .map(m => String(m.callLine).trim())
      .join('\n')
    const msg = `Failed verifyAllWhenMocksCalled: ${uncalledMocks.length} not called at:\n\n${callLines}`

    assert.ok(allMocks.length === calledMocks.length, msg)
  })
}

when.resetAllWhenMocks = resetAllWhenMocks
when.verifyAllWhenMocksCalled = verifyAllWhenMocksCalled

module.exports = {
  when,
  resetAllWhenMocks,
  verifyAllWhenMocksCalled,
  WhenMock
}
