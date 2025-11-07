'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _contextCompat = require('eslint-module-utils/contextCompat');
var _resolve = require('eslint-module-utils/resolve');var _resolve2 = _interopRequireDefault(_resolve);
var _semver = require('semver');var _semver2 = _interopRequireDefault(_semver);

var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}function _toArray(arr) {return Array.isArray(arr) ? arr : Array.from(arr);}

var typescriptPkg = void 0;
try {
  typescriptPkg = require('typescript/package.json'); // eslint-disable-line import/no-extraneous-dependencies
} catch (e) {/**/}

function isPunctuator(node, value) {
  return node.type === 'Punctuator' && node.value === value;
}

// Get the name of the default import of `node`, if any.
function getDefaultImportName(node) {
  var defaultSpecifier = node.specifiers.
  find(function (specifier) {return specifier.type === 'ImportDefaultSpecifier';});
  return defaultSpecifier != null ? defaultSpecifier.local.name : undefined;
}

// Checks whether `node` has a namespace import.
function hasNamespace(node) {
  var specifiers = node.specifiers.
  filter(function (specifier) {return specifier.type === 'ImportNamespaceSpecifier';});
  return specifiers.length > 0;
}

// Checks whether `node` has any non-default specifiers.
function hasSpecifiers(node) {
  var specifiers = node.specifiers.
  filter(function (specifier) {return specifier.type === 'ImportSpecifier';});
  return specifiers.length > 0;
}

// Checks whether `node` has a comment (that ends) on the previous line or on
// the same line as `node` (starts).
function hasCommentBefore(node, sourceCode) {
  return sourceCode.getCommentsBefore(node).
  some(function (comment) {return comment.loc.end.line >= node.loc.start.line - 1;});
}

// Checks whether `node` has a comment (that starts) on the same line as `node`
// (ends).
function hasCommentAfter(node, sourceCode) {
  return sourceCode.getCommentsAfter(node).
  some(function (comment) {return comment.loc.start.line === node.loc.end.line;});
}

// Checks whether `node` has any comments _inside,_ except inside the `{...}`
// part (if any).
function hasCommentInsideNonSpecifiers(node, sourceCode) {
  var tokens = sourceCode.getTokens(node);
  var openBraceIndex = tokens.findIndex(function (token) {return isPunctuator(token, '{');});
  var closeBraceIndex = tokens.findIndex(function (token) {return isPunctuator(token, '}');});
  // Slice away the first token, since we're no looking for comments _before_
  // `node` (only inside). If there's a `{...}` part, look for comments before
  // the `{`, but not before the `}` (hence the `+1`s).
  var someTokens = openBraceIndex >= 0 && closeBraceIndex >= 0 ?
  tokens.slice(1, openBraceIndex + 1).concat(tokens.slice(closeBraceIndex + 1)) :
  tokens.slice(1);
  return someTokens.some(function (token) {return sourceCode.getCommentsBefore(token).length > 0;});
}

// It's not obvious what the user wants to do with comments associated with
// duplicate imports, so skip imports with comments when autofixing.
function hasProblematicComments(node, sourceCode) {
  return (
    hasCommentBefore(node, sourceCode) ||
    hasCommentAfter(node, sourceCode) ||
    hasCommentInsideNonSpecifiers(node, sourceCode));

}

/** @type {(first: import('estree').ImportDeclaration, rest: import('estree').ImportDeclaration[], sourceCode: import('eslint').SourceCode.SourceCode, context: import('eslint').Rule.RuleContext) => import('eslint').Rule.ReportFixer | undefined} */
function getFix(first, rest, sourceCode, context) {
  // Sorry ESLint <= 3 users, no autofix for you. Autofixing duplicate imports
  // requires multiple `fixer.whatever()` calls in the `fix`: We both need to
  // update the first one, and remove the rest. Support for multiple
  // `fixer.whatever()` in a single `fix` was added in ESLint 4.1.
  // `sourceCode.getCommentsBefore` was added in 4.0, so that's an easy thing to
  // check for.
  if (typeof sourceCode.getCommentsBefore !== 'function') {
    return undefined;
  }

  // Adjusting the first import might make it multiline, which could break
  // `eslint-disable-next-line` comments and similar, so bail if the first
  // import has comments. Also, if the first import is `import * as ns from
  // './foo'` there's nothing we can do.
  if (hasProblematicComments(first, sourceCode) || hasNamespace(first)) {
    return undefined;
  }

  var defaultImportNames = new Set(
  [].concat(first, rest || []).flatMap(function (x) {return getDefaultImportName(x) || [];}));


  // Bail if there are multiple different default import names – it's up to the
  // user to choose which one to keep.
  if (defaultImportNames.size > 1) {
    return undefined;
  }

  // Leave it to the user to handle comments. Also skip `import * as ns from
  // './foo'` imports, since they cannot be merged into another import.
  var restWithoutComments = rest.filter(function (node) {return !hasProblematicComments(node, sourceCode) && !hasNamespace(node);});

  var specifiers = restWithoutComments.
  map(function (node) {
    var tokens = sourceCode.getTokens(node);
    var openBrace = tokens.find(function (token) {return isPunctuator(token, '{');});
    var closeBrace = tokens.find(function (token) {return isPunctuator(token, '}');});

    if (openBrace == null || closeBrace == null) {
      return undefined;
    }

    return {
      importNode: node,
      identifiers: sourceCode.text.slice(openBrace.range[1], closeBrace.range[0]).split(','), // Split the text into separate identifiers (retaining any whitespace before or after)
      isEmpty: !hasSpecifiers(node) };

  }).
  filter(function (x) {return !!x;});

  var unnecessaryImports = restWithoutComments.filter(function (node) {return !hasSpecifiers(node) &&
    !hasNamespace(node) &&
    !specifiers.some(function (specifier) {return specifier.importNode === node;});});


  var shouldAddDefault = getDefaultImportName(first) == null && defaultImportNames.size === 1;
  var shouldAddSpecifiers = specifiers.length > 0;
  var shouldRemoveUnnecessary = unnecessaryImports.length > 0;
  var preferInline = context.options[0] && context.options[0]['prefer-inline'];

  if (!(shouldAddDefault || shouldAddSpecifiers || shouldRemoveUnnecessary)) {
    return undefined;
  }

  /** @type {import('eslint').Rule.ReportFixer} */
  return function (fixer) {
    var tokens = sourceCode.getTokens(first);
    var openBrace = tokens.find(function (token) {return isPunctuator(token, '{');});
    var closeBrace = tokens.find(function (token) {return isPunctuator(token, '}');});
    var firstToken = sourceCode.getFirstToken(first);var _defaultImportNames = _slicedToArray(
    defaultImportNames, 1),defaultImportName = _defaultImportNames[0];

    var firstHasTrailingComma = closeBrace != null && isPunctuator(sourceCode.getTokenBefore(closeBrace), ',');
    var firstIsEmpty = !hasSpecifiers(first);
    var firstExistingIdentifiers = firstIsEmpty ?
    new Set() :
    new Set(sourceCode.text.slice(openBrace.range[1], closeBrace.range[0]).
    split(',').
    map(function (x) {return x.trim();}));var _specifiers$reduce =


    specifiers.reduce(
    function (_ref, specifier) {var _ref2 = _slicedToArray(_ref, 3),result = _ref2[0],needsComma = _ref2[1],existingIdentifiers = _ref2[2];
      var isTypeSpecifier = specifier.importNode.importKind === 'type';

      // a user might set prefer-inline but not have a supporting TypeScript version. Flow does not support inline types so this should fail in that case as well.
      if (preferInline && (!typescriptPkg || !_semver2['default'].satisfies(typescriptPkg.version, '>= 4.5'))) {
        throw new Error('Your version of TypeScript does not support inline type imports.');
      }

      // Add *only* the new identifiers that don't already exist, and track any new identifiers so we don't add them again in the next loop
      var _specifier$identifier = specifier.identifiers.reduce(function (_ref3, cur) {var _ref4 = _slicedToArray(_ref3, 2),text = _ref4[0],set = _ref4[1];
        var trimmed = cur.trim(); // Trim whitespace before/after to compare to our set of existing identifiers
        var curWithType = trimmed.length > 0 && preferInline && isTypeSpecifier ? 'type ' + String(cur) : cur;
        if (existingIdentifiers.has(trimmed)) {
          return [text, set];
        }
        return [text.length > 0 ? String(text) + ',' + String(curWithType) : curWithType, set.add(trimmed)];
      }, ['', existingIdentifiers]),_specifier$identifier2 = _slicedToArray(_specifier$identifier, 2),specifierText = _specifier$identifier2[0],updatedExistingIdentifiers = _specifier$identifier2[1];

      return [
      needsComma && !specifier.isEmpty && specifierText.length > 0 ? String(
      result) + ',' + String(specifierText) : '' + String(
      result) + String(specifierText),
      specifier.isEmpty ? needsComma : true,
      updatedExistingIdentifiers];

    },
    ['', !firstHasTrailingComma && !firstIsEmpty, firstExistingIdentifiers]),_specifiers$reduce2 = _slicedToArray(_specifiers$reduce, 1),specifiersText = _specifiers$reduce2[0];


    /** @type {import('eslint').Rule.Fix[]} */
    var fixes = [];

    if (shouldAddSpecifiers && preferInline && first.importKind === 'type') {
      // `import type {a} from './foo'` → `import {type a} from './foo'`
      var typeIdentifierToken = tokens.find(function (token) {return token.type === 'Identifier' && token.value === 'type';});
      fixes.push(fixer.removeRange([typeIdentifierToken.range[0], typeIdentifierToken.range[1] + 1]));

      tokens.
      filter(function (token) {return firstExistingIdentifiers.has(token.value);}).
      forEach(function (identifier) {
        fixes.push(fixer.replaceTextRange([identifier.range[0], identifier.range[1]], 'type ' + String(identifier.value)));
      });
    }

    if (shouldAddDefault && openBrace == null && shouldAddSpecifiers) {
      // `import './foo'` → `import def, {...} from './foo'`
      fixes.push(
      fixer.insertTextAfter(firstToken, ' ' + String(defaultImportName) + ', {' + String(specifiersText) + '} from'));

    } else if (shouldAddDefault && openBrace == null && !shouldAddSpecifiers) {
      // `import './foo'` → `import def from './foo'`
      fixes.push(fixer.insertTextAfter(firstToken, ' ' + String(defaultImportName) + ' from'));
    } else if (shouldAddDefault && openBrace != null && closeBrace != null) {
      // `import {...} from './foo'` → `import def, {...} from './foo'`
      fixes.push(fixer.insertTextAfter(firstToken, ' ' + String(defaultImportName) + ','));
      if (shouldAddSpecifiers) {
        // `import def, {...} from './foo'` → `import def, {..., ...} from './foo'`
        fixes.push(fixer.insertTextBefore(closeBrace, specifiersText));
      }
    } else if (!shouldAddDefault && openBrace == null && shouldAddSpecifiers) {
      if (first.specifiers.length === 0) {
        // `import './foo'` → `import {...} from './foo'`
        fixes.push(fixer.insertTextAfter(firstToken, ' {' + String(specifiersText) + '} from'));
      } else {
        // `import def from './foo'` → `import def, {...} from './foo'`
        fixes.push(fixer.insertTextAfter(first.specifiers[0], ', {' + String(specifiersText) + '}'));
      }
    } else if (!shouldAddDefault && openBrace != null && closeBrace != null) {
      // `import {...} './foo'` → `import {..., ...} from './foo'`
      fixes.push(fixer.insertTextBefore(closeBrace, specifiersText));
    }

    // Remove imports whose specifiers have been moved into the first import.
    specifiers.forEach(function (specifier) {
      var importNode = specifier.importNode;
      fixes.push(fixer.remove(importNode));

      var charAfterImportRange = [importNode.range[1], importNode.range[1] + 1];
      var charAfterImport = sourceCode.text.substring(charAfterImportRange[0], charAfterImportRange[1]);
      if (charAfterImport === '\n') {
        fixes.push(fixer.removeRange(charAfterImportRange));
      }
    });

    // Remove imports whose default import has been moved to the first import,
    // and side-effect-only imports that are unnecessary due to the first
    // import.
    unnecessaryImports.forEach(function (node) {
      fixes.push(fixer.remove(node));

      var charAfterImportRange = [node.range[1], node.range[1] + 1];
      var charAfterImport = sourceCode.text.substring(charAfterImportRange[0], charAfterImportRange[1]);
      if (charAfterImport === '\n') {
        fixes.push(fixer.removeRange(charAfterImportRange));
      }
    });

    return fixes;
  };
}

