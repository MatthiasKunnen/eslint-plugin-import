'use strict';




var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

var defs = {
  ArrayExpression: {
    option: 'allowArray',
    description: 'If `false`, will report default export of an array',
    message: 'Assign array to a variable before exporting as module default' },

  ArrowFunctionExpression: {
    option: 'allowArrowFunction',
    description: 'If `false`, will report default export of an arrow function',
    message: 'Assign arrow function to a variable before exporting as module default' },

  CallExpression: {
    option: 'allowCallExpression',
    description: 'If `false`, will report default export of a function call',
    message: 'Assign call result to a variable before exporting as module default',
    'default': true },

  ClassDeclaration: {
    option: 'allowAnonymousClass',
    description: 'If `false`, will report default export of an anonymous class',
    message: 'Unexpected default export of anonymous class',
    forbid: function () {function forbid(node) {return !node.declaration.id;}return forbid;}() },

  FunctionDeclaration: {
    option: 'allowAnonymousFunction',
    description: 'If `false`, will report default export of an anonymous function',
    message: 'Unexpected default export of anonymous function',
    forbid: function () {function forbid(node) {return !node.declaration.id;}return forbid;}() },

  Literal: {
    option: 'allowLiteral',
    description: 'If `false`, will report default export of a literal',
    message: 'Assign literal to a variable before exporting as module default' },

  ObjectExpression: {
    option: 'allowObject',
    description: 'If `false`, will report default export of an object expression',
    message: 'Assign object to a variable before exporting as module default' },

  TemplateLiteral: {
    option: 'allowLiteral',
    description: 'If `false`, will report default export of a literal',
    message: 'Assign literal to a variable before exporting as module default' },

  NewExpression: {
    option: 'allowNew',
    description: 'If `false`, will report default export of a class instantiation',
    message: 'Assign instance to a variable before exporting as module default' } }; /**
                                                                                      * @fileoverview Rule to disallow anonymous default exports.
                                                                                      * @author Duncan Beevers
                                                                                      */
var schemaProperties = Object.fromEntries(Object.values(defs).map(function (def) {return [def.option, {
    description: def.description,
    type: 'boolean' }];}));


