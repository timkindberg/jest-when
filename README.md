# jest-when

[![build status](https://travis-ci.org/timkindberg/jest-when.svg?branch=master)](https://travis-ci.org/timkindberg/jest-when)
[![codecov](https://codecov.io/gh/timkindberg/jest-when/branch/master/graph/badge.svg)](https://codecov.io/gh/timkindberg/jest-when)
[![GitHub license](https://img.shields.io/github/license/timkindberg/jest-when.svg)](https://github.com/timkindberg/jest-when/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/v/jest-when.svg)](https://www.npmjs.com/package/jest-when)
[![ThoughtWorks Tech Radar 2020 | Adopt](https://img.shields.io/badge/Tech%20Radar-Adopt-b3005d)](https://www.thoughtworks.com/radar/languages-and-frameworks?blipid=201911030)

Specify dynamic return values for specifically matched mocked function arguments. Flexible matchers. Feels like canonical jest syntax.

ThoughtWorks says:
> jest-when is a lightweight JavaScript library that complements Jest by matching mock function call arguments. Jest is a great tool for testing the stack; jest-when allows you to expect specific arguments for mock functions which enables you to write more robust unit tests of modules with many dependencies. It's easy to use and provides great support for multiple matchers, which is why our teams have made jest-when their default choice for mocking in this space.

### Introduction
`jest-when` allows you to use a set of the original
[Jest mock functions](https://facebook.github.io/jest/docs/en/mock-function-api) in order to train
your mocks only based on parameters your mocked function is called with.

#### An Example

So in jest if you want to mock a return value you would do:

```javascript
const fn = jest.fn()
fn.mockReturnValue('yay!')
```

But that will return "yay!" regardless of what arguments are send to the `fn`. If you want to change the return value
based on the arguments, you have to use `mockImplementation` and it can be a bit cumbersome.

`jest-when` makes this easy and fun!

```javascript
when(fn).calledWith(1).mockReturnValue('yay!')
```

Now, the mock function `fn` will behave as follows&mdash;assuming no other trainings took place:
* return `yay!` if called with `1` _as the only parameter_
* return `undefined` if called with _any parameters other_ than `1`

So the steps are:
```javascript
const fn = jest.fn()                    // 1) Start with any normal jest mock function
when(fn)                                // 2) Wrap it with when()
  .calledWith(/* any matchers here */)  // 3) Add your matchers with calledWith()
  .mockReturnValue(/* some value */)    // 4) Then use any of the normal set of jest mock functions
```

The supported set of mock functions is:
* `mockReturnValue`
* `mockReturnValueOnce`
* `mockResolvedValue`
* `mockResolvedValueOnce`
* `mockRejectedValue`
* `mockRejectedValueOnce`
* `mockImplementation`
* `mockImplementationOnce`

For extended usage see the examples below.

### Features

- Match literals: `1`, `true`, `"string"`, `/regex/`, `null`, etc
- Match objects or arrays: `{ foo: true }`, `[1, 2, 3]`
- Match [asymmetric matchers](https://jestjs.io/docs/en/expect#expectanything): expect.any(), expect.objectContaining(), expect.stringMatching(), etc
- Setup multiple matched calls with differing returns
- Chaining of mock trainings
- Replacement of mock trainings
- One-time trainings, removed after they are matched
- Promises, resolved or rejected
- Can also wrap jest.spyOn functions with when()
- Supports function matchers
- Setup a default behavior
- Supports resetting mocks between tests
- Supports verifying all whenMocks were called

### Usage Examples

#### Installation
```bash
npm i --save-dev jest-when
```

#### Basic usage:
```javascript
import { when } from 'jest-when'

const fn = jest.fn()
when(fn).calledWith(1).mockReturnValue('yay!')

expect(fn(1)).toEqual('yay!')
```

#### Supports chaining of mock trainings:
```javascript
when(fn)
  .calledWith(1).mockReturnValue('yay!')
  .calledWith(2).mockReturnValue('nay!')

expect(fn(1)).toEqual('yay!')
expect(fn(2)).toEqual('nay!')
```
Thanks to [@fkloes](https://github.com/fkloes).

```javascript
when(fn)
  .calledWith(1)
  .mockReturnValueOnce('yay!')
  .mockReturnValue('nay!')

expect(fn(1)).toEqual('yay!')
expect(fn(1)).toEqual('nay!')
```
Thanks to [@danielhusar](https://github.com/danielhusar).

#### Supports replacement of mock trainings:
```javascript
when(fn).calledWith(1).mockReturnValue('yay!')
expect(fn(1)).toEqual('yay!')

when(fn).calledWith(1).mockReturnValue('nay!')
expect(fn(1)).toEqual('nay!')
```
This replacement of the training only happens for mock functions _not_ ending in `*Once`.
Trainings like `mockReturnValueOnce` are removed after a matching function call anyway.

Thanks to [@fkloes](https://github.com/fkloes).

#### Supports training for single calls
```javascript
when(fn).calledWith(1, true, 'foo').mockReturnValueOnce('yay!')
when(fn).calledWith(1, true, 'foo').mockReturnValueOnce('nay!')

expect(fn(1, true, 'foo')).toEqual('yay!')
expect(fn(1, true, 'foo')).toEqual('nay!')
expect(fn(1, true, 'foo')).toBeUndefined()
```

#### Supports Promises, both resolved and rejected
```javascript
when(fn).calledWith(1).mockResolvedValue('yay!')
when(fn).calledWith(2).mockResolvedValueOnce('nay!')

await expect(fn(1)).resolves.toEqual('yay!')
await expect(fn(1)).resolves.toEqual('yay!')

await expect(fn(2)).resolves.toEqual('nay!')
expect(await fn(2)).toBeUndefined()


when(fn).calledWith(3).mockRejectedValue(new Error('oh no!'))
when(fn).calledWith(4).mockRejectedValueOnce(new Error('oh no, an error again!'))

await expect(fn(3)).rejects.toThrow('oh no!')
await expect(fn(3)).rejects.toThrow('oh no!')

await expect(fn(4)).rejects.toThrow('oh no, an error again!')
expect(await fn(4)).toBeUndefined()
```

#### Supports jest.spyOn:
```javascript
const theSpiedMethod = jest.spyOn(theInstance, 'theMethod');
when(theSpiedMethod)
  .calledWith(1)
  .mockReturnValue('mock');
const returnValue = theInstance.theMethod(1);
expect(returnValue).toBe('mock');
```

#### Supports jest [asymmetric matchers](https://jestjs.io/docs/en/expect#expectanything):

Use all the same asymmetric matchers available to the `toEqual()` assertion

```javascript
when(fn).calledWith(
  expect.anything(),
  expect.any(Number),
  expect.arrayContaining(false)
).mockReturnValue('yay!')

const result = fn('whatever', 100, [true, false])
expect(result).toEqual('yay!')
```

#### Supports function matchers:

Just wrap any regular function (cannot be a jest mock or spy!) with `when`.

The function will receive the arg and will be considered a match if the function returns true.

It works with both calledWith and expectCalledWith.

```javascript
const allValuesTrue = when((arg) => Object.values(arg).every(Boolean))
const numberDivisibleBy3 = when((arg) => arg % 3 === 0)

when(fn)
.calledWith(allValuesTrue, numberDivisibleBy3)
.mockReturnValue('yay!')

expect(fn({ foo: true, bar: true }, 9)).toEqual('yay!')
expect(fn({ foo: true, bar: false }, 9)).toEqual(undefined)
expect(fn({ foo: true, bar: false }, 13)).toEqual(undefined)
```

#### Supports compound declarations:
```javascript
when(fn).calledWith(1).mockReturnValue('no')
when(fn).calledWith(2).mockReturnValue('way?')
when(fn).calledWith(3).mockReturnValue('yes')
when(fn).calledWith(4).mockReturnValue('way!')

expect(fn(1)).toEqual('no')
expect(fn(2)).toEqual('way?')
expect(fn(3)).toEqual('yes')
expect(fn(4)).toEqual('way!')
expect(fn(5)).toEqual(undefined)
```

#### Supports matching or asserting against all of the arguments together using `when.allArgs`:

Pass a single special matcher, `when.allArgs`, if you'd like to handle all of the arguments 
with one function matcher. The function will receive all of the arguments as an array and you 
are responsible for returning true if they are a match, or false if not. The function also is
provided with the powerful `equals` utility from Jasmine.


This allows some convenient patterns:
- Less verbose for variable args where all need to be of a certain type or match (e.g. all numbers)
- Can be useful for partial matching, because you can assert just the first arg for example and ignore the rest

E.g. All args should be numbers:
```javascript
const areNumbers = (args, equals) => args.every(arg => equals(arg, expect.any(Number)))
when(fn).calledWith(when.allArgs(areNumbers)).mockReturnValue('yay!')

expect(fn(3, 6, 9)).toEqual('yay!')
expect(fn(3, 666)).toEqual('yay!')
expect(fn(-100, 2, 3.234234, 234, 90e3)).toEqual('yay!')
expect(fn(123, 'not a number')).toBeUndefined()
```

E.g. Single arg match:
```javascript
const argAtIndex = (index, matcher) => when.allArgs((args, equals) => equals(args[index], matcher))

when(fn).calledWith(argAtIndex(0, expect.any(Number))).mockReturnValue('yay!')

expect(fn(3, 6, 9)).toEqual('yay!')
expect(fn(3, 666)).toEqual('yay!')
expect(fn(-100, 2, 3.234234, 234, 90e3)).toEqual('yay!')
expect(fn(123, 'not a number')).toBeUndefined()
```

E.g. Partial match, only first defined matching args matter:
```javascript
const fn = jest.fn()
const partialArgs = (...argsToMatch) => when.allArgs((args, equals) => equals(args, expect.arrayContaining(argsToMatch)))

when(fn)
  .calledWith(partialArgs(1, 2, 3))
  .mockReturnValue('x')

expect(fn(1, 2, 3)).toEqual('x')
expect(fn(1, 2, 3, 4, 5, 6)).toEqual('x')
expect(fn(1, 2)).toBeUndefined()
expect(fn(1, 2, 4)).toBeUndefined()
```

#### Assert the args:

Use `expectCalledWith` instead to run an assertion that the `fn` was called with the provided
args. Your test will fail if the jest mock function is ever called without those exact
`expectCalledWith` params.

Disclaimer: This won't really work very well with compound declarations, because one of them will
always fail, and throw an assertion error.
```javascript
when(fn).expectCalledWith(1).mockReturnValue('x')

fn(2); // Will throw a helpful jest assertion error with args diff
```

#### Supports default behavior

Use any of `defaultReturnValue`, `defaultResolvedValue`, `defaultRejectedValue`, `defaultImplementation`
to set up a default behavior, which will serve as fallback if no matcher fits.

```javascript
when(fn)
  .calledWith('foo').mockReturnValue('special')
  .defaultReturnValue('default') // This line can be placed anywhere, doesn't have to be at the end

expect(fn('foo')).toEqual('special')
expect(fn('bar')).toEqual('default')
```

Or if you use any of `mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, `mockImplementation` directly on the object
before using `calledWith` it will also behave as a default fallback.

```javascript
// Same as above example
when(fn)
  .mockReturnValue('default')
  .calledWith('foo').mockReturnValue('special')

expect(fn('foo')).toEqual('special')
expect(fn('bar')).toEqual('default')
```

One idea is to set up a default implementation that throws an error if an improper call is made to the mock.

```javascript
when(fn)
  .calledWith(correctArgs)
  .mockReturnValue(expectedValue)
  .defaultImplementation(unsupportedCallError)

// A default implementation that fails your test
function unsupportedCallError(...args) {
  throw new Error(`Wrong args: ${JSON.stringify(args, null, 2)}`);
}
```

#### Supports custom mockImplementation

You could use this to call callbacks passed to your mock fn or other custom functionality.

```javascript
const cb = jest.fn()

when(fn).calledWith(cb).mockImplementation(callbackArg => callbackArg())

fn(cb)

expect(cb).toBeCalled()
```

Thanks to [@idan-at](https://github.com/idan-at).

#### Supports reseting mocks between tests

You could use this to prevent mocks from carrying state between tests or assertions.

```javascript
const { when, resetAllWhenMocks } = require('jest-when')
const fn = jest.fn()

// Test 1
when(fn).expectCalledWith(1).mockReturnValueOnce('x')
expect(fn(1)).toEqual('x')

resetAllWhenMocks()

// Test 2
when(fn).expectCalledWith(1).mockReturnValueOnce('z')
expect(fn(1)).toEqual('z')
```

Thanks to [@whoaa512](https://github.com/whoaa512).

#### Supports resetting individual mocks entirely or by matchers

You can reset a single mocked function by calling `mockReset` on the mock function.

```javascript
const fn = jest.fn()

when(fn).calledWith(1).mockReturnValue('yay!')
when(fn).calledWith(2).mockReturnValue('boo!')
fn.mockReset()

expect(fn(1)).toBeUndefined() // no mocks
expect(fn(2)).toBeUndefined() // no mocks
```

You can reset a single set of matchers by calling `mockReset` after `calledWith`. The matchers
passed to calledWith will be used to remove any existing `calledWith` trainings with the same mathers.

```javascript
const fn = jest.fn()

when(fn).calledWith(1, 2, 3).mockReturnValue('yay!')
when(fn).calledWith(2).mockReturnValue('boo!')

// Reset only the 1, 2, 3 mock call
when(fn).calledWith(1, 2, 3).mockReset()

expect(fn(1, 2, 3)).toBeUndefined() // no mock for 1, 2, 3
expect(fn(2)).toEqual('boo!') // success!
```

#### Supports verifying that all mocked functions were called

Call `verifyAllWhenMocksCalled` after your test to assert that all mocks were used.

```javascript
const { when, verifyAllWhenMocksCalled } = require('jest-when')
const fn = jest.fn()

when(fn).expectCalledWith(1).mockReturnValueOnce('x')

expect(fn(1)).toEqual('x')

verifyAllWhenMocksCalled() // passes
```

```javascript
const { when, verifyAllWhenMocksCalled } = require('jest-when')
const fn = jest.fn()

when(fn).expectCalledWith(1).mockReturnValueOnce('x')

verifyAllWhenMocksCalled() // fails
```

Thanks to [@roaclark](https://github.com/roaclark).


### Contributors (in order of contribution)
* [@timkindberg](https://github.com/timkindberg/) (original author)
* [@jonasholtkamp](https://github.com/jonasholtkamp) (forked @ https://github.com/jonasholtkamp/jest-when-xt)
> Many thanks to @jonasholtkamp. He forked this repo when I was inactive and stewarded several key features and bug fixes!
* [@fkloes](https://github.com/fkloes)
* [@danielhusar](https://github.com/danielhusar)
* [@idan-at](https://github.com/idan-at)
* [@whoaa512](https://github.com/whoaa512).
* [@roaclark](https://github.com/roaclark)

