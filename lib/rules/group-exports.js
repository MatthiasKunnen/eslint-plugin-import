'use strict';var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

var meta = {
  type: 'suggestion',
  docs: {
    category: 'Style guide',
    description: 'Prefer named exports to be grouped together in a single export declaration',
    url: (0, _docsUrl2['default'])('group-exports') } };


/* eslint-disable max-len */
var errors = {
  ExportNamedDeclaration: 'Multiple named export declarations; consolidate all named exports into a single export declaration',
  AssignmentExpression: 'Multiple CommonJS exports; consolidate all exports into a single assignment to `module.exports`' };

/* eslint-enable max-len */

/**
                             * Returns an array with names of the properties in the accessor chain for MemberExpression nodes
                             *
                             * Example:
                             *
                             * `module.exports = {}` => ['module', 'exports']
                             * `module.exports.property = true` => ['module', 'exports', 'property']
                             *
                             * @param     {Node}    node    AST Node (MemberExpression)
                             * @return    {Array}           Array with the property names in the chain
                             * @private
                             */
function accessorChain(node) {
  var chain = [];

  do {
    chain.unshift(node.property.name);

    if (node.object.type === 'Identifier') {
      chain.unshift(node.object.name);
      break;
    }

    node = node.object;
  } while (node.type === 'MemberExpression');

  return chain;
}

function create(context) {
  var nodes = {
    modules: {
      set: new Set(),
      sources: {} },

    types: {
      set: new Set(),
      sources: {} },

    commonjs: {
      set: new Set() } };



  return {
    ExportNamedDeclaration: function () {function ExportNamedDeclaration(node) {
        var target = node.exportKind === 'type' ? nodes.types : nodes.modules;
        if (!node.source) {
          target.set.add(node);
        } else if (Array.isArray(target.sources[node.source.value])) {
          target.sources[node.source.value].push(node);
        } else {
          target.sources[node.source.value] = [node];
        }
      }return ExportNamedDeclaration;}(),

    AssignmentExpression: function () {function AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') {
          return;
        }

        var chain = accessorChain(node.left);

        // Assignments to module.exports
        // Deeper assignments are ignored since they just modify what's already being exported
        // (ie. module.exports.exported.prop = true is ignored)
        if (chain[0] === 'module' && chain[1] === 'exports' && chain.length <= 3) {
          nodes.commonjs.set.add(node);
          return;
        }

        // Assignments to exports (exports.* = *)
        if (chain[0] === 'exports' && chain.length === 2) {
          nodes.commonjs.set.add(node);
          return;
        }
      }return AssignmentExpression;}(),

    'Program:exit': function () {function onExit() {
        // Report multiple `export` declarations (ES2015 modules)
        if (nodes.modules.set.size > 1) {
          nodes.modules.set.forEach(function (node) {
            context.report({
              node: node,
              message: errors[node.type] });

          });
        }

        // Report multiple `aggregated exports` from the same module (ES2015 modules)
        Object.values(nodes.modules.sources).
        filter(function (nodesWithSource) {return Array.isArray(nodesWithSource) && nodesWithSource.length > 1;}).
        flat().
        forEach(function (node) {
          context.report({
            node: node,
            message: errors[node.type] });

        });

        // Report multiple `export type` declarations (FLOW ES2015 modules)
        if (nodes.types.set.size > 1) {
          nodes.types.set.forEach(function (node) {
            context.report({
              node: node,
              message: errors[node.type] });

          });
        }

        // Report multiple `aggregated type exports` from the same module (FLOW ES2015 modules)
        Object.values(nodes.types.sources).
        filter(function (nodesWithSource) {return Array.isArray(nodesWithSource) && nodesWithSource.length > 1;}).
        flat().
        forEach(function (node) {
          context.report({
            node: node,
            message: errors[node.type] });

        });

        // Report multiple `module.exports` assignments (CommonJS)
        if (nodes.commonjs.set.size > 1) {
          nodes.commonjs.set.forEach(function (node) {
            context.report({
              node: node,
              message: errors[node.type] });

          });
        }
      }return onExit;}() };

}

