import { equals } from 'expect/build/jasmine_utils';

export class WhenMock {
  constructor(fn, debug) {
    this.fn = fn;
    this.callMocks = [];
    this.debug = debug;
    this.log = (...args) => this.debug && console.log(...args);

    const mockReturnValue = (matchers, assertCall, once = false) => (val) => {
      this.callMocks.push({ matchers, val, assertCall, once });

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
            let removedOneItem = false;
            this.callMocks = this.callMocks.filter(mock => !(mock.once && equals(mock.matchers, matchers) && !removedOneItem & (removedOneItem = true)));
            return val;
          }
        }
      });
    };

    const mockResolvedValueOnce = (matchers, assertCall) => (val) =>
      mockReturnValueOnce(matchers, assertCall)(Promise.resolve(val));

    const mockResolvedValue = (matchers, assertCall) => (val) =>
      mockReturnValue(matchers, assertCall)(Promise.resolve(val));

    const mockReturnValueOnce = (matchers, assertCall) => (val) =>
      mockReturnValue(matchers, assertCall, true)(val);

    this.calledWith = (...matchers) => ({
      mockReturnValue: mockReturnValue(matchers, false),
      mockReturnValueOnce: mockReturnValueOnce(matchers, false),
      mockResolvedValue: mockResolvedValue(matchers, false),
      mockResolvedValueOnce: mockResolvedValueOnce(matchers, false)
    });

    this.expectCalledWith = (...matchers) => ({
      mockReturnValue: mockReturnValue(matchers, true),
      mockReturnValueOnce: mockReturnValueOnce(matchers, true),
      mockResolvedValue: mockResolvedValue(matchers, true),
      mockResolvedValueOnce: mockResolvedValueOnce(matchers, true)
    });
  }
}

export const when = (fn, { debug = false } = {}) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__;
  fn.__whenMock__ = new WhenMock(fn, debug);
  return fn.__whenMock__;
};
