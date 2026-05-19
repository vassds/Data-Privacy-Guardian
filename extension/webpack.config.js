const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/service_worker.ts',
    content: './src/content/dom_monitor.ts',
    popup: './src/popup/index.tsx',
    options: './src/options/index.tsx' // NEW: Options entry point
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'public/popup.html', to: 'popup.html' },
        { from: 'public/options.html', to: 'options.html' }, // NEW: Copy options HTML
        { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
        { from: '../core/pkg/dpg_core_bg.wasm', to: 'dpg_core_bg.wasm' }
      ]
    })
  ],
  experiments: {
    asyncWebAssembly: true
  }
};