# jest-when

```
npm i --save-dev jest-when
```
A sugary way to mock return values for specific arguments only.

#### Basic usage:
```javascript
import when from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1).mockReturnValue('yay!');

const result = fn(1);
expect(result).toEqual('yay!');
```

#### Supports multiple args:
```javascript
import when from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1, true, 'foo').mockReturnValue('yay!');

const result = fn(1, true, 'foo');
expect(result).toEqual('yay!');
```

#### Supports jest matchers:
```javascript
import when from 'jest-when';

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
import when from 'jest-when';

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

#### Assert args for debugging:

Just pass `true` as second param to `.mockReturnValue(value, true)`. After that your test will fail if the jest mock function is ever called without those exact `calledWith` params.
```javascript
import when from 'jest-when';

const fn = jest.fn();
when(fn).calledWith(1).mockReturnValue('x');

fn(2); // Will throw a helpful jest assertion error with diff
```

