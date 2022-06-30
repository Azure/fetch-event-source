import * as fetch from "./fetch";

describe("fetch", () => {
  describe("fetchEventSource", () => {
    it("cannot create event source since there is no document", () => {
      fetch.fetchEventSource("http://localhost:3000", {}).catch((error) => {
        expect(error).toEqual(new ReferenceError("document is not defined"));
      });
    });

    it("cannot create event source since there is no window", () => {
      fetch
        .fetchEventSource("http://localhost:3000", { openWhenHidden: true })
        .catch((error) => {
          expect(error).toEqual(new ReferenceError("window is not defined"));
        });
    });

    it("can create event source", () => {
      const fetchStub = jasmine.createSpy();

      const promise = fetch.fetchEventSource("http://localhost:3000", {
        openWhenHidden: true,
        fetch: fetchStub,
      });
      expect(promise).toBeDefined();
    });
  });
});
