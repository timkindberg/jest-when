# jest-when

[![npm](https://img.shields.io/npm/v/jest-when.svg)](https://www.npmjs.com/package/jest-when)
[![license](https://img.shields.io/github/license/timkindberg/jest-when.svg)](https://github.com/timkindberg/jest-when/blob/master/LICENSE)

Train Jest mocks by argument list.

`jest-when` lets you keep Jest's familiar mock API while returning different values for different calls, without stuffing branching logic into `mockImplementation`.

## Table of contents

- [Why jest-when?](#why-jest-when)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Matchers](#matchers)
- [API reference](#api-reference)
- [TypeScript in v4](#typescript-in-v4)
- [Recipes](#recipes)
- [Contributors](#contributors)

## Why jest-when?

Plain Jest makes one thing easy:

```ts
const fn = jest.fn()
fn.mockReturnValue('yay!')
```

But that returns `'yay!'` no matter how `fn` is called.

If you want different behavior for different arguments, the usual alternative is a custom implementation with `if` statements inside your test. That works, but it gets noisy fast.

With `jest-when`:

```ts
import { when } from 'jest-when'

const fn = jest.fn()
when(fn).calledWith(1).mockReturnValue('yay!')
```

Now `fn(1)` returns `'yay!'`, and non-matching calls fall through to `undefined` unless you configure a default.

A good default mental model is:

- use `calledWith(...)` for the normal case
- use Jest asymmetric matchers when literals are too specific
- use `mockReturnValue*`, `mockResolvedValue*`, and `mockRejectedValue*` just like you already do in Jest
- use `default*` methods when you want a fallback
- use `expectCalledWith(...)` when unexpected calls should fail loudly
- use `when.allArgs(...)` for advanced matching across the entire argument list

## Installation

```bash
npm install --save-dev jest-when
```

### Compatibility

- Jest `>= 27`
- Works in both JavaScript and TypeScript projects
- Named imports are recommended:

```ts
import { when, resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when'
```

If you use CommonJS, `require('jest-when')` works too.

## Quick start

```ts
import { when } from 'jest-when'

const fn = jest.fn()

when(fn).calledWith(1).mockReturnValue('one')
when(fn).calledWith(2).mockReturnValue('two')

expect(fn(1)).toBe('one')
expect(fn(2)).toBe('two')
expect(fn(3)).toBeUndefined()
```

> [!IMPORTANT]
> `calledWith(...)` uses exact arity matching.
>
> `when(fn).calledWith(1)` matches `fn(1)`.
> It does **not** match `fn()`, `fn(1, 2)`, or `fn(1, undefined)`.

Async values work the same way:

```ts
const fetchUser = jest.fn()

when(fetchUser).calledWith(1).mockResolvedValue({ id: 1, role: 'admin' })
when(fetchUser).calledWith(2).mockRejectedValue(new Error('not found'))

await expect(fetchUser(1)).resolves.toEqual({ id: 1, role: 'admin' })
await expect(fetchUser(2)).rejects.toThrow('not found')
```

## Core concepts

### `when(fn)` wraps a Jest mock or spy

Start with any normal Jest mock function or spy, then train it:

```ts
const fn = jest.fn()

when(fn)
  .calledWith('hello')
  .mockReturnValue('world')
```

`when()` also supports `jest.spyOn(...)`:

```ts
const spy = jest.spyOn(api, 'fetchUser')

when(spy).calledWith(123).mockResolvedValue({ id: 123 })
```

### `calledWith(...)` trains a specific call

```ts
when(fn).calledWith(1, true, 'foo').mockReturnValue('yay!')
```

That training matches only that exact argument list.

### Trainings can be chained

```ts
when(fn)
  .calledWith(1).mockReturnValue('yay!')
  .calledWith(2).mockReturnValue('nay!')

expect(fn(1)).toBe('yay!')
expect(fn(2)).toBe('nay!')
```

### Later non-`Once` trainings replace earlier ones for the same matchers

```ts
when(fn).calledWith(1).mockReturnValue('old')
when(fn).calledWith(1).mockReturnValue('new')

expect(fn(1)).toBe('new')
```

### `*Once` trainings are queued and removed after use

```ts
when(fn)
  .calledWith(1)
  .mockReturnValueOnce('first')
  .mockReturnValue('later')

expect(fn(1)).toBe('first')
expect(fn(1)).toBe('later')
expect(fn(1)).toBe('later')
```

### Defaults are explicit in v3+ and still familiar in v4

The clearest way to add a fallback is with a `default*` method:

```ts
when(fn)
  .calledWith('foo').mockReturnValue('special')
  .defaultReturnValue('default')

expect(fn('foo')).toBe('special')
expect(fn('bar')).toBe('default')
```

You can place the default anywhere in the chain.

You can also set the fallback by calling a Jest-style method on the `when(fn)` chain before any `calledWith(...)`:

```ts
when(fn)
  .mockReturnValue('default')
  .calledWith('foo').mockReturnValue('special')
```

That behaves the same as `defaultReturnValue('default')`.

## Matchers

### Literals, objects, arrays, regexes, `null`, and friends

```ts
when(fn).calledWith(1).mockReturnValue('number')
when(fn).calledWith({ role: 'admin' }).mockReturnValue('object')
when(fn).calledWith([1, 2, 3]).mockReturnValue('array')
when(fn).calledWith(/abc/).mockReturnValue('regex')
when(fn).calledWith(null).mockReturnValue('null')
```

### Jest asymmetric matchers

Anything that works well with Jest's equality matching also works well here:

```ts
when(fn)
  .calledWith(
    expect.anything(),
    expect.any(Number),
    expect.objectContaining({ enabled: true })
  )
  .mockReturnValue('matched')
```

### Function matchers

Wrap a regular predicate function with `when(...)` to use it as an argument matcher.

```ts
const allValuesTrue = when((arg: Record<string, boolean>) => Object.values(arg).every(Boolean))
const divisibleBy3 = when((arg: number) => arg % 3 === 0)

when(fn)
  .calledWith(allValuesTrue, divisibleBy3)
  .mockReturnValue('yay!')

expect(fn({ a: true, b: true }, 9)).toBe('yay!')
expect(fn({ a: true, b: false }, 9)).toBeUndefined()
```

### `when.allArgs(...)`

Use `when.allArgs(...)` when matching one argument at a time is awkward and you want to evaluate the entire argument list at once.

```ts
const areNumberArgs = (args, equals) => args.every((arg) => equals(arg, expect.any(Number)));

when(fn).calledWith(when.allArgs(areNumberArgs)).mockReturnValue('all numbers')

expect(fn(3, 6, 9)).toBe('all numbers')
expect(fn(3, 666)).toBe('all numbers')
expect(fn(123, 'not a number')).toBeUndefined()
```

A handy partial-match pattern:

```ts
const firstArgMatches = (matcher: unknown) =>
  when.allArgs((args, equals) => equals(args[0], matcher))

when(fn).calledWith(firstArgMatches(expect.any(Number))).mockReturnValue('yay!')
```

> [!IMPORTANT]
> `when.allArgs(...)` must be the only matcher passed to `calledWith(...)` or `expectCalledWith(...)`.

## API reference

### Top-level exports

| Export | What it does |
| --- | --- |
| `when(fn)` | Wraps a Jest mock or spy so you can train behavior by arguments. |
| `when(matcherFn)` | Turns a regular predicate into a function matcher. |
| `when.allArgs(fn)` | Creates a matcher that receives the entire argument list at once. |
| `resetAllWhenMocks()` | Removes all `jest-when` trainings and restores original mock implementations. |
| `verifyAllWhenMocksCalled()` | Asserts that every configured training was matched at least once. |
| `WhenMock` | Exported for advanced usage and typing. Most users should not need to import it directly. |
| default export | Available for compatibility. Named imports are the recommended API. |

### Chain methods

#### Match a call

| Method | Purpose |
| --- | --- |
| `calledWith(...matchers)` | Train behavior for an exact argument list. |
| `expectCalledWith(...matchers)` | Like `calledWith`, but throws an assertion error if the mock is called with different args. |

#### Configure behavior for a matched call

| Method | Purpose |
| --- | --- |
| `mockReturnValue(value)` | Return a value for matching calls. |
| `mockReturnValueOnce(value)` | Return a value once for matching calls. |
| `mockResolvedValue(value)` | Resolve a promise for matching calls. |
| `mockResolvedValueOnce(value)` | Resolve a promise once for matching calls. |
| `mockRejectedValue(error)` | Reject a promise for matching calls. |
| `mockRejectedValueOnce(error)` | Reject a promise once for matching calls. |
| `mockImplementation(fn)` | Use a custom implementation for matching calls. |
| `mockImplementationOnce(fn?)` | Use a custom implementation once for matching calls. |

#### Configure fallback behavior

| Method | Purpose |
| --- | --- |
| `defaultReturnValue(value)` | Fallback return value when no training matches. |
| `defaultResolvedValue(value)` | Fallback resolved promise when no training matches. |
| `defaultRejectedValue(error)` | Fallback rejected promise when no training matches. |
| `defaultImplementation(fn)` | Fallback implementation when no training matches. |

#### Reset and verify

| Method | Purpose |
| --- | --- |
| `mockReset()` | Removes trainings for the current `calledWith(...)` / `expectCalledWith(...)` matcher set. |
| `resetWhenMocks()` | Removes all `jest-when` trainings for one mock or spy. |
| `resetAllWhenMocks()` | Removes all `jest-when` trainings across the entire test run. |
| `verifyAllWhenMocksCalled()` | Fails if any configured training was never matched. |

### Reset behavior at a glance

| Call | Effect |
| --- | --- |
| `fn.mockReset()` | Resets the underlying Jest mock and removes all `jest-when` trainings for that mock. |
| `when(fn).calledWith(1, 2, 3).mockReset()` | Removes only the training(s) for that exact matcher set. |
| `when(fn).resetWhenMocks()` | Removes all `jest-when` trainings for that one mock and restores its original implementation. |
| `resetAllWhenMocks()` | Removes all `jest-when` trainings across all wrapped mocks. |

### `expectCalledWith(...)`

`expectCalledWith(...)` is intentionally stricter than `calledWith(...)`:

```ts
when(fn).expectCalledWith(1).mockReturnValue('x')

fn(2) // throws a helpful Jest assertion error
```

It is best when you want the mock itself to fail loudly on unexpected calls.

It is less pleasant with lots of compound declarations, because one unmatched branch will still fail the assertion.

## TypeScript in v4

v4 is rewritten in TypeScript and has much better inference, while keeping the same core API shape.

Most of the time you should not need to import any `jest-when` types at all.

```ts
const getUser = jest.fn(async (id: number) => ({ id, name: 'original' }))

when(getUser).calledWith(1).mockResolvedValue({ id: 1, name: 'Ada' })

await expect(getUser(1)).resolves.toEqual({ id: 1, name: 'Ada' })
```

That inference also works well with common patterns such as:

- `jest.fn(...)`
- `jest.spyOn(...)`
- `jest.mocked(...)`
- mocked module functions
- cast/mock-library patterns such as `jest-mock-extended`
- optional arguments, variadic arguments, `void`, and async return types

In other words: the docs can stay simple because the types should mostly just follow along.

## Recipes

### Fail loudly on unexpected calls

A great default is one that throws:

```ts
when(fn)
  .calledWith('expected').mockReturnValue('ok')
  .defaultImplementation((...args) => {
    throw new Error(`Unexpected args: ${JSON.stringify(args)}`)
  })
```

### Call callbacks in a custom implementation

```ts
const callback = jest.fn()

when(fn)
  .calledWith(callback)
  .mockImplementation((cb) => cb())

fn(callback)

expect(callback).toHaveBeenCalled()
```

### Reset one matcher set without touching the rest

```ts
when(fn).calledWith(1, 2, 3).mockReturnValue('yay!')
when(fn).calledWith(2).mockReturnValue('boo!')

when(fn).calledWith(1, 2, 3).mockReset()

expect(fn(1, 2, 3)).toBeUndefined()
expect(fn(2)).toBe('boo!')
```

### Verify that every training was used

```ts
import { verifyAllWhenMocksCalled, when } from 'jest-when'

const fn = jest.fn()

when(fn).calledWith(1).mockReturnValue('x')

fn(1)
verifyAllWhenMocksCalled()
```

This checks that every configured training was matched at least once.

## Contributors

Created by [@timkindberg](https://github.com/timkindberg).

Many thanks to the people who helped shape and steward the project, especially:

- [@jonasholtkamp](https://github.com/jonasholtkamp)
- [@fkloes](https://github.com/fkloes)
- [@danielhusar](https://github.com/danielhusar)
- [@idan-at](https://github.com/idan-at)
- [@whoaa512](https://github.com/whoaa512)
- [@roaclark](https://github.com/roaclark)
- [@tlevesque-ueat](https://github.com/tlevesque-ueat)
