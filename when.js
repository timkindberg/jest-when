import { equals } from 'expect/build/jasmine_utils';

export class WhenMock {
  constructor(fn) {
    this.fn = fn;
    this.callMocks = [];
    this.debug = false;
    this.log = (...args) => this.debug && console.log(...args);

    const mockReturnValue = (matchers, assertCall) => (val) => {
      this.callMocks.push({ matchers, val, assertCall });

      this.fn.mockImplementation((...args) => {
        this.log('mocked impl', args);

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, val, assertCall } = this.callMocks[i];
          const match = matchers.reduce((match, matcher, i) => {
            this.log(`matcher check, match: ${match}, index: ${i}`);

            // Propagate failure to the end
            if (!match) {
              return false;
            }

            const arg = args[i];

            this.log(`   matcher: ${matcher}`);
            this.log(`   arg: ${arg}`);

            // Assert the match for better messaging during a failure
            if (assertCall) {
              expect(arg).toEqual(matcher);
            }

            return equals(arg, matcher);
          }, true);

          if (match) {
            return val;
          }
        }
      });
    };

    this.calledWith = (...matchers) => ({ mockReturnValue: mockReturnValue(matchers, false) });
    this.expectCalledWith = (...matchers) => ({ mockReturnValue: mockReturnValue(matchers, true) });
  }
}

export const when = (fn) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__;
  fn.__whenMock__ = new WhenMock(fn);
  return fn.__whenMock__;
};
