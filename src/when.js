const utils = require('expect/build/jasmine_utils')
const logger = require('./log')('when')

const checkArgumentMatchers = (assertCall, args) => (match, matcher, i) => {
  logger.debug(`matcher check, match: ${match}, index: ${i}`)

  // Propagate failure to the end
  if (!match) {
    return false
  }

  const arg = args[i]

  logger.debug(`   matcher: ${matcher}`)
  logger.debug(`   arg: ${arg}`)

  // Assert the match for better messaging during a failure
  if (assertCall) {
    expect(arg).toEqual(matcher)
  }

  return utils.equals(arg, matcher)
}
class WhenMock {
  constructor (fn, defaultValue = { isSet: false, val: undefined }) {
    this.fn = fn
    this.callMocks = []

    if (defaultValue.isSet) {
      this.fn.mockImplementation(() => {
        throw new Error('Uninteded use: Only use default value in combination with .calledWith(..), ' +
          'or use standard mocking without jest-when.')
      })
    }

    const _mockReturnValue = (matchers, assertCall, once = false) => (val) => {
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !utils.equals(callMock.matchers, matchers))
        .concat({ matchers, val, assertCall, once })
        .sort(({ once }) => !once ? 1 : 0)

      this.fn.mockImplementation((...args) => {
        logger.debug('mocked impl', args)

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, val, assertCall } = this.callMocks[i]
          const match = matchers.reduce(checkArgumentMatchers(assertCall, args), true)

          if (match) {
            let removedOneItem = false
            this.callMocks = this.callMocks.filter(mock => {
              if (mock.once && utils.equals(mock.matchers, matchers) && !removedOneItem) {
                removedOneItem = true
                return false
              }
              return true
            })
            return typeof val === 'function' ? val(...args) : val
          }
        }

        return defaultValue.val
      })

      return {
        ...this,
        ...mockFunctions(matchers, assertCall)
      }
    }

    const mockFunctions = (matchers, assertCall) => ({
      mockReturnValue: val => _mockReturnValue(matchers, assertCall)(val),
      mockReturnValueOnce: val => _mockReturnValue(matchers, assertCall, true)(val),
      mockResolvedValue: val => _mockReturnValue(matchers, assertCall)(Promise.resolve(val)),
      mockResolvedValueOnce: val => _mockReturnValue(matchers, assertCall, true)(Promise.resolve(val)),
      mockRejectedValue: err => _mockReturnValue(matchers, assertCall)(Promise.reject(err)),
      mockRejectedValueOnce: err => _mockReturnValue(matchers, assertCall, true)(Promise.reject(err)),
      mockImplementation: implementation => _mockReturnValue(matchers, assertCall)(implementation),
      mockImplementationOnce: implementation => _mockReturnValue(matchers, assertCall, true)(implementation)
    })

    this.mockReturnValue = val => new WhenMock(fn, { isSet: true, val })
    this.mockResolvedValue = val => this.mockReturnValue(Promise.resolve(val))
    this.mockRejectedValue = err => this.mockReturnValue(Promise.reject(err))

    this.calledWith = (...matchers) => ({ ...mockFunctions(matchers, false) })

    this.expectCalledWith = (...matchers) => ({ ...mockFunctions(matchers, true) })
  }
}

const when = (fn) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__
  fn.__whenMock__ = new WhenMock(fn)
  return fn.__whenMock__
}

module.exports = {
  when,
  WhenMock
}
