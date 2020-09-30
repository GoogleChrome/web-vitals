/*
 Copyright 2020 Google LLC
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import replace from '@rollup/plugin-replace';
import {terser} from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';

const configurePlugins = ({module, externalPolyfill = false}) => {
  return [
    babel({
      presets: [['@babel/preset-env', {
        targets: {
          browsers: ['ie 11'],
        },
      }]],
    }),
    terser({
      module,
      mangle: true,
      compress: true,
    }),
    replace({
      'self.__WEB_VITALS_EXTERNAL_POLYFILL__': externalPolyfill,
    })
  ]
}

const configs = [
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'esm',
      file: './dist/web-vitals.full.js',
    },
    plugins: configurePlugins({module: true, externalPolyfill: false}),
  },
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'umd',
      file: `./dist/web-vitals.full.umd.js`,
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false, externalPolyfill: false}),
  },
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'esm',
      file: './dist/web-vitals.external-polyfill.js',
    },
    plugins: configurePlugins({module: true, externalPolyfill: true}),
  },
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'umd',
      file: `./dist/web-vitals.external-polyfill.umd.js`,
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false, externalPolyfill: true}),
  },
  {
    input: 'dist/modules/polyfill.js',
    output: {
      format: 'iife',
      file: './dist/polyfill.js',
      name: 'webVitals',
      strict: false,
    },
    plugins: configurePlugins({module: false}),
  },
];

export default configs;
