const { override } = require('customize-cra');

const updateConfig = (config) => {
  config.output.path = `${__dirname}/build`;
  return config;
};

module.exports = override(updateConfig);