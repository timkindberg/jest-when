import { expectTypeOf } from 'expect-type';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { mock } from 'jest-mock-extended';
import { when, WhenMock, WhenMockWithMatchers } from './when';

// Pure compile-time contract tests. This file is type-checked by tsconfig.test.json
// but excluded from the runtime Jest suite and build output.

type MockedObjectMethod<TFunc extends (...args: any[]) => any> = TFunc & {
  calledWith: (...args: any[]) => any;
};

// when() return type
{
  const fn = jest.fn<string, [number]>();
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<string, [number]>>();
  expectTypeOf(when(fn).calledWith(1)).toEqualTypeOf<WhenMockWithMatchers<string, [number]>>();
}

{
  const fn = jest.fn();
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<any, any[]>>();
}

{
  const fn = jest.fn((_x: number): string => '');
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<string, [number]>>();
}

{
  const fn = jest.fn<Promise<boolean>, []>();
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<Promise<boolean>, []>>();
}

{
  class Svc { fetch(_id: number): string { return ''; } }
  expectTypeOf(when(jest.spyOn(new Svc(), 'fetch'))).toEqualTypeOf<WhenMock<string, [number]>>();
}

{
  const fn = jest.fn() as (x: number) => Promise<number>;
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<Promise<number>, [number]>>();
}

{
  const fn = jest.fn() as unknown as (x: number) => string;
  expectTypeOf(when(jest.mocked(fn))).toEqualTypeOf<WhenMock<string, [number]>>();
}

{
  const fn = jest.fn<() => void, []>();
  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<() => void, []>>();
}

// typed mocked function
{
  const syncNonVoid = jest.fn() as (arg: string) => number;
  const asyncNonVoid = jest.fn() as (arg: string) => Promise<number>;
  const syncVoid = jest.fn() as () => void;
  const asyncVoid = jest.fn() as () => Promise<void>;

  when(syncNonVoid).calledWith('blah').mockReturnValue(42);
  // @ts-expect-error wrong argument type
  when(syncNonVoid).calledWith(42).mockReturnValue(42);
  // @ts-expect-error wrong return type
  when(syncNonVoid).calledWith('blah').mockReturnValue('blah');

  when(asyncNonVoid).calledWith('blah').mockResolvedValue(42);
  // @ts-expect-error wrong argument type
  when(asyncNonVoid).calledWith(42).mockResolvedValue(42);
  // @ts-expect-error wrong resolved value type
  when(asyncNonVoid).calledWith('blah').mockResolvedValue('blah');

  when(syncVoid).calledWith().mockReturnValue();
  when(syncVoid).calledWith().mockReturnValue(undefined);
  // @ts-expect-error wrong argument type
  when(syncVoid).calledWith(42).mockReturnValue();
  // @ts-expect-error void function should not accept a non-void return value
  when(syncVoid).calledWith().mockReturnValue('blah');

  when(asyncVoid).calledWith().mockResolvedValue();
  when(asyncVoid).calledWith().mockResolvedValue(undefined);
  // @ts-expect-error wrong argument type
  when(asyncVoid).calledWith(42).mockResolvedValue();
  // @ts-expect-error Promise<void> should not accept a non-void resolved value
  when(asyncVoid).calledWith().mockResolvedValue('blah');
}

