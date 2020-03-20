/*
 Copyright 2020 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import {terser} from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';

const baseOpts = {
  input: 'dist/web-vitals.js',
  watch: {
    clearScreen: false,
  },
};

export default [
  {
    ...baseOpts,
    output: {
      dir: './dist',
      format: 'esm',
      entryFileNames: 'web-vitals.min.js',
    },
    plugins: [
      terser({
        module: true,
        mangle: true,
        compress: true,
      }),
    ],
  },
  {
    ...baseOpts,
    output: {
      dir: './dist',
      format: 'umd',
      entryFileNames: 'web-vitals.umd.min.js',
      name: 'webVitals',
    },
    plugins: [
      babel({
        presets: [['@babel/preset-env', {
          targets: {
            browsers: ['ie 11'],
          },
        }]],
      }),
      terser({
        mangle: true,
        compress: true,
      }),
    ],
    watch: {
      clearScreen: false,
    },
  },
];
