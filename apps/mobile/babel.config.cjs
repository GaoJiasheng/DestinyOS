module.exports = function (api) {
  // DESIGN-GAP: Jest's CommonJS VM cannot execute native import(); transform only tests, retaining Metro lazy loading.
  const test = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    plugins: test ? ['@babel/plugin-transform-dynamic-import'] : [],
  };
};