// mocked object methods (structural callable mock object case, e.g. jest-mock-extended-like methods)
{
  interface Foo {
    asyncNonVoid: MockedObjectMethod<(arg: string) => Promise<number>>;
    asyncVoid: MockedObjectMethod<(arg: string) => Promise<void>>;
    syncNonVoid: MockedObjectMethod<(arg: string) => number>;
    syncVoid: MockedObjectMethod<(arg: string) => void>;
  }

  const fooMock = {} as Foo;

  expectTypeOf(when(fooMock.syncNonVoid)).toEqualTypeOf<WhenMock<number, [string]>>();
  expectTypeOf(when(fooMock.asyncNonVoid)).toEqualTypeOf<WhenMock<Promise<number>, [string]>>();
  expectTypeOf(when(fooMock.syncVoid)).toEqualTypeOf<WhenMock<void, [string]>>();
  expectTypeOf(when(fooMock.asyncVoid)).toEqualTypeOf<WhenMock<Promise<void>, [string]>>();

  when(fooMock.syncNonVoid).calledWith('blah').mockReturnValue(42);
  // @ts-expect-error wrong argument type
  when(fooMock.syncNonVoid).calledWith(42).mockReturnValue(42);
  // @ts-expect-error wrong return type
  when(fooMock.syncNonVoid).calledWith('blah').mockReturnValue('blah');

  when(fooMock.asyncNonVoid).calledWith('blah').mockResolvedValue(42);
  // @ts-expect-error wrong argument type
  when(fooMock.asyncNonVoid).calledWith(42).mockResolvedValue(42);
  // @ts-expect-error wrong resolved value type
  when(fooMock.asyncNonVoid).calledWith('blah').mockResolvedValue('blah');

  when(fooMock.syncVoid).calledWith('d').mockReturnValue();
  when(fooMock.syncVoid).calledWith('d').mockReturnValue(undefined);
  // @ts-expect-error wrong argument type
  when(fooMock.syncVoid).calledWith(42).mockReturnValue();
  // @ts-expect-error void method should not accept a non-void return value
  when(fooMock.syncVoid).calledWith('d').mockReturnValue('blah');

  when(fooMock.asyncVoid).calledWith('d').mockResolvedValue();
  when(fooMock.asyncVoid).calledWith('d').mockResolvedValue(undefined);
  // @ts-expect-error wrong argument type
  when(fooMock.asyncVoid).calledWith(42).mockResolvedValue();
  // @ts-expect-error Promise<void> method should not accept a non-void resolved value
  when(fooMock.asyncVoid).calledWith('d').mockResolvedValue('blah');
}

// real jest-mock-extended mocked object cases from issue #109 gist
// These are intentionally added before fixing support so we can prove they fail first.
{
  interface Foo {
    asyncNonVoid(arg: string): Promise<number>;
    asyncVoid(arg: string): Promise<void>;
    syncNonVoid(arg: string): number;
    syncVoid(arg: string): void;
  }

  const fooMock = mock<Foo>();

  expectTypeOf(when(fooMock.syncNonVoid)).toEqualTypeOf<WhenMock<number, [string]>>();
  expectTypeOf(when(fooMock.asyncNonVoid)).toEqualTypeOf<WhenMock<Promise<number>, [string]>>();
  expectTypeOf(when(fooMock.syncVoid)).toEqualTypeOf<WhenMock<void, [string]>>();
  expectTypeOf(when(fooMock.asyncVoid)).toEqualTypeOf<WhenMock<Promise<void>, [string]>>();

  when(fooMock.syncNonVoid).calledWith('blah').mockReturnValue(42);
  when(fooMock.asyncNonVoid).calledWith('blah').mockResolvedValue(42);
  when(fooMock.syncVoid).calledWith('d').mockReturnValue();
  when(fooMock.asyncVoid).calledWith('d').mockResolvedValue();
}

// optional args
{
  const fn = jest.fn() as (arg1: string, arg2?: boolean) => number;

  expectTypeOf(when(fn)).toEqualTypeOf<WhenMock<number, [string, (boolean | undefined)?]>>();

  when(fn).calledWith('x').mockReturnValue(1);
  when(fn).calledWith('x', true).mockReturnValue(1);
  when(fn).expectCalledWith('x').mockReturnValue(1);
  when(fn).expectCalledWith('x', true).mockReturnValue(1);

  // @ts-expect-error wrong second arg type
  when(fn).calledWith('x', 'true').mockReturnValue(1);
  // @ts-expect-error extra arg
  when(fn).calledWith('x', true, false).mockReturnValue(1);
  // @ts-expect-error wrong first arg type
  when(fn).calledWith(1).mockReturnValue(1);

  // @ts-expect-error wrong second arg type
  when(fn).expectCalledWith('x', 'true').mockReturnValue(1);
  // @ts-expect-error extra arg
  when(fn).expectCalledWith('x', true, false).mockReturnValue(1);
  // @ts-expect-error wrong first arg type
  when(fn).expectCalledWith(1).mockReturnValue(1);
}

