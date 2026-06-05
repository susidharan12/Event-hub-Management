/** Tailwind config used to COMPILE a static CSS file for the Tailwind-based
 *  pages (booking, booking-success, checkin, payment). Scans HTML + JS so
 *  classes toggled from scripts are included too. Build:
 *    npx tailwindcss@3.4.16 -i tailwind.input.css -o Public/js/vendor/tailwind.css --minify
 */
module.exports = {
  content: [
    './Public/**/*.html',
    './Public/**/*.js',
    './index.html'
  ],
  theme: { extend: {} },
  plugins: []
};
