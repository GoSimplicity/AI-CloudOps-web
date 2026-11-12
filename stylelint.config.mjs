export default {
  extends: ['@vben/stylelint-config'],
  overrides: [
    {
      files: ['*.css', '**/*.css'],
      rules: {
        // Vue SFCs already ignore `deep` / `global`. Plain CSS in this repo uses
        // the same Vue `<style>` deep combinator (`:deep()`), which stylelint's
        // CSS syntax does not know.
        'selector-pseudo-class-no-unknown': [
          true,
          {
            ignorePseudoClasses: ['global', 'deep'],
          },
        ],
      },
    },
  ],
  root: true,
  rules: {
    // recess-order rewrites shorthand/longhand order and can change the cascade.
    // Keep source order. See also the skipped autofix in #72.
    'order/properties-order': null,
  },
};