// mocked module
{
  when(fsp.readFile).calledWith('path/to/file').mockResolvedValue('file content');
  // @ts-expect-error wrong argument type
  when(fsp.readFile).calledWith(true).mockResolvedValue('file content');
  // @ts-expect-error wrong resolved value type
  when(fsp.readFile).calledWith('path/to/file').mockResolvedValue(42);

  when(fs.readFileSync).calledWith('path/to/file').mockReturnValue('file content');
  // @ts-expect-error wrong argument type
  when(fs.readFileSync).calledWith(true).mockReturnValue('file content');
  // @ts-expect-error wrong return type
  when(fs.readFileSync).calledWith('path/to/file').mockReturnValue(42);
}

// calledWith / expectCalledWith arg tuple contract
{
  const fn = jest.fn<number, [string, boolean]>();
  const secondIsTrue = when((value: boolean) => value === true);

  when(fn).calledWith('x', true).mockReturnValue(1);
  when(fn).expectCalledWith('x', true).mockReturnValue(1);
  when(fn).calledWith('x', expect.any(Boolean)).mockReturnValue(1);
  when(fn).expectCalledWith('x', expect.any(Boolean)).mockReturnValue(1);
  when(fn).calledWith('x', secondIsTrue).mockReturnValue(1);
  when(fn).expectCalledWith('x', secondIsTrue).mockReturnValue(1);

  // @ts-expect-error missing required second arg
  when(fn).calledWith('x').mockReturnValue(1);
  // @ts-expect-error extra arg
  when(fn).calledWith('x', true, false).mockReturnValue(1);
  // @ts-expect-error wrong second arg type
  when(fn).calledWith('x', 'true').mockReturnValue(1);
  // @ts-expect-error wrong second-arg matcher type
  when(fn).calledWith('x', when((value: string) => value.length > 0)).mockReturnValue(1);

  // @ts-expect-error missing required second arg
  when(fn).expectCalledWith('x').mockReturnValue(1);
  // @ts-expect-error extra arg
  when(fn).expectCalledWith('x', true, false).mockReturnValue(1);
  // @ts-expect-error wrong second arg type
  when(fn).expectCalledWith('x', 'true').mockReturnValue(1);
  // @ts-expect-error wrong second-arg matcher type
  when(fn).expectCalledWith('x', when((value: string) => value.length > 0)).mockReturnValue(1);
}

