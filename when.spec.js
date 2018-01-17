import when, { WhenMock } from './when';
import mockExpect from 'expect';

// jest.mock('expect', () => (arg) => ({
//   toEqual: jest.fn()
// }));

const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*\\n.*${expect}.*\\nReceived.*\\n.*${actual}`);

describe('When', () => {
  describe('when', () => {
    it('returns a WhenMock with ', () => {
      const fn = jest.fn();
      const whenFn = when(fn);

      expect(whenFn).toBeInstanceOf(WhenMock);
      expect(whenFn.fn).toBe(fn);
    });
  });

  describe('usage regular args', () => {
    let fn1, fn2;

    beforeEach(() => {
      fn1 = jest.fn();
      fn2 = jest.fn();
    });

    it('allows mocking a number', () => {
      when(fn1).calledWith(1).mockReturnValue('x');

      expect(fn1(1)).toEqual('x');
      expect(() => fn1(9)).toThrow(errMsg({
        expect: 1,
        actual: 9
      }));
    });

    it('allows mocking a string', () => {
      when(fn1).calledWith('foo').mockReturnValue('x');

      expect(fn1('foo')).toEqual('x');
      expect(() => fn1('bar')).toThrow(errMsg({
        expect: 'foo',
        actual: 'bar'
      }));
    });

    it('allows mocking a boolean', () => {
      when(fn1).calledWith(true).mockReturnValue('x');

      expect(fn1(true)).toEqual('x');
      expect(() => fn1(false)).toThrow(errMsg({
        expect: true,
        actual: false
      }));

      when(fn2).calledWith(false).mockReturnValue('y');

      expect(fn2(false)).toEqual('y');
      expect(() => fn2(true)).toThrow(errMsg({
        expect: false,
        actual: true
      }));
    });

    it('allows mocking a Date', () => {
      when(fn1).calledWith(new Date('1995-12-17T03:24:00'))
        .mockReturnValue('x');

      expect(fn1(new Date('1995-12-17T03:24:00'))).toEqual('x');
      expect(() => fn1(new Date('2010-01-01T03:24:00'))).toThrow(errMsg({
        expect: '1995-12-17T08:24:00.000Z',
        actual: '2010-01-01T08:24:00.000Z'
      }));

    });

    it('allows mocking a Regexp', () => {
      when(fn1).calledWith(/abc/mi).mockReturnValue('x');

      expect(fn1(/abc/mi)).toEqual('x');
      expect(() => fn1(/xyz/g)).toThrow(errMsg({
        expect: '/abc/im',
        actual: '/xyz/g'
      }));
    });

    it('allows mocking null', () => {
      when(fn1).calledWith(null).mockReturnValue('x');

      expect(fn1(null)).toEqual('x');
      expect(() => fn1(0)).toThrow(errMsg({
        expect: null,
        actual: 0
      }));
    });

    it('allows mocking undefined', () => {
      when(fn1).calledWith(undefined).mockReturnValue('x');

      expect(fn1()).toEqual('x');
      expect(fn1(undefined)).toEqual('x');
      expect(() => fn1(0)).toThrow(errMsg({
        expect: undefined,
        actual: 0
      }));
    });

    it('allows mocking objects', () => {
      when(fn1).calledWith({ foo: 'true' }).mockReturnValue('x');

      expect(fn1({ foo: 'true' })).toEqual('x');
      expect(() => fn1({ foo: 'false' })).toThrow(errMsg({
        expect: '{"foo": "true"}',
        actual: '{"foo": "false"}'
      }));
      expect(() => fn1({ foo: 'true', bar: 'true' })).toThrow(errMsg({
        expect: '{"foo": "true"}',
        actual: '{"bar": "true", "foo": "true"}'
      }));
      expect(() => fn1({ bar: 'true' })).toThrow(errMsg({
        expect: '{"foo": "true"}',
        actual: '{"bar": "true"}'
      }));
    });

    it('allows mocking array', () => {
      when(fn1).calledWith(['foo', true, 4, { foo: 'bar' }]).mockReturnValue('x');

      expect(fn1(['foo', true, 4, { foo: 'bar' }])).toEqual('x');
      expect(() => fn1([5, false])).toThrow(errMsg({
        expect: '["foo", true, 4, {"foo": "bar"}]',
        actual: '[5, false]'
      }));
      expect(() => fn1(['foo', true, 4, { foo: 'baz' }])).toThrow(errMsg({
        expect: '["foo", true, 4, {"foo": "bar"}]',
        actual: '["foo", true, 4, {"foo": "baz"}]'
      }));
    });
  });

  describe('usage asymmetric matchers', () => {
    let fn1, fn2;

    beforeEach(() => {
      fn1 = jest.fn();
      fn2 = jest.fn();
    });

    it('allows mocking with expect.anything', () => {
      when(fn1).calledWith(expect.anything()).mockReturnValue('x');

      expect(fn1(1)).toEqual('x');
      expect(fn1('foo')).toEqual('x');
      expect(fn1(true)).toEqual('x');
      expect(fn1(false)).toEqual('x');
      expect(fn1({})).toEqual('x');
      expect(fn1([])).toEqual('x');
      expect(fn1('')).toEqual('x');
      expect(fn1(new Date())).toEqual('x');
      expect(fn1(/abc/)).toEqual('x');
      expect(() => fn1(null)).toThrow(errMsg({
        expect: 'Anything',
        actual: 'null'
      }));
      expect(() => fn1(undefined)).toThrow(errMsg({
        expect: 'Anything',
        actual: 'undefined'
      }));
      expect(() => fn1()).toThrow(errMsg({
        expect: 'Anything',
        actual: 'undefined'
      }));
    });

    it('allows mocking with expect.any()', () => {
      when(fn1).calledWith(expect.any(Number)).mockReturnValue('x');

      expect(fn1(1)).toEqual('x');
      expect(fn1(9999)).toEqual('x');
      expect(fn1(42.23452345)).toEqual('x');
      expect(() => fn1('23')).toThrow(errMsg({
        expect: 'Any<Number>',
        actual: '"23"'
      }));

      when(fn2).calledWith(expect.any(String)).mockReturnValue('x');

      expect(fn2('foo')).toEqual('x');
      expect(fn2('barbazquux')).toEqual('x');
      expect(fn2(`hello
      asdfasdf
      asdfasdf`)).toEqual('x');
      expect(() => fn2(42)).toThrow(errMsg({
        expect: 'Any<String>',
        actual: '42'
      }));
    });

    it('allows mocking with expect.arrayContainer()', () => {
      when(fn1).calledWith(expect.any(Number)).mockReturnValue('x');

      expect(fn1(1)).toEqual('x');
      expect(fn1(9999)).toEqual('x');
      expect(fn1(42.23452345)).toEqual('x');
      expect(() => fn1('23')).toThrow(errMsg({
        expect: 'Any<Number>',
        actual: '"23"'
      }));

      when(fn2).calledWith(expect.any(String)).mockReturnValue('x');

      expect(fn2('foo')).toEqual('x');
      expect(fn2('barbazquux')).toEqual('x');
      expect(fn2(`hello
      asdfasdf
      asdfasdf`)).toEqual('x');
      expect(() => fn2(42)).toThrow(errMsg({
        expect: 'Any<String>',
        actual: '42'
      }));
    });
  })
});