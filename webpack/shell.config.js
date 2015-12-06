require('babel/polyfill');

// Webpack config for creating the shell bundle.
var path = require('path');
var webpack = require('webpack');
var CleanPlugin = require('clean-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var strip = require('strip-loader');

var relativeAssetsPath = '../static/dist';
var assetsPath = path.join(__dirname, relativeAssetsPath);

module.exports = {
  entry: './shell/index.js',
  output: {
    path: __dirname + '/../bin',
    filename: 'shell.js',
    libraryTarget: 'commonjs2',
  },
  context: path.resolve(__dirname, '..'),
  target: 'node',
  externals: [
    // Every non-relative module is external
    /^[a-z\-0-9]+$/,
  ],
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/,
        loaders: [strip.loader('debug'), 'babel']},
        { test: /\.json$/, loader: 'json-loader' },
    ]
  },
  node: {
    console: true,
    global: false,
    process: false,
    Buffer: false,
    __filename: false,
    __dirname: false,
  },
  resolve: {
    modulesDirectories: [
      'src',
      'node_modules'
    ],
    extensions: ['', '.json', '.js']
  },
};
