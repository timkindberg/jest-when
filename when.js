import { equals } from 'expect/build/jasmine_utils';

export class WhenMock {
  constructor(fn) {
    this.fn = fn;
    this.callMocks = [];
    this.debug = false;
    this.log = (...args) => this.debug && console.log(...args);

    const mockReturnValue = (matchers, assertCall, limit = null) => (val) => {
      this.callMocks.push({ matchers, val, assertCall, limit });

      this.fn.mockImplementation((...args) => {
        this.log('mocked impl', args);

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, val, assertCall, limit } = this.callMocks[i];

          if (limit === 0) {
            continue;
          }

          if (limit !== null) {
            this.callMocks[i].limit = limit - 1;
          }

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

    this.calledWith = (...matchers) => ({
      mockReturnValue: mockReturnValue(matchers, false),
      mockReturnValueOnce: mockReturnValue(matchers, false, 1)
    });
    this.expectCalledWith = (...matchers) => ({
      mockReturnValue: mockReturnValue(matchers, true),
      mockReturnValueOnce: mockReturnValue(matchers, false, 1)
    });
  }
}

export const when = (fn) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__;
  fn.__whenMock__ = new WhenMock(fn);
  return fn.__whenMock__;
};
