'use strict';var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

function isNonExportStatement(_ref) {var type = _ref.type;
  return type !== 'ExportDefaultDeclaration' &&
  type !== 'ExportNamedDeclaration' &&
  type !== 'ExportAllDeclaration';
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      category: 'Style guide',
      description: 'Ensure all exports appear after other statements.',
      url: (0, _docsUrl2['default'])('exports-last') },

    schema: [] },


  create: function () {function create(context) {
      return {
        Program: function () {function Program(_ref2) {var body = _ref2.body;
            var lastNonExportStatementIndex = body.findLastIndex(isNonExportStatement);

            if (lastNonExportStatementIndex !== -1) {
              body.slice(0, lastNonExportStatementIndex).forEach(function (node) {
                if (!isNonExportStatement(node)) {
                  context.report({
                    node: node,
                    message: 'Export statements should appear at the end of the file' });

                }
              });
            }
          }return Program;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9leHBvcnRzLWxhc3QuanMiXSwibmFtZXMiOlsiaXNOb25FeHBvcnRTdGF0ZW1lbnQiLCJ0eXBlIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwiY2F0ZWdvcnkiLCJkZXNjcmlwdGlvbiIsInVybCIsInNjaGVtYSIsImNyZWF0ZSIsImNvbnRleHQiLCJQcm9ncmFtIiwiYm9keSIsImxhc3ROb25FeHBvcnRTdGF0ZW1lbnRJbmRleCIsImZpbmRMYXN0SW5kZXgiLCJzbGljZSIsImZvckVhY2giLCJub2RlIiwicmVwb3J0IiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6ImFBQUEscUM7O0FBRUEsU0FBU0Esb0JBQVQsT0FBd0MsS0FBUkMsSUFBUSxRQUFSQSxJQUFRO0FBQ3RDLFNBQU9BLFNBQVMsMEJBQVQ7QUFDRkEsV0FBUyx3QkFEUDtBQUVGQSxXQUFTLHNCQUZkO0FBR0Q7O0FBRURDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKSCxVQUFNLFlBREY7QUFFSkksVUFBTTtBQUNKQyxnQkFBVSxhQUROO0FBRUpDLG1CQUFhLG1EQUZUO0FBR0pDLFdBQUssMEJBQVEsY0FBUixDQUhELEVBRkY7O0FBT0pDLFlBQVEsRUFQSixFQURTOzs7QUFXZkMsUUFYZSwrQkFXUkMsT0FYUSxFQVdDO0FBQ2QsYUFBTztBQUNMQyxlQURLLHVDQUNhLEtBQVJDLElBQVEsU0FBUkEsSUFBUTtBQUNoQixnQkFBTUMsOEJBQThCRCxLQUFLRSxhQUFMLENBQW1CZixvQkFBbkIsQ0FBcEM7O0FBRUEsZ0JBQUljLGdDQUFnQyxDQUFDLENBQXJDLEVBQXdDO0FBQ3RDRCxtQkFBS0csS0FBTCxDQUFXLENBQVgsRUFBY0YsMkJBQWQsRUFBMkNHLE9BQTNDLENBQW1ELFVBQUNDLElBQUQsRUFBVTtBQUMzRCxvQkFBSSxDQUFDbEIscUJBQXFCa0IsSUFBckIsQ0FBTCxFQUFpQztBQUMvQlAsMEJBQVFRLE1BQVIsQ0FBZTtBQUNiRCw4QkFEYTtBQUViRSw2QkFBUyx3REFGSSxFQUFmOztBQUlEO0FBQ0YsZUFQRDtBQVFEO0FBQ0YsV0FkSSxvQkFBUDs7QUFnQkQsS0E1QmMsbUJBQWpCIiwiZmlsZSI6ImV4cG9ydHMtbGFzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnO1xuXG5mdW5jdGlvbiBpc05vbkV4cG9ydFN0YXRlbWVudCh7IHR5cGUgfSkge1xuICByZXR1cm4gdHlwZSAhPT0gJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbidcbiAgICAmJiB0eXBlICE9PSAnRXhwb3J0TmFtZWREZWNsYXJhdGlvbidcbiAgICAmJiB0eXBlICE9PSAnRXhwb3J0QWxsRGVjbGFyYXRpb24nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIHR5cGU6ICdzdWdnZXN0aW9uJyxcbiAgICBkb2NzOiB7XG4gICAgICBjYXRlZ29yeTogJ1N0eWxlIGd1aWRlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW5zdXJlIGFsbCBleHBvcnRzIGFwcGVhciBhZnRlciBvdGhlciBzdGF0ZW1lbnRzLicsXG4gICAgICB1cmw6IGRvY3NVcmwoJ2V4cG9ydHMtbGFzdCcpLFxuICAgIH0sXG4gICAgc2NoZW1hOiBbXSxcbiAgfSxcblxuICBjcmVhdGUoY29udGV4dCkge1xuICAgIHJldHVybiB7XG4gICAgICBQcm9ncmFtKHsgYm9keSB9KSB7XG4gICAgICAgIGNvbnN0IGxhc3ROb25FeHBvcnRTdGF0ZW1lbnRJbmRleCA9IGJvZHkuZmluZExhc3RJbmRleChpc05vbkV4cG9ydFN0YXRlbWVudCk7XG5cbiAgICAgICAgaWYgKGxhc3ROb25FeHBvcnRTdGF0ZW1lbnRJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBib2R5LnNsaWNlKDAsIGxhc3ROb25FeHBvcnRTdGF0ZW1lbnRJbmRleCkuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFpc05vbkV4cG9ydFN0YXRlbWVudChub2RlKSkge1xuICAgICAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRXhwb3J0IHN0YXRlbWVudHMgc2hvdWxkIGFwcGVhciBhdCB0aGUgZW5kIG9mIHRoZSBmaWxlJyxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcbn07XG4iXX0=