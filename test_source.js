const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

const css = `@import "tailwindcss";
@source "../../src";
`;

postcss([tailwind()])
  .process(css, { from: 'src/app/globals.css' })
  .then(res => {
    console.log('Result length with @source:', res.css.length);
    console.log('Has .bg-blue-600:', res.css.includes('bg-blue-600'));
    console.log('Has .flex:', res.css.includes('.flex'));
    console.log('Has .grid:', res.css.includes('.grid'));
  })
  .catch(err => console.error('Error:', err));