// matcher scenarios
{
  const fn = jest.fn<number, [string]>();
  const isNonEmpty = when((value: string) => value.length > 0);
  const allArgsNonEmpty = when.allArgs((args: [string]) => args[0].length > 0);

  expectTypeOf(isNonEmpty).toEqualTypeOf<WhenMock<boolean, [string]>>();
  expectTypeOf(allArgsNonEmpty).toEqualTypeOf<((args: [string], equals: jest.MatcherUtils['equals']) => boolean) & {
    _isAllArgsFunctionMatcher?: true;
    _isFunctionMatcher?: true;
  }>();
  expectTypeOf(when(fn).calledWith(allArgsNonEmpty)).toEqualTypeOf<WhenMockWithMatchers<number, [string]>>();
  expectTypeOf(when(fn).expectCalledWith(allArgsNonEmpty)).toEqualTypeOf<WhenMockWithMatchers<number, [string]>>();

  when(fn).calledWith(expect.any(String)).mockReturnValue(1);
  when(fn).calledWith(isNonEmpty).mockReturnValue(1);
  when(fn).expectCalledWith(isNonEmpty).mockReturnValue(1);
  when(fn).calledWith(allArgsNonEmpty).mockReturnValue(1);
  when(fn).expectCalledWith(allArgsNonEmpty).mockReturnValue(1);

  const wrongMatcherArgs = when((value: number) => value > 0);
  // @ts-expect-error function matcher has wrong arg type (number vs string)
  when(fn).calledWith(wrongMatcherArgs).mockReturnValue(1);

  const wrongMatcherReturn = when((value: string) => value.length);
  // @ts-expect-error function matcher has wrong return type (number vs boolean)
  when(fn).calledWith(wrongMatcherReturn).mockReturnValue(1);

  const wrongMatcherBoth = when((value: number) => value.toString());
  // @ts-expect-error function matcher has wrong arg and return types
  when(fn).calledWith(wrongMatcherBoth).mockReturnValue(1);

  const wrongAllArgsTuple = when.allArgs((args: [number]) => args[0] > 0);
  // @ts-expect-error allArgs matcher has wrong tuple type
  when(fn).calledWith(wrongAllArgsTuple).mockReturnValue(1);

  // @ts-expect-error allArgs matcher must return boolean
  const wrongAllArgsReturn = when.allArgs((args: [string]) => args[0].length);
  wrongAllArgsReturn;

  // @ts-expect-error allArgs matcher has wrong tuple and return types
  const wrongAllArgsBoth = when.allArgs((args: [number]) => args[0].toString());
  wrongAllArgsBoth;

  // @ts-expect-error allArgs must be the only matcher
  when(fn).calledWith(allArgsNonEmpty, 'x').mockReturnValue(1);
  // @ts-expect-error allArgs must be the only matcher
  when(fn).expectCalledWith(allArgsNonEmpty, 'x').mockReturnValue(1);
}

// allArgs on multi-arg tuples
{
  const fn = jest.fn<number, [string, boolean]>();
  const allArgsMatcher = when.allArgs((args: [string, boolean]) => args[0].length > 0 && args[1] === true);

  expectTypeOf(when(fn).calledWith(allArgsMatcher)).toEqualTypeOf<WhenMockWithMatchers<number, [string, boolean]>>();
  expectTypeOf(when(fn).expectCalledWith(allArgsMatcher)).toEqualTypeOf<WhenMockWithMatchers<number, [string, boolean]>>();

  when(fn).calledWith(allArgsMatcher).mockReturnValue(1);
  when(fn).expectCalledWith(allArgsMatcher).mockReturnValue(1);

  const wrongTuple = when.allArgs((args: [string, string]) => args[0].length > 0 && args[1].length > 0);
  // @ts-expect-error wrong allArgs tuple for [string, boolean]
  when(fn).calledWith(wrongTuple).mockReturnValue(1);
}

// rest / variadic args
{
  const allStrings = jest.fn() as (...args: string[]) => number;
  const headTail = jest.fn() as (head: string, ...tail: number[]) => number;

  when(allStrings).calledWith().mockReturnValue(1);
  when(allStrings).calledWith('a').mockReturnValue(1);
  when(allStrings).calledWith('a', 'b', 'c').mockReturnValue(1);
  // @ts-expect-error wrong variadic arg type
  when(allStrings).calledWith('a', 1).mockReturnValue(1);

  when(headTail).calledWith('a').mockReturnValue(1);
  when(headTail).calledWith('a', 1).mockReturnValue(1);
  when(headTail).calledWith('a', 1, 2, 3).mockReturnValue(1);
  // @ts-expect-error missing required head arg
  when(headTail).calledWith().mockReturnValue(1);
  // @ts-expect-error wrong head arg type
  when(headTail).calledWith(1).mockReturnValue(1);
  // @ts-expect-error wrong rest arg type
  when(headTail).calledWith('a', 1, 'b').mockReturnValue(1);
}

