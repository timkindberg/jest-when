# jest-when

[![build status](https://travis-ci.org/timkindberg/jest-when.svg?branch=master)](https://travis-ci.org/timkindberg/jest-when)
[![codecov](https://codecov.io/gh/timkindberg/jest-when/branch/master/graph/badge.svg)](https://codecov.io/gh/timkindberg/jest-when)
[![GitHub license](https://img.shields.io/github/license/timkindberg/jest-when.svg)](https://github.com/timkindberg/jest-when/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/v/jest-when.svg)](https://www.npmjs.com/package/jest-when)

An extended, sugary way to mock return values for specific arguments only

> Many thanks to @jonasholtkamp. He forked this repo when I was inactive and stewarded several key features and bug fixes!

### Features
`jest-when` allows you to use a set of the original
[Jest mock functions](https://facebook.github.io/jest/docs/en/mock-function-api) in order to train
your mocks only based on parameters your mocked function is called with.

An example statement would be as follows:

```javascript
when(fn).calledWith(1).mockReturnValue('yay!')
```

The trained mock function `fn` will now behave as follows -- assumed no other trainings took place:
* return `yay!` if called with `1` _as first parameter_
* return `undefined` if called with _any other first parameter_ than `1`

For extended usage see the examples below.

The supported set of mock functions is:
* `mockReturnValue`
* `mockReturnValueOnce`
* `mockResolvedValue`
* `mockResolvedValueOnce`
* `mockRejectedValue`
* `mockRejectedValueOnce`
* `mockImplementation`
* `mockImplementationOnce`

### Usage

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
This replacement of the training does only happen for mock functions _not_ ending in `*Once`.
Trainings like `mockReturnValueOnce` are removed after a matching function call anyway.

Thanks to [@fkloes](https://github.com/fkloes).

#### Supports multiple args with partial argument matching:
```javascript
when(fn).calledWith(1, true).mockReturnValue('yay!')

expect(fn(1, true)).toEqual('yay!')
expect(fn(1, true, 'foo')).toEqual('yay!')
```

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

#### Supports jest matchers:
```javascript
when(fn).calledWith(
  expect.anything(),
  expect.any(Number),
  expect.arrayContaining(false)
).mockReturnValue('yay!')

const result = fn('whatever', 100, [true, false])
expect(result).toEqual('yay!')
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

Use any of `mockReturnValue`, `mockResolvedValue` or `mockRejectedValue` directly on the object
to set up a default behavior, which will serve as fallback if no matcher fits.

```javascript
when(fn)
  .mockReturnValue('default')
  .calledWith('foo').mockReturnValue('special')

expect(fn('foo')).toEqual('special')
expect(fn('bar')).toEqual('default')
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

when(fn).expectCalledWith(1).mockReturnValueOnce('x')

expect(fn(1)).toEqual('x')

resetAllWhenMocks()

when(fn).expectCalledWith(1).mockReturnValueOnce('z')

expect(fn(1)).toEqual('z')
```

Thanks to [@whoaa512](https://github.com/whoaa512).

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
* [@fkloes](https://github.com/fkloes)
* [@danielhusar](https://github.com/danielhusar)
* [@idan-at](https://github.com/idan-at)
* [@whoaa512](https://github.com/whoaa512).
* [@roaclark](https://github.com/roaclark)

