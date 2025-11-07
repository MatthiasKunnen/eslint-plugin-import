'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _builder = require('../exportMap/builder');var _builder2 = _interopRequireDefault(_builder);
var _patternCapture = require('../exportMap/patternCapture');var _patternCapture2 = _interopRequireDefault(_patternCapture);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

/*
                                                                                                                                                                                      Notes on TypeScript namespaces aka TSModuleDeclaration:
                                                                                                                                                                                      
                                                                                                                                                                                      There are two forms:
                                                                                                                                                                                      - active namespaces: namespace Foo {} / module Foo {}
                                                                                                                                                                                      - ambient modules; declare module "eslint-plugin-import" {}
                                                                                                                                                                                      
                                                                                                                                                                                      active namespaces:
                                                                                                                                                                                      - cannot contain a default export
                                                                                                                                                                                      - cannot contain an export all
                                                                                                                                                                                      - cannot contain a multi name export (export { a, b })
                                                                                                                                                                                      - can have active namespaces nested within them
                                                                                                                                                                                      
                                                                                                                                                                                      ambient namespaces:
                                                                                                                                                                                      - can only be defined in .d.ts files
                                                                                                                                                                                      - cannot be nested within active namespaces
                                                                                                                                                                                      - have no other restrictions
                                                                                                                                                                                      */

var rootProgram = 'root';
var tsTypePrefix = 'type:';

/**
                             * remove function overloads like:
                             * ```ts
                             * export function foo(a: number);
                             * export function foo(a: string);
                             * ```
                             * @param {Set<Object>} nodes
                             */
function removeTypescriptFunctionOverloads(nodes) {
  nodes.forEach(function (node) {
    var declType = node.type === 'ExportDefaultDeclaration' ? node.declaration.type : node.parent.type;
    if (
    // eslint 6+
    declType === 'TSDeclareFunction'
    // eslint 4-5
    || declType === 'TSEmptyBodyFunctionDeclaration')
    {
      nodes['delete'](node);
    }
  });
}

/**
   * Detect merging Namespaces with Classes, Functions, or Enums like:
   * ```ts
   * export class Foo { }
   * export namespace Foo { }
   * ```
   * @param {Set<Object>} nodes
   * @returns {boolean}
   */
function isTypescriptNamespaceMerging(nodes) {
  var types = new Set(Array.from(nodes, function (node) {return node.parent.type;}));
  var noNamespaceNodes = Array.from(nodes).filter(function (node) {return node.parent.type !== 'TSModuleDeclaration';});

  return types.has('TSModuleDeclaration') && (

  types.size === 1
  // Merging with functions
  || types.size === 2 && (types.has('FunctionDeclaration') || types.has('TSDeclareFunction')) ||
  types.size === 3 && types.has('FunctionDeclaration') && types.has('TSDeclareFunction')
  // Merging with classes or enums
  || types.size === 2 && (types.has('ClassDeclaration') || types.has('TSEnumDeclaration')) && noNamespaceNodes.length === 1);

}

/**
   * Detect if a typescript namespace node should be reported as multiple export:
   * ```ts
   * export class Foo { }
   * export function Foo();
   * export namespace Foo { }
   * ```
   * @param {Object} node
   * @param {Set<Object>} nodes
   * @returns {boolean}
   */