// implementation/default method signatures should use TArgs and TReturn
{
  const fn = jest.fn<string, [number]>();
  const w = when(fn);

  expectTypeOf(w.mockImplementation).parameter(0).toEqualTypeOf<(arg: number) => string>();
  expectTypeOf(w.mockImplementationOnce).parameter(0).toEqualTypeOf<((arg: number) => string) | undefined>();
  expectTypeOf(w.defaultImplementation).parameter(0).toEqualTypeOf<(arg: number) => string>();
  expectTypeOf(w.mockReturnValue).parameter(0).toEqualTypeOf<string>();
  expectTypeOf(w.mockReturnValueOnce).parameter(0).toEqualTypeOf<string>();
  expectTypeOf(w.defaultReturnValue).parameter(0).toEqualTypeOf<string>();

  // @ts-expect-error wrong implementation arg type
  w.mockImplementation((arg: string) => arg);
  // @ts-expect-error wrong implementation return type
  w.mockImplementation((arg: number) => arg);
  // @ts-expect-error wrong default implementation arg type
  w.defaultImplementation((arg: string) => arg);
}

{
  const fn = jest.fn<Promise<number>, [string]>();
  const w = when(fn);

  expectTypeOf(w.mockResolvedValue).parameter(0).toEqualTypeOf<jest.ResolvedValue<Promise<number>>>();
  expectTypeOf(w.mockResolvedValueOnce).parameter(0).toEqualTypeOf<jest.ResolvedValue<Promise<number>>>();
  expectTypeOf(w.defaultResolvedValue).parameter(0).toEqualTypeOf<jest.ResolvedValue<Promise<number>>>();
  expectTypeOf(w.mockRejectedValue).parameter(0).toEqualTypeOf<jest.RejectedValue<Promise<number>>>();
  expectTypeOf(w.mockRejectedValueOnce).parameter(0).toEqualTypeOf<jest.RejectedValue<Promise<number>>>();
  expectTypeOf(w.defaultRejectedValue).parameter(0).toEqualTypeOf<jest.RejectedValue<Promise<number>>>();
}

// void defaults and once variants
{
  const syncVoid = jest.fn() as () => void;
  const asyncVoid = jest.fn() as () => Promise<void>;

  when(syncVoid).defaultReturnValue();
  when(syncVoid).defaultReturnValue(undefined);
  // @ts-expect-error void default should not accept a non-void return value
  when(syncVoid).defaultReturnValue('blah');

  when(asyncVoid).defaultResolvedValue();
  when(asyncVoid).defaultResolvedValue(undefined);
  // @ts-expect-error Promise<void> default should not accept a non-void resolved value
  when(asyncVoid).defaultResolvedValue('blah');

  when(syncVoid).calledWith().mockReturnValueOnce();
  when(syncVoid).calledWith().mockReturnValueOnce(undefined);
  // @ts-expect-error void once should not accept a non-void return value
  when(syncVoid).calledWith().mockReturnValueOnce('blah');

  when(asyncVoid).calledWith().mockResolvedValueOnce();
  when(asyncVoid).calledWith().mockResolvedValueOnce(undefined);
  // @ts-expect-error Promise<void> once should not accept a non-void resolved value
  when(asyncVoid).calledWith().mockResolvedValueOnce('blah');
}

// chain return types
{
  const fn = jest.fn<number, [string]>();
  const w = when(fn);

  expectTypeOf(w.calledWith('x')).toEqualTypeOf<WhenMockWithMatchers<number, [string]>>();
  expectTypeOf(w.expectCalledWith('x')).toEqualTypeOf<WhenMockWithMatchers<number, [string]>>();
  expectTypeOf(w.mockReturnValue(1)).toEqualTypeOf<WhenMock<number, [string]> & WhenMockWithMatchers<number, [string]>>();
  expectTypeOf(w.mockReturnValueOnce(1)).toEqualTypeOf<WhenMock<number, [string]> & WhenMockWithMatchers<number, [string]>>();
  expectTypeOf(w.mockReset()).toEqualTypeOf<WhenMock<number, [string]>>();
}