module.exports = {
  meta: meta,
  create: create };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9ncm91cC1leHBvcnRzLmpzIl0sIm5hbWVzIjpbIm1ldGEiLCJ0eXBlIiwiZG9jcyIsImNhdGVnb3J5IiwiZGVzY3JpcHRpb24iLCJ1cmwiLCJlcnJvcnMiLCJFeHBvcnROYW1lZERlY2xhcmF0aW9uIiwiQXNzaWdubWVudEV4cHJlc3Npb24iLCJhY2Nlc3NvckNoYWluIiwibm9kZSIsImNoYWluIiwidW5zaGlmdCIsInByb3BlcnR5IiwibmFtZSIsIm9iamVjdCIsImNyZWF0ZSIsImNvbnRleHQiLCJub2RlcyIsIm1vZHVsZXMiLCJzZXQiLCJTZXQiLCJzb3VyY2VzIiwidHlwZXMiLCJjb21tb25qcyIsInRhcmdldCIsImV4cG9ydEtpbmQiLCJzb3VyY2UiLCJhZGQiLCJBcnJheSIsImlzQXJyYXkiLCJ2YWx1ZSIsInB1c2giLCJsZWZ0IiwibGVuZ3RoIiwib25FeGl0Iiwic2l6ZSIsImZvckVhY2giLCJyZXBvcnQiLCJtZXNzYWdlIiwiT2JqZWN0IiwidmFsdWVzIiwiZmlsdGVyIiwibm9kZXNXaXRoU291cmNlIiwiZmxhdCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiJhQUFBLHFDOztBQUVBLElBQU1BLE9BQU87QUFDWEMsUUFBTSxZQURLO0FBRVhDLFFBQU07QUFDSkMsY0FBVSxhQUROO0FBRUpDLGlCQUFhLDRFQUZUO0FBR0pDLFNBQUssMEJBQVEsZUFBUixDQUhELEVBRkssRUFBYjs7O0FBUUE7QUFDQSxJQUFNQyxTQUFTO0FBQ2JDLDBCQUF3QixvR0FEWDtBQUViQyx3QkFBc0IsaUdBRlQsRUFBZjs7QUFJQTs7QUFFQTs7Ozs7Ozs7Ozs7O0FBWUEsU0FBU0MsYUFBVCxDQUF1QkMsSUFBdkIsRUFBNkI7QUFDM0IsTUFBTUMsUUFBUSxFQUFkOztBQUVBLEtBQUc7QUFDREEsVUFBTUMsT0FBTixDQUFjRixLQUFLRyxRQUFMLENBQWNDLElBQTVCOztBQUVBLFFBQUlKLEtBQUtLLE1BQUwsQ0FBWWQsSUFBWixL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QUFpQjtBQUNmOUMsWUFEZTtBQUVmZ0IsZ0JBRmUsRUFBakIiLCJmaWxlIjoiZ3JvdXAtZXhwb3J0cy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnO1xuXG5jb25zdCBtZXRhID0ge1xuICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gIGRvY3M6IHtcbiAgICBjYXRlZ29yeTogJ1N0eWxlIGd1aWRlJyxcbiAgICBkZXNjcmlwdGlvbjogJ1ByZWZlciBuYW1lZCBleHBvcnRzIHRvIGJlIGdyb3VwZWQgdG9nZXRoZXIgaW4gYSBzaW5nbGUgZXhwb3J0IGRlY2xhcmF0aW9uJyxcbiAgICB1cmw6IGRvY3NVcmwoJ2dyb3VwLWV4cG9ydHMnKSxcbiAgfSxcbn07XG4vKiBlc2xpbnQtZGlzYWJsZSBtYXgtbGVuICovXG5jb25zdCBlcnJvcnMgPSB7XG4gIEV4cG9ydE5hbWVkRGVjbGFyYXRpb246ICdNdWx0aXBsZSBuYW1lZCBleHBvcnQgZGVjbGFyYXRpb25zOyBjb25zb2xpZGF0ZSBhbGwgbmFtZWQgZXhwb3J0cyBpbnRvIGEgc2luZ2xlIGV4cG9ydCBkZWNsYXJhdGlvbicsXG4gIEFzc2lnbm1lbnRFeHByZXNzaW9uOiAnTXVsdGlwbGUgQ29tbW9uSlMgZXhwb3J0czsgY29uc29saWRhdGUgYWxsIGV4cG9ydHMgaW50byBhIHNpbmdsZSBhc3NpZ25tZW50IHRvIGBtb2R1bGUuZXhwb3J0c2AnLFxufTtcbi8qIGVzbGludC1lbmFibGUgbWF4LWxlbiAqL1xuXG4vKipcbiAqIFJldHVybnMgYW4gYXJyYXkgd2l0aCBuYW1lcyBvZiB0aGUgcHJvcGVydGllcyBpbiB0aGUgYWNjZXNzb3IgY2hhaW4gZm9yIE1lbWJlckV4cHJlc3Npb24gbm9kZXNcbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqIGBtb2R1bGUuZXhwb3J0cyA9IHt9YCA9PiBbJ21vZHVsZScsICdleHBvcnRzJ11cbiAqIGBtb2R1bGUuZXhwb3J0cy5wcm9wZXJ0eSA9IHRydWVgID0+IFsnbW9kdWxlJywgJ2V4cG9ydHMnLCAncHJvcGVydHknXVxuICpcbiAqIEBwYXJhbSAgICAge05vZGV9ICAgIG5vZGUgICAgQVNUIE5vZGUgKE1lbWJlckV4cHJlc3Npb24pXG4gKiBAcmV0dXJuICAgIHtBcnJheX0gICAgICAgICAgIEFycmF5IHdpdGggdGhlIHByb3BlcnR5IG5hbWVzIGluIHRoZSBjaGFpblxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gYWNjZXNzb3JDaGFpbihub2RlKSB7XG4gIGNvbnN0IGNoYWluID0gW107XG5cbiAgZG8ge1xuICAgIGNoYWluLnVuc2hpZnQobm9kZS5wcm9wZXJ0eS5uYW1lKTtcblxuICAgIGlmIChub2RlLm9iamVjdC50eXBlID09PSAnSWRlbnRpZmllcicpIHtcbiAgICAgIGNoYWluLnVuc2hpZnQobm9kZS5vYmplY3QubmFtZSk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBub2RlID0gbm9kZS5vYmplY3Q7XG4gIH0gd2hpbGUgKG5vZGUudHlwZSA9PT0gJ01lbWJlckV4cHJlc3Npb24nKTtcblxuICByZXR1cm4gY2hhaW47XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZShjb250ZXh0KSB7XG4gIGNvbnN0IG5vZGVzID0ge1xuICAgIG1vZHVsZXM6IHtcbiAgICAgIHNldDogbmV3IFNldCgpLFxuICAgICAgc291cmNlczoge30sXG4gICAgfSxcbiAgICB0eXBlczoge1xuICAgICAgc2V0OiBuZXcgU2V0KCksXG4gICAgICBzb3VyY2VzOiB7fSxcbiAgICB9LFxuICAgIGNvbW1vbmpzOiB7XG4gICAgICBzZXQ6IG5ldyBTZXQoKSxcbiAgICB9LFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgRXhwb3J0TmFtZWREZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBub2RlLmV4cG9ydEtpbmQgPT09ICd0eXBlJyA/IG5vZGVzLnR5cGVzIDogbm9kZXMubW9kdWxlcztcbiAgICAgIGlmICghbm9kZS5zb3VyY2UpIHtcbiAgICAgICAgdGFyZ2V0LnNldC5hZGQobm9kZSk7XG4gICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodGFyZ2V0LnNvdXJjZXNbbm9kZS5zb3VyY2UudmFsdWVdKSkge1xuICAgICAgICB0YXJnZXQuc291cmNlc1tub2RlLnNvdXJjZS52YWx1ZV0ucHVzaChub2RlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldC5zb3VyY2VzW25vZGUuc291cmNlLnZhbHVlXSA9IFtub2RlXTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgQXNzaWdubWVudEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgaWYgKG5vZGUubGVmdC50eXBlICE9PSAnTWVtYmVyRXhwcmVzc2lvbicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjaGFpbiA9IGFjY2Vzc29yQ2hhaW4obm9kZS5sZWZ0KTtcblxuICAgICAgLy8gQXNzaWdubWVudHMgdG8gbW9kdWxlLmV4cG9ydHNcbiAgICAgIC8vIERlZXBlciBhc3NpZ25tZW50cyBhcmUgaWdub3JlZCBzaW5jZSB0aGV5IGp1c3QgbW9kaWZ5IHdoYXQncyBhbHJlYWR5IGJlaW5nIGV4cG9ydGVkXG4gICAgICAvLyAoaWUuIG1vZHVsZS5leHBvcnRzLmV4cG9ydGVkLnByb3AgPSB0cnVlIGlzIGlnbm9yZWQpXG4gICAgICBpZiAoY2hhaW5bMF0gPT09ICdtb2R1bGUnICYmIGNoYWluWzFdID09PSAnZXhwb3J0cycgJiYgY2hhaW4ubGVuZ3RoIDw9IDMpIHtcbiAgICAgICAgbm9kZXMuY29tbW9uanMuc2V0LmFkZChub2RlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBBc3NpZ25tZW50cyB0byBleHBvcnRzIChleHBvcnRzLiogPSAqKVxuICAgICAgaWYgKGNoYWluWzBdID09PSAnZXhwb3J0cycgJiYgY2hhaW4ubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIG5vZGVzLmNvbW1vbmpzLnNldC5hZGQobm9kZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgJ1Byb2dyYW06ZXhpdCc6IGZ1bmN0aW9uIG9uRXhpdCgpIHtcbiAgICAgIC8vIFJlcG9ydCBtdWx0aXBsZSBgZXhwb3J0YCBkZWNsYXJhdGlvbnMgKEVTMjAxNSBtb2R1bGVzKVxuICAgICAgaWYgKG5vZGVzLm1vZHVsZXMuc2V0LnNpemUgPiAxKSB7XG4gICAgICAgIG5vZGVzLm1vZHVsZXMuc2V0LmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JzW25vZGUudHlwZV0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXBvcnQgbXVsdGlwbGUgYGFnZ3JlZ2F0ZWQgZXhwb3J0c2AgZnJvbSB0aGUgc2FtZSBtb2R1bGUgKEVTMjAxNSBtb2R1bGVzKVxuICAgICAgT2JqZWN0LnZhbHVlcyhub2Rlcy5tb2R1bGVzLnNvdXJjZXMpXG4gICAgICAgIC5maWx0ZXIoKG5vZGVzV2l0aFNvdXJjZSkgPT4gQXJyYXkuaXNBcnJheShub2Rlc1dpdGhTb3VyY2UpICYmIG5vZGVzV2l0aFNvdXJjZS5sZW5ndGggPiAxKVxuICAgICAgICAuZmxhdCgpXG4gICAgICAgIC5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yc1tub2RlLnR5cGVdLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gUmVwb3J0IG11bHRpcGxlIGBleHBvcnQgdHlwZWAgZGVjbGFyYXRpb25zIChGTE9XIEVTMjAxNSBtb2R1bGVzKVxuICAgICAgaWYgKG5vZGVzLnR5cGVzLnNldC5zaXplID4gMSkge1xuICAgICAgICBub2Rlcy50eXBlcy5zZXQuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvcnNbbm9kZS50eXBlXSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlcG9ydCBtdWx0aXBsZSBgYWdncmVnYXRlZCB0eXBlIGV4cG9ydHNgIGZyb20gdGhlIHNhbWUgbW9kdWxlIChGTE9XIEVTMjAxNSBtb2R1bGVzKVxuICAgICAgT2JqZWN0LnZhbHVlcyhub2Rlcy50eXBlcy5zb3VyY2VzKVxuICAgICAgICAuZmlsdGVyKChub2Rlc1dpdGhTb3VyY2UpID0+IEFycmF5LmlzQXJyYXkobm9kZXNXaXRoU291cmNlKSAmJiBub2Rlc1dpdGhTb3VyY2UubGVuZ3RoID4gMSlcbiAgICAgICAgLmZsYXQoKVxuICAgICAgICAuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvcnNbbm9kZS50eXBlXSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIFJlcG9ydCBtdWx0aXBsZSBgbW9kdWxlLmV4cG9ydHNgIGFzc2lnbm1lbnRzIChDb21tb25KUylcbiAgICAgIGlmIChub2Rlcy5jb21tb25qcy5zZXQuc2l6ZSA+IDEpIHtcbiAgICAgICAgbm9kZXMuY29tbW9uanMuc2V0LmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JzW25vZGUudHlwZV0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhLFxuICBjcmVhdGUsXG59O1xuIl19