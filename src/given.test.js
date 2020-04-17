const { stringContaining } = expect

const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*${expect}.*\\nReceived.*${actual}`)

describe('Given', () => {
  let spyEquals, given, GivenMock, mockLogger, resetAllGivenMocks, verifyAllGivenMocksCalled

  beforeEach(() => {
    spyEquals = jest.spyOn(require('expect/build/jasmineUtils'), 'equals')

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn()
    }

    jest.mock('./log', () => () => mockLogger)

    given = require('./when').given
    resetAllGivenMocks = require('./when').resetAllGivenMocks
    verifyAllGivenMocksCalled = require('./when').verifyAllGivenMocksCalled
    GivenMock = require('./when').GivenMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
  })

  describe('given', () => {
    it('returns a GivenMock', () => {
      const fn = jest.fn()
      const givenFn = given(fn)

      expect(givenFn).toBeInstanceOf(GivenMock)
      expect(givenFn.fn).toBe(fn)
    })

    it('returns existing GivenMock if fn was already givenified', () => {
      const fn = jest.fn()
      const givenFn1 = given(fn)
      const givenFn2 = given(fn)

      expect(givenFn1).toBeInstanceOf(GivenMock)
      expect(givenFn2).toBeInstanceOf(GivenMock)
      expect(givenFn1).toBe(givenFn2)
    })

    it('allows reset of mocks to enable overrides later', () => {
      const fn = jest.fn()

      given(fn).expectCalledWith(1).returns('x')

      resetAllGivenMocks()

      given(fn).expectCalledWith(1).onceReturns('z')

      expect(fn(1)).toEqual('z')
    })

    it('reset of mocks restores original implementation', () => {
      const fn = jest.fn(() => 'a')

      given(fn).expectCalledWith(1).onceReturns('x')

      resetAllGivenMocks()

      expect(fn(1)).toEqual('a')
    })

    it('allows reset of mocks for one function', () => {
      const fn = jest.fn(() => 'a')

      const mock = given(fn).expectCalledWith(1).onceReturns('x')

      mock.resetGivenMocks()

      expect(fn(1)).toEqual('a')
    })

    it('allows checking that all mocks were called', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      given(fn1).expectCalledWith(1).returns('z')
      given(fn2).expectCalledWith(1).onceReturns('x')
      given(fn2).expectCalledWith(1).onceReturns('y')
      given(fn2).expectCalledWith(1).returns('z')

      fn1(1)
      fn2(1)
      fn2(1)
      fn2(1)

      expect(verifyAllGivenMocksCalled).not.toThrow()
    })

    it('fails verification check if all mocks were not called', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      given(fn1).expectCalledWith(expect.anything()).returns('z')
      given(fn2).expectCalledWith(expect.anything()).onceReturns('x')
      given(fn2).expectCalledWith(expect.anything()).onceReturns('y')
      given(fn2).expectCalledWith(expect.anything()).returns('z')

      fn1(1)
      fn2(1)

      let caughtErr

      try {
        verifyAllGivenMocksCalled()
      } catch (e) {
        caughtErr = e
      }

      expect(caughtErr.expected).toEqual('called mocks: 4')
      expect(caughtErr.actual).toEqual('called mocks: 2')
      expect(caughtErr.message).toMatch(/Failed verifyAllWhenMocksCalled: 2 not called/)
    })

    it('fails verification check if all mocks were not called with line numbers', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      given(fn1).expectCalledWith(expect.anything()).returns('z')
      given(fn2).expectCalledWith(expect.anything()).onceReturns('x')
      given(fn2).expectCalledWith(expect.anything()).onceReturns('y')
      given(fn2).expectCalledWith(expect.anything()).returns('z')

      fn1(1)
      fn2(1)

      // Should be two call lines printed, hence the {2} at the end of the regex
      expect(verifyAllGivenMocksCalled).toThrow(/(src\/given\.test\.js:\d{3}(.|\s)*){2}/)
    })
  })

  describe('mock implementation', () => {
    it('offloads equality check to jasmine equals helper', () => {
      const fn = jest.fn()

      given(fn).calledWith(1).returns('x')

      expect(fn(1)).toEqual('x')
      expect(spyEquals).toBeCalledWith(1, 1)

      expect(fn(2)).toEqual(undefined)
      expect(spyEquals).toBeCalledWith(2, 1)
    })

    it('works with multiple args', () => {
      const fn = jest.fn()

      const anyString = expect.any(String)

      given(fn)
        .calledWith(1, 'foo', true, anyString, undefined)
        .returns('x')

      expect(fn(1, 'foo', true, 'whatever')).toEqual('x')
      expect(spyEquals).toBeCalledWith(1, 1)
      expect(spyEquals).toBeCalledWith('foo', 'foo')
      expect(spyEquals).toBeCalledWith(true, true)
      expect(spyEquals).toBeCalledWith('whatever', anyString)
      expect(spyEquals).toBeCalledWith(undefined, undefined)
    })

    it('supports compound given declarations', () => {
      const fn = jest.fn()

      given(fn).calledWith(1).returns('x')
      given(fn).calledWith('foo', 'bar').returns('y')
      given(fn).calledWith(false, /asdf/g).returns('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('supports chaining of given declarations', () => {
      const fn = jest.fn()

      given(fn)
        .calledWith(1)
        .returns('x')

      given(fn).calledWith('foo', 'bar')
        .returns('y')
        .calledWith(false, /asdf/g)
        .returns('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('supports replacement of given declarations', () => {
      const fn = jest.fn()

      given(fn).calledWith('foo', 'bar').returns('x')
      given(fn).calledWith(false, /asdf/g).returns('y')
      given(fn).calledWith('foo', 'bar').returns('z')

      expect(fn('foo', 'bar')).toEqual('z')
    })

    it('returns a declared value repeatedly', () => {
      const fn = jest.fn()

      given(fn).calledWith(1).returns('x')
      given(fn).calledWith(2).onceReturns('x').returns('y')

      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(2)).toEqual('x')
      expect(fn(2)).toEqual('y')
    })

    it('should handle symbol matchers', () => {
      const fn = jest.fn()
      const symbol = Symbol.for(`sym`)
      given(fn).calledWith(symbol, 2).returns('x')

      expect(fn(5)).toBeUndefined()
      expect(fn(symbol, 2)).toBe('x')
      expect(mockLogger.debug).toBeCalledWith(stringContaining('matcher: Symbol(sym)'))
    })

    it('returns nothing if no declared value matches', () => {
      const fn = jest.fn()

      given(fn).calledWith(1, 2).returns('x')

      expect(fn(5, 6)).toBeUndefined()
      expect(mockLogger.debug).toBeCalledWith(stringContaining('matcher: 1'))
      expect(mockLogger.debug).not.toBeCalledWith(stringContaining('matcher: 2'))
    })

    it('expectCalledWith: fails a test with error messaging if argument does not match', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      given(fn1).expectCalledWith(1).returns('x')
      given(fn2).calledWith('foo').returns('y')

      expect(() => fn1(2)).toThrow(errMsg({ expect: 1, actual: 2 }))
      expect(() => fn2('bar')).not.toThrow()
    })

    it('returns: should return a function', () => {
      const fn = jest.fn()
      const returnValue = () => {}

      given(fn).calledWith('foo').returns(returnValue)

      expect(fn('foo')).toBe(returnValue)
    })

    it('onceReturns: should return a function', () => {
      const fn = jest.fn()
      const returnValue = () => {}

      given(fn).calledWith('foo').returns(returnValue)

      expect(fn('foo')).toBe(returnValue)
    })

    it('onceReturns: should return specified value only once', () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').onceReturns('bar')
      given(fn).calledWith('foo').onceReturns('cbs')

      expect(fn('foo')).toEqual('bar')
      expect(fn('foo')).toEqual('cbs')
      expect(fn('foo')).toBeUndefined()
    })

    it('onceReturns: should return specified value only once and the regular value after that', () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').returns('bar')
      expect(fn('foo')).toEqual('bar')

      given(fn).calledWith('foo').onceReturns('cbs')
      expect(fn('foo')).toEqual('cbs')

      expect(fn('foo')).toEqual('bar')
    })

    it('onceReturns: works with expectCalledWith', () => {
      const fn = jest.fn()

      given(fn).expectCalledWith('foo').onceReturns('bar')

      expect(fn('foo')).toEqual('bar')
    })

    it('resolvesTo: should return a Promise', async () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').resolvesTo('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('resolvesTo: works with expectCalledWith', async () => {
      const fn = jest.fn()

      given(fn).expectCalledWith('foo').resolvesTo('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('onceResolvesTo: should return a Promise only once', async () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').onceResolvesTo('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('onceResolvesTo: should return specified value only once and the regular value after that', async () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').resolvesTo('bar')
      expect(await fn('foo')).toEqual('bar')

      given(fn).calledWith('foo').onceResolvesTo('cbs')
      expect(await fn('foo')).toEqual('cbs')

      expect(await fn('foo')).toEqual('bar')
    })

    it('onceResolvesTo: works with expectCalledWith', async () => {
      const fn = jest.fn()

      given(fn).expectCalledWith('foo').onceResolvesTo('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('rejectsWith: should return a rejected Promise', async () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').rejectsWith(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('rejectsWith: does not reject the Promise until the function is called', done => {
      const fn = jest.fn()

      given(fn).calledWith('foo').rejectsWith(new Error('bar'))

      setTimeout(async () => {
        await expect(fn('foo')).rejects.toThrow('bar')
        done()
      }, 0)
    })

    it('rejectsWith: works with expectCalledWith', async () => {
      const fn = jest.fn()

      given(fn).expectCalledWith('foo').rejectsWith(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('onceRejectsWith: should return a rejected Promise only once', async () => {
      const fn = jest.fn()

      given(fn).calledWith('foo').onceRejectsWith(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('onceRejectsWith: does not reject the Promise until the function is called', done => {
      const fn = jest.fn()

      given(fn).calledWith('foo').onceRejectsWith(new Error('bar'))

      setTimeout(async () => {
        await expect(fn('foo')).rejects.toThrow('bar')
        done()
      }, 0)
    })

    it('onceRejectsWith: works with expectCalledWith', async () => {
      const fn = jest.fn()

      given(fn).expectCalledWith('foo').onceRejectsWith(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('can be reset via `mockReset`', () => {
      const fn = jest.fn()

      given(fn).calledWith(1).returns('return 1')
      expect(fn(1)).toEqual('return 1')

      fn.mockReset()
      expect(fn(1)).toBeUndefined()

      given(fn).calledWith(1).returns('return 2')
      expect(fn(1)).toEqual('return 2')
    })

    it('has a default and a non-default behavior', () => {
      const fn = jest.fn()

      given(fn)
        .returns('default')
        .calledWith('foo')
        .returns('special')

      expect(fn('bar')).toEqual('default')
      expect(fn('foo')).toEqual('special')
      expect(fn('bar')).toEqual('default')
    })

    it('has a default which is falsy', () => {
      const fn = jest.fn()

      given(fn)
        .returns(false)
        .calledWith('foo')
        .returns('special')

      expect(fn('bar')).toEqual(false)
      expect(fn('foo')).toEqual('special')
      expect(fn('bar')).toEqual(false)
    })

    it('has a default which is a function', () => {
      const fn = jest.fn()
      const defaultValue = () => { }

      given(fn)
        .returns(defaultValue)
        .calledWith('bar').returns('baz')

      expect(fn('foo')).toBe(defaultValue)
    })

    it('keeps the default with a lot of matchers', () => {
      const fn = jest.fn()

      given(fn)
        .returns('default')
        .calledWith('in1').returns('out1')
        .calledWith('in2').returns('out2')
        .calledWith('in3').returns('out3')
        .calledWith('in4').onceReturns('out4')

      expect(fn('foo')).toEqual('default')
      expect(fn('in2')).toEqual('out2')
      expect(fn('in4')).toEqual('out4')
      expect(fn('in1')).toEqual('out1')
      expect(fn('in3')).toEqual('out3')
      expect(fn('in4')).toEqual('default')
    })

    it('has a default and non-default resolved value', async () => {
      const fn = jest.fn()

      given(fn)
        .resolvesTo('default')
        .calledWith('foo').resolvesTo('special')

      await expect(fn('bar')).resolves.toEqual('default')
      await expect(fn('foo')).resolves.toEqual('special')
    })

    it('has a default and non-default rejected value', async () => {
      const fn = jest.fn()

      given(fn)
        .rejectsWith(new Error('default'))
        .calledWith('foo').rejectsWith(new Error('special'))

      await expect(fn('bar')).rejects.toThrow('default')
      await expect(fn('foo')).rejects.toThrow('special')
    })

    it('default reject interoperates with resolve', async () => {
      const fn = jest.fn()

      given(fn)
        .rejectsWith(new Error('non-mocked interaction'))
        .calledWith('foo').resolvesTo('mocked')

      await expect(fn('foo')).resolves.toEqual('mocked')
      await expect(fn('bar')).rejects.toThrow('non-mocked interaction')
    })

    it('can override default', () => {
      const fn = jest.fn()

      given(fn)
        .returns('oldDefault')
        .returns('newDefault')
        .calledWith('foo').returns('bar')

      expect(fn('foo')).toEqual('bar')
      expect(fn('foo2')).toEqual('newDefault')
    })

    it('will throw because of unintended usage', () => {
      const fn = jest.fn()

      given(fn)
        .returns('default')

      expect(fn).toThrow('Unintended use: Only use default value in combination with .calledWith(..), ' +
        'or use standard mocking without jest-when.')
    })

    it('will not throw on old non-throwing case', () => {
      const fn = jest.fn()

      given(fn)

      expect(fn).not.toThrow()
    })

    it('allows using isImplementedAs', () => {
      const fn = jest.fn()

      given(fn).calledWith('foo', 'bar').isImplementedAs((...args) => args)

      expect(fn('foo', 'bar')).toEqual(['foo', 'bar'])
      expect(fn('foo', 'bar')).toEqual(['foo', 'bar'])

      expect(fn('not-foo')).toBeUndefined()
    })

    it('allows using onceIsImplementedAs', () => {
      const fn = jest.fn()

      given(fn).calledWith('foo', 'bar').onceIsImplementedAs((...args) => args)

      expect(fn('foo', 'bar')).toEqual(['foo', 'bar'])
      expect(fn('foo')).toBeUndefined()
    })

    it('accepts a spied method:', () => {
      class TheClass {
        theMethod (theArgument) {
          return 'real'
        }
      }

      const theInstance = new TheClass()

      const theSpiedMethod = jest.spyOn(theInstance, 'theMethod')
      given(theSpiedMethod)
        .calledWith(1)
        .returns('mock')
      const returnValue = theInstance.theMethod(1)
      expect(returnValue).toBe('mock')
    })

    it('mocks implementation only once when using onceIsImplementedAs', () => {
      const fn = jest.fn()

      given(fn).calledWith(expect.anything()).isImplementedAs(() => 'foo').onceIsImplementedAs(() => 'bar')

      expect(fn('')).toEqual('bar')
      expect(fn('')).toEqual('foo')
    })
  })
})