var defaults = Object.fromEntries(Object.values(defs).map(function (def) {return [def.option, Object.hasOwn(def, 'default') ? def['default'] : false];}));

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      category: 'Style guide',
      description: 'Forbid anonymous values as default exports.',
      url: (0, _docsUrl2['default'])('no-anonymous-default-export') },


    schema: [
    {
      type: 'object',
      properties: schemaProperties,
      additionalProperties: false }] },




  create: function () {function create(context) {
      var options = Object.assign({}, defaults, context.options[0]);

      return {
        ExportDefaultDeclaration: function () {function ExportDefaultDeclaration(node) {
            var def = defs[node.declaration.type];

            // Recognized node type and allowed by configuration,
            //   and has no forbid check, or forbid check return value is truthy
            if (def && !options[def.option] && (!def.forbid || def.forbid(node))) {
              context.report({ node: node, message: def.message });
            }
          }return ExportDefaultDeclaration;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby1hbm9ueW1vdXMtZGVmYXVsdC1leHBvcnQuanMiXSwibmFtZXMiOlsiZGVmcyIsIkFycmF5RXhwcmVzc2lvbiIsIm9wdGlvbiIsImRlc2NyaXB0aW9uIiwibWVzc2FnZSIsIkFycm93RnVuY3Rpb25FeHByZXNzaW9uIiwiQ2FsbEV4cHJlc3Npb24iLCJDbGFzc0RlY2xhcmF0aW9uIiwiZm9yYmlkIiwibm9kZSIsImRlY2xhcmF0aW9uIiwiaWQiLCJGdW5jdGlvbkRlY2xhcmF0aW9uIiwiTGl0ZXJhbCIsIk9iamVjdEV4cHJlc3Npb24iLCJUZW1wbGF0ZUxpdGVyYWwiLCJOZXdFeHByZXNzaW9uIiwic2NoZW1hUHJvcGVydGllcyIsIk9iamVjdCIsImZyb21FbnRyaWVzIiwidmFsdWVzIiwibWFwIiwiZGVmIiwidHlwZSIsImRlZmF1bHRzIiwiaGFzT3duIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwiY2F0ZWdvcnkiLCJ1cmwiLCJzY2hlbWEiLCJwcm9wZXJ0aWVzIiwiYWRkaXRpb25hbFByb3BlcnRpZXMiLCJjcmVhdGUiLCJjb250ZXh0Iiwib3B0aW9ucyIsIkV4cG9ydERlZmF1bHREZWNsYXJhdGlvbiIsInJlcG9ydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxxQzs7QUFFQSxJQUFNQSxPQUFPO0FBQ1hDLG1CQUFpQjtBQUNmQyxZQUFRLFlBRE87QUFFZkMsaUJBQWEsb0RBRkU7QUFHZkMsYUFBUywrREFITSxFQUROOztBQU1YQywyQkFBeUI7QUFDdkJILFlBQVEsb0JBRGU7QUFFdkJDLGlCQUFhLDZEQUZVO0FBR3ZCQyxhQUFTLHdFQUhjLEVBTmQ7O0FBV1hFLGtCQUFnQjtBQUNkSixZQUFRLHFCQURNO0FBRWRDLGlCQUFhLDJEQUZDO0FBR2RDLGFBQVMscUVBSEs7QUFJZCxlQUFTLElBSkssRUFYTDs7QUFpQlhHLG9CQUFrQjtBQUNoQkwsWUFBUSxxQkFEUTtBQUVoQkMsaUJBQWEsOERBRkc7QUFHaEJDLGFBQVMsOENBSE87QUFJaEJJLHlCQUFRLGdCQUFDQyxJQUFELFVBQVUsQ0FBQ0EsS0FBS0MsV0FBTCxDQUFpQkMsRUFBNUIsRUFBUixpQkFKZ0IsRUFqQlA7O0FBdUJYQyx1QkFBcUI7QUFDbkJWLFlBQVEsd0JBRFc7QUFFbkJDLGlCQUFhLGlFQUZNO0FBR25CQyxhQUFTLGlEQUhVO0FBSW5CSSx5QkFBUSxnQkFBQ0MsSUFBRCxVQUFVLENBQUNBLEtBQUtDLFdBQUwsQ0FBaUJDLEVBQTVCLEVBQVIsaUJBSm1CLEVBdkJWOztBQTZCWEUsV0FBUztBQUNQWCxZQUFRLGNBREQ7QUFFUEMsaUJBQWEscURBRk47QUFHUEMsYUFBUyxpRUFIRixFQTdCRTs7QUFrQ1hVLG9CQUFrQjtBQUNoQlosWUFBUSxhQURRO0FBRWhCQyxpQkFBYSxnRUFGRztBQUdoQkMsYUFBUyxnRUFITyxFQWxDUDs7QUF1Q1hXLG1CQUFpQjtBQUNmYixZQUFRLGNBRE87QUFFZkMsaUJBQWEscURBRkU7QUFHZkMsYUFBUyxpRUFITSxFQXZDTjs7QUE0Q1hZLGlCQUFlO0FBQ2JkLFlBQVEsVUFESztBQUViQyxpQkFBYSxpRUFGQTtBQUdiQyxhQUFTLGtFQUhJLEVBNUNKLEVBQWIsQyxDQVBBOzs7O0FBMERBLElBQU1hLG1CQUFtQkMsT0FBT0MsV0FBUCxDQUFtQkQsT0FBT0UsTUFBUCxDQUFjcEIsSUFBZCxFQUFvQnFCLEdBQXBCLENBQXdCLFVBQUNDLEdBQUQsVUFBUyxDQUFDQSxJQUFJcEIsTUFBTCxFQUFhO0FBQ3hGQyxpQkFBYW1CLElBQUluQixXQUR1RTtBQUV4Rm9CLFVBQU0sU0FGa0YsRUFBYixDQUFULEVBQXhCLENBQW5CLENBQXpCOzs7QUFLQSxJQUFNQyxXQUFXTixPQUFPQyxXQUFQLENBQW1CRCxPQUFPRSxNQUFQLENBQWNwQixJQUFkLEVBQW9CcUIsR0FBcEIsQ0FBd0IsVUFBQ0MsR0FBRCxVQUFTLENBQUNBLElBQUlwQixNQUFMLEVBQWFnQixPQUFPTyxNQUFQLENBQWNILEdBQWQsRUFBbUIsU0FBbkIsSUFBZ0NBLGNBQWhDLEdBQThDLEtBQTNELENBQVQsRUFBeEIsQ0FBbkIsQ0FBakI7O0FBRUFJLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKTCxVQUFNLFlBREY7QUFFSk0sVUFBTTtBQUNKQyxnQkFBVSxhQUROO0FBRUozQixtQkFBYSw2Q0FGVDtBQUdKNEIsV0FBSywwQkFBUSw2QkFBUixDQUhELEVBRkY7OztBQVFKQyxZQUFRO0FBQ047QUFDRVQsWUFBTSxRQURSO0FBRUVVLGtCQUFZaEIsZ0JBRmQ7QUFHRWlCLDRCQUFzQixLQUh4QixFQURNLENBUkosRUFEUzs7Ozs7QUFrQmZDLFFBbEJlLCtCQWtCUkMsT0FsQlEsRUFrQkM7QUFDZCxVQUFNQyw0QkFBZWIsUUFBZixFQUE0QlksUUFBUUMsT0FBUixDQUFnQixDQUFoQixDQUE1QixDQUFOOztBQUVBLGFBQU87QUFDTEMsZ0NBREssaURBQ29CN0IsSUFEcEIsRUFDMEI7QUFDN0IsZ0JBQU1hLE1BQU10QixLQUFLUyxLQUFLQyxXQUFMLENBQWlCYSxJQUF0QixDQUFaOztBQUVBO0FBQ0E7QUFDQSxnQkFBSUQsT0FBTyxDQUFDZSxRQUFRZixJQUFJcEIsTUFBWixDQUFSLEtBQWdDLENBQUNvQixJQUFJZCxNQUFMLElBQWVjLElBQUlkLE1BQUosQ0FBV0MsSUFBWCxDQUEvQyxDQUFKLEVBQXNFO0FBQ3BFMkIsc0JBQVFHLE1BQVIsQ0FBZSxFQUFFOUIsVUFBRixFQUFRTCxTQUFTa0IsSUFBSWxCLE9BQXJCLEVBQWY7QUFDRDtBQUNGLFdBVEkscUNBQVA7O0FBV0QsS0FoQ2MsbUJBQWpCIiwiZmlsZSI6Im5vLWFub255bW91cy1kZWZhdWx0LWV4cG9ydC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVvdmVydmlldyBSdWxlIHRvIGRpc2FsbG93IGFub255bW91cyBkZWZhdWx0IGV4cG9ydHMuXG4gKiBAYXV0aG9yIER1bmNhbiBCZWV2ZXJzXG4gKi9cblxuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCc7XG5cbmNvbnN0IGRlZnMgPSB7XG4gIEFycmF5RXhwcmVzc2lvbjoge1xuICAgIG9wdGlvbjogJ2FsbG93QXJyYXknLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYXJyYXknLFxuICAgIG1lc3NhZ2U6ICdBc3NpZ24gYXJyYXkgdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd0Fycm93RnVuY3Rpb24nLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYXJyb3cgZnVuY3Rpb24nLFxuICAgIG1lc3NhZ2U6ICdBc3NpZ24gYXJyb3cgZnVuY3Rpb24gdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgQ2FsbEV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd0NhbGxFeHByZXNzaW9uJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgZnVuY3Rpb24gY2FsbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBjYWxsIHJlc3VsdCB0byBhIHZhcmlhYmxlIGJlZm9yZSBleHBvcnRpbmcgYXMgbW9kdWxlIGRlZmF1bHQnLFxuICAgIGRlZmF1bHQ6IHRydWUsXG4gIH0sXG4gIENsYXNzRGVjbGFyYXRpb246IHtcbiAgICBvcHRpb246ICdhbGxvd0Fub255bW91c0NsYXNzJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGFuIGFub255bW91cyBjbGFzcycsXG4gICAgbWVzc2FnZTogJ1VuZXhwZWN0ZWQgZGVmYXVsdCBleHBvcnQgb2YgYW5vbnltb3VzIGNsYXNzJyxcbiAgICBmb3JiaWQ6IChub2RlKSA9PiAhbm9kZS5kZWNsYXJhdGlvbi5pZCxcbiAgfSxcbiAgRnVuY3Rpb25EZWNsYXJhdGlvbjoge1xuICAgIG9wdGlvbjogJ2FsbG93QW5vbnltb3VzRnVuY3Rpb24nLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYW5vbnltb3VzIGZ1bmN0aW9uJyxcbiAgICBtZXNzYWdlOiAnVW5leHBlY3RlZCBkZWZhdWx0IGV4cG9ydCBvZiBhbm9ueW1vdXMgZnVuY3Rpb24nLFxuICAgIGZvcmJpZDogKG5vZGUpID0+ICFub2RlLmRlY2xhcmF0aW9uLmlkLFxuICB9LFxuICBMaXRlcmFsOiB7XG4gICAgb3B0aW9uOiAnYWxsb3dMaXRlcmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgbGl0ZXJhbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBsaXRlcmFsIHRvIGEgdmFyaWFibGUgYmVmb3JlIGV4cG9ydGluZyBhcyBtb2R1bGUgZGVmYXVsdCcsXG4gIH0sXG4gIE9iamVjdEV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd09iamVjdCcsXG4gICAgZGVzY3JpcHRpb246ICdJZiBgZmFsc2VgLCB3aWxsIHJlcG9ydCBkZWZhdWx0IGV4cG9ydCBvZiBhbiBvYmplY3QgZXhwcmVzc2lvbicsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBvYmplY3QgdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgVGVtcGxhdGVMaXRlcmFsOiB7XG4gICAgb3B0aW9uOiAnYWxsb3dMaXRlcmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgbGl0ZXJhbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBsaXRlcmFsIHRvIGEgdmFyaWFibGUgYmVmb3JlIGV4cG9ydGluZyBhcyBtb2R1bGUgZGVmYXVsdCcsXG4gIH0sXG4gIE5ld0V4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd05ldycsXG4gICAgZGVzY3JpcHRpb246ICdJZiBgZmFsc2VgLCB3aWxsIHJlcG9ydCBkZWZhdWx0IGV4cG9ydCBvZiBhIGNsYXNzIGluc3RhbnRpYXRpb24nLFxuICAgIG1lc3NhZ2U6ICdBc3NpZ24gaW5zdGFuY2UgdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbn07XG5cbmNvbnN0IHNjaGVtYVByb3BlcnRpZXMgPSBPYmplY3QuZnJvbUVudHJpZXMoT2JqZWN0LnZhbHVlcyhkZWZzKS5tYXAoKGRlZikgPT4gW2RlZi5vcHRpb24sIHtcbiAgZGVzY3JpcHRpb246IGRlZi5kZXNjcmlwdGlvbixcbiAgdHlwZTogJ2Jvb2xlYW4nLFxufV0pKTtcblxuY29uc3QgZGVmYXVsdHMgPSBPYmplY3QuZnJvbUVudHJpZXMoT2JqZWN0LnZhbHVlcyhkZWZzKS5tYXAoKGRlZikgPT4gW2RlZi5vcHRpb24sIE9iamVjdC5oYXNPd24oZGVmLCAnZGVmYXVsdCcpID8gZGVmLmRlZmF1bHQgOiBmYWxzZV0pKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gICAgZG9jczoge1xuICAgICAgY2F0ZWdvcnk6ICdTdHlsZSBndWlkZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZvcmJpZCBhbm9ueW1vdXMgdmFsdWVzIGFzIGRlZmF1bHQgZXhwb3J0cy4nLFxuICAgICAgdXJsOiBkb2NzVXJsKCduby1hbm9ueW1vdXMtZGVmYXVsdC1leHBvcnQnKSxcbiAgICB9LFxuXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiBzY2hlbWFQcm9wZXJ0aWVzLFxuICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlKGNvbnRleHQpIHtcbiAgICBjb25zdCBvcHRpb25zID0geyAuLi5kZWZhdWx0cywgLi4uY29udGV4dC5vcHRpb25zWzBdIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uKG5vZGUpIHtcbiAgICAgICAgY29uc3QgZGVmID0gZGVmc1tub2RlLmRlY2xhcmF0aW9uLnR5cGVdO1xuXG4gICAgICAgIC8vIFJlY29nbml6ZWQgbm9kZSB0eXBlIGFuZCBhbGxvd2VkIGJ5IGNvbmZpZ3VyYXRpb24sXG4gICAgICAgIC8vICAgYW5kIGhhcyBubyBmb3JiaWQgY2hlY2ssIG9yIGZvcmJpZCBjaGVjayByZXR1cm4gdmFsdWUgaXMgdHJ1dGh5XG4gICAgICAgIGlmIChkZWYgJiYgIW9wdGlvbnNbZGVmLm9wdGlvbl0gJiYgKCFkZWYuZm9yYmlkIHx8IGRlZi5mb3JiaWQobm9kZSkpKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoeyBub2RlLCBtZXNzYWdlOiBkZWYubWVzc2FnZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9LFxufTtcbiJdfQ==