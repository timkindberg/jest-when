const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*${expect}.*\\nReceived.*${actual}`)

describe('When', () => {
  let when, WhenMock, resetAllWhenMocks, verifyAllWhenMocksCalled

  beforeEach(() => {
    when = require('./when').when
    resetAllWhenMocks = require('./when').resetAllWhenMocks
    verifyAllWhenMocksCalled = require('./when').verifyAllWhenMocksCalled
    WhenMock = require('./when').WhenMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
  })

  describe('when', () => {
    it('returns a WhenMock', () => {
      const fn = jest.fn()
      const whenFn = when(fn)

      expect(whenFn).toBeInstanceOf(WhenMock)
      expect(whenFn.fn).toBe(fn)
    })

    it('returns existing WhenMock if fn was already whenified', () => {
      const fn = jest.fn()
      const whenFn1 = when(fn)
      const whenFn2 = when(fn)

      expect(whenFn1).toBeInstanceOf(WhenMock)
      expect(whenFn2).toBeInstanceOf(WhenMock)
      expect(whenFn1).toBe(whenFn2)
    })

    it('allows reset of mocks to enable overrides later', () => {
      const fn = jest.fn()

      when(fn).expectCalledWith(1).mockReturnValueOnce('x')

      resetAllWhenMocks()

      when(fn).expectCalledWith(1).mockReturnValueOnce('z')

      expect(fn(1)).toEqual('z')
    })

    it('reset of mocks restores original implementation', () => {
      const fn = jest.fn(() => 'a')

      when(fn).expectCalledWith(1).mockReturnValueOnce('x')

      resetAllWhenMocks()

      expect(fn(1)).toEqual('a')
    })

    it('allows reset of mocks for one function', () => {
      const fn = jest.fn(() => 'a')

      const mock = when(fn).expectCalledWith(1).mockReturnValueOnce('x')

      mock.resetWhenMocks()

      expect(fn(1)).toEqual('a')
    })

    it('allows checking that all mocks were called', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      when(fn1).expectCalledWith(1).mockReturnValue('z')
      when(fn2).expectCalledWith(1).mockReturnValueOnce('x')
      when(fn2).expectCalledWith(1).mockReturnValueOnce('y')
      when(fn2).expectCalledWith(1).mockReturnValue('z')

      fn1(1)
      fn2(1)
      fn2(1)
      fn2(1)

      expect(verifyAllWhenMocksCalled).not.toThrow()
    })

    it('fails verification check if all mocks were not called', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      when(fn1).expectCalledWith(expect.anything()).mockReturnValue('z')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValueOnce('x')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValueOnce('y')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValue('z')

      fn1(1)
      fn2(1)

      let caughtErr

      try {
        verifyAllWhenMocksCalled()
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

      when(fn1).expectCalledWith(expect.anything()).mockReturnValue('z')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValueOnce('x')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValueOnce('y')
      when(fn2).expectCalledWith(expect.anything()).mockReturnValue('z')

      fn1(1)
      fn2(1)

      // Should be two call lines printed, hence the {2} at the end of the regex
      expect(verifyAllWhenMocksCalled).toThrow(/(src(?:\\|\/)when\.test\.js:\d{3}(.|\s)*){2}/)
    })
  })

  describe('mock implementation', () => {
    it('only matches exact sets of args, too little or too many args do not trigger mock return', () => {
      const fn = jest.fn()

      when(fn)
        .calledWith(1, 'foo', true, expect.any(String), undefined)
        .mockReturnValue('x')

      expect(fn(1, 'foo', true, 'whatever', undefined)).toEqual('x')

      expect(fn(1, 'foo', true, 'whatever')).toEqual(undefined)
      expect(fn(1, 'foo', true, 'whatever', undefined, undefined)).toEqual(undefined)
      expect(fn(1, 'foo', true, 'whatever', undefined, 'oops')).toEqual(undefined)
    })

    it('able to call with null', () => {
      const fn = jest.fn()

      when(fn)
        .calledWith(null)
        .mockReturnValue('x')

      expect(fn(null)).toEqual('x')
    })

    describe('function matcher', () => {
      it('works with custom function args', () => {
        const fn = jest.fn()

        const allValuesTrue = (arg) => Object.values(arg).every(Boolean)
        const numberDivisibleBy3 = (arg) => arg % 3 === 0

        when(fn)
          .calledWith(when(allValuesTrue), when(numberDivisibleBy3))
          .mockReturnValue('x')

        expect(fn({ foo: true, bar: true }, 9)).toEqual('x')
        expect(fn({ foo: true, bar: false }, 9)).toEqual(undefined)
        expect(fn({ foo: true, bar: false }, 13)).toEqual(undefined)
      })

      it('custom function args get access to the "equals" jasmine util', () => {
        const fn = jest.fn()

        const arrMatch = (arg, equals) => equals(arg, [1, 2, 3])

        when(fn)
          .calledWith(when(arrMatch))
          .mockReturnValue('x')

        expect(fn([1, 2, 3])).toEqual('x')
      })

      it('expects with custom function args', () => {
        const fn = jest.fn()

        const allValuesTrue = (arg) => Object.values(arg).every(Boolean)
        const numberDivisibleBy3 = (arg) => arg % 3 === 0

        when(fn)
          .expectCalledWith(when(allValuesTrue), when(numberDivisibleBy3))
          .mockReturnValue('x')

        expect(fn({ foo: true, bar: true }, 9)).toEqual('x')
        expect(() => fn({ foo: false, bar: true }, 9)).toThrow(/Failed function matcher within expectCalledWith: allValuesTrue\(\{"foo":false,"bar":true\}\) did not return true/)
        expect(() => fn({ foo: true, bar: true }, 13)).toThrow(/Failed function matcher within expectCalledWith: numberDivisibleBy3\(13\) did not return true/)
      })

      it('does not call regular functions as function matchers', () => {
        const fn = jest.fn()

        const doNotCallMeBro = () => {
          throw new Error('BOOM')
        }

        when(fn)
          .expectCalledWith(doNotCallMeBro)
          .mockReturnValue('x')

        expect(fn(doNotCallMeBro)).toEqual('x')
        expect(() => fn(doNotCallMeBro)).not.toThrow()
      })
    })

    describe('when.allArgs', () => {
      it('throws an error if you try to use other matches with it', () => {
        const fn = jest.fn()

        when(fn)
          .calledWith(when.allArgs(() => true), 1, 2, 3)
          .mockReturnValue('x')

        expect(() => fn(3, 6, 9)).toThrow(/When using when.allArgs, it must be the one and only matcher provided to calledWith. You have incorrectly provided other matchers along with when.allArgs./)
      })

      it('allows matching against all the args at once with when.allArgs', () => {
        const fn = jest.fn()

        const numberDivisibleBy3 = (args) => args.every(arg => arg % 3 === 0)

        when(fn)
          .calledWith(when.allArgs(numberDivisibleBy3))
          .mockReturnValue('x')

        expect(fn(3, 6, 9)).toEqual('x')
        expect(fn(3, 6, 10)).toBeUndefined()
        expect(fn(1, 2, 3)).toBeUndefined()
      })

      it('all args are numbers example', () => {
        const fn = jest.fn()
        const areNumbers = (args, equals) => args.every(arg => equals(arg, expect.any(Number)))

        when(fn)
          .calledWith(when.allArgs(areNumbers))
          .mockReturnValue('x')

        expect(fn(3, 6, 9)).toEqual('x')
        expect(fn(3, 666)).toEqual('x')
        expect(fn(-100, 2, 3.234234, 234, 90e3)).toEqual('x')
        expect(fn(123, 'not a number')).toBeUndefined()
      })

      it('first matcher is a proxy', () => {
        const fn = jest.fn()

        const proxy = new Proxy({}, {
          get: () => true
        })

        when(fn)
          .calledWith(proxy)
          .mockReturnValue('x')

        expect(proxy._isAllArgsFunctionMatcher).toEqual(true)

        expect(fn(proxy)).toEqual('x')
      })

      it('single arg match example', () => {
        const fn = jest.fn()
        const argAtIndex = (index, matcher) => when.allArgs((args, equals) => equals(args[index], matcher))

        when(fn)
          .calledWith(argAtIndex(0, expect.any(Number)))
          .mockReturnValue('x')

        expect(fn(1, 2, 3)).toEqual('x')
        expect(fn(-123123, 'string', false, null)).toEqual('x')
        expect(fn('not a string', 2, 3)).toBeUndefined()
      })

      it('partial match example', () => {
        const fn = jest.fn()
        const partialArgs = (...argsToMatch) => when.allArgs((args, equals) => equals(args, expect.arrayContaining(argsToMatch)))

        when(fn)
          .calledWith(partialArgs(1, 2, 3))
          .mockReturnValue('x')

        expect(fn(1, 2, 3)).toEqual('x')
        expect(fn(1, 2, 3, 4, 5, 6)).toEqual('x')
        expect(fn(1, 2)).toBeUndefined()
        expect(fn(1, 2, 4)).toBeUndefined()
      })

      it('react use case from github', () => {
        // SEE: https://github.com/timkindberg/jest-when/issues/66

        const SomeChild = jest.fn()

        when(SomeChild)
          .calledWith({ xyz: '123' })
          .mockReturnValue('hello world')

        const propsOf = propsToMatch => when.allArgs(([props, refOrContext], equals) => equals(props, propsToMatch))

        when(SomeChild)
          .calledWith(propsOf({ xyz: '123' }))
          .mockReturnValue('hello world')

        expect(SomeChild({ xyz: '123' })).toEqual('hello world')
      })

      it('allows matching against all the args at once with when.allArgs using expect matchers', () => {
        const fn = jest.fn()

        when(fn)
          .calledWith(when.allArgs(expect.arrayContaining([42])))
          .mockReturnValue('x')
          .calledWith(when.allArgs(expect.arrayContaining([expect.objectContaining({ foo: true })])))
          .mockReturnValue('y')

        expect(fn(3, 6, 42)).toEqual('x')
        expect(fn({ foo: true, bar: true }, 'a', 'b', 'c')).toEqual('y')
        expect(fn(1, 2, 3)).toBeUndefined()
      })

      it('allows asserting against all the args at once with when.allArgs', () => {
        const fn = jest.fn()

        const numberDivisibleBy3 = (args) => args.every(arg => arg % 3 === 0)

        when(fn)
          .expectCalledWith(when.allArgs(numberDivisibleBy3))
          .mockReturnValue('x')

        expect(fn(3, 6, 9)).toEqual('x')
        expect(() => fn(3, 6, 10)).toThrow(/Failed function matcher within expectCalledWith: numberDivisibleBy3\(\[3,6,10]\) did not return true/)
        expect(() => fn(1, 2, 3)).toThrow(/Failed function matcher within expectCalledWith: numberDivisibleBy3\(\[1,2,3]\) did not return true/)
      })
    })

    it('supports compound when declarations', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')
      when(fn).calledWith('foo', 'bar').mockReturnValue('y')
      when(fn).calledWith(false, /asdf/g).mockReturnValue('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('supports chaining of when declarations', () => {
      const fn = jest.fn()

      when(fn)
        .calledWith(1)
        .mockReturnValue('x')

      when(fn).calledWith('foo', 'bar')
        .mockReturnValue('y')
        .calledWith(false, /asdf/g)
        .mockReturnValue('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('supports replacement of when declarations', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo', 'bar').mockReturnValue('x')
      when(fn).calledWith(false, /asdf/g).mockReturnValue('y')
      when(fn).calledWith('foo', 'bar').mockReturnValue('z')

      expect(fn('foo', 'bar')).toEqual('z')
    })

    it('returns a declared value repeatedly', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')
      when(fn).calledWith(2).mockReturnValueOnce('x').mockReturnValue('y')

      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(2)).toEqual('x')
      expect(fn(2)).toEqual('y')
    })

    it('should handle symbol matchers', () => {
      const fn = jest.fn()
      const symbol = Symbol.for(`sym`)
      when(fn).calledWith(symbol, 2).mockReturnValue('x')

      expect(fn(5)).toBeUndefined()
      expect(fn(symbol, 2)).toBe('x')
    })

    it('returns nothing if no declared value matches', () => {
      const fn = jest.fn()

      when(fn).calledWith(1, 2).mockReturnValue('x')

      expect(fn(5, 6)).toBeUndefined()
    })

    it('expectCalledWith: fails a test with error messaging if argument does not match', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      when(fn1).expectCalledWith(1).mockReturnValue('x')
      when(fn2).calledWith('foo').mockReturnValue('y')

      expect(() => fn1(2)).toThrow(errMsg({ expect: 1, actual: 2 }))
      expect(() => fn2('bar')).not.toThrow()
    })

    it('mockReturnValue: should return a function', () => {
      const fn = jest.fn()
      const returnValue = () => {}

      when(fn).calledWith('foo').mockReturnValue(returnValue)

      expect(fn('foo')).toBe(returnValue)
    })

    it('mockReturnValueOnce: should return a function', () => {
      const fn = jest.fn()
      const returnValue = () => {}

      when(fn).calledWith('foo').mockReturnValueOnce(returnValue)

      expect(fn('foo')).toBe(returnValue)
    })

    it('mockReturnValueOnce: should return specified value only once', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockReturnValueOnce('bar')
      when(fn).calledWith('foo').mockReturnValueOnce('cbs')

      expect(fn('foo')).toEqual('bar')
      expect(fn('foo')).toEqual('cbs')
      expect(fn('foo')).toBeUndefined()
    })

    it('mockReturnValueOnce: should return specified value only once and the regular value after that', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockReturnValue('bar')
      expect(fn('foo')).toEqual('bar')

      when(fn).calledWith('foo').mockReturnValueOnce('cbs')
      expect(fn('foo')).toEqual('cbs')

      expect(fn('foo')).toEqual('bar')
    })

    it('mockReturnValueOnce: works with expectCalledWith', () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockReturnValueOnce('bar')

      expect(fn('foo')).toEqual('bar')
    })

    it('mockResolvedValue: should return a Promise', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValue('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('mockResolvedValue: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValue('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('mockResolvedValueOnce: should return a Promise only once', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValueOnce('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('mockResolvedValueOnce: should return specified value only once and the regular value after that', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValue('bar')
      expect(await fn('foo')).toEqual('bar')

      when(fn).calledWith('foo').mockResolvedValueOnce('cbs')
      expect(await fn('foo')).toEqual('cbs')

      expect(await fn('foo')).toEqual('bar')
    })

    it('mockResolvedValueOnce: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValueOnce('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('mockRejectedValue: should return a rejected Promise', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValue(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('mockRejectedValue: does not reject the Promise until the function is called', done => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValue(new Error('bar'))

      setTimeout(async () => {
        await expect(fn('foo')).rejects.toThrow('bar')
        done()
      }, 0)
    })

    it('mockRejectedValue: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockRejectedValue(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('mockRejectedValueOnce: should return a rejected Promise only once', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValueOnce(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('mockRejectedValueOnce: does not reject the Promise until the function is called', done => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValueOnce(new Error('bar'))

      setTimeout(async () => {
        await expect(fn('foo')).rejects.toThrow('bar')
        done()
      }, 0)
    })

    it('mockRejectedValueOnce: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockRejectedValueOnce(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('can be reset via `mockReset`', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('return 1')
      expect(fn(1)).toEqual('return 1')

      fn.mockReset()
      expect(fn(1)).toBeUndefined()

      when(fn).calledWith(1).mockReturnValue('return 2')
      expect(fn(1)).toEqual('return 2')
    })

    it('`mockReset` on unused when calls', () => {
      const fn = jest.fn()

      when(fn)
        .calledWith('test')
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        // .mockReturnValueOnce(3)
      expect(fn('test')).toBe(1)
      expect(fn.mock.calls.length).toBe(1)

      fn.mockReset()

      when(fn).calledWith('test').mockReturnValueOnce(1)
      expect(fn('test')).toBe(1)
      expect(fn.mock.calls.length).toBe(1)
    })

    describe('Default Behavior (no called with)', () => {
      describe('defaultX methods', () => {
        it('has a default and a non-default behavior (defaultReturnValue alias)', () => {
          let fn = jest.fn()

          when(fn)
            .defaultReturnValue('default')
            .calledWith('foo')
            .mockReturnValue('special')

          expect(fn('bar')).toEqual('default')
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual('default')

          fn = jest.fn()

          when(fn)
            .calledWith('foo')
            .mockReturnValue('special')
            .defaultReturnValue('default')

          expect(fn('bar')).toEqual('default')
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual('default')
        })

        it('has a default which is falsy (defaultReturnValue alias)', () => {
          let fn = jest.fn()

          when(fn)
            .defaultReturnValue(false)
            .calledWith('foo')
            .mockReturnValue('special')

          expect(fn('bar')).toEqual(false)
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual(false)

          fn = jest.fn()

          when(fn)
            .calledWith('foo')
            .mockReturnValue('special')
            .defaultReturnValue(false)

          expect(fn('bar')).toEqual(false)
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual(false)
        })

        it('has a default value which is a function (defaultReturnValue alias)', () => {
          const fn = jest.fn()
          const defaultValue = () => {
          }

          when(fn)
            .defaultReturnValue(defaultValue)
            .calledWith('bar').mockReturnValue('baz')

          expect(fn('foo')).toBe(defaultValue)
        })

        it('has a default implementation (defaultReturnValue alias)', () => {
          let fn = jest.fn()

          when(fn)
            .defaultImplementation(() => 1)
            .calledWith('bar').mockReturnValue('baz')

          expect(fn('foo')).toBe(1)
          expect(fn('bar')).toBe('baz')

          fn = jest.fn()

          when(fn)
            .calledWith('bar').mockReturnValue('baz')
            .defaultImplementation(() => 1)

          expect(fn('foo')).toBe(1)
          expect(fn('bar')).toBe('baz')
        })

        it('has access to args in a default implementation (defaultReturnValue alias)', () => {
          const fn = jest.fn()

          when(fn)
            .defaultImplementation(({ name }) => `Hello ${name}`)
            .calledWith({ name: 'bar' }).mockReturnValue('Goodbye bar')

          expect(fn({ name: 'foo' })).toBe('Hello foo')
          expect(fn({ name: 'bar' })).toBe('Goodbye bar')
        })

        it('keeps the default with a lot of matchers (defaultReturnValue alias)', () => {
          const fn = jest.fn()

          when(fn)
            .calledWith('in1').mockReturnValue('out1')
            .calledWith('in2').mockReturnValue('out2')
            .calledWith('in3').mockReturnValue('out3')
            .calledWith('in4').mockReturnValueOnce('out4')
            .defaultReturnValue('default')

          expect(fn('foo')).toEqual('default')
          expect(fn('in2')).toEqual('out2')
          expect(fn('in4')).toEqual('out4')
          expect(fn('in1')).toEqual('out1')
          expect(fn('in3')).toEqual('out3')
          expect(fn('in4')).toEqual('default')
        })

        it('has a default and non-default resolved value (defaultReturnValue alias)', async () => {
          const fn = jest.fn()

          when(fn)
            .calledWith('foo').mockResolvedValue('special')
            .defaultResolvedValue('default')

          await expect(fn('bar')).resolves.toEqual('default')
          await expect(fn('foo')).resolves.toEqual('special')
        })

        it('can default a resolved value alone', async () => {
          const fn = jest.fn()

          when(fn)
            .defaultResolvedValue('default')

          await expect(fn('bar')).resolves.toEqual('default')
          await expect(fn('foo')).resolves.toEqual('default')
        })

        it('has a default and non-default rejected value (defaultReturnValue alias)', async () => {
          const fn = jest.fn()

          when(fn)
            .calledWith('foo').mockRejectedValue(new Error('special'))
            .defaultRejectedValue(new Error('default'))

          await expect(fn('bar')).rejects.toThrow('default')
          await expect(fn('foo')).rejects.toThrow('special')
        })

        it('can default a rejected value alone', async () => {
          const fn = jest.fn()

          when(fn)
            .defaultRejectedValue(new Error('default'))

          await expect(fn('bar')).rejects.toThrow('default')
          await expect(fn('foo')).rejects.toThrow('default')
        })

        it('default reject interoperates with resolve (defaultReturnValue alias)', async () => {
          const fn = jest.fn()

          when(fn)
            .calledWith('foo').mockResolvedValue('mocked')
            .defaultRejectedValue(new Error('non-mocked interaction'))

          await expect(fn('foo')).resolves.toEqual('mocked')
          await expect(fn('bar')).rejects.toThrow('non-mocked interaction')
        })

        it('can override default (defaultReturnValue alias)', () => {
          const fn = jest.fn()

          when(fn)
            .defaultReturnValue('oldDefault')
            .calledWith('foo').mockReturnValue('bar')
            .defaultReturnValue('newDefault')

          expect(fn('foo')).toEqual('bar')
          expect(fn('foo2')).toEqual('newDefault')
        })

        it('allows defining the default NOT in a chained case (defaultReturnValue alias)', async () => {
          const fn = jest.fn()

          when(fn).defaultRejectedValue(false)

          when(fn)
            .calledWith(expect.anything())
            .mockResolvedValue(true)

          await expect(fn('anything')).resolves.toEqual(true)
          await expect(fn()).rejects.toEqual(false)
        })

        it('allows overriding the default NOT in a chained case (defaultReturnValue alias)', () => {
          const fn = jest.fn()

          when(fn)
            .calledWith(expect.anything())
            .mockReturnValue(true)

          when(fn).defaultReturnValue(1)
          when(fn).defaultReturnValue(2)

          expect(fn()).toEqual(2)
        })
      })

      describe('legacy methods', () => {
        it('has a default and a non-default behavior', () => {
          const fn = jest.fn()

          when(fn)
            .mockReturnValue('default')
            .calledWith('foo')
            .mockReturnValue('special')

          expect(fn('bar')).toEqual('default')
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual('default')
        })

        it('has a default which is falsy', () => {
          const fn = jest.fn()

          when(fn)
            .mockReturnValue(false)
            .calledWith('foo')
            .mockReturnValue('special')

          expect(fn('bar')).toEqual(false)
          expect(fn('foo')).toEqual('special')
          expect(fn('bar')).toEqual(false)
        })

        it('has a default value which is a function', () => {
          const fn = jest.fn()
          const defaultValue = () => {
          }

          when(fn)
            .mockReturnValue(defaultValue)
            .calledWith('bar').mockReturnValue('baz')

          expect(fn('foo')).toBe(defaultValue)
        })

        it('has a default implementation', () => {
          const fn = jest.fn()

          when(fn)
            .mockImplementation(() => 1)
            .calledWith('bar').mockReturnValue('baz')

          expect(fn('foo')).toBe(1)
          expect(fn('bar')).toBe('baz')
        })

        it('has access to args in a default implementation', () => {
          const fn = jest.fn()

          when(fn)
            .mockImplementation(({ name }) => `Hello ${name}`)
            .calledWith({ name: 'bar' }).mockReturnValue('Goodbye bar')

          expect(fn({ name: 'foo' })).toBe('Hello foo')
          expect(fn({ name: 'bar' })).toBe('Goodbye bar')
        })

        it('keeps the default with a lot of matchers', () => {
          const fn = jest.fn()

          when(fn)
            .mockReturnValue('default')
            .calledWith('in1').mockReturnValue('out1')
            .calledWith('in2').mockReturnValue('out2')
            .calledWith('in3').mockReturnValue('out3')
            .calledWith('in4').mockReturnValueOnce('out4')

          expect(fn('foo')).toEqual('default')
          expect(fn('in2')).toEqual('out2')
          expect(fn('in4')).toEqual('out4')
          expect(fn('in1')).toEqual('out1')
          expect(fn('in3')).toEqual('out3')
          expect(fn('in4')).toEqual('default')
        })

        it('has a default and non-default resolved value', async () => {
          const fn = jest.fn()

          when(fn)
            .mockResolvedValue('default')
            .calledWith('foo').mockResolvedValue('special')

          await expect(fn('bar')).resolves.toEqual('default')
          await expect(fn('foo')).resolves.toEqual('special')
        })

        it('has a default and non-default rejected value', async () => {
          const fn = jest.fn()

          when(fn)
            .mockRejectedValue(new Error('default'))
            .calledWith('foo').mockRejectedValue(new Error('special'))

          await expect(fn('bar')).rejects.toThrow('default')
          await expect(fn('foo')).rejects.toThrow('special')
        })

        it('default reject interoperates with resolve', async () => {
          const fn = jest.fn()

          when(fn)
            .mockRejectedValue(new Error('non-mocked interaction'))
            .calledWith('foo').mockResolvedValue('mocked')

          await expect(fn('foo')).resolves.toEqual('mocked')
          await expect(fn('bar')).rejects.toThrow('non-mocked interaction')
        })

        it('can override default', () => {
          const fn = jest.fn()

          when(fn)
            .mockReturnValue('oldDefault')
            .mockReturnValue('newDefault')
            .calledWith('foo').mockReturnValue('bar')

          expect(fn('foo')).toEqual('bar')
          expect(fn('foo2')).toEqual('newDefault')
        })

        it('allows defining the default NOT in a chained case', async () => {
          const fn = jest.fn()

          when(fn).mockRejectedValue(false)

          when(fn)
            .calledWith(expect.anything())
            .mockResolvedValue(true)

          await expect(fn('anything')).resolves.toEqual(true)
          await expect(fn()).rejects.toEqual(false)
        })

        it('allows overriding the default NOT in a chained case', () => {
          const fn = jest.fn()

          when(fn).mockReturnValue(1)
          when(fn).mockReturnValue(2)

          when(fn)
            .calledWith(expect.anything())
            .mockReturnValue(true)

          expect(fn()).toEqual(2)
        })
      })
    })

    it('will throw because of unintended usage', () => {
      const fn = jest.fn()

      when(fn)
        .mockReturnValue('default')

      expect(fn()).toEqual('default')
    })

    it('will not throw on old non-throwing case', () => {
      const fn = jest.fn()

      when(fn)

      expect(fn).not.toThrow()
    })

    it('allows using mockImplementation', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo', 'bar').mockImplementation((...args) => args)

      expect(fn('foo', 'bar')).toEqual(['foo', 'bar'])
      expect(fn('foo', 'bar')).toEqual(['foo', 'bar'])

      expect(fn('not-foo')).toBeUndefined()
    })

    it('allows using mockImplementationOnce', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo', 'bar').mockImplementationOnce((...args) => args)

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
      when(theSpiedMethod)
        .calledWith(1)
        .mockReturnValue('mock')
      const returnValue = theInstance.theMethod(1)
      expect(returnValue).toBe('mock')
    })

    it('keeps default function implementation when not matched', () => {
      class TheClass {
        fn () {
          return 'real'
        }
      }
      const instance = new TheClass()
      const spy = jest.spyOn(instance, 'fn')
      when(spy)
        .calledWith(1)
        .mockReturnValue('mock')
      expect(instance.fn(2)).toBe('real')
    })

    it('keeps default mock implementation when not matched', () => {
      const fn = jest.fn(() => {
        return 'real'
      })
      when(fn)
        .calledWith(1)
        .mockReturnValue('mock')
      expect(fn(1)).toBe('mock')
      expect(fn(2)).toBe('real')
    })

    it('keeps default mockReturnValue when not matched', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('a')
      when(fn).mockReturnValue('b')

      expect(fn(1)).toEqual('a') // fails and will still return 'b' (as before my change)
      expect(fn(2)).toEqual('b')
    })

    it('keeps call context when not matched', () => {
      class TheClass {
        call () {
          return 'ok'
        }

        request (...args) {
          return this.call(...args)
        }
      }

      const theInstance = new TheClass()

      const theSpiedMethod = jest.spyOn(theInstance, 'request')

      when(theSpiedMethod)
        .calledWith(1)
        .mockReturnValue('mock')

      const unhandledCall = theInstance.request()
      expect(unhandledCall).toBe('ok')
    })

    it('keeps call context when matched', () => {
      class TheClass {
        call () {
          return 'ok'
        }

        request (...args) {
          return this.call(...args)
        }
      }

      const theInstance = new TheClass()

      const theSpiedMethod = jest.spyOn(theInstance, 'request')

      when(theSpiedMethod)
        .calledWith(1)
        .mockImplementation(function () {
          return this.call() + '!'
        })

      const unhandledCall = theInstance.request(1)
      expect(unhandledCall).toBe('ok!')
    })

    it('does not add to the number of assertion calls', () => {
      expect.assertions(0)
    })
  })
})
