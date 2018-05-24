import { when, WhenMock } from './when';
import * as utils from 'expect/build/jasmine_utils';

const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*\\n.*${expect}.*\\nReceived.*\\n.*${actual}`);

describe('When', () => {
  describe('when', () => {
    it('returns a WhenMock', () => {
      const fn = jest.fn();
      const whenFn = when(fn);

      expect(whenFn).toBeInstanceOf(WhenMock);
      expect(whenFn.fn).toBe(fn);
      expect(whenFn.debug).toBe(false);
    });

    it('returns existing WhenMock if fn was already whenified', () => {
      const fn = jest.fn();
      const whenFn1 = when(fn);
      const whenFn2 = when(fn);

      expect(whenFn1).toBeInstanceOf(WhenMock);
      expect(whenFn2).toBeInstanceOf(WhenMock);
      expect(whenFn1).toBe(whenFn2);
    });
  });

  describe('mock implementation', () => {
    it('offloads equality check to jasmine equals helper', () => {
      const fn = jest.fn();

      jest.spyOn(utils, 'equals');

      when(fn).calledWith(1).mockReturnValue('x');

      expect(fn(1)).toEqual('x');
      expect(utils.equals).toBeCalledWith(1, 1);

      expect(fn(2)).toEqual(undefined);
      expect(utils.equals).toBeCalledWith(2, 1);
    });

    it('works with multiple args', () => {
      const fn = jest.fn();

      jest.spyOn(utils, 'equals');

      const anyString = expect.any(String);

      when(fn)
        .calledWith(1, 'foo', true, anyString, undefined)
        .mockReturnValue('x');

      expect(fn(1, 'foo', true, 'whatever')).toEqual('x');
      expect(utils.equals).toBeCalledWith(1, 1);
      expect(utils.equals).toBeCalledWith('foo', 'foo');
      expect(utils.equals).toBeCalledWith(true, true);
      expect(utils.equals).toBeCalledWith('whatever', anyString);
      expect(utils.equals).toBeCalledWith(undefined, undefined);
    });

    it('supports compound when declarations', () => {
      const fn = jest.fn();

      jest.spyOn(utils, 'equals');

      when(fn).calledWith(1).mockReturnValue('x');
      when(fn).calledWith('foo', 'bar').mockReturnValue('y');
      when(fn).calledWith(false, /asdf/g).mockReturnValue('z');

      expect(fn(1)).toEqual('x');
      expect(fn('foo', 'bar')).toEqual('y');
      expect(fn(false, /asdf/g)).toEqual('z');
    });

    it('should log if debug is enabled', () => {
      const fn = jest.fn();
      console.log = jest.fn();

      const whenFn = when(fn, { debug: true });
      whenFn.calledWith(1).mockReturnValue('x');

      fn(1);

      expect(whenFn.debug).toBeTruthy();
      expect(console.log).toBeCalled();
    });

    it('returns a declared value repeatedly', () => {
      const fn = jest.fn();

      when(fn).calledWith(1).mockReturnValue('x');

      expect(fn(1)).toEqual('x');
      expect(fn(1)).toEqual('x');
      expect(fn(1)).toEqual('x');
    });

    it('expectCalledWith: fails a test with error messaging if argument does not match', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      when(fn1).expectCalledWith(1).mockReturnValue('x');
      when(fn2).calledWith('foo').mockReturnValue('y');

      expect(() => fn1(2)).toThrow(errMsg({ expect: 1, actual: 2 }));
      expect(() => fn2('bar')).not.toThrow();
    });

    it('mockReturnValueOnce: should return specified value only once', () => {
      const fn = jest.fn();

      when(fn).calledWith('foo').mockReturnValueOnce('bar');
      when(fn).calledWith('foo').mockReturnValueOnce('cbs');

      expect(fn('foo')).toEqual('bar');
      expect(fn('foo')).toEqual('cbs');
      expect(fn('foo')).toBeUndefined();
    });

    it('mockResolvedValue: should return a Promise', async () => {
      const fn = jest.fn();

      when(fn).calledWith('foo').mockResolvedValue('bar');

      // expect(fn('foo').then).toBe(Function())
      expect(await fn('foo')).toEqual('bar');
    });

    it('mockResolvedValueOnce: should return a Promise only once', async () => {
      const fn = jest.fn();

      when(fn).calledWith('foo').mockResolvedValueOnce('bar');
      when(fn).calledWith('foo').mockResolvedValueOnce('cbs');

      // expect(fn('foo').then).toBe(Function())
      expect(await fn('foo')).toEqual('bar');
      expect(await fn('foo')).toEqual('cbs');
      expect(await fn('foo')).toBeUndefined();
    });
  });
});