/** @type {(imported: Map<string, import('estree').ImportDeclaration[]>, context: import('eslint').Rule.RuleContext) => void} */
function checkImports(imported, context) {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
    for (var _iterator = imported.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _ref5 = _step.value;var _ref6 = _slicedToArray(_ref5, 2);var _module = _ref6[0];var nodes = _ref6[1];
      if (nodes.length > 1) {(function () {
          var message = '\'' + String(_module) + '\' imported multiple times.';var _nodes = _toArray(
          nodes),first = _nodes[0],rest = _nodes.slice(1);
          var sourceCode = (0, _contextCompat.getSourceCode)(context);
          var fix = getFix(first, rest, sourceCode, context);

          context.report({
            node: first.source,
            message: message,
            fix: fix // Attach the autofix (if any) to the first import.
          });

          rest.forEach(function (node) {
            context.report({
              node: node.source,
              message: message });

          });})();
      }
    }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      category: 'Style guide',
      description: 'Forbid repeated import of the same module in multiple places.',
      url: (0, _docsUrl2['default'])('no-duplicates') },

    fixable: 'code',
    schema: [
    {
      type: 'object',
      properties: {
        considerQueryString: {
          type: 'boolean' },

        'prefer-inline': {
          type: 'boolean' } },


      additionalProperties: false }] },




  /** @param {import('eslint').Rule.RuleContext} context */
  create: function () {function create(context) {
      /** @type {boolean} */
      // Prepare the resolver from options.
      var considerQueryStringOption = context.options[0] && context.options[0].considerQueryString;
      /** @type {boolean} */
      var preferInline = context.options[0] && context.options[0]['prefer-inline'];
      var defaultResolver = function () {function defaultResolver(sourcePath) {return (0, _resolve2['default'])(sourcePath, context) || sourcePath;}return defaultResolver;}();
      var resolver = considerQueryStringOption ? function (sourcePath) {
        var parts = sourcePath.match(/^([^?]*)\?(.*)$/);
        if (!parts) {
          return defaultResolver(sourcePath);
        }
        return String(defaultResolver(parts[1])) + '?' + String(parts[2]);
      } : defaultResolver;

      /** @type {Map<unknown, { imported: Map<string, import('estree').ImportDeclaration[]>, nsImported: Map<string, import('estree').ImportDeclaration[]>, defaultTypesImported: Map<string, import('estree').ImportDeclaration[]>, namedTypesImported: Map<string, import('estree').ImportDeclaration[]>}>} */
      var moduleMaps = new Map();

      /** @param {import('estree').ImportDeclaration} n */
      /** @returns {typeof moduleMaps[keyof typeof moduleMaps]} */
      function getImportMap(n) {
        if (!moduleMaps.has(n.parent)) {
          moduleMaps.set(n.parent, /** @type {typeof moduleMaps} */{
            imported: new Map(),
            nsImported: new Map(),
            defaultTypesImported: new Map(),
            namedTypesImported: new Map() });

        }
        var map = moduleMaps.get(n.parent);
        if (!preferInline && n.importKind === 'type') {
          return n.specifiers.length > 0 && n.specifiers[0].type === 'ImportDefaultSpecifier' ? map.defaultTypesImported : map.namedTypesImported;
        }
        if (!preferInline && n.specifiers.some(function (spec) {return spec.importKind === 'type';})) {
          return map.namedTypesImported;
        }

        return hasNamespace(n) ? map.nsImported : map.imported;
      }

      return {
        /** @param {import('estree').ImportDeclaration} n */
        ImportDeclaration: function () {function ImportDeclaration(n) {
            /** @type {string} */
            // resolved path will cover aliased duplicates
            var resolvedPath = resolver(n.source.value);
            var importMap = getImportMap(n);

            if (importMap.has(resolvedPath)) {
              importMap.get(resolvedPath).push(n);
            } else {
              importMap.set(resolvedPath, [n]);
            }
          }return ImportDeclaration;}(),

        'Program:exit': function () {function ProgramExit() {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
              for (var _iterator2 = moduleMaps.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var map = _step2.value;
                checkImports(map.imported, context);
                checkImports(map.nsImported, context);
                checkImports(map.defaultTypesImported, context);
                checkImports(map.namedTypesImported, context);
              }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2['return']) {_iterator2['return']();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
          }return ProgramExit;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby1kdXBsaWNhdGVzLmpzIl0sIm5hbWVzIjpbInR5cGVzY3JpcHRQa2ciLCJyZXF1aXJlIiwiZSIsImlzUHVuY3R1YXRvciIsIm5vZGUiLCJ2YWx1ZSIsInR5cGUiLCJnZXREZWZhdWx0SW1wb3J0TmFtZSIsImRlZmF1bHRTcGVjaWZpZXIiLCJzcGVjaWZpZXJzIiwiZmluZCIsInNwZWNpZmllciIsImxvY2FsIiwibmFtZSIsInVuZGVmaW5lZCIsImhhc05hbWVzcGFjZSIsImZpbHRlciIsImxlbmd0aCIsImhhc1NwZWNpZmllcnMiLCJoYXNDb21tZW50QmVmb3JlIiwic291cmNlQ29kZSIsImdldENvbW1lbnRzQmVmb3JlIiwic29tZSIsImNvbW1lbnQiLCJsb2MiLCJlbmQiLCJsaW5lIiwic3RhcnQiLCJoYXNDb21tZW50QWZ0ZXIiLCJnZXRDb21tZW50c0FmdGVyIiwiaGFzQ29tbWVudEluc2lkZU5vblNwZWNpZmllcnMiLCJ0b2tlbnMiLCJnZXRUb2tlbnMiLCJvcGVuQnJhY2VJbmRleCIsImZpbmRJbmRleCIsInRva2VuIiwiY2xvc2VCcmFjZUluZGV4Iiwic29tZVRva2VucyIsInNsaWNlIiwiY29uY2F0IiwiaGFzUHJvYmxlbWF0aWNDb21tZW50cyIsImdldEZpeCIsImZpcnN0IiwicmVzdCIsImNvbnRleHQiLCJkZWZhdWx0SW1wb3J0TmFtZXMiLCJTZXQiLCJmbGF0TWFwIiwieCIsInNpemUiLCJyZXN0V2l0aG91dENvbW1lbnRzIiwibWFwIiwib3BlbkJyYWNlIiwiY2xvc2VCcmFjZSIsImltcG9ydE5vZGUiLCJpZGVudGlmaWVycyIsInRleHQiLCJyYW5nZSIsInNwbGl0IiwiaXNFbXB0eSIsInVubmVjZXNzYXJ5SW1wb3J0cyIsInNob3VsZEFkZERlZmF1bHQiLCJzaG91bGRBZGRTcGVjaWZpZXJzIiwic2hvdWxkUmVtb3ZlVW5uZWNlc3NhcnkiLCJwcmVmZXJJbmxpbmUiLCJvcHRpb25zIiwiZml4ZXIiLCJmaXJzdFRva2VuIiwiZ2V0Rmlyc3RUb2tlbiIsImRlZmF1bHRJbXBvcnROYW1lIiwiZmlyc3RIYXNUcmFpbGluZ0NvbW1hIiwiZ2V0VG9rZW5CZWZvcmUiLCJmaXJzdElzRW1wdHkiLCJmaXJzdEV4aXN0aW5nSWRlbnRpZmllcnMiLCJ0cmltIiwicmVkdWNlIiwicmVzdWx0IiwibmVlZHNDb21tYSIsImV4aXN0aW5nSWRlbnRpZmllcnMiLCJpc1R5cGVTcGVjaWZpZXIiLCJpbXBvcnRLaW5kIiwic2VtdmVyIiwic2F0aXNmaWVzIiwidmVyc2lvbiIsIkVycm9yIiwiY3VyIiwic2V0IiwidHJpbW1lZCIsImN1cldpdGhUeXBlIiwiaGFzIiwiYWRkIiwic3BlY2lmaWVyVGV4dCIsInVwZGF0ZWRFeGlzdGluZ0lkZW50aWZpZXJzIiwic3BlY2lmaWVyc1RleHQiLCJmaXhlcyIsInR5cGVJZGVudGlmaWVyVG9rZW4iLCJwdXNoIiwicmVtb3ZlUmFuZ2UiLCJmb3JFYWNoIiwiaWRlbnRpZmllciIsInJlcGxhY2VUZXh0UmFuZ2UiLCJpbnNlcnRUZXh0QWZ0ZXIiLCJpbnNlcnRUZXh0QmVmb3JlIiwicmVtb3ZlIiwiY2hhckFmdGVySW1wb3J0UmFuZ2UiLCJjaGFyQWZ0ZXJJbXBvcnQiLCJzdWJzdHJpbmciLCJjaGVja0ltcG9ydHMiLCJpbXBvcnRlZCIsImVudHJpZXMiLCJtb2R1bGUiLCJub2RlcyIsIm1lc3NhZ2UiLCJmaXgiLCJyZXBvcnQiLCJzb3VyY2UiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJjYXRlZ29yeSIsImRlc2NyaXB0aW9uIiwidXJsIiwiZml4YWJsZSIsInNjaGVtYSIsInByb3BlcnRpZXMiLCJjb25zaWRlclF1ZXJ5U3RyaW5nIiwiYWRkaXRpb25hbFByb3BlcnRpZXMiLCJjcmVhdGUiLCJjb25zaWRlclF1ZXJ5U3RyaW5nT3B0aW9uIiwiZGVmYXVsdFJlc29sdmVyIiwic291cmNlUGF0aCIsInJlc29sdmVyIiwicGFydHMiLCJtYXRjaCIsIm1vZHVsZU1hcHMiLCJNYXAiLCJnZXRJbXBvcnRNYXAiLCJuIiwicGFyZW50IiwibnNJbXBvcnRlZCIsImRlZmF1bHRUeXBlc0ltcG9ydGVkIiwibmFtZWRUeXBlc0ltcG9ydGVkIiwiZ2V0Iiwic3BlYyIsIkltcG9ydERlY2xhcmF0aW9uIiwicmVzb2x2ZWRQYXRoIiwiaW1wb3J0TWFwIiwidmFsdWVzIl0sIm1hcHBpbmdzIjoicW9CQUFBO0FBQ0Esc0Q7QUFDQSxnQzs7QUFFQSxxQzs7QUFFQSxJQUFJQSxzQkFBSjtBQUNBLElBQUk7QUFDRkEsa0JBQWdCQyxRQUFRLHlCQUFSLENBQWhCLENBREUsQ0FDa0Q7QUFDckQsQ0FGRCxDQUVFLE9BQU9DLENBQVAsRUFBVSxDQUFFLElBQU07O0FBRXBCLFNBQVNDLFlBQVQsQ0FBc0JDLElBQXRCLEVBQTRCQyxLQUE1QixFQUFtQztBQUNqQyxTQUFPRCxLQUFLRSxJQUFMLEtBQWMsWUFBZCxJQUE4QkYsS0FBS0MsS0FBTCxLQUFlQSxLQUFwRDtBQUNEOztBQUVEO0FBQ0EsU0FBU0Usb0JBQVQsQ0FBOEJILElBQTlCLEVBQW9DO0FBQ2xDLE1BQU1JLG1CQUFtQkosS0FBS0ssVUFBTDtBQUN0QkMsTUFEc0IsQ0FDakIsVUFBQ0MsU0FBRCxVQUFlQSxVQUFVTCxJQUFWLEtBQW1CLHdCQUFsQyxFQURpQixDQUF6QjtBQUVBLFNBQU9FLG9CQUFvQixJQUFwQixHQUEyQkEsaUJBQWlCSSxLQUFqQixDQUF1QkMsSUFBbEQsR0FBeURDLFNBQWhFO0FBQ0Q7O0FBRUQ7QUFDQSxTQUFTQyxZQUFULENBQXNCWCxJQUF0QixFQUE0QjtBQUMxQixNQUFNSyxhQUFhTCxLQUFLSyxVQUFMO0FBQ2hCTyxRQURnQixDQUNULFVBQUNMLFNBQUQsVUFBZUEsVUFBVUwsSUFBVixLQUFtQiwwQkFBbEMsRUFEUyxDQUFuQjtBQUVBLFNBQU9HLFdBQVdRLE1BQVgsR0FBb0IsQ0FBM0I7QUFDRDs7QUFFRDtBQUNBLFNBQVNDLGFBQVQsQ0FBdUJkLElBQXZCLEVBQTZCO0FBQzNCLE1BQU1LLGFBQWFMLEtBQUtLLFVBQUw7QUFDaEJP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LEVBQWxCLENBQXJCLEVBQThFO0FBQzVFLGlCQUFPN0IsSUFBSTBGLGtCQUFYO0FBQ0Q7O0FBRUQsZUFBTzlILGFBQWEwSCxDQUFiLElBQWtCdEYsSUFBSXdGLFVBQXRCLEdBQW1DeEYsSUFBSXlELFFBQTlDO0FBQ0Q7O0FBRUQsYUFBTztBQUNMO0FBQ0FvQyx5QkFGSywwQ0FFYVAsQ0FGYixFQUVnQjtBQUNuQjtBQUNBO0FBQ0EsZ0JBQU1RLGVBQWVkLFNBQVNNLEVBQUV0QixNQUFGLENBQVM5RyxLQUFsQixDQUFyQjtBQUNBLGdCQUFNNkksWUFBWVYsYUFBYUMsQ0FBYixDQUFsQjs7QUFFQSxnQkFBSVMsVUFBVXpELEdBQVYsQ0FBY3dELFlBQWQsQ0FBSixFQUFpQztBQUMvQkMsd0JBQVVKLEdBQVYsQ0FBY0csWUFBZCxFQUE0QmpELElBQTVCLENBQWlDeUMsQ0FBakM7QUFDRCxhQUZELE1BRU87QUFDTFMsd0JBQVU1RCxHQUFWLENBQWMyRCxZQUFkLEVBQTRCLENBQUNSLENBQUQsQ0FBNUI7QUFDRDtBQUNGLFdBYkk7O0FBZUwsc0JBZkssc0NBZVk7QUFDZixvQ0FBa0JILFdBQVdhLE1BQVgsRUFBbEIsbUlBQXVDLEtBQTVCaEcsR0FBNEI7QUFDckN3RCw2QkFBYXhELElBQUl5RCxRQUFqQixFQUEyQmhFLE9BQTNCO0FBQ0ErRCw2QkFBYXhELElBQUl3RixVQUFqQixFQUE2Qi9GLE9BQTdCO0FBQ0ErRCw2QkFBYXhELElBQUl5RixvQkFBakIsRUFBdUNoRyxPQUF2QztBQUNBK0QsNkJBQWF4RCxJQUFJMEYsa0JBQWpCLEVBQXFDakcsT0FBckM7QUFDRCxlQU5jO0FBT2hCLFdBdEJJLHdCQUFQOztBQXdCRCxLQTFGYyxtQkFBakIiLCJmaWxlIjoibm8tZHVwbGljYXRlcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldFNvdXJjZUNvZGUgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2NvbnRleHRDb21wYXQnO1xuaW1wb3J0IHJlc29sdmUgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlJztcbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCc7XG5cbmxldCB0eXBlc2NyaXB0UGtnO1xudHJ5IHtcbiAgdHlwZXNjcmlwdFBrZyA9IHJlcXVpcmUoJ3R5cGVzY3JpcHQvcGFja2FnZS5qc29uJyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgaW1wb3J0L25vLWV4dHJhbmVvdXMtZGVwZW5kZW5jaWVzXG59IGNhdGNoIChlKSB7IC8qKi8gfVxuXG5mdW5jdGlvbiBpc1B1bmN0dWF0b3Iobm9kZSwgdmFsdWUpIHtcbiAgcmV0dXJuIG5vZGUudHlwZSA9PT0gJ1B1bmN0dWF0b3InICYmIG5vZGUudmFsdWUgPT09IHZhbHVlO1xufVxuXG4vLyBHZXQgdGhlIG5hbWUgb2YgdGhlIGRlZmF1bHQgaW1wb3J0IG9mIGBub2RlYCwgaWYgYW55LlxuZnVuY3Rpb24gZ2V0RGVmYXVsdEltcG9ydE5hbWUobm9kZSkge1xuICBjb25zdCBkZWZhdWx0U3BlY2lmaWVyID0gbm9kZS5zcGVjaWZpZXJzXG4gICAgLmZpbmQoKHNwZWNpZmllcikgPT4gc3BlY2lmaWVyLnR5cGUgPT09ICdJbXBvcnREZWZhdWx0U3BlY2lmaWVyJyk7XG4gIHJldHVybiBkZWZhdWx0U3BlY2lmaWVyICE9IG51bGwgPyBkZWZhdWx0U3BlY2lmaWVyLmxvY2FsLm5hbWUgOiB1bmRlZmluZWQ7XG59XG5cbi8vIENoZWNrcyB3aGV0aGVyIGBub2RlYCBoYXMgYSBuYW1lc3BhY2UgaW1wb3J0LlxuZnVuY3Rpb24gaGFzTmFtZXNwYWNlKG5vZGUpIHtcbiAgY29uc3Qgc3BlY2lmaWVycyA9IG5vZGUuc3BlY2lmaWVyc1xuICAgIC5maWx0ZXIoKHNwZWNpZmllcikgPT4gc3BlY2lmaWVyLnR5cGUgPT09ICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInKTtcbiAgcmV0dXJuIHNwZWNpZmllcnMubGVuZ3RoID4gMDtcbn1cblxuLy8gQ2hlY2tzIHdoZXRoZXIgYG5vZGVgIGhhcyBhbnkgbm9uLWRlZmF1bHQgc3BlY2lmaWVycy5cbmZ1bmN0aW9uIGhhc1NwZWNpZmllcnMobm9kZSkge1xuICBjb25zdCBzcGVjaWZpZXJzID0gbm9kZS5zcGVjaWZpZXJzXG4gICAgLmZpbHRlcigoc3BlY2lmaWVyKSA9PiBzcGVjaWZpZXIudHlwZSA9PT0gJ0ltcG9ydFNwZWNpZmllcicpO1xuICByZXR1cm4gc3BlY2lmaWVycy5sZW5ndGggPiAwO1xufVxuXG4vLyBDaGVja3Mgd2hldGhlciBgbm9kZWAgaGFzIGEgY29tbWVudCAodGhhdCBlbmRzKSBvbiB0aGUgcHJldmlvdXMgbGluZSBvciBvblxuLy8gdGhlIHNhbWUgbGluZSBhcyBgbm9kZWAgKHN0YXJ0cykuXG5mdW5jdGlvbiBoYXNDb21tZW50QmVmb3JlKG5vZGUsIHNvdXJjZUNvZGUpIHtcbiAgcmV0dXJuIHNvdXJjZUNvZGUuZ2V0Q29tbWVudHNCZWZvcmUobm9kZSlcbiAgICAuc29tZSgoY29tbWVudCkgPT4gY29tbWVudC5sb2MuZW5kLmxpbmUgPj0gbm9kZS5sb2Muc3RhcnQubGluZSAtIDEpO1xufVxuXG4vLyBDaGVja3Mgd2hldGhlciBgbm9kZWAgaGFzIGEgY29tbWVudCAodGhhdCBzdGFydHMpIG9uIHRoZSBzYW1lIGxpbmUgYXMgYG5vZGVgXG4vLyAoZW5kcykuXG5mdW5jdGlvbiBoYXNDb21tZW50QWZ0ZXIobm9kZSwgc291cmNlQ29kZSkge1xuICByZXR1cm4gc291cmNlQ29kZS5nZXRDb21tZW50c0FmdGVyKG5vZGUpXG4gICAgLnNvbWUoKGNvbW1lbnQpID0+IGNvbW1lbnQubG9jLnN0YXJ0LmxpbmUgPT09IG5vZGUubG9jLmVuZC5saW5lKTtcbn1cblxuLy8gQ2hlY2tzIHdoZXRoZXIgYG5vZGVgIGhhcyBhbnkgY29tbWVudHMgX2luc2lkZSxfIGV4Y2VwdCBpbnNpZGUgdGhlIGB7Li4ufWBcbi8vIHBhcnQgKGlmIGFueSkuXG5mdW5jdGlvbiBoYXNDb21tZW50SW5zaWRlTm9uU3BlY2lmaWVycyhub2RlLCBzb3VyY2VDb2RlKSB7XG4gIGNvbnN0IHRva2VucyA9IHNvdXJjZUNvZGUuZ2V0VG9rZW5zKG5vZGUpO1xuICBjb25zdCBvcGVuQnJhY2VJbmRleCA9IHRva2Vucy5maW5kSW5kZXgoKHRva2VuKSA9PiBpc1B1bmN0dWF0b3IodG9rZW4sICd7JykpO1xuICBjb25zdCBjbG9zZUJyYWNlSW5kZXggPSB0b2tlbnMuZmluZEluZGV4KCh0b2tlbikgPT4gaXNQdW5jdHVhdG9yKHRva2VuLCAnfScpKTtcbiAgLy8gU2xpY2UgYXdheSB0aGUgZmlyc3QgdG9rZW4sIHNpbmNlIHdlJ3JlIG5vIGxvb2tpbmcgZm9yIGNvbW1lbnRzIF9iZWZvcmVfXG4gIC8vIGBub2RlYCAob25seSBpbnNpZGUpLiBJZiB0aGVyZSdzIGEgYHsuLi59YCBwYXJ0LCBsb29rIGZvciBjb21tZW50cyBiZWZvcmVcbiAgLy8gdGhlIGB7YCwgYnV0IG5vdCBiZWZvcmUgdGhlIGB9YCAoaGVuY2UgdGhlIGArMWBzKS5cbiAgY29uc3Qgc29tZVRva2VucyA9IG9wZW5CcmFjZUluZGV4ID49IDAgJiYgY2xvc2VCcmFjZUluZGV4ID49IDBcbiAgICA/IHRva2Vucy5zbGljZSgxLCBvcGVuQnJhY2VJbmRleCArIDEpLmNvbmNhdCh0b2tlbnMuc2xpY2UoY2xvc2VCcmFjZUluZGV4ICsgMSkpXG4gICAgOiB0b2tlbnMuc2xpY2UoMSk7XG4gIHJldHVybiBzb21lVG9rZW5zLnNvbWUoKHRva2VuKSA9PiBzb3VyY2VDb2RlLmdldENvbW1lbnRzQmVmb3JlKHRva2VuKS5sZW5ndGggPiAwKTtcbn1cblxuLy8gSXQncyBub3Qgb2J2aW91cyB3aGF0IHRoZSB1c2VyIHdhbnRzIHRvIGRvIHdpdGggY29tbWVudHMgYXNzb2NpYXRlZCB3aXRoXG4vLyBkdXBsaWNhdGUgaW1wb3J0cywgc28gc2tpcCBpbXBvcnRzIHdpdGggY29tbWVudHMgd2hlbiBhdXRvZml4aW5nLlxuZnVuY3Rpb24gaGFzUHJvYmxlbWF0aWNDb21tZW50cyhub2RlLCBzb3VyY2VDb2RlKSB7XG4gIHJldHVybiAoXG4gICAgaGFzQ29tbWVudEJlZm9yZShub2RlLCBzb3VyY2VDb2RlKVxuICAgIHx8IGhhc0NvbW1lbnRBZnRlcihub2RlLCBzb3VyY2VDb2RlKVxuICAgIHx8IGhhc0NvbW1lbnRJbnNpZGVOb25TcGVjaWZpZXJzKG5vZGUsIHNvdXJjZUNvZGUpXG4gICk7XG59XG5cbi8qKiBAdHlwZSB7KGZpcnN0OiBpbXBvcnQoJ2VzdHJlZScpLkltcG9ydERlY2xhcmF0aW9uLCByZXN0OiBpbXBvcnQoJ2VzdHJlZScpLkltcG9ydERlY2xhcmF0aW9uW10sIHNvdXJjZUNvZGU6IGltcG9ydCgnZXNsaW50JykuU291cmNlQ29kZS5Tb3VyY2VDb2RlLCBjb250ZXh0OiBpbXBvcnQoJ2VzbGludCcpLlJ1bGUuUnVsZUNvbnRleHQpID0+IGltcG9ydCgnZXNsaW50JykuUnVsZS5SZXBvcnRGaXhlciB8IHVuZGVmaW5lZH0gKi9cbmZ1bmN0aW9uIGdldEZpeChmaXJzdCwgcmVzdCwgc291cmNlQ29kZSwgY29udGV4dCkge1xuICAvLyBTb3JyeSBFU0xpbnQgPD0gMyB1c2Vycywgbm8gYXV0b2ZpeCBmb3IgeW91LiBBdXRvZml4aW5nIGR1cGxpY2F0ZSBpbXBvcnRzXG4gIC8vIHJlcXVpcmVzIG11bHRpcGxlIGBmaXhlci53aGF0ZXZlcigpYCBjYWxscyBpbiB0aGUgYGZpeGA6IFdlIGJvdGggbmVlZCB0b1xuICAvLyB1cGRhdGUgdGhlIGZpcnN0IG9uZSwgYW5kIHJlbW92ZSB0aGUgcmVzdC4gU3VwcG9ydCBmb3IgbXVsdGlwbGVcbiAgLy8gYGZpeGVyLndoYXRldmVyKClgIGluIGEgc2luZ2xlIGBmaXhgIHdhcyBhZGRlZCBpbiBFU0xpbnQgNC4xLlxuICAvLyBgc291cmNlQ29kZS5nZXRDb21tZW50c0JlZm9yZWAgd2FzIGFkZGVkIGluIDQuMCwgc28gdGhhdCdzIGFuIGVhc3kgdGhpbmcgdG9cbiAgLy8gY2hlY2sgZm9yLlxuICBpZiAodHlwZW9mIHNvdXJjZUNvZGUuZ2V0Q29tbWVudHNCZWZvcmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gQWRqdXN0aW5nIHRoZSBmaXJzdCBpbXBvcnQgbWlnaHQgbWFrZSBpdCBtdWx0aWxpbmUsIHdoaWNoIGNvdWxkIGJyZWFrXG4gIC8vIGBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVgIGNvbW1lbnRzIGFuZCBzaW1pbGFyLCBzbyBiYWlsIGlmIHRoZSBmaXJzdFxuICAvLyBpbXBvcnQgaGFzIGNvbW1lbnRzLiBBbHNvLCBpZiB0aGUgZmlyc3QgaW1wb3J0IGlzIGBpbXBvcnQgKiBhcyBucyBmcm9tXG4gIC8vICcuL2ZvbydgIHRoZXJlJ3Mgbm90aGluZyB3ZSBjYW4gZG8uXG4gIGlmIChoYXNQcm9ibGVtYXRpY0NvbW1lbnRzKGZpcnN0LCBzb3VyY2VDb2RlKSB8fCBoYXNOYW1lc3BhY2UoZmlyc3QpKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IGRlZmF1bHRJbXBvcnROYW1lcyA9IG5ldyBTZXQoXG4gICAgW10uY29uY2F0KGZpcnN0LCByZXN0IHx8IFtdKS5mbGF0TWFwKCh4KSA9PiBnZXREZWZhdWx0SW1wb3J0TmFtZSh4KSB8fCBbXSksXG4gICk7XG5cbiAgLy8gQmFpbCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgZGlmZmVyZW50IGRlZmF1bHQgaW1wb3J0IG5hbWVzIOKAkyBpdCdzIHVwIHRvIHRoZVxuICAvLyB1c2VyIHRvIGNob29zZSB3aGljaCBvbmUgdG8ga2VlcC5cbiAgaWYgKGRlZmF1bHRJbXBvcnROYW1lcy5zaXplID4gMSkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBMZWF2ZSBpdCB0byB0aGUgdXNlciB0byBoYW5kbGUgY29tbWVudHMuIEFsc28gc2tpcCBgaW1wb3J0ICogYXMgbnMgZnJvbVxuICAvLyAnLi9mb28nYCBpbXBvcnRzLCBzaW5jZSB0aGV5IGNhbm5vdCBiZSBtZXJnZWQgaW50byBhbm90aGVyIGltcG9ydC5cbiAgY29uc3QgcmVzdFdpdGhvdXRDb21tZW50cyA9IHJlc3QuZmlsdGVyKChub2RlKSA9PiAhaGFzUHJvYmxlbWF0aWNDb21tZW50cyhub2RlLCBzb3VyY2VDb2RlKSAmJiAhaGFzTmFtZXNwYWNlKG5vZGUpKTtcblxuICBjb25zdCBzcGVjaWZpZXJzID0gcmVzdFdpdGhvdXRDb21tZW50c1xuICAgIC5tYXAoKG5vZGUpID0+IHtcbiAgICAgIGNvbnN0IHRva2VucyA9IHNvdXJjZUNvZGUuZ2V0VG9rZW5zKG5vZGUpO1xuICAgICAgY29uc3Qgb3BlbkJyYWNlID0gdG9rZW5zLmZpbmQoKHRva2VuKSA9PiBpc1B1bmN0dWF0b3IodG9rZW4sICd7JykpO1xuICAgICAgY29uc3QgY2xvc2VCcmFjZSA9IHRva2Vucy5maW5kKCh0b2tlbikgPT4gaXNQdW5jdHVhdG9yKHRva2VuLCAnfScpKTtcblxuICAgICAgaWYgKG9wZW5CcmFjZSA9PSBudWxsIHx8IGNsb3NlQnJhY2UgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbXBvcnROb2RlOiBub2RlLFxuICAgICAgICBpZGVudGlmaWVyczogc291cmNlQ29kZS50ZXh0LnNsaWNlKG9wZW5CcmFjZS5yYW5nZVsxXSwgY2xvc2VCcmFjZS5yYW5nZVswXSkuc3BsaXQoJywnKSwgLy8gU3BsaXQgdGhlIHRleHQgaW50byBzZXBhcmF0ZSBpZGVudGlmaWVycyAocmV0YWluaW5nIGFueSB3aGl0ZXNwYWNlIGJlZm9yZSBvciBhZnRlcilcbiAgICAgICAgaXNFbXB0eTogIWhhc1NwZWNpZmllcnMobm9kZSksXG4gICAgICB9O1xuICAgIH0pXG4gICAgLmZpbHRlcigoeCkgPT4gISF4KTtcblxuICBjb25zdCB1bm5lY2Vzc2FyeUltcG9ydHMgPSByZXN0V2l0aG91dENvbW1lbnRzLmZpbHRlcigobm9kZSkgPT4gIWhhc1NwZWNpZmllcnMobm9kZSlcbiAgICAmJiAhaGFzTmFtZXNwYWNlKG5vZGUpXG4gICAgJiYgIXNwZWNpZmllcnMuc29tZSgoc3BlY2lmaWVyKSA9PiBzcGVjaWZpZXIuaW1wb3J0Tm9kZSA9PT0gbm9kZSksXG4gICk7XG5cbiAgY29uc3Qgc2hvdWxkQWRkRGVmYXVsdCA9IGdldERlZmF1bHRJbXBvcnROYW1lKGZpcnN0KSA9PSBudWxsICYmIGRlZmF1bHRJbXBvcnROYW1lcy5zaXplID09PSAxO1xuICBjb25zdCBzaG91bGRBZGRTcGVjaWZpZXJzID0gc3BlY2lmaWVycy5sZW5ndGggPiAwO1xuICBjb25zdCBzaG91bGRSZW1vdmVVbm5lY2Vzc2FyeSA9IHVubmVjZXNzYXJ5SW1wb3J0cy5sZW5ndGggPiAwO1xuICBjb25zdCBwcmVmZXJJbmxpbmUgPSBjb250ZXh0Lm9wdGlvbnNbMF0gJiYgY29udGV4dC5vcHRpb25zWzBdWydwcmVmZXItaW5saW5lJ107XG5cbiAgaWYgKCEoc2hvdWxkQWRkRGVmYXVsdCB8fCBzaG91bGRBZGRTcGVjaWZpZXJzIHx8IHNob3VsZFJlbW92ZVVubmVjZXNzYXJ5KSkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKiogQHR5cGUge2ltcG9ydCgnZXNsaW50JykuUnVsZS5SZXBvcnRGaXhlcn0gKi9cbiAgcmV0dXJuIChmaXhlcikgPT4ge1xuICAgIGNvbnN0IHRva2VucyA9IHNvdXJjZUNvZGUuZ2V0VG9rZW5zKGZpcnN0KTtcbiAgICBjb25zdCBvcGVuQnJhY2UgPSB0b2tlbnMuZmluZCgodG9rZW4pID0+IGlzUHVuY3R1YXRvcih0b2tlbiwgJ3snKSk7XG4gICAgY29uc3QgY2xvc2VCcmFjZSA9IHRva2Vucy5maW5kKCh0b2tlbikgPT4gaXNQdW5jdHVhdG9yKHRva2VuLCAnfScpKTtcbiAgICBjb25zdCBmaXJzdFRva2VuID0gc291cmNlQ29kZS5nZXRGaXJzdFRva2VuKGZpcnN0KTtcbiAgICBjb25zdCBbZGVmYXVsdEltcG9ydE5hbWVdID0gZGVmYXVsdEltcG9ydE5hbWVzO1xuXG4gICAgY29uc3QgZmlyc3RIYXNUcmFpbGluZ0NvbW1hID0gY2xvc2VCcmFjZSAhPSBudWxsICYmIGlzUHVuY3R1YXRvcihzb3VyY2VDb2RlLmdldFRva2VuQmVmb3JlKGNsb3NlQnJhY2UpLCAnLCcpO1xuICAgIGNvbnN0IGZpcnN0SXNFbXB0eSA9ICFoYXNTcGVjaWZpZXJzKGZpcnN0KTtcbiAgICBjb25zdCBmaXJzdEV4aXN0aW5nSWRlbnRpZmllcnMgPSBmaXJzdElzRW1wdHlcbiAgICAgID8gbmV3IFNldCgpXG4gICAgICA6IG5ldyBTZXQoc291cmNlQ29kZS50ZXh0LnNsaWNlKG9wZW5CcmFjZS5yYW5nZVsxXSwgY2xvc2VCcmFjZS5yYW5nZVswXSlcbiAgICAgICAgLnNwbGl0KCcsJylcbiAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpLFxuICAgICAgKTtcblxuICAgIGNvbnN0IFtzcGVjaWZpZXJzVGV4dF0gPSBzcGVjaWZpZXJzLnJlZHVjZShcbiAgICAgIChbcmVzdWx0LCBuZWVkc0NvbW1hLCBleGlzdGluZ0lkZW50aWZpZXJzXSwgc3BlY2lmaWVyKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzVHlwZVNwZWNpZmllciA9IHNwZWNpZmllci5pbXBvcnROb2RlLmltcG9ydEtpbmQgPT09ICd0eXBlJztcblxuICAgICAgICAvLyBhIHVzZXIgbWlnaHQgc2V0IHByZWZlci1pbmxpbmUgYnV0IG5vdCBoYXZlIGEgc3VwcG9ydGluZyBUeXBlU2NyaXB0IHZlcnNpb24uIEZsb3cgZG9lcyBub3Qgc3VwcG9ydCBpbmxpbmUgdHlwZXMgc28gdGhpcyBzaG91bGQgZmFpbCBpbiB0aGF0IGNhc2UgYXMgd2VsbC5cbiAgICAgICAgaWYgKHByZWZlcklubGluZSAmJiAoIXR5cGVzY3JpcHRQa2cgfHwgIXNlbXZlci5zYXRpc2ZpZXModHlwZXNjcmlwdFBrZy52ZXJzaW9uLCAnPj0gNC41JykpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3VyIHZlcnNpb24gb2YgVHlwZVNjcmlwdCBkb2VzIG5vdCBzdXBwb3J0IGlubGluZSB0eXBlIGltcG9ydHMuJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgKm9ubHkqIHRoZSBuZXcgaWRlbnRpZmllcnMgdGhhdCBkb24ndCBhbHJlYWR5IGV4aXN0LCBhbmQgdHJhY2sgYW55IG5ldyBpZGVudGlmaWVycyBzbyB3ZSBkb24ndCBhZGQgdGhlbSBhZ2FpbiBpbiB0aGUgbmV4dCBsb29wXG4gICAgICAgIGNvbnN0IFtzcGVjaWZpZXJUZXh0LCB1cGRhdGVkRXhpc3RpbmdJZGVudGlmaWVyc10gPSBzcGVjaWZpZXIuaWRlbnRpZmllcnMucmVkdWNlKChbdGV4dCwgc2V0XSwgY3VyKSA9PiB7XG4gICAgICAgICAgY29uc3QgdHJpbW1lZCA9IGN1ci50cmltKCk7IC8vIFRyaW0gd2hpdGVzcGFjZSBiZWZvcmUvYWZ0ZXIgdG8gY29tcGFyZSB0byBvdXIgc2V0IG9mIGV4aXN0aW5nIGlkZW50aWZpZXJzXG4gICAgICAgICAgY29uc3QgY3VyV2l0aFR5cGUgPSB0cmltbWVkLmxlbmd0aCA+IDAgJiYgcHJlZmVySW5saW5lICYmIGlzVHlwZVNwZWNpZmllciA/IGB0eXBlICR7Y3VyfWAgOiBjdXI7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nSWRlbnRpZmllcnMuaGFzKHRyaW1tZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RleHQsIHNldF07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBbdGV4dC5sZW5ndGggPiAwID8gYCR7dGV4dH0sJHtjdXJXaXRoVHlwZX1gIDogY3VyV2l0aFR5cGUsIHNldC5hZGQodHJpbW1lZCldO1xuICAgICAgICB9LCBbJycsIGV4aXN0aW5nSWRlbnRpZmllcnNdKTtcblxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgIG5lZWRzQ29tbWEgJiYgIXNwZWNpZmllci5pc0VtcHR5ICYmIHNwZWNpZmllclRleHQubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyBgJHtyZXN1bHR9LCR7c3BlY2lmaWVyVGV4dH1gXG4gICAgICAgICAgICA6IGAke3Jlc3VsdH0ke3NwZWNpZmllclRleHR9YCxcbiAgICAgICAgICBzcGVjaWZpZXIuaXNFbXB0eSA/IG5lZWRzQ29tbWEgOiB0cnVlLFxuICAgICAgICAgIHVwZGF0ZWRFeGlzdGluZ0lkZW50aWZpZXJzLFxuICAgICAgICBdO1xuICAgICAgfSxcbiAgICAgIFsnJywgIWZpcnN0SGFzVHJhaWxpbmdDb21tYSAmJiAhZmlyc3RJc0VtcHR5LCBmaXJzdEV4aXN0aW5nSWRlbnRpZmllcnNdLFxuICAgICk7XG5cbiAgICAvKiogQHR5cGUge2ltcG9ydCgnZXNsaW50JykuUnVsZS5GaXhbXX0gKi9cbiAgICBjb25zdCBmaXhlcyA9IFtdO1xuXG4gICAgaWYgKHNob3VsZEFkZFNwZWNpZmllcnMgJiYgcHJlZmVySW5saW5lICYmIGZpcnN0LmltcG9ydEtpbmQgPT09ICd0eXBlJykge1xuICAgICAgLy8gYGltcG9ydCB0eXBlIHthfSBmcm9tICcuL2ZvbydgIOKGkiBgaW1wb3J0IHt0eXBlIGF9IGZyb20gJy4vZm9vJ2BcbiAgICAgIGNvbnN0IHR5cGVJZGVudGlmaWVyVG9rZW4gPSB0b2tlbnMuZmluZCgodG9rZW4pID0+IHRva2VuLnR5cGUgPT09ICdJZGVudGlmaWVyJyAmJiB0b2tlbi52YWx1ZSA9PT0gJ3R5cGUnKTtcbiAgICAgIGZpeGVzLnB1c2goZml4ZXIucmVtb3ZlUmFuZ2UoW3R5cGVJZGVudGlmaWVyVG9rZW4ucmFuZ2VbMF0sIHR5cGVJZGVudGlmaWVyVG9rZW4ucmFuZ2VbMV0gKyAxXSkpO1xuXG4gICAgICB0b2tlbnNcbiAgICAgICAgLmZpbHRlcigodG9rZW4pID0+IGZpcnN0RXhpc3RpbmdJZGVudGlmaWVycy5oYXModG9rZW4udmFsdWUpKVxuICAgICAgICAuZm9yRWFjaCgoaWRlbnRpZmllcikgPT4ge1xuICAgICAgICAgIGZpeGVzLnB1c2goZml4ZXIucmVwbGFjZVRleHRSYW5nZShbaWRlbnRpZmllci5yYW5nZVswXSwgaWRlbnRpZmllci5yYW5nZVsxXV0sIGB0eXBlICR7aWRlbnRpZmllci52YWx1ZX1gKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChzaG91bGRBZGREZWZhdWx0ICYmIG9wZW5CcmFjZSA9PSBudWxsICYmIHNob3VsZEFkZFNwZWNpZmllcnMpIHtcbiAgICAgIC8vIGBpbXBvcnQgJy4vZm9vJ2Ag4oaSIGBpbXBvcnQgZGVmLCB7Li4ufSBmcm9tICcuL2ZvbydgXG4gICAgICBmaXhlcy5wdXNoKFxuICAgICAgICBmaXhlci5pbnNlcnRUZXh0QWZ0ZXIoZmlyc3RUb2tlbiwgYCAke2RlZmF1bHRJbXBvcnROYW1lfSwgeyR7c3BlY2lmaWVyc1RleHR9fSBmcm9tYCksXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoc2hvdWxkQWRkRGVmYXVsdCAmJiBvcGVuQnJhY2UgPT0gbnVsbCAmJiAhc2hvdWxkQWRkU3BlY2lmaWVycykge1xuICAgICAgLy8gYGltcG9ydCAnLi9mb28nYCDihpIgYGltcG9ydCBkZWYgZnJvbSAnLi9mb28nYFxuICAgICAgZml4ZXMucHVzaChmaXhlci5pbnNlcnRUZXh0QWZ0ZXIoZmlyc3RUb2tlbiwgYCAke2RlZmF1bHRJbXBvcnROYW1lfSBmcm9tYCkpO1xuICAgIH0gZWxzZSBpZiAoc2hvdWxkQWRkRGVmYXVsdCAmJiBvcGVuQnJhY2UgIT0gbnVsbCAmJiBjbG9zZUJyYWNlICE9IG51bGwpIHtcbiAgICAgIC8vIGBpbXBvcnQgey4uLn0gZnJvbSAnLi9mb28nYCDihpIgYGltcG9ydCBkZWYsIHsuLi59IGZyb20gJy4vZm9vJ2BcbiAgICAgIGZpeGVzLnB1c2goZml4ZXIuaW5zZXJ0VGV4dEFmdGVyKGZpcnN0VG9rZW4sIGAgJHtkZWZhdWx0SW1wb3J0TmFtZX0sYCkpO1xuICAgICAgaWYgKHNob3VsZEFkZFNwZWNpZmllcnMpIHtcbiAgICAgICAgLy8gYGltcG9ydCBkZWYsIHsuLi59IGZyb20gJy4vZm9vJ2Ag4oaSIGBpbXBvcnQgZGVmLCB7Li4uLCAuLi59IGZyb20gJy4vZm9vJ2BcbiAgICAgICAgZml4ZXMucHVzaChmaXhlci5pbnNlcnRUZXh0QmVmb3JlKGNsb3NlQnJhY2UsIHNwZWNpZmllcnNUZXh0KSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghc2hvdWxkQWRkRGVmYXVsdCAmJiBvcGVuQnJhY2UgPT0gbnVsbCAmJiBzaG91bGRBZGRTcGVjaWZpZXJzKSB7XG4gICAgICBpZiAoZmlyc3Quc3BlY2lmaWVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gYGltcG9ydCAnLi9mb28nYCDihpIgYGltcG9ydCB7Li4ufSBmcm9tICcuL2ZvbydgXG4gICAgICAgIGZpeGVzLnB1c2goZml4ZXIuaW5zZXJ0VGV4dEFmdGVyKGZpcnN0VG9rZW4sIGAgeyR7c3BlY2lmaWVyc1RleHR9fSBmcm9tYCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYGltcG9ydCBkZWYgZnJvbSAnLi9mb28nYCDihpIgYGltcG9ydCBkZWYsIHsuLi59IGZyb20gJy4vZm9vJ2BcbiAgICAgICAgZml4ZXMucHVzaChmaXhlci5pbnNlcnRUZXh0QWZ0ZXIoZmlyc3Quc3BlY2lmaWVyc1swXSwgYCwgeyR7c3BlY2lmaWVyc1RleHR9fWApKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFzaG91bGRBZGREZWZhdWx0ICYmIG9wZW5CcmFjZSAhPSBudWxsICYmIGNsb3NlQnJhY2UgIT0gbnVsbCkge1xuICAgICAgLy8gYGltcG9ydCB7Li4ufSAnLi9mb28nYCDihpIgYGltcG9ydCB7Li4uLCAuLi59IGZyb20gJy4vZm9vJ2BcbiAgICAgIGZpeGVzLnB1c2goZml4ZXIuaW5zZXJ0VGV4dEJlZm9yZShjbG9zZUJyYWNlLCBzcGVjaWZpZXJzVGV4dCkpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBpbXBvcnRzIHdob3NlIHNwZWNpZmllcnMgaGF2ZSBiZWVuIG1vdmVkIGludG8gdGhlIGZpcnN0IGltcG9ydC5cbiAgICBzcGVjaWZpZXJzLmZvckVhY2goKHNwZWNpZmllcikgPT4ge1xuICAgICAgY29uc3QgaW1wb3J0Tm9kZSA9IHNwZWNpZmllci5pbXBvcnROb2RlO1xuICAgICAgZml4ZXMucHVzaChmaXhlci5yZW1vdmUoaW1wb3J0Tm9kZSkpO1xuXG4gICAgICBjb25zdCBjaGFyQWZ0ZXJJbXBvcnRSYW5nZSA9IFtpbXBvcnROb2RlLnJhbmdlWzFdLCBpbXBvcnROb2RlLnJhbmdlWzFdICsgMV07XG4gICAgICBjb25zdCBjaGFyQWZ0ZXJJbXBvcnQgPSBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKGNoYXJBZnRlckltcG9ydFJhbmdlWzBdLCBjaGFyQWZ0ZXJJbXBvcnRSYW5nZVsxXSk7XG4gICAgICBpZiAoY2hhckFmdGVySW1wb3J0ID09PSAnXFxuJykge1xuICAgICAgICBmaXhlcy5wdXNoKGZpeGVyLnJlbW92ZVJhbmdlKGNoYXJBZnRlckltcG9ydFJhbmdlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBSZW1vdmUgaW1wb3J0cyB3aG9zZSBkZWZhdWx0IGltcG9ydCBoYXMgYmVlbiBtb3ZlZCB0byB0aGUgZmlyc3QgaW1wb3J0LFxuICAgIC8vIGFuZCBzaWRlLWVmZmVjdC1vbmx5IGltcG9ydHMgdGhhdCBhcmUgdW5uZWNlc3NhcnkgZHVlIHRvIHRoZSBmaXJzdFxuICAgIC8vIGltcG9ydC5cbiAgICB1bm5lY2Vzc2FyeUltcG9ydHMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgZml4ZXMucHVzaChmaXhlci5yZW1vdmUobm9kZSkpO1xuXG4gICAgICBjb25zdCBjaGFyQWZ0ZXJJbXBvcnRSYW5nZSA9IFtub2RlLnJhbmdlWzFdLCBub2RlLnJhbmdlWzFdICsgMV07XG4gICAgICBjb25zdCBjaGFyQWZ0ZXJJbXBvcnQgPSBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKGNoYXJBZnRlckltcG9ydFJhbmdlWzBdLCBjaGFyQWZ0ZXJJbXBvcnRSYW5nZVsxXSk7XG4gICAgICBpZiAoY2hhckFmdGVySW1wb3J0ID09PSAnXFxuJykge1xuICAgICAgICBmaXhlcy5wdXNoKGZpeGVyLnJlbW92ZVJhbmdlKGNoYXJBZnRlckltcG9ydFJhbmdlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZml4ZXM7XG4gIH07XG59XG5cbi8qKiBAdHlwZSB7KGltcG9ydGVkOiBNYXA8c3RyaW5nLCBpbXBvcnQoJ2VzdHJlZScpLkltcG9ydERlY2xhcmF0aW9uW10+LCBjb250ZXh0OiBpbXBvcnQoJ2VzbGludCcpLlJ1bGUuUnVsZUNvbnRleHQpID0+IHZvaWR9ICovXG5mdW5jdGlvbiBjaGVja0ltcG9ydHMoaW1wb3J0ZWQsIGNvbnRleHQpIHtcbiAgZm9yIChjb25zdCBbbW9kdWxlLCBub2Rlc10gb2YgaW1wb3J0ZWQuZW50cmllcygpKSB7XG4gICAgaWYgKG5vZGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgJyR7bW9kdWxlfScgaW1wb3J0ZWQgbXVsdGlwbGUgdGltZXMuYDtcbiAgICAgIGNvbnN0IFtmaXJzdCwgLi4ucmVzdF0gPSBub2RlcztcbiAgICAgIGNvbnN0IHNvdXJjZUNvZGUgPSBnZXRTb3VyY2VDb2RlKGNvbnRleHQpO1xuICAgICAgY29uc3QgZml4ID0gZ2V0Rml4KGZpcnN0LCByZXN0LCBzb3VyY2VDb2RlLCBjb250ZXh0KTtcblxuICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICBub2RlOiBmaXJzdC5zb3VyY2UsXG4gICAgICAgIG1lc3NhZ2UsXG4gICAgICAgIGZpeCwgLy8gQXR0YWNoIHRoZSBhdXRvZml4IChpZiBhbnkpIHRvIHRoZSBmaXJzdCBpbXBvcnQuXG4gICAgICB9KTtcblxuICAgICAgcmVzdC5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICBub2RlOiBub2RlLnNvdXJjZSxcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG4vKiogQHR5cGUge2ltcG9ydCgnZXNsaW50JykuUnVsZS5SdWxlTW9kdWxlfSAqL1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAncHJvYmxlbScsXG4gICAgZG9jczoge1xuICAgICAgY2F0ZWdvcnk6ICdTdHlsZSBndWlkZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZvcmJpZCByZXBlYXRlZCBpbXBvcnQgb2YgdGhlIHNhbWUgbW9kdWxlIGluIG11bHRpcGxlIHBsYWNlcy4nLFxuICAgICAgdXJsOiBkb2NzVXJsKCduby1kdXBsaWNhdGVzJyksXG4gICAgfSxcbiAgICBmaXhhYmxlOiAnY29kZScsXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgY29uc2lkZXJRdWVyeVN0cmluZzoge1xuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3ByZWZlci1pbmxpbmUnOiB7XG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuXG4gIC8qKiBAcGFyYW0ge2ltcG9ydCgnZXNsaW50JykuUnVsZS5SdWxlQ29udGV4dH0gY29udGV4dCAqL1xuICBjcmVhdGUoY29udGV4dCkge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICAvLyBQcmVwYXJlIHRoZSByZXNvbHZlciBmcm9tIG9wdGlvbnMuXG4gICAgY29uc3QgY29uc2lkZXJRdWVyeVN0cmluZ09wdGlvbiA9IGNvbnRleHQub3B0aW9uc1swXSAmJiBjb250ZXh0Lm9wdGlvbnNbMF0uY29uc2lkZXJRdWVyeVN0cmluZztcbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgY29uc3QgcHJlZmVySW5saW5lID0gY29udGV4dC5vcHRpb25zWzBdICYmIGNvbnRleHQub3B0aW9uc1swXVsncHJlZmVyLWlubGluZSddO1xuICAgIGNvbnN0IGRlZmF1bHRSZXNvbHZlciA9IChzb3VyY2VQYXRoKSA9PiByZXNvbHZlKHNvdXJjZVBhdGgsIGNvbnRleHQpIHx8IHNvdXJjZVBhdGg7XG4gICAgY29uc3QgcmVzb2x2ZXIgPSBjb25zaWRlclF1ZXJ5U3RyaW5nT3B0aW9uID8gKHNvdXJjZVBhdGgpID0+IHtcbiAgICAgIGNvbnN0IHBhcnRzID0gc291cmNlUGF0aC5tYXRjaCgvXihbXj9dKilcXD8oLiopJC8pO1xuICAgICAgaWYgKCFwYXJ0cykge1xuICAgICAgICByZXR1cm4gZGVmYXVsdFJlc29sdmVyKHNvdXJjZVBhdGgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGAke2RlZmF1bHRSZXNvbHZlcihwYXJ0c1sxXSl9PyR7cGFydHNbMl19YDtcbiAgICB9IDogZGVmYXVsdFJlc29sdmVyO1xuXG4gICAgLyoqIEB0eXBlIHtNYXA8dW5rbm93biwgeyBpbXBvcnRlZDogTWFwPHN0cmluZywgaW1wb3J0KCdlc3RyZWUnKS5JbXBvcnREZWNsYXJhdGlvbltdPiwgbnNJbXBvcnRlZDogTWFwPHN0cmluZywgaW1wb3J0KCdlc3RyZWUnKS5JbXBvcnREZWNsYXJhdGlvbltdPiwgZGVmYXVsdFR5cGVzSW1wb3J0ZWQ6IE1hcDxzdHJpbmcsIGltcG9ydCgnZXN0cmVlJykuSW1wb3J0RGVjbGFyYXRpb25bXT4sIG5hbWVkVHlwZXNJbXBvcnRlZDogTWFwPHN0cmluZywgaW1wb3J0KCdlc3RyZWUnKS5JbXBvcnREZWNsYXJhdGlvbltdPn0+fSAqL1xuICAgIGNvbnN0IG1vZHVsZU1hcHMgPSBuZXcgTWFwKCk7XG5cbiAgICAvKiogQHBhcmFtIHtpbXBvcnQoJ2VzdHJlZScpLkltcG9ydERlY2xhcmF0aW9ufSBuICovXG4gICAgLyoqIEByZXR1cm5zIHt0eXBlb2YgbW9kdWxlTWFwc1trZXlvZiB0eXBlb2YgbW9kdWxlTWFwc119ICovXG4gICAgZnVuY3Rpb24gZ2V0SW1wb3J0TWFwKG4pIHtcbiAgICAgIGlmICghbW9kdWxlTWFwcy5oYXMobi5wYXJlbnQpKSB7XG4gICAgICAgIG1vZHVsZU1hcHMuc2V0KG4ucGFyZW50LCAvKiogQHR5cGUge3R5cGVvZiBtb2R1bGVNYXBzfSAqLyB7XG4gICAgICAgICAgaW1wb3J0ZWQ6IG5ldyBNYXAoKSxcbiAgICAgICAgICBuc0ltcG9ydGVkOiBuZXcgTWFwKCksXG4gICAgICAgICAgZGVmYXVsdFR5cGVzSW1wb3J0ZWQ6IG5ldyBNYXAoKSxcbiAgICAgICAgICBuYW1lZFR5cGVzSW1wb3J0ZWQ6IG5ldyBNYXAoKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCBtYXAgPSBtb2R1bGVNYXBzLmdldChuLnBhcmVudCk7XG4gICAgICBpZiAoIXByZWZlcklubGluZSAmJiBuLmltcG9ydEtpbmQgPT09ICd0eXBlJykge1xuICAgICAgICByZXR1cm4gbi5zcGVjaWZpZXJzLmxlbmd0aCA+IDAgJiYgbi5zcGVjaWZpZXJzWzBdLnR5cGUgPT09ICdJbXBvcnREZWZhdWx0U3BlY2lmaWVyJyA/IG1hcC5kZWZhdWx0VHlwZXNJbXBvcnRlZCA6IG1hcC5uYW1lZFR5cGVzSW1wb3J0ZWQ7XG4gICAgICB9XG4gICAgICBpZiAoIXByZWZlcklubGluZSAmJiBuLnNwZWNpZmllcnMuc29tZSgoc3BlYykgPT4gc3BlYy5pbXBvcnRLaW5kID09PSAndHlwZScpKSB7XG4gICAgICAgIHJldHVybiBtYXAubmFtZWRUeXBlc0ltcG9ydGVkO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gaGFzTmFtZXNwYWNlKG4pID8gbWFwLm5zSW1wb3J0ZWQgOiBtYXAuaW1wb3J0ZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIC8qKiBAcGFyYW0ge2ltcG9ydCgnZXN0cmVlJykuSW1wb3J0RGVjbGFyYXRpb259IG4gKi9cbiAgICAgIEltcG9ydERlY2xhcmF0aW9uKG4pIHtcbiAgICAgICAgLyoqIEB0eXBlIHtzdHJpbmd9ICovXG4gICAgICAgIC8vIHJlc29sdmVkIHBhdGggd2lsbCBjb3ZlciBhbGlhc2VkIGR1cGxpY2F0ZXNcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZXIobi5zb3VyY2UudmFsdWUpO1xuICAgICAgICBjb25zdCBpbXBvcnRNYXAgPSBnZXRJbXBvcnRNYXAobik7XG5cbiAgICAgICAgaWYgKGltcG9ydE1hcC5oYXMocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICAgIGltcG9ydE1hcC5nZXQocmVzb2x2ZWRQYXRoKS5wdXNoKG4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGltcG9ydE1hcC5zZXQocmVzb2x2ZWRQYXRoLCBbbl0pO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAnUHJvZ3JhbTpleGl0JygpIHtcbiAgICAgICAgZm9yIChjb25zdCBtYXAgb2YgbW9kdWxlTWFwcy52YWx1ZXMoKSkge1xuICAgICAgICAgIGNoZWNrSW1wb3J0cyhtYXAuaW1wb3J0ZWQsIGNvbnRleHQpO1xuICAgICAgICAgIGNoZWNrSW1wb3J0cyhtYXAubnNJbXBvcnRlZCwgY29udGV4dCk7XG4gICAgICAgICAgY2hlY2tJbXBvcnRzKG1hcC5kZWZhdWx0VHlwZXNJbXBvcnRlZCwgY29udGV4dCk7XG4gICAgICAgICAgY2hlY2tJbXBvcnRzKG1hcC5uYW1lZFR5cGVzSW1wb3J0ZWQsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gIH0sXG59O1xuIl19