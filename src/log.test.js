const log = require('./log')
const packagejson = require('../package.json')
const { objectContaining } = expect

describe('the logger', () => {
  it('should create new loggers', () => {
    const logger = log('name')

    expect(logger.info).toBeDefined()
  })

  it('should use the package json name as the logger app', () => {
    const logger = log('name')

    expect(logger.fields.app).toBe(packagejson.name)
  })

  it('should use the name as the loggers name', () => {
    const name = 'some name'

    const logger = log(name)

    expect(logger.fields.name).toBe(name)
  })

  it('should fail if no name is passed', () => {
    expect(() => log()).toThrow()
  })

  describe('should set "src" to the correct value', () => {
    let mockCreateLogger, log

    beforeEach(() => {
      mockCreateLogger = jest.fn()
      jest.mock('bunyan', () => ({
        createLogger: mockCreateLogger
      }))

      log = require('./log')
    })

    afterEach(() => {
      jest.resetModules()
      jest.resetAllMocks()
    })

    it('should set "src" to true if the stage is development', () => {
      const originalValue = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      log('name')

      process.env.NODE_ENV = originalValue
      expect(mockCreateLogger).toBeCalledWith(objectContaining({ src: true }))
    })

    it('should set "src" to false if the stage is NOT development', () => {
      const originalValue = process.env.NODE_ENV
      process.env.NODE_ENV = 'some other stage'

      log('name')

      process.env.NODE_ENV = originalValue
      expect(mockCreateLogger).toBeCalledWith(objectContaining({ src: false }))
    })
  })
})
