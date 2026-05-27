// @ts-check
import ts from '@typed-sigterm/eslint-config';

export default ts({}, {
  files: ['./test/**'],
  rules: {
    'no-console': 'off',
  },
});
