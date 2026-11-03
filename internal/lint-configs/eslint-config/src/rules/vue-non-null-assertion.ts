import type { Rule } from 'eslint';
import type { AST } from 'vue-eslint-parser';

/** Check both Vue template expressions and scripts; ordinary JS visitors miss templates. */
export const vueNonNullAssertion: Rule.RuleModule = {
  create(context) {
    const parserOptions = context.languageOptions.parserOptions ?? {};
    if (parserOptions.parser === false) {
      throw new TypeError(
        'Vue script parsing must remain enabled for SFC assertions',
      );
    }
    const visitor: Rule.RuleListener = {
      TSNonNullExpression(node: { loc?: AST.LocationRange | null }) {
        if (!node.loc)
          throw new TypeError('SFC assertion locations are required');
        context.report({ loc: node.loc, messageId: 'forbidden' });
      },
    };
    const services = context.sourceCode.parserServices;
    if (
      typeof services.defineTemplateBodyVisitor !== 'function' ||
      typeof services.getDocumentFragment !== 'function'
    ) {
      throw new TypeError(
        'Vue parser services are required for SFC assertions',
      );
    }
    const document: AST.VDocumentFragment | null | undefined =
      services.getDocumentFragment();
    if (
      !document ||
      document.type !== 'VDocumentFragment' ||
      !Array.isArray(document.children)
    ) {
      throw new TypeError(
        'Vue document parser services are required for SFC assertions',
      );
    }
    // Expression parser failures have no HTML error code. Vue's valid self-closing
    // elements also produce HTML notices, so do not reject all document.errors.
    if (document.errors.some((error) => error.code === undefined)) {
      throw new TypeError(
        'Vue template expression parsing must succeed for SFC assertions',
      );
    }
    for (const element of document.children) {
      if (
        element.type !== 'VElement' ||
        !['script', 'template'].includes(element.name)
      )
        continue;
      const attributes = element.startTag.attributes;
      const source = attributes.find(
        (attribute): attribute is AST.VAttribute =>
          !attribute.directive && attribute.key.name === 'src',
      );
      if (source) {
        throw new TypeError(
          'Vue script and template source attributes cannot be checked for SFC assertions',
        );
      }
      if (element.name !== 'template') continue;
      const language = attributes.find(
        (attribute): attribute is AST.VAttribute =>
          !attribute.directive && attribute.key.name === 'lang',
      )?.value?.value;
      if (language && language !== 'html') {
        const tokenizers = parserOptions.templateTokenizer;
        if (
          !tokenizers ||
          typeof tokenizers !== 'object' ||
          !Object.hasOwn(tokenizers, language) ||
          !Reflect.get(tokenizers, language)
        ) {
          throw new TypeError(
            'Non-HTML Vue templates require a tokenizer for SFC assertions',
          );
        }
      }
    }
    return services.defineTemplateBodyVisitor({ ...visitor }, visitor);
  },
  meta: {
    docs: {
      description:
        'Require explicit existence checks in Vue scripts and templates.',
    },
    messages: {
      forbidden:
        'Check this value explicitly instead of asserting that it exists.',
    },
    schema: [],
    type: 'problem',
  },
};
