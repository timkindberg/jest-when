# jest-when

```
npm i --save-dev jest-when
```
A sugary way to mock return values for specific arguments only.

#### Basic usage:
```javascript
import { when } from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1).mockReturnValue('yay!');

const result = fn(1);
expect(result).toEqual('yay!');
```

#### Supports multiple args:
```javascript
import { when } from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1, true, 'foo').mockReturnValue('yay!');

const result = fn(1, true, 'foo');
expect(result).toEqual('yay!');
```

#### Supports jest matchers:
```javascript
import { when } from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(
  expect.anything(),
  expect.any(Number),
  expect.arrayContaining(false)
).mockReturnValue('yay!');

const result = fn('whatever', 100, [true, false]);
expect(result).toEqual('yay!');
```

#### Supports compound declarations:
```javascript
import { when } from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1).mockReturnValue('no');
when(fn).calledWith(2).mockReturnValue('way?');
when(fn).calledWith(3).mockReturnValue('yes');
when(fn).calledWith(4).mockReturnValue('way!');

expect(fn(1)).toEqual('no');
expect(fn(2)).toEqual('way?');
expect(fn(3)).toEqual('yes');
expect(fn(4)).toEqual('way!');
expect(fn(5)).toEqual(undefined);
```

#### Assert the args:

Use `expectCalledWith` instead to run an assertion that the `fn` was called with the provided args. Your test will fail if the jest mock function is ever called without those exact `expectCalledWith` params.

Disclaimer: This won't really work very well with compound declarations, because one of them will always fail, and throw an assertion error.
```javascript
import { when } from 'jest-when';

const fn = jest.fn();
when(fn).expectCalledWith(1).mockReturnValue('x');

fn(2); // Will throw a helpful jest assertion error with args diff
```

