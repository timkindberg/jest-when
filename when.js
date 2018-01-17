import { equals } from 'expect/build/jasmine_utils';
// import expect from 'expect';

export class WhenMock {
  constructor(fn) {
    this.fn = fn;
    this.debug = false;
    this.log = (...args) => this.debug && console.log(...args);
  }

  calledWith(...matchers) {
    this.log('calledWith', matchers);
    this.matchers = matchers;
    return this;
  }

  mockReturnValue(val) {
    this.log('mockReturn', val);
    this.fn.mockImplementation((...args) => {
      this.log('mocked impl', args);

      const match = this.matchers.reduce((match, matcher, i) => {
        this.log(`matcher check, match: ${match}, index: ${i}`);

        // Propagate failure to the end
        if (!match) {
          return false;
        }

        const arg = args[i];

        this.log(`   matcher: ${matcher}`);
        this.log(`   arg: ${arg}`);

        // Assert the match for better messaging during a failure
        expect(arg).toEqual(matcher);

        return equals(arg, matcher);
      }, true);

      if (match) {
        return val;
      }
    });
  }
}

const when = (fn) => {
  return new WhenMock(fn);
};

export default when;
