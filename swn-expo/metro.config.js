const { getDefaultConfig } = require("expo/metro-config");
const { withMdx } = require("@bacons/mdx/metro");

const config = withMdx(getDefaultConfig(__dirname));

module.exports = config;