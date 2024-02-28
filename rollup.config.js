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

import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const configurePlugins = ({module}) => {
  return [
    babel({
      babelHelpers: 'bundled',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              browsers: ['ie 11'],
            },
          },
        ],
      ],
    }),
    terser({
      module,
      mangle: true,
      compress: true,
    }),
  ];
};

const configs = [
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'esm',
      file: './dist/web-vitals.js',
    },
    plugins: configurePlugins({module: true}),
  },
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'umd',
      file: `./dist/web-vitals.umd.cjs`,
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false}),
  },
  {
    input: 'dist/modules/index.js',
    output: {
      format: 'iife',
      file: './dist/web-vitals.iife.js',
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false}),
  },
  {
    input: 'dist/modules/attribution/index.js',
    output: {
      format: 'esm',
      file: './dist/web-vitals.attribution.js',
    },
    plugins: configurePlugins({module: true}),
  },
  {
    input: 'dist/modules/attribution/index.js',
    output: {
      format: 'umd',
      file: `./dist/web-vitals.attribution.umd.cjs`,
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false}),
  },
  {
    input: 'dist/modules/attribution/index.js',
    output: {
      format: 'iife',
      file: './dist/web-vitals.attribution.iife.js',
      name: 'webVitals',
    },
    plugins: configurePlugins({module: false}),
  },
];

export default configs;