function shouldSkipTypescriptNamespace(node, nodes) {
  var types = new Set(Array.from(nodes, function (node) {return node.parent.type;}));

  return !isTypescriptNamespaceMerging(nodes) &&
  node.parent.type === 'TSModuleDeclaration' && (

  types.has('TSEnumDeclaration') ||
  types.has('ClassDeclaration') ||
  types.has('FunctionDeclaration') ||
  types.has('TSDeclareFunction'));

}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      category: 'Helpful warnings',
      description: 'Forbid any invalid exports, i.e. re-export of the same name.',
      url: (0, _docsUrl2['default'])('export') },

    schema: [] },


  create: function () {function create(context) {
      var namespace = new Map([[rootProgram, new Map()]]);

      function addNamed(name, node, parent, isType) {
        if (!namespace.has(parent)) {
          namespace.set(parent, new Map());
        }
        var named = namespace.get(parent);

        var key = isType ? '' + tsTypePrefix + String(name) : name;
        var nodes = named.get(key);

        if (nodes == null) {
          nodes = new Set();
          named.set(key, nodes);
        }

        nodes.add(node);
      }

      function getParent(node) {
        if (node.parent && node.parent.type === 'TSModuleBlock') {
          return node.parent.parent;
        }

        // just in case somehow a non-ts namespace export declaration isn't directly
        // parented to the root Program node
        return rootProgram;
      }

      return {
        ExportDefaultDeclaration: function () {function ExportDefaultDeclaration(node) {
            addNamed('default', node, getParent(node));
          }return ExportDefaultDeclaration;}(),

        ExportSpecifier: function () {function ExportSpecifier(node) {
            addNamed(
            node.exported.name || node.exported.value,
            node.exported,
            getParent(node.parent));

          }return ExportSpecifier;}(),

        ExportNamedDeclaration: function () {function ExportNamedDeclaration(node) {
            if (node.declaration == null) {return;}

            var parent = getParent(node);
            // support for old TypeScript versions
            var isTypeVariableDecl = node.declaration.kind === 'type';

            if (node.declaration.id != null) {
              if ([
              'TSTypeAliasDeclaration',
              'TSInterfaceDeclaration'].
              includes(node.declaration.type)) {
                addNamed(node.declaration.id.name, node.declaration.id, parent, true);
              } else {
                addNamed(node.declaration.id.name, node.declaration.id, parent, isTypeVariableDecl);
              }
            }

            if (node.declaration.declarations != null) {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
                for (var _iterator = node.declaration.declarations[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var declaration = _step.value;
                  (0, _patternCapture2['default'])(declaration.id, function (v) {addNamed(v.name, v, parent, isTypeVariableDecl);});
                }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
            }
          }return ExportNamedDeclaration;}(),

        ExportAllDeclaration: function () {function ExportAllDeclaration(node) {
            if (node.source == null) {return;} // not sure if this is ever true

            // `export * as X from 'path'` does not conflict
            if (node.exported && node.exported.name) {return;}

            var remoteExports = _builder2['default'].get(node.source.value, context);
            if (remoteExports == null) {return;}

            if (remoteExports.errors.length) {
              remoteExports.reportErrors(context, node);
              return;
            }

            var parent = getParent(node);

            var any = false;
            remoteExports.forEach(function (v, name) {
              if (name !== 'default') {
                any = true; // poor man's filter
                addNamed(name, node, parent);
              }
            });

            if (!any) {
              context.report(
              node.source, 'No named exports found in module \'' + String(
              node.source.value) + '\'.');

            }
          }return ExportAllDeclaration;}(),

        'Program:exit': function () {function ProgramExit() {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
              for (var _iterator2 = namespace[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var _ref = _step2.value;var _ref2 = _slicedToArray(_ref, 2);var named = _ref2[1];var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {
                  for (var _iterator3 = named[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var _ref3 = _step3.value;var _ref4 = _slicedToArray(_ref3, 2);var name = _ref4[0];var nodes = _ref4[1];
                    removeTypescriptFunctionOverloads(nodes);

                    if (nodes.size <= 1) {continue;}

                    if (isTypescriptNamespaceMerging(nodes)) {continue;}var _iteratorNormalCompletion4 = true;var _didIteratorError4 = false;var _iteratorError4 = undefined;try {

                      for (var _iterator4 = nodes[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {var node = _step4.value;
                        if (shouldSkipTypescriptNamespace(node, nodes)) {continue;}

                        if (name === 'default') {
                          context.report(node, 'Multiple default exports.');
                        } else {
                          context.report(
                          node, 'Multiple exports of name \'' + String(
                          name.replace(tsTypePrefix, '')) + '\'.');

                        }
                      }} catch (err) {_didIteratorError4 = true;_iteratorError4 = err;} finally {try {if (!_iteratorNormalCompletion4 && _iterator4['return']) {_iterator4['return']();}} finally {if (_didIteratorError4) {throw _iteratorError4;}}}
                  }} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3['return']) {_iterator3['return']();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}
              }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2['return']) {_iterator2['return']();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
          }return ProgramExit;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9leHBvcnQuanMiXSwibmFtZXMiOlsicm9vdFByb2dyYW0iLCJ0c1R5cGVQcmVmaXgiLCJyZW1vdmVUeXBlc2NyaXB0RnVuY3Rpb25PdmVybG9hZHMiLCJub2RlcyIsImZvckVhY2giLCJub2RlIiwiZGVjbFR5cGUiLCJ0eXBlIiwiZGVjbGFyYXRpb24iLCJwYXJlbnQiLCJpc1R5cGVzY3JpcHROYW1lc3BhY2VNZXJnaW5nIiwidHlwZXMiLCJTZXQiLCJBcnJheSIsImZyb20iLCJub05hbWVzcGFjZU5vZGVzIiwiZmlsdGVyIiwiaGFzIiwic2l6ZSIsImxlbmd0aCIsInNob3VsZFNraXBUeXBlc2NyaXB0TmFtZXNwYWNlIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwiY2F0ZWdvcnkiLCJkZXNjcmlwdGlvbiIsInVybCIsInNjaGVtYSIsImNyZWF0ZSIsImNvbnRleHQiLCJuYW1lc3BhY2UiLCJNYXAiLCJhZGROYW1lZCIsIm5hbWUiLCJpc1R5cGUiLCJzZXQiLCJuYW1lZCIsImdldCIsImtleSIsImFkZCIsImdldFBhcmVudCIsIkV4cG9ydERlZmF1bHREZWNsYXJhdGlvbiIsIkV4cG9ydFNwZWNpZmllciIsImV4cG9ydGVkIiwidmFsdWUiLCJFeHBvcnROYW1lZERlY2xhcmF0aW9uIiwiaXNUeXBlVmFyaWFibGVEZWNsIiwia2luZCIsImlkIiwiaW5jbHVkZXMiLCJkZWNsYXJhdGlvbnMiLCJ2IiwiRXhwb3J0QWxsRGVjbGFyYXRpb24iLCJzb3VyY2UiLCJyZW1vdGVFeHBvcnRzIiwiRXhwb3J0TWFwQnVpbGRlciIsImVycm9ycyIsInJlcG9ydEVycm9ycyIsImFueSIsInJlcG9ydCIsInJlcGxhY2UiXSwibWFwcGluZ3MiOiJxb0JBQUEsK0M7QUFDQSw2RDtBQUNBLHFDOztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLElBQU1BLGNBQWMsTUFBcEI7QUFDQSxJQUFNQyxlQUFlLE9BQXJCOztBQUVBOzs7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OEJBQThCZixJQUE5QixFQUFvQ0YsS0FBcEMsQ0FBSixFQUFnRCxDQUFFLFNBQVc7O0FBRTdELDRCQUFJK0IsU0FBUyxTQUFiLEVBQXdCO0FBQ3RCSixrQ0FBUThCLE1BQVIsQ0FBZXZELElBQWYsRUFBcUIsMkJBQXJCO0FBQ0QseUJBRkQsTUFFTztBQUNMeUIsa0NBQVE4QixNQUFSO0FBQ0V2RCw4QkFERjtBQUUrQjZCLCtCQUFLMkIsT0FBTCxDQUFhNUQsWUFBYixFQUEyQixFQUEzQixDQUYvQjs7QUFJRDtBQUNGLHVCQWxCZ0M7QUFtQmxDLG1CQXBCZ0M7QUFxQmxDLGVBdEJjO0FBdUJoQixXQTdGSSx3QkFBUDs7QUErRkQsS0F4SWMsbUJBQWpCIiwiZmlsZSI6ImV4cG9ydC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBFeHBvcnRNYXBCdWlsZGVyIGZyb20gJy4uL2V4cG9ydE1hcC9idWlsZGVyJztcbmltcG9ydCByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZSBmcm9tICcuLi9leHBvcnRNYXAvcGF0dGVybkNhcHR1cmUnO1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCc7XG5cbi8qXG5Ob3RlcyBvbiBUeXBlU2NyaXB0IG5hbWVzcGFjZXMgYWthIFRTTW9kdWxlRGVjbGFyYXRpb246XG5cblRoZXJlIGFyZSB0d28gZm9ybXM6XG4tIGFjdGl2ZSBuYW1lc3BhY2VzOiBuYW1lc3BhY2UgRm9vIHt9IC8gbW9kdWxlIEZvbyB7fVxuLSBhbWJpZW50IG1vZHVsZXM7IGRlY2xhcmUgbW9kdWxlIFwiZXNsaW50LXBsdWdpbi1pbXBvcnRcIiB7fVxuXG5hY3RpdmUgbmFtZXNwYWNlczpcbi0gY2Fubm90IGNvbnRhaW4gYSBkZWZhdWx0IGV4cG9ydFxuLSBjYW5ub3QgY29udGFpbiBhbiBleHBvcnQgYWxsXG4tIGNhbm5vdCBjb250YWluIGEgbXVsdGkgbmFtZSBleHBvcnQgKGV4cG9ydCB7IGEsIGIgfSlcbi0gY2FuIGhhdmUgYWN0aXZlIG5hbWVzcGFjZXMgbmVzdGVkIHdpdGhpbiB0aGVtXG5cbmFtYmllbnQgbmFtZXNwYWNlczpcbi0gY2FuIG9ubHkgYmUgZGVmaW5lZCBpbiAuZC50cyBmaWxlc1xuLSBjYW5ub3QgYmUgbmVzdGVkIHdpdGhpbiBhY3RpdmUgbmFtZXNwYWNlc1xuLSBoYXZlIG5vIG90aGVyIHJlc3RyaWN0aW9uc1xuKi9cblxuY29uc3Qgcm9vdFByb2dyYW0gPSAncm9vdCc7XG5jb25zdCB0c1R5cGVQcmVmaXggPSAndHlwZTonO1xuXG4vKipcbiAqIHJlbW92ZSBmdW5jdGlvbiBvdmVybG9hZHMgbGlrZTpcbiAqIGBgYHRzXG4gKiBleHBvcnQgZnVuY3Rpb24gZm9vKGE6IG51bWJlcik7XG4gKiBleHBvcnQgZnVuY3Rpb24gZm9vKGE6IHN0cmluZyk7XG4gKiBgYGBcbiAqIEBwYXJhbSB7U2V0PE9iamVjdD59IG5vZGVzXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZVR5cGVzY3JpcHRGdW5jdGlvbk92ZXJsb2Fkcyhub2Rlcykge1xuICBub2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgY29uc3QgZGVjbFR5cGUgPSBub2RlLnR5cGUgPT09ICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nID8gbm9kZS5kZWNsYXJhdGlvbi50eXBlIDogbm9kZS5wYXJlbnQudHlwZTtcbiAgICBpZiAoXG4gICAgICAvLyBlc2xpbnQgNitcbiAgICAgIGRlY2xUeXBlID09PSAnVFNEZWNsYXJlRnVuY3Rpb24nXG4gICAgICAvLyBlc2xpbnQgNC01XG4gICAgICB8fCBkZWNsVHlwZSA9PT0gJ1RTRW1wdHlCb2R5RnVuY3Rpb25EZWNsYXJhdGlvbidcbiAgICApIHtcbiAgICAgIG5vZGVzLmRlbGV0ZShub2RlKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIERldGVjdCBtZXJnaW5nIE5hbWVzcGFjZXMgd2l0aCBDbGFzc2VzLCBGdW5jdGlvbnMsIG9yIEVudW1zIGxpa2U6XG4gKiBgYGB0c1xuICogZXhwb3J0IGNsYXNzIEZvbyB7IH1cbiAqIGV4cG9ydCBuYW1lc3BhY2UgRm9vIHsgfVxuICogYGBgXG4gKiBAcGFyYW0ge1NldDxPYmplY3Q+fSBub2Rlc1xuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGlzVHlwZXNjcmlwdE5hbWVzcGFjZU1lcmdpbmcobm9kZXMpIHtcbiAgY29uc3QgdHlwZXMgPSBuZXcgU2V0KEFycmF5LmZyb20obm9kZXMsIChub2RlKSA9PiBub2RlLnBhcmVudC50eXBlKSk7XG4gIGNvbnN0IG5vTmFtZXNwYWNlTm9kZXMgPSBBcnJheS5mcm9tKG5vZGVzKS5maWx0ZXIoKG5vZGUpID0+IG5vZGUucGFyZW50LnR5cGUgIT09ICdUU01vZHVsZURlY2xhcmF0aW9uJyk7XG5cbiAgcmV0dXJuIHR5cGVzLmhhcygnVFNNb2R1bGVEZWNsYXJhdGlvbicpXG4gICAgJiYgKFxuICAgICAgdHlwZXMuc2l6ZSA9PT0gMVxuICAgICAgLy8gTWVyZ2luZyB3aXRoIGZ1bmN0aW9uc1xuICAgICAgfHwgdHlwZXMuc2l6ZSA9PT0gMiAmJiAodHlwZXMuaGFzKCdGdW5jdGlvbkRlY2xhcmF0aW9uJykgfHwgdHlwZXMuaGFzKCdUU0RlY2xhcmVGdW5jdGlvbicpKVxuICAgICAgfHwgdHlwZXMuc2l6ZSA9PT0gMyAmJiB0eXBlcy5oYXMoJ0Z1bmN0aW9uRGVjbGFyYXRpb24nKSAmJiB0eXBlcy5oYXMoJ1RTRGVjbGFyZUZ1bmN0aW9uJylcbiAgICAgIC8vIE1lcmdpbmcgd2l0aCBjbGFzc2VzIG9yIGVudW1zXG4gICAgICB8fCB0eXBlcy5zaXplID09PSAyICYmICh0eXBlcy5oYXMoJ0NsYXNzRGVjbGFyYXRpb24nKSB8fCB0eXBlcy5oYXMoJ1RTRW51bURlY2xhcmF0aW9uJykpICYmIG5vTmFtZXNwYWNlTm9kZXMubGVuZ3RoID09PSAxXG4gICAgKTtcbn1cblxuLyoqXG4gKiBEZXRlY3QgaWYgYSB0eXBlc2NyaXB0IG5hbWVzcGFjZSBub2RlIHNob3VsZCBiZSByZXBvcnRlZCBhcyBtdWx0aXBsZSBleHBvcnQ6XG4gKiBgYGB0c1xuICogZXhwb3J0IGNsYXNzIEZvbyB7IH1cbiAqIGV4cG9ydCBmdW5jdGlvbiBGb28oKTtcbiAqIGV4cG9ydCBuYW1lc3BhY2UgRm9vIHsgfVxuICogYGBgXG4gKiBAcGFyYW0ge09iamVjdH0gbm9kZVxuICogQHBhcmFtIHtTZXQ8T2JqZWN0Pn0gbm9kZXNcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBzaG91bGRTa2lwVHlwZXNjcmlwdE5hbWVzcGFjZShub2RlLCBub2Rlcykge1xuICBjb25zdCB0eXBlcyA9IG5ldyBTZXQoQXJyYXkuZnJvbShub2RlcywgKG5vZGUpID0+IG5vZGUucGFyZW50LnR5cGUpKTtcblxuICByZXR1cm4gIWlzVHlwZXNjcmlwdE5hbWVzcGFjZU1lcmdpbmcobm9kZXMpXG4gICAgJiYgbm9kZS5wYXJlbnQudHlwZSA9PT0gJ1RTTW9kdWxlRGVjbGFyYXRpb24nXG4gICAgJiYgKFxuICAgICAgdHlwZXMuaGFzKCdUU0VudW1EZWNsYXJhdGlvbicpXG4gICAgICB8fCB0eXBlcy5oYXMoJ0NsYXNzRGVjbGFyYXRpb24nKVxuICAgICAgfHwgdHlwZXMuaGFzKCdGdW5jdGlvbkRlY2xhcmF0aW9uJylcbiAgICAgIHx8IHR5cGVzLmhhcygnVFNEZWNsYXJlRnVuY3Rpb24nKVxuICAgICk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgdHlwZTogJ3Byb2JsZW0nLFxuICAgIGRvY3M6IHtcbiAgICAgIGNhdGVnb3J5OiAnSGVscGZ1bCB3YXJuaW5ncycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZvcmJpZCBhbnkgaW52YWxpZCBleHBvcnRzLCBpLmUuIHJlLWV4cG9ydCBvZiB0aGUgc2FtZSBuYW1lLicsXG4gICAgICB1cmw6IGRvY3NVcmwoJ2V4cG9ydCcpLFxuICAgIH0sXG4gICAgc2NoZW1hOiBbXSxcbiAgfSxcblxuICBjcmVhdGUoY29udGV4dCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9IG5ldyBNYXAoW1tyb290UHJvZ3JhbSwgbmV3IE1hcCgpXV0pO1xuXG4gICAgZnVuY3Rpb24gYWRkTmFtZWQobmFtZSwgbm9kZSwgcGFyZW50LCBpc1R5cGUpIHtcbiAgICAgIGlmICghbmFtZXNwYWNlLmhhcyhwYXJlbnQpKSB7XG4gICAgICAgIG5hbWVzcGFjZS5zZXQocGFyZW50LCBuZXcgTWFwKCkpO1xuICAgICAgfVxuICAgICAgY29uc3QgbmFtZWQgPSBuYW1lc3BhY2UuZ2V0KHBhcmVudCk7XG5cbiAgICAgIGNvbnN0IGtleSA9IGlzVHlwZSA/IGAke3RzVHlwZVByZWZpeH0ke25hbWV9YCA6IG5hbWU7XG4gICAgICBsZXQgbm9kZXMgPSBuYW1lZC5nZXQoa2V5KTtcblxuICAgICAgaWYgKG5vZGVzID09IG51bGwpIHtcbiAgICAgICAgbm9kZXMgPSBuZXcgU2V0KCk7XG4gICAgICAgIG5hbWVkLnNldChrZXksIG5vZGVzKTtcbiAgICAgIH1cblxuICAgICAgbm9kZXMuYWRkKG5vZGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFBhcmVudChub2RlKSB7XG4gICAgICBpZiAobm9kZS5wYXJlbnQgJiYgbm9kZS5wYXJlbnQudHlwZSA9PT0gJ1RTTW9kdWxlQmxvY2snKSB7XG4gICAgICAgIHJldHVybiBub2RlLnBhcmVudC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIC8vIGp1c3QgaW4gY2FzZSBzb21laG93IGEgbm9uLXRzIG5hbWVzcGFjZSBleHBvcnQgZGVjbGFyYXRpb24gaXNuJ3QgZGlyZWN0bHlcbiAgICAgIC8vIHBhcmVudGVkIHRvIHRoZSByb290IFByb2dyYW0gbm9kZVxuICAgICAgcmV0dXJuIHJvb3RQcm9ncmFtO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24obm9kZSkge1xuICAgICAgICBhZGROYW1lZCgnZGVmYXVsdCcsIG5vZGUsIGdldFBhcmVudChub2RlKSk7XG4gICAgICB9LFxuXG4gICAgICBFeHBvcnRTcGVjaWZpZXIobm9kZSkge1xuICAgICAgICBhZGROYW1lZChcbiAgICAgICAgICBub2RlLmV4cG9ydGVkLm5hbWUgfHwgbm9kZS5leHBvcnRlZC52YWx1ZSxcbiAgICAgICAgICBub2RlLmV4cG9ydGVkLFxuICAgICAgICAgIGdldFBhcmVudChub2RlLnBhcmVudCksXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBFeHBvcnROYW1lZERlY2xhcmF0aW9uKG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUuZGVjbGFyYXRpb24gPT0gbnVsbCkgeyByZXR1cm47IH1cblxuICAgICAgICBjb25zdCBwYXJlbnQgPSBnZXRQYXJlbnQobm9kZSk7XG4gICAgICAgIC8vIHN1cHBvcnQgZm9yIG9sZCBUeXBlU2NyaXB0IHZlcnNpb25zXG4gICAgICAgIGNvbnN0IGlzVHlwZVZhcmlhYmxlRGVjbCA9IG5vZGUuZGVjbGFyYXRpb24ua2luZCA9PT0gJ3R5cGUnO1xuXG4gICAgICAgIGlmIChub2RlLmRlY2xhcmF0aW9uLmlkICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoW1xuICAgICAgICAgICAgJ1RTVHlwZUFsaWFzRGVjbGFyYXRpb24nLFxuICAgICAgICAgICAgJ1RTSW50ZXJmYWNlRGVjbGFyYXRpb24nLFxuICAgICAgICAgIF0uaW5jbHVkZXMobm9kZS5kZWNsYXJhdGlvbi50eXBlKSkge1xuICAgICAgICAgICAgYWRkTmFtZWQobm9kZS5kZWNsYXJhdGlvbi5pZC5uYW1lLCBub2RlLmRlY2xhcmF0aW9uLmlkLCBwYXJlbnQsIHRydWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhZGROYW1lZChub2RlLmRlY2xhcmF0aW9uLmlkLm5hbWUsIG5vZGUuZGVjbGFyYXRpb24uaWQsIHBhcmVudCwgaXNUeXBlVmFyaWFibGVEZWNsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMgIT0gbnVsbCkge1xuICAgICAgICAgIGZvciAoY29uc3QgZGVjbGFyYXRpb24gb2Ygbm9kZS5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGRlY2xhcmF0aW9uLmlkLCAodikgPT4geyBhZGROYW1lZCh2Lm5hbWUsIHYsIHBhcmVudCwgaXNUeXBlVmFyaWFibGVEZWNsKTsgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICBFeHBvcnRBbGxEZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICAgIGlmIChub2RlLnNvdXJjZSA9PSBudWxsKSB7IHJldHVybjsgfSAvLyBub3Qgc3VyZSBpZiB0aGlzIGlzIGV2ZXIgdHJ1ZVxuXG4gICAgICAgIC8vIGBleHBvcnQgKiBhcyBYIGZyb20gJ3BhdGgnYCBkb2VzIG5vdCBjb25mbGljdFxuICAgICAgICBpZiAobm9kZS5leHBvcnRlZCAmJiBub2RlLmV4cG9ydGVkLm5hbWUpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgY29uc3QgcmVtb3RlRXhwb3J0cyA9IEV4cG9ydE1hcEJ1aWxkZXIuZ2V0KG5vZGUuc291cmNlLnZhbHVlLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKHJlbW90ZUV4cG9ydHMgPT0gbnVsbCkgeyByZXR1cm47IH1cblxuICAgICAgICBpZiAocmVtb3RlRXhwb3J0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgcmVtb3RlRXhwb3J0cy5yZXBvcnRFcnJvcnMoY29udGV4dCwgbm9kZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyZW50ID0gZ2V0UGFyZW50KG5vZGUpO1xuXG4gICAgICAgIGxldCBhbnkgPSBmYWxzZTtcbiAgICAgICAgcmVtb3RlRXhwb3J0cy5mb3JFYWNoKCh2LCBuYW1lKSA9PiB7XG4gICAgICAgICAgaWYgKG5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgICAgICAgYW55ID0gdHJ1ZTsgLy8gcG9vciBtYW4ncyBmaWx0ZXJcbiAgICAgICAgICAgIGFkZE5hbWVkKG5hbWUsIG5vZGUsIHBhcmVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIWFueSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KFxuICAgICAgICAgICAgbm9kZS5zb3VyY2UsXG4gICAgICAgICAgICBgTm8gbmFtZWQgZXhwb3J0cyBmb3VuZCBpbiBtb2R1bGUgJyR7bm9kZS5zb3VyY2UudmFsdWV9Jy5gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgICdQcm9ncmFtOmV4aXQnKCkge1xuICAgICAgICBmb3IgKGNvbnN0IFssIG5hbWVkXSBvZiBuYW1lc3BhY2UpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IFtuYW1lLCBub2Rlc10gb2YgbmFtZWQpIHtcbiAgICAgICAgICAgIHJlbW92ZVR5cGVzY3JpcHRGdW5jdGlvbk92ZXJsb2Fkcyhub2Rlcyk7XG5cbiAgICAgICAgICAgIGlmIChub2Rlcy5zaXplIDw9IDEpIHsgY29udGludWU7IH1cblxuICAgICAgICAgICAgaWYgKGlzVHlwZXNjcmlwdE5hbWVzcGFjZU1lcmdpbmcobm9kZXMpKSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuICAgICAgICAgICAgICBpZiAoc2hvdWxkU2tpcFR5cGVzY3JpcHROYW1lc3BhY2Uobm9kZSwgbm9kZXMpKSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09ICdkZWZhdWx0Jykge1xuICAgICAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KG5vZGUsICdNdWx0aXBsZSBkZWZhdWx0IGV4cG9ydHMuJyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoXG4gICAgICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgICAgICAgYE11bHRpcGxlIGV4cG9ydHMgb2YgbmFtZSAnJHtuYW1lLnJlcGxhY2UodHNUeXBlUHJlZml4LCAnJyl9Jy5gLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcbn07XG4iXX0=