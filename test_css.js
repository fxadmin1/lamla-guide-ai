const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const fs = require('fs');

const inputCss = fs.readFileSync('src/app/globals.css', 'utf8');
postcss([tailwind()])
  .process(inputCss, { from: 'src/app/globals.css' })
  .then(res => {
    console.log('CSS transformed successfully! Length:', res.css.length);
    console.log('Has flex:', res.css.includes('.flex'));
    console.log('Has bg-blue-600:', res.css.includes('bg-blue-600'));
    console.log('Has text-3xl:', res.css.includes('text-3xl'));
  })
  .catch(err => console.error('Postcss error:', err));
