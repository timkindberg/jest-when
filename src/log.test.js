const log = require('./log')
const { enable } = require('diary')

enable('*')

describe('the logger', () => {
  it('should create new loggers', () => {
    const logger = log('name')

    expect(logger.info).toBeDefined()
  })

  describe('when capture info output', () => {
    const originalInfo = console.info

    beforeEach(() => {
      console.info = jest.fn()
    })
    afterEach(() => {
      console.info = originalInfo
    })

    it('should use the package json name and logger name in the scope', () => {
      const logger = log('name')
      logger.info('hello world')
      expect(console.info).toHaveBeenCalledWith('ℹ info  [jest-when: name] hello world')
    })
  })

  it('should fail if no name is passed', () => {
    expect(() => log()).toThrow()
  })
})
