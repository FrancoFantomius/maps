const noop = () => Promise.resolve();

const mockFs = new Proxy({}, {
  get(target, prop) {
    return noop;
  }
});

export default mockFs;
