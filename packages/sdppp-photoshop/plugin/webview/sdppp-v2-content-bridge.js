export { R, r, g, a, s, b, c, d, l, j, t } from './content.js';

const e = { Buffer: globalThis.Buffer };

function f(module) {
  if (Object.prototype.hasOwnProperty.call(module, '__esModule')) return module;
  const value = module.default;
  let result;
  if (typeof value === 'function') {
    result = function () {
      return this instanceof result
        ? Reflect.construct(value, arguments, this.constructor)
        : value.apply(this, arguments);
    };
    result.prototype = value.prototype;
  } else {
    result = {};
  }
  Object.defineProperty(result, '__esModule', { value: true });
  Object.keys(module).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(module, key);
    Object.defineProperty(result, key, descriptor.get ? descriptor : {
      enumerable: true,
      get: () => module[key],
    });
  });
  return result;
}

const _ = (loader) => loader();

export { e, f, _ };
