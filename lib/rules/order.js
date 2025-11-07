'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();

var _minimatch = require('minimatch');var _minimatch2 = _interopRequireDefault(_minimatch);
var _contextCompat = require('eslint-module-utils/contextCompat');

var _importType = require('../core/importType');var _importType2 = _interopRequireDefault(_importType);
var _staticRequire = require('../core/staticRequire');var _staticRequire2 = _interopRequireDefault(_staticRequire);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

var categories = {
  named: 'named',
  'import': 'import',
  exports: 'exports' };


var defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index'];

// REPORTING AND FIXING

function reverse(array) {
  return array.map(function (v) {return Object.assign({}, v, { rank: -v.rank });}).reverse();
}

function getTokensOrCommentsAfter(sourceCode, node, count) {
  var currentNodeOrToken = node;
  var result = [];
  for (var i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentAfter(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result;
}

function getTokensOrCommentsBefore(sourceCode, node, count) {
  var currentNodeOrToken = node;
  var result = [];
  for (var i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentBefore(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result.reverse();
}

function takeTokensAfterWhile(sourceCode, node, condition) {
  var tokens = getTokensOrCommentsAfter(sourceCode, node, 100);
  var result = [];
  for (var i = 0; i < tokens.length; i++) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result;
}

function takeTokensBeforeWhile(sourceCode, node, condition) {
  var tokens = getTokensOrCommentsBefore(sourceCode, node, 100);
  var result = [];
  for (var i = tokens.length - 1; i >= 0; i--) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result.reverse();
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return [];
  }
  var maxSeenRankNode = imported[0];
  return imported.filter(function (importedModule) {
    var res = importedModule.rank < maxSeenRankNode.rank;
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule;
    }
    return res;
  });
}

function findRootNode(node) {
  var parent = node;
  while (parent.parent != null && parent.parent.body == null) {
    parent = parent.parent;
  }
  return parent;
}

function commentOnSameLineAs(node) {
  return function (token) {return (token.type === 'Block' || token.type === 'Line') &&
    token.loc.start.line === token.loc.end.line &&
    token.loc.end.line === node.loc.end.line;};
}

function findEndOfLineWithComments(sourceCode, node) {
  var tokensToEndOfLine = takeTokensAfterWhile(sourceCode, node, commentOnSameLineAs(node));
  var endOfTokens = tokensToEndOfLine.length > 0 ?
  tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1] :
  node.range[1];
  var result = endOfTokens;
  for (var i = endOfTokens; i < sourceCode.text.length; i++) {
    if (sourceCode.text[i] === '\n') {
      result = i + 1;
      break;
    }
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t' && sourceCode.text[i] !== '\r') {
      break;
    }
    result = i + 1;
  }
  return result;
}

function findStartOfLineWithComments(sourceCode, node) {
  var tokensToEndOfLine = takeTokensBeforeWhile(sourceCode, node, commentOnSameLineAs(node));
  var startOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[0].range[0] : node.range[0];
  var result = startOfTokens;
  for (var i = startOfTokens - 1; i > 0; i--) {
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t') {
      break;
    }
    result = i;
  }
  return result;
}

function findSpecifierStart(sourceCode, node) {
  var token = void 0;

  do {
    token = sourceCode.getTokenBefore(node);
  } while (token.value !== ',' && token.value !== '{');

  return token.range[1];
}

function findSpecifierEnd(sourceCode, node) {
  var token = void 0;

  do {
    token = sourceCode.getTokenAfter(node);
  } while (token.value !== ',' && token.value !== '}');

  return token.range[0];
}

function isRequireExpression(expr) {
  return expr != null &&
  expr.type === 'CallExpression' &&
  expr.callee != null &&
  expr.callee.name === 'require' &&
  expr.arguments != null &&
  expr.arguments.length === 1 &&
  expr.arguments[0].type === 'Literal';
}

function isSupportedRequireModule(node) {
  if (node.type !== 'VariableDeclaration') {
    return false;
  }
  if (node.declarations.length !== 1) {
    return false;
  }
  var decl = node.declarations[0];
  var isPlainRequire = decl.id && (
  decl.id.type === 'Identifier' || decl.id.type === 'ObjectPattern') &&
  isRequireExpression(decl.init);
  var isRequireWithMemberExpression = decl.id && (
  decl.id.type === 'Identifier' || decl.id.type === 'ObjectPattern') &&
  decl.init != null &&
  decl.init.type === 'CallExpression' &&
  decl.init.callee != null &&
  decl.init.callee.type === 'MemberExpression' &&
  isRequireExpression(decl.init.callee.object);
  return isPlainRequire || isRequireWithMemberExpression;
}

function isPlainImportModule(node) {
  return node.type === 'ImportDeclaration' && node.specifiers != null && node.specifiers.length > 0;
}

function isPlainImportEquals(node) {
  return node.type === 'TSImportEqualsDeclaration' && node.moduleReference.expression;
}

function isCJSExports(context, node) {
  if (
  node.type === 'MemberExpression' &&
  node.object.type === 'Identifier' &&
  node.property.type === 'Identifier' &&
  node.object.name === 'module' &&
  node.property.name === 'exports')
  {
    return (0, _contextCompat.getScope)(context, node).variables.findIndex(function (variable) {return variable.name === 'module';}) === -1;
  }
  if (
  node.type === 'Identifier' &&
  node.name === 'exports')
  {
    return (0, _contextCompat.getScope)(context, node).variables.findIndex(function (variable) {return variable.name === 'exports';}) === -1;
  }
}

function getNamedCJSExports(context, node) {
  if (node.type !== 'MemberExpression') {
    return;
  }
  var result = [];
  var root = node;
  var parent = null;
  while (root.type === 'MemberExpression') {
    if (root.property.type !== 'Identifier') {
      return;
    }
    result.unshift(root.property.name);
    parent = root;
    root = root.object;
  }

  if (isCJSExports(context, root)) {
    return result;
  }

  if (isCJSExports(context, parent)) {
    return result.slice(1);
  }
}

function canCrossNodeWhileReorder(node) {
  return isSupportedRequireModule(node) || isPlainImportModule(node) || isPlainImportEquals(node);
}

function canReorderItems(firstNode, secondNode) {
  var parent = firstNode.parent;var _sort =
  [
  parent.body.indexOf(firstNode),
  parent.body.indexOf(secondNode)].
  sort(),_sort2 = _slicedToArray(_sort, 2),firstIndex = _sort2[0],secondIndex = _sort2[1];
  var nodesBetween = parent.body.slice(firstIndex, secondIndex + 1);var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
    for (var _iterator = nodesBetween[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var nodeBetween = _step.value;
      if (!canCrossNodeWhileReorder(nodeBetween)) {
        return false;
      }
    }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
  return true;
}

function makeImportDescription(node) {
  if (node.type === 'export') {
    if (node.node.exportKind === 'type') {
      return 'type export';
    }
    return 'export';
  }
  if (node.node.importKind === 'type') {
    return 'type import';
  }
  if (node.node.importKind === 'typeof') {
    return 'typeof import';
  }
  return 'import';
}

function fixOutOfOrder(context, firstNode, secondNode, order, category) {
  var isNamed = category === categories.named;
  var isExports = category === categories.exports;
  var sourceCode = (0, _contextCompat.getSourceCode)(context);var _ref =




  isNamed ? {
    firstRoot: firstNode.node,
    secondRoot: secondNode.node } :
  {
    firstRoot: findRootNode(firstNode.node),
    secondRoot: findRootNode(secondNode.node) },firstRoot = _ref.firstRoot,secondRoot = _ref.secondRoot;var _ref2 =







  isNamed ? {
    firstRootStart: findSpecifierStart(sourceCode, firstRoot),
    firstRootEnd: findSpecifierEnd(sourceCode, firstRoot),
    secondRootStart: findSpecifierStart(sourceCode, secondRoot),
    secondRootEnd: findSpecifierEnd(sourceCode, secondRoot) } :
  {
    firstRootStart: findStartOfLineWithComments(sourceCode, firstRoot),
    firstRootEnd: findEndOfLineWithComments(sourceCode, firstRoot),
    secondRootStart: findStartOfLineWithComments(sourceCode, secondRoot),
    secondRootEnd: findEndOfLineWithComments(sourceCode, secondRoot) },firstRootStart = _ref2.firstRootStart,firstRootEnd = _ref2.firstRootEnd,secondRootStart = _ref2.secondRootStart,secondRootEnd = _ref2.secondRootEnd;


  if (firstNode.displayName === secondNode.displayName) {
    if (firstNode.alias) {
      firstNode.displayName = String(firstNode.displayName) + ' as ' + String(firstNode.alias);
    }
    if (secondNode.alias) {
      secondNode.displayName = String(secondNode.displayName) + ' as ' + String(secondNode.alias);
    }
  }

  var firstImport = String(makeImportDescription(firstNode)) + ' of `' + String(firstNode.displayName) + '`';
  var secondImport = '`' + String(secondNode.displayName) + '` ' + String(makeImportDescription(secondNode));
  var message = secondImport + ' should occur ' + String(order) + ' ' + firstImport;

  if (isNamed) {
    var firstCode = sourceCode.text.slice(firstRootStart, firstRoot.range[1]);
    var firstTrivia = sourceCode.text.slice(firstRoot.range[1], firstRootEnd);
    var secondCode = sourceCode.text.slice(secondRootStart, secondRoot.range[1]);
    var secondTrivia = sourceCode.text.slice(secondRoot.range[1], secondRootEnd);

    if (order === 'before') {
      var trimmedTrivia = secondTrivia.trimEnd();
      var gapCode = sourceCode.text.slice(firstRootEnd, secondRootStart - 1);
      var whitespaces = secondTrivia.slice(trimmedTrivia.length);
      context.report({
        node: secondNode.node,
        message: message,
        fix: function () {function fix(fixer) {return fixer.replaceTextRange(
            [firstRootStart, secondRootEnd], String(
            secondCode) + ',' + String(trimmedTrivia) + String(firstCode) + String(firstTrivia) + String(gapCode) + String(whitespaces));}return fix;}() });


    } else if (order === 'after') {
      var _trimmedTrivia = firstTrivia.trimEnd();
      var _gapCode = sourceCode.text.slice(secondRootEnd + 1, firstRootStart);
      var _whitespaces = firstTrivia.slice(_trimmedTrivia.length);
      context.report({
        node: secondNode.node,
        message: message,
        fix: function () {function fix(fixes) {return fixes.replaceTextRange(
            [secondRootStart, firstRootEnd], '' + String(
            _gapCode) + String(firstCode) + ',' + String(_trimmedTrivia) + String(secondCode) + String(_whitespaces));}return fix;}() });


    }
  } else {
    var canFix = isExports || canReorderItems(firstRoot, secondRoot);
    var newCode = sourceCode.text.substring(secondRootStart, secondRootEnd);

    if (newCode[newCode.length - 1] !== '\n') {
      newCode = String(newCode) + '\n';
    }

    if (order === 'before') {
      context.report({
        node: secondNode.node,
        message: message,
        fix: canFix && function (fixer) {return fixer.replaceTextRange(
          [firstRootStart, secondRootEnd],
          newCode + sourceCode.text.substring(firstRootStart, secondRootStart));} });


    } else if (order === 'after') {
      context.report({
        node: secondNode.node,
        message: message,
        fix: canFix && function (fixer) {return fixer.replaceTextRange(
          [secondRootStart, firstRootEnd],
          sourceCode.text.substring(secondRootEnd, firstRootEnd) + newCode);} });


    }
  }
}

function reportOutOfOrder(context, imported, outOfOrder, order, category) {
  outOfOrder.forEach(function (imp) {
    var found = imported.find(function () {function hasHigherRank(importedItem) {
        return importedItem.rank > imp.rank;
      }return hasHigherRank;}());
    fixOutOfOrder(context, found, imp, order, category);
  });
}

function makeOutOfOrderReport(context, imported, category) {
  var outOfOrder = findOutOfOrder(imported);
  if (!outOfOrder.length) {
    return;
  }

  // There are things to report. Try to minimize the number of reported errors.
  var reversedImported = reverse(imported);
  var reversedOrder = findOutOfOrder(reversedImported);
  if (reversedOrder.length < outOfOrder.length) {
    reportOutOfOrder(context, reversedImported, reversedOrder, 'after', category);
    return;
  }
  reportOutOfOrder(context, imported, outOfOrder, 'before', category);
}

var compareString = function compareString(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/** Some parsers (languages without types) don't provide ImportKind */
var DEFAULT_IMPORT_KIND = 'value';
var getNormalizedValue = function getNormalizedValue(node, toLowerCase) {
  var value = node.value;
  return toLowerCase ? String(value).toLowerCase() : value;
};

function getSorter(alphabetizeOptions) {
  var multiplier = alphabetizeOptions.order === 'asc' ? 1 : -1;
  var orderImportKind = alphabetizeOptions.orderImportKind;
  var multiplierImportKind = orderImportKind !== 'ignore' && (
  alphabetizeOptions.orderImportKind === 'asc' ? 1 : -1);

  return function () {function importsSorter(nodeA, nodeB) {
      var importA = getNormalizedValue(nodeA, alphabetizeOptions.caseInsensitive);
      var importB = getNormalizedValue(nodeB, alphabetizeOptions.caseInsensitive);
      var result = 0;

      if (!importA.includes('/') && !importB.includes('/')) {
        result = compareString(importA, importB);
      } else {
        var A = importA.split('/');
        var B = importB.split('/');
        var a = A.length;
        var b = B.length;

        for (var i = 0; i < Math.min(a, b); i++) {
          // Skip comparing the first path segment, if they are relative segments for both imports
          if (i === 0 && (A[i] === '.' || A[i] === '..') && (B[i] === '.' || B[i] === '..')) {
            // If one is sibling and the other parent import, no need to compare at all, since the paths belong in different groups
            if (A[i] !== B[i]) {break;}
            continue;
          }
          result = compareString(A[i], B[i]);
          if (result) {break;}
        }

        if (!result && a !== b) {
          result = a < b ? -1 : 1;
        }
      }

      result = result * multiplier;

      // In case the paths are equal (result === 0), sort them by importKind
      if (!result && multiplierImportKind) {
        result = multiplierImportKind * compareString(
        nodeA.node.importKind || DEFAULT_IMPORT_KIND,
        nodeB.node.importKind || DEFAULT_IMPORT_KIND);

      }

      return result;
    }return importsSorter;}();
}

function mutateRanksToAlphabetize(imported, alphabetizeOptions) {
  var groupedByRanks = Object.groupBy(imported, function (item) {return item.rank;});

  var sorterFn = getSorter(alphabetizeOptions);

  // sort group keys so that they can be iterated on in order
  var groupRanks = Object.keys(groupedByRanks).sort(function (a, b) {
    return a - b;
  });

  // sort imports locally within their group
  groupRanks.forEach(function (groupRank) {
    groupedByRanks[groupRank].sort(sorterFn);
  });

  // assign globally unique rank to each import
  var newRank = 0;
  var alphabetizedRanks = groupRanks.reduce(function (acc, groupRank) {
    groupedByRanks[groupRank].forEach(function (importedItem) {
      acc[String(importedItem.value) + '|' + String(importedItem.node.importKind)] = parseInt(groupRank, 10) + newRank;
      newRank += 1;
    });
    return acc;
  }, {});

  // mutate the original group-rank with alphabetized-rank
  imported.forEach(function (importedItem) {
    importedItem.rank = alphabetizedRanks[String(importedItem.value) + '|' + String(importedItem.node.importKind)];
  });
}

// DETECTING

function computePathRank(ranks, pathGroups, path, maxPosition) {
  for (var i = 0, l = pathGroups.length; i < l; i++) {var _pathGroups$i =
    pathGroups[i],pattern = _pathGroups$i.pattern,patternOptions = _pathGroups$i.patternOptions,group = _pathGroups$i.group,_pathGroups$i$positio = _pathGroups$i.position,position = _pathGroups$i$positio === undefined ? 1 : _pathGroups$i$positio;
    if ((0, _minimatch2['default'])(path, pattern, patternOptions || { nocomment: true })) {
      return ranks[group] + position / maxPosition;
    }
  }
}

function computeRank(context, ranks, importEntry, excludedImportTypes, isSortingTypesGroup) {
  var impType = void 0;
  var rank = void 0;

  var isTypeGroupInGroups = ranks.omittedTypes.indexOf('type') === -1;
  var isTypeOnlyImport = importEntry.node.importKind === 'type';
  var isExcludedFromPathRank = isTypeOnlyImport && isTypeGroupInGroups && excludedImportTypes.has('type');

  if (importEntry.type === 'import:object') {
    impType = 'object';
  } else if (isTypeOnlyImport && isTypeGroupInGroups && !isSortingTypesGroup) {
    impType = 'type';
  } else {
    impType = (0, _importType2['default'])(importEntry.value, context);
  }

  if (!excludedImportTypes.has(impType) && !isExcludedFromPathRank) {
    rank = computePathRank(ranks.groups, ranks.pathGroups, importEntry.value, ranks.maxPosition);
  }

  if (typeof rank === 'undefined') {
    rank = ranks.groups[impType];

    if (typeof rank === 'undefined') {
      return -1;
    }
  }

  if (isTypeOnlyImport && isSortingTypesGroup) {
    rank = ranks.groups.type + rank / 10;
  }

  if (importEntry.type !== 'import' && !importEntry.type.startsWith('import:')) {
    rank += 100;
  }

  return rank;
}

function registerNode(context, importEntry, ranks, imported, excludedImportTypes, isSortingTypesGroup) {
  var rank = computeRank(context, ranks, importEntry, excludedImportTypes, isSortingTypesGroup);
  if (rank !== -1) {
    var importNode = importEntry.node;

    if (importEntry.type === 'require' && importNode.parent.parent.type === 'VariableDeclaration') {
      importNode = importNode.parent.parent;
    }

    imported.push(Object.assign({},
    importEntry, {
      rank: rank,
      isMultiline: importNode.loc.end.line !== importNode.loc.start.line }));

  }
}

function getRequireBlock(node) {
  var n = node;
  // Handle cases like `const baz = require('foo').bar.baz`
  // and `const foo = require('foo')()`
  while (
  n.parent.type === 'MemberExpression' && n.parent.object === n ||
  n.parent.type === 'CallExpression' && n.parent.callee === n)
  {
    n = n.parent;
  }
  if (
  n.parent.type === 'VariableDeclarator' &&
  n.parent.parent.type === 'VariableDeclaration' &&
  n.parent.parent.parent.type === 'Program')
  {
    return n.parent.parent.parent;
  }
}

var types = ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object', 'type'];

/**
                                                                                                             * Creates an object with type-rank pairs.
                                                                                                             *
                                                                                                             * Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
                                                                                                             */
function convertGroupsToRanks(groups) {
  var rankObject = groups.reduce(function (res, group, index) {
    [].concat(group).forEach(function (groupItem) {
      res[groupItem] = index * 2;
    });
    return res;
  }, {});

  var omittedTypes = types.filter(function (type) {
    return typeof rankObject[type] === 'undefined';
  });

  var ranks = omittedTypes.reduce(function (res, type) {
    res[type] = groups.length * 2;
    return res;
  }, rankObject);

  return { groups: ranks, omittedTypes: omittedTypes };
}

function convertPathGroupsForRanks(pathGroups) {
  var after = {};
  var before = {};

  var transformed = pathGroups.map(function (pathGroup, index) {var
    group = pathGroup.group,positionString = pathGroup.position;
    var position = 0;
    if (positionString === 'after') {
      if (!after[group]) {
        after[group] = 1;
      }
      position = after[group]++;
    } else if (positionString === 'before') {
      if (!before[group]) {
        before[group] = [];
      }
      before[group].push(index);
    }

    return Object.assign({}, pathGroup, { position: position });
  });

  var maxPosition = 1;

  Object.keys(before).forEach(function (group) {
    var groupLength = before[group].length;
    before[group].forEach(function (groupIndex, index) {
      transformed[groupIndex].position = -1 * (groupLength - index);
    });
    maxPosition = Math.max(maxPosition, groupLength);
  });

  Object.keys(after).forEach(function (key) {
    var groupNextPosition = after[key];
    maxPosition = Math.max(maxPosition, groupNextPosition - 1);
  });

  return {
    pathGroups: transformed,
    maxPosition: maxPosition > 10 ? Math.pow(10, Math.ceil(Math.log10(maxPosition))) : 10 };

}

function fixNewLineAfterImport(context, previousImport) {
  var prevRoot = findRootNode(previousImport.node);
  var tokensToEndOfLine = takeTokensAfterWhile(
  (0, _contextCompat.getSourceCode)(context),
  prevRoot,
  commentOnSameLineAs(prevRoot));


  var endOfLine = prevRoot.range[1];
  if (tokensToEndOfLine.length > 0) {
    endOfLine = tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1];
  }
  return function (fixer) {return fixer.insertTextAfterRange([prevRoot.range[0], endOfLine], '\n');};
}

function removeNewLineAfterImport(context, currentImport, previousImport) {
  var sourceCode = (0, _contextCompat.getSourceCode)(context);
  var prevRoot = findRootNode(previousImport.node);
  var currRoot = findRootNode(currentImport.node);
  var rangeToRemove = [
  findEndOfLineWithComments(sourceCode, prevRoot),
  findStartOfLineWithComments(sourceCode, currRoot)];

  if (/^\s*$/.test(sourceCode.text.substring(rangeToRemove[0], rangeToRemove[1]))) {
    return function (fixer) {return fixer.removeRange(rangeToRemove);};
  }
  return undefined;
}

function makeNewlinesBetweenReport(context, imported, newlinesBetweenImports_, newlinesBetweenTypeOnlyImports_, distinctGroup, isSortingTypesGroup, isConsolidatingSpaceBetweenImports) {
  var getNumberOfEmptyLinesBetween = function getNumberOfEmptyLinesBetween(currentImport, previousImport) {
    var linesBetweenImports = (0, _contextCompat.getSourceCode)(context).lines.slice(
    previousImport.node.loc.end.line,
    currentImport.node.loc.start.line - 1);


    return linesBetweenImports.filter(function (line) {return !line.trim().length;}).length;
  };
  var getIsStartOfDistinctGroup = function getIsStartOfDistinctGroup(currentImport, previousImport) {return currentImport.rank - 1 >= previousImport.rank;};
  var previousImport = imported[0];

  imported.slice(1).forEach(function (currentImport) {
    var emptyLinesBetween = getNumberOfEmptyLinesBetween(
    currentImport,
    previousImport);


    var isStartOfDistinctGroup = getIsStartOfDistinctGroup(
    currentImport,
    previousImport);


    var isTypeOnlyImport = currentImport.node.importKind === 'type';
    var isPreviousImportTypeOnlyImport = previousImport.node.importKind === 'type';

    var isNormalImportNextToTypeOnlyImportAndRelevant = isTypeOnlyImport !== isPreviousImportTypeOnlyImport && isSortingTypesGroup;

    var isTypeOnlyImportAndRelevant = isTypeOnlyImport && isSortingTypesGroup;

    // In the special case where newlinesBetweenImports and consolidateIslands
    // want the opposite thing, consolidateIslands wins
    var newlinesBetweenImports = isSortingTypesGroup &&
    isConsolidatingSpaceBetweenImports && (
    previousImport.isMultiline || currentImport.isMultiline) &&
    newlinesBetweenImports_ === 'never' ?
    'always-and-inside-groups' :
    newlinesBetweenImports_;

    // In the special case where newlinesBetweenTypeOnlyImports and
    // consolidateIslands want the opposite thing, consolidateIslands wins
    var newlinesBetweenTypeOnlyImports = isSortingTypesGroup &&
    isConsolidatingSpaceBetweenImports && (
    isNormalImportNextToTypeOnlyImportAndRelevant ||
    previousImport.isMultiline ||
    currentImport.isMultiline) &&
    newlinesBetweenTypeOnlyImports_ === 'never' ?
    'always-and-inside-groups' :
    newlinesBetweenTypeOnlyImports_;

    var isNotIgnored = isTypeOnlyImportAndRelevant &&
    newlinesBetweenTypeOnlyImports !== 'ignore' ||
    !isTypeOnlyImportAndRelevant && newlinesBetweenImports !== 'ignore';

    if (isNotIgnored) {
      var shouldAssertNewlineBetweenGroups = (isTypeOnlyImportAndRelevant || isNormalImportNextToTypeOnlyImportAndRelevant) && (
      newlinesBetweenTypeOnlyImports === 'always' ||
      newlinesBetweenTypeOnlyImports === 'always-and-inside-groups') ||
      !isTypeOnlyImportAndRelevant && !isNormalImportNextToTypeOnlyImportAndRelevant && (
      newlinesBetweenImports === 'always' ||
      newlinesBetweenImports === 'always-and-inside-groups');

      var shouldAssertNoNewlineWithinGroup = (isTypeOnlyImportAndRelevant || isNormalImportNextToTypeOnlyImportAndRelevant) &&
      newlinesBetweenTypeOnlyImports !== 'always-and-inside-groups' ||
      !isTypeOnlyImportAndRelevant && !isNormalImportNextToTypeOnlyImportAndRelevant &&
      newlinesBetweenImports !== 'always-and-inside-groups';

      var shouldAssertNoNewlineBetweenGroup = !isSortingTypesGroup ||
      !isNormalImportNextToTypeOnlyImportAndRelevant ||
      newlinesBetweenTypeOnlyImports === 'never';

      var isTheNewlineBetweenImportsInTheSameGroup = distinctGroup && currentImport.rank === previousImport.rank ||
      !distinctGroup && !isStartOfDistinctGroup;

      // Let's try to cut down on linting errors sent to the user
      var alreadyReported = false;

      if (shouldAssertNewlineBetweenGroups) {
        if (currentImport.rank !== previousImport.rank && emptyLinesBetween === 0) {
          if (distinctGroup || isStartOfDistinctGroup) {
            alreadyReported = true;
            context.report({
              node: previousImport.node,
              message: 'There should be at least one empty line between import groups',
              fix: fixNewLineAfterImport(context, previousImport) });

          }
        } else if (emptyLinesBetween > 0 && shouldAssertNoNewlineWithinGroup) {
          if (isTheNewlineBetweenImportsInTheSameGroup) {
            alreadyReported = true;
            context.report({
              node: previousImport.node,
              message: 'There should be no empty line within import group',
              fix: removeNewLineAfterImport(context, currentImport, previousImport) });

          }
        }
      } else if (emptyLinesBetween > 0 && shouldAssertNoNewlineBetweenGroup) {
        alreadyReported = true;
        context.report({
          node: previousImport.node,
          message: 'There should be no empty line between import groups',
          fix: removeNewLineAfterImport(context, currentImport, previousImport) });

      }

      if (!alreadyReported && isConsolidatingSpaceBetweenImports) {
        if (emptyLinesBetween === 0 && currentImport.isMultiline) {
          context.report({
            node: previousImport.node,
            message: 'There should be at least one empty line between this import and the multi-line import that follows it',
            fix: fixNewLineAfterImport(context, previousImport) });

        } else if (emptyLinesBetween === 0 && previousImport.isMultiline) {
          context.report({
            node: previousImport.node,
            message: 'There should be at least one empty line between this multi-line import and the import that follows it',
            fix: fixNewLineAfterImport(context, previousImport) });

        } else if (
        emptyLinesBetween > 0 &&
        !previousImport.isMultiline &&
        !currentImport.isMultiline &&
        isTheNewlineBetweenImportsInTheSameGroup)
        {
          context.report({
            node: previousImport.node,
            message:
            'There should be no empty lines between this single-line import and the single-line import that follows it',
            fix: removeNewLineAfterImport(context, currentImport, previousImport) });

        }
      }
    }

    previousImport = currentImport;
  });
}

function getAlphabetizeConfig(options) {
  var alphabetize = options.alphabetize || {};
  var order = alphabetize.order || 'ignore';
  var orderImportKind = alphabetize.orderImportKind || 'ignore';
  var caseInsensitive = alphabetize.caseInsensitive || false;

  return { order: order, orderImportKind: orderImportKind, caseInsensitive: caseInsensitive };
}

// TODO, semver-major: Change the default of "distinctGroup" from true to false
var defaultDistinctGroup = true;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      category: 'Style guide',
      description: 'Enforce a convention in module import order.',
      url: (0, _docsUrl2['default'])('order') },


    fixable: 'code',
    schema: [
    {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          uniqueItems: true,
          items: {
            oneOf: [
            { 'enum': types },
            {
              type: 'array',
              uniqueItems: true,
              items: { 'enum': types } }] } },




        pathGroupsExcludedImportTypes: {
          type: 'array' },

        distinctGroup: {
          type: 'boolean',
          'default': defaultDistinctGroup },

        pathGroups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string' },

              patternOptions: {
                type: 'object' },

              group: {
                type: 'string',
                'enum': types },

              position: {
                type: 'string',
                'enum': ['after', 'before'] } },


            additionalProperties: false,
            required: ['pattern', 'group'] } },


        'newlines-between': {
          'enum': [
          'ignore',
          'always',
          'always-and-inside-groups',
          'never'] },


        'newlines-between-types': {
          'enum': [
          'ignore',
          'always',
          'always-and-inside-groups',
          'never'] },


        consolidateIslands: {
          'enum': [
          'inside-groups',
          'never'] },


        sortTypesGroup: {
          type: 'boolean',
          'default': false },

        named: {
          'default': false,
          oneOf: [{
            type: 'boolean' },
          {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              'import': { type: 'boolean' },
              'export': { type: 'boolean' },
              require: { type: 'boolean' },
              cjsExports: { type: 'boolean' },
              types: {
                type: 'string',
                'enum': [
                'mixed',
                'types-first',
                'types-last'] } },



            additionalProperties: false }] },


        alphabetize: {
          type: 'object',
          properties: {
            caseInsensitive: {
              type: 'boolean',
              'default': false },

            order: {
              'enum': ['ignore', 'asc', 'desc'],
              'default': 'ignore' },

            orderImportKind: {
              'enum': ['ignore', 'asc', 'desc'],
              'default': 'ignore' } },


          additionalProperties: false },

        warnOnUnassignedImports: {
          type: 'boolean',
          'default': false } },


      additionalProperties: false,
      dependencies: {
        sortTypesGroup: {
          oneOf: [
          {
            // When sortTypesGroup is true, groups must NOT be an array that does not contain 'type'
            properties: {
              sortTypesGroup: { 'enum': [true] },
              groups: {
                not: {
                  type: 'array',
                  uniqueItems: true,
                  items: {
                    oneOf: [
                    { 'enum': types.filter(function (t) {return t !== 'type';}) },
                    {
                      type: 'array',
                      uniqueItems: true,
                      items: { 'enum': types.filter(function (t) {return t !== 'type';}) } }] } } } },






            required: ['groups'] },

          {
            properties: {
              sortTypesGroup: { 'enum': [false] } } }] },




        'newlines-between-types': {
          properties: {
            sortTypesGroup: { 'enum': [true] } },

          required: ['sortTypesGroup'] },

        consolidateIslands: {
          oneOf: [
          {
            properties: {
              consolidateIslands: { 'enum': ['inside-groups'] } },

            anyOf: [
            {
              properties: {
                'newlines-between': { 'enum': ['always-and-inside-groups'] } },

              required: ['newlines-between'] },

            {
              properties: {
                'newlines-between-types': { 'enum': ['always-and-inside-groups'] } },

              required: ['newlines-between-types'] }] },



          {
            properties: {
              consolidateIslands: { 'enum': ['never'] } } }] } } }] },









  create: function () {function create(context) {
      var options = context.options[0] || {};
      var newlinesBetweenImports = options['newlines-between'] || 'ignore';
      var newlinesBetweenTypeOnlyImports = options['newlines-between-types'] || newlinesBetweenImports;
      var pathGroupsExcludedImportTypes = new Set(options.pathGroupsExcludedImportTypes || ['builtin', 'external', 'object']);
      var sortTypesGroup = options.sortTypesGroup;
      var consolidateIslands = options.consolidateIslands || 'never';

      var named = Object.assign({
        types: 'mixed' },
      _typeof(options.named) === 'object' ? Object.assign({},
      options.named, {
        'import': 'import' in options.named ? options.named['import'] : options.named.enabled,
        'export': 'export' in options.named ? options.named['export'] : options.named.enabled,
        require: 'require' in options.named ? options.named.require : options.named.enabled,
        cjsExports: 'cjsExports' in options.named ? options.named.cjsExports : options.named.enabled }) :
      {
        'import': options.named,
        'export': options.named,
        require: options.named,
        cjsExports: options.named });



      var namedGroups = named.types === 'mixed' ? [] : named.types === 'types-last' ? ['value'] : ['type'];
      var alphabetize = getAlphabetizeConfig(options);
      var distinctGroup = options.distinctGroup == null ? defaultDistinctGroup : !!options.distinctGroup;
      var ranks = void 0;

      try {var _convertPathGroupsFor =
        convertPathGroupsForRanks(options.pathGroups || []),pathGroups = _convertPathGroupsFor.pathGroups,maxPosition = _convertPathGroupsFor.maxPosition;var _convertGroupsToRanks =
        convertGroupsToRanks(options.groups || defaultGroups),groups = _convertGroupsToRanks.groups,omittedTypes = _convertGroupsToRanks.omittedTypes;
        ranks = {
          groups: groups,
          omittedTypes: omittedTypes,
          pathGroups: pathGroups,
          maxPosition: maxPosition };

      } catch (error) {
        // Malformed configuration
        return {
          Program: function () {function Program(node) {
              context.report(node, error.message);
            }return Program;}() };

      }
      var importMap = new Map();
      var exportMap = new Map();

      var isTypeGroupInGroups = ranks.omittedTypes.indexOf('type') === -1;
      var isSortingTypesGroup = isTypeGroupInGroups && sortTypesGroup;

      function getBlockImports(node) {
        if (!importMap.has(node)) {
          importMap.set(node, []);
        }
        return importMap.get(node);
      }

      function getBlockExports(node) {
        if (!exportMap.has(node)) {
          exportMap.set(node, []);
        }
        return exportMap.get(node);
      }

      function makeNamedOrderReport(context, namedImports) {
        if (namedImports.length > 1) {
          var imports = namedImports.map(
          function (namedImport) {
            var kind = namedImport.kind || 'value';
            var rank = namedGroups.findIndex(function (entry) {return [].concat(entry).indexOf(kind) > -1;});

            return Object.assign({
              displayName: namedImport.value,
              rank: rank === -1 ? namedGroups.length : rank },
            namedImport, {
              value: String(namedImport.value) + ':' + String(namedImport.alias || '') });

          });

          if (alphabetize.order !== 'ignore') {
            mutateRanksToAlphabetize(imports, alphabetize);
          }

          makeOutOfOrderReport(context, imports, categories.named);
        }
      }

      return Object.assign({
        ImportDeclaration: function () {function ImportDeclaration(node) {
            // Ignoring unassigned imports unless warnOnUnassignedImports is set
            if (node.specifiers.length || options.warnOnUnassignedImports) {
              var name = node.source.value;
              registerNode(
              context,
              {
                node: node,
                value: name,
                displayName: name,
                type: 'import' },

              ranks,
              getBlockImports(node.parent),
              pathGroupsExcludedImportTypes,
              isSortingTypesGroup);


              if (named['import']) {
                makeNamedOrderReport(
                context,
                node.specifiers.filter(
                function (specifier) {return specifier.type === 'ImportSpecifier';}).map(
                function (specifier) {return Object.assign({
                    node: specifier,
                    value: specifier.imported.name,
                    type: 'import',
                    kind: specifier.importKind },
                  specifier.local.range[0] !== specifier.imported.range[0] && {
                    alias: specifier.local.name });}));




              }
            }
          }return ImportDeclaration;}(),
        TSImportEqualsDeclaration: function () {function TSImportEqualsDeclaration(node) {
            // skip "export import"s
            if (node.isExport) {
              return;
            }

            var displayName = void 0;
            var value = void 0;
            var type = void 0;
            if (node.moduleReference.type === 'TSExternalModuleReference') {
              value = node.moduleReference.expression.value;
              displayName = value;
              type = 'import';
            } else {
              value = '';
              displayName = (0, _contextCompat.getSourceCode)(context).getText(node.moduleReference);
              type = 'import:object';
            }

            registerNode(
            context,
            {
              node: node,
              value: value,
              displayName: displayName,
              type: type },

            ranks,
            getBlockImports(node.parent),
            pathGroupsExcludedImportTypes,
            isSortingTypesGroup);

          }return TSImportEqualsDeclaration;}(),
        CallExpression: function () {function CallExpression(node) {
            if (!(0, _staticRequire2['default'])(node)) {
              return;
            }
            var block = getRequireBlock(node);
            if (!block) {
              return;
            }
            var name = node.arguments[0].value;
            registerNode(
            context,
            {
              node: node,
              value: name,
              displayName: name,
              type: 'require' },

            ranks,
            getBlockImports(block),
            pathGroupsExcludedImportTypes,
            isSortingTypesGroup);

          }return CallExpression;}() },
      named.require && {
        VariableDeclarator: function () {function VariableDeclarator(node) {
            if (node.id.type === 'ObjectPattern' && isRequireExpression(node.init)) {
              for (var i = 0; i < node.id.properties.length; i++) {
                if (
                node.id.properties[i].key.type !== 'Identifier' ||
                node.id.properties[i].value.type !== 'Identifier')
                {
                  return;
                }
              }
              makeNamedOrderReport(
              context,
              node.id.properties.map(function (prop) {return Object.assign({
                  node: prop,
                  value: prop.key.name,
                  type: 'require' },
                prop.key.range[0] !== prop.value.range[0] && {
                  alias: prop.value.name });}));



            }
          }return VariableDeclarator;}() },

      named['export'] && {
        ExportNamedDeclaration: function () {function ExportNamedDeclaration(node) {
            makeNamedOrderReport(
            context,
            node.specifiers.map(function (specifier) {return Object.assign({
                node: specifier,
                value: specifier.local.name,
                type: 'export',
                kind: specifier.exportKind },
              specifier.local.range[0] !== specifier.exported.range[0] && {
                alias: specifier.exported.name });}));



          }return ExportNamedDeclaration;}() },

      named.cjsExports && {
        AssignmentExpression: function () {function AssignmentExpression(node) {
            if (node.parent.type === 'ExpressionStatement') {
              if (isCJSExports(context, node.left)) {
                if (node.right.type === 'ObjectExpression') {
                  for (var i = 0; i < node.right.properties.length; i++) {
                    if (
                    !node.right.properties[i].key ||
                    node.right.properties[i].key.type !== 'Identifier' ||
                    !node.right.properties[i].value ||
                    node.right.properties[i].value.type !== 'Identifier')
                    {
                      return;
                    }
                  }

                  makeNamedOrderReport(
                  context,
                  node.right.properties.map(function (prop) {return Object.assign({
                      node: prop,
                      value: prop.key.name,
                      type: 'export' },
                    prop.key.range[0] !== prop.value.range[0] && {
                      alias: prop.value.name });}));



                }
              } else {
                var nameParts = getNamedCJSExports(context, node.left);
                if (nameParts && nameParts.length > 0) {
                  var name = nameParts.join('.');
                  getBlockExports(node.parent.parent).push({
                    node: node,
                    value: name,
                    displayName: name,
                    type: 'export',
                    rank: 0 });

                }
              }
            }
          }return AssignmentExpression;}() }, {

        'Program:exit': function () {function ProgramExit() {
            importMap.forEach(function (imported) {
              if (newlinesBetweenImports !== 'ignore' || newlinesBetweenTypeOnlyImports !== 'ignore') {
                makeNewlinesBetweenReport(
                context,
                imported,
                newlinesBetweenImports,
                newlinesBetweenTypeOnlyImports,
                distinctGroup,
                isSortingTypesGroup,
                consolidateIslands === 'inside-groups' && (
                newlinesBetweenImports === 'always-and-inside-groups' ||
                newlinesBetweenTypeOnlyImports === 'always-and-inside-groups'));

              }

              if (alphabetize.order !== 'ignore') {
                mutateRanksToAlphabetize(imported, alphabetize);
              }

              makeOutOfOrderReport(context, imported, categories['import']);
            });

            exportMap.forEach(function (exported) {
              if (alphabetize.order !== 'ignore') {
                mutateRanksToAlphabetize(exported, alphabetize);
                makeOutOfOrderReport(context, exported, categories.exports);
              }
            });

            importMap.clear();
            exportMap.clear();
          }return ProgramExit;}() });

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9vcmRlci5qcyJdLCJuYW1lcyI6WyJjYXRlZ29yaWVzIiwibmFtZWQiLCJleHBvcnRzIiwiZGVmYXVsdEdyb3VwcyIsInJldmVyc2UiLCJhcnJheSIsIm1hcCIsInYiLCJyYW5rIiwiZ2V0VG9rZW5zT3JDb21tZW50c0FmdGVyIiwic291cmNlQ29kZSIsIm5vZGUiLCJjb3VudCIsImN1cnJlbnROb2RlT3JUb2tlbiIsInJlc3VsdCIsImkiLCJnZXRUb2tlbk9yQ29tbWVudEFmdGVyIiwicHVzaCIsImdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUiLCJnZXRUb2tlbk9yQ29tbWVudEJlZm9yZSIsInRha2VUb2tlbnNBZnRlcldoaWxlIiwiY29uZGl0aW9uIiwidG9rZW5zIiwibGVuZ3RoIiwidGFrZVRva2Vuc0JlZm9yZVdoaWxlIiwiZmluZE91dE9mT3JkZXIiLCJpbXBvcnRlZCIsIm1heFNlZW5SYW5rTm9kZSIsImZpbHRlciIsImltcG9ydGVkTW9kdWxlIiwicmVzIiwiZmluZFJvb3ROb2RlIiwicGFyZW50IiwiYm9keSIsImNvbW1lbnRPblNhbWVMaW5lQXMiLCJ0b2tlbiIsInR5cGUiLCJsb2MiLCJzdGFydCIsImxpbmUiLCJlbmQiLCJmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzIiwidG9rZW5zVG9FbmRPZkxpbmUiLCJlbmRPZlRva2VucyIsInJhbmdlIiwidGV4dCIsImZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyIsInN0YXJ0T2ZUb2tlbnMiLCJmaW5kU3BlY2lmaWVyU3RhcnQiLCJnZXRUb2tlbkJlZm9yZSIsInZhbHVlIiwiZmluZFNwZWNpZmllckVuZCIsImdldFRva2VuQWZ0ZXIiLCJpc1JlcXVpcmVFeHByZXNzaW9uIiwiZXhwciIsImNhbGxlZSIsIm5hbWUiLCJhcmd1bWVudHMiLCJpc1N1cHBvcnRlZFJlcXVpcmVNb2R1bGUiLCJkZWNsYXJhdGlvbnMiLCJkZWNsIiwiaXNQbGFpblJlcXVpcmUiLCJpZCIsImluaXQiLCJpc1JlcXVpcmVXaXRoTWVtYmVyRXhwcmVzc2lvbiIsIm9iamVjdCIsImlzUGxhaW5JbXBvcnRNb2R1bGUiLCJzcGVjaWZpZXJzIiwiaXNQbGFpbkltcG9ydEVxdWFscyIsIm1vZHVsZVJlZmVyZW5jZSIsImV4cHJlc3Npb24iLCJpc0NKU0V4cG9ydHMiLCJjb250ZXh0IiwicHJvcGVydHkiLCJ2YXJpYWJsZXMiLCJmaW5kSW5kZXgiLCJ2YXJpYWJsZSIsImdldE5hbWVkQ0pTRXhwb3J0cyIsInJvb3QiLCJ1bnNoaWZ0Iiwic2xpY2UiLCJjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIiLCJjYW5SZW9yZGVySXRlbXMiLCJmaXJzdE5vZGUiLCJzZWNvbmROb2RlIiwiaW5kZXhPZiIsInNvcnQiLCJmaXJzdEluZGV4Iiwic2Vjb25kSW5kZXgiLCJub2Rlc0JldHdlZW4iLCJub2RlQmV0d2VlbiIsIm1ha2VJbXBvcnREZXNjcmlwdGlvbiIsImV4cG9ydEtpbmQiLCJpbXBvcnRLaW5kIiwiZml4T3V0T2ZPcmRlciIsIm9yZGVyIiwiY2F0ZWdvcnkiLCJpc05hbWVkIiwiaXNFeHBvcnRzIiwiZmlyc3RSb290Iiwic2Vjb25kUm9vdCIsImZpcnN0Um9vdFN0YXJ0IiwiZmlyc3RSb290RW5kIiwic2Vjb25kUm9vdFN0YXJ0Iiwic2Vjb25kUm9vdEVuZCIsImRpc3BsYXlOYW1lIiwiYWxpYXMiLCJmaXJzdEltcG9ydCIsInNlY29uZEltcG9ydCIsIm1lc3NhZ2UiLCJmaXJzdENvZGUiLCJmaXJzdFRyaXZpYSIsInNlY29uZENvZGUiLCJzZWNvbmRUcml2aWEiLCJ0cmltbWVkVHJpdmlhIiwidHJpbUVuZCIsImdhcENvZGUiLCJ3aGl0ZXNwYWNlcyIsInJlcG9ydCIsImZpeCIsImZpeGVyIiwicmVwbGFjZVRleHRSYW5nZSIsImZpeGVzIiwiY2FuRml4IiwibmV3Q29kZSIsInN1YnN0cmluZyIsInJlcG9ydE91dE9mT3JkZXIiLCJvdXRPZk9yZGVyIiwiZm9yRWFjaCIsImltcCIsImZvdW5kIiwiZmluZCIsImhhc0hpZ2hlclJhbmsiLCJpbXBvcnRlZEl0ZW0iLCJtYWtlT3V0T2ZPcmRlclJlcG9ydCIsInJldmVyc2VkSW1wb3J0ZWQiLCJyZXZlcnNlZE9yZGVyIiwiY29tcGFyZVN0cmluZyIsImEiLCJiIiwiREVGQVVMVF9JTVBPUlRfS0lORCIsImdldE5vcm1hbGl6ZWRWYWx1ZSIsInRvTG93ZXJDYXNlIiwiU3RyaW5nIiwiZ2V0U29ydGVyIiwiYWxwaGFiZXRpemVPcHRpb25zIiwibXVsdGlwbGllciIsIm9yZGVySW1wb3J0S2luZCIsIm11bHRpcGxpZXJJbXBvcnRLaW5kIiwiaW1wb3J0c1NvcnRlciIsIm5vZGVBIiwibm9kZUIiLCJpbXBvcnRBIiwiY2FzZUluc2Vuc2l0aXZlIiwiaW1wb3J0QiIsImluY2x1ZGVzIiwiQSIsInNwbGl0IiwiQiIsIk1hdGgiLCJtaW4iLCJtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUiLCJncm91cGVkQnlSYW5rcyIsIk9iamVjdCIsImdyb3VwQnkiLCJpdGVtIiwic29ydGVyRm4iLCJncm91cFJhbmtzIiwia2V5cyIsImdyb3VwUmFuayIsIm5ld1JhbmsiLCJhbHBoYWJldGl6ZWRSYW5rcyIsInJlZHVjZSIsImFjYyIsInBhcnNlSW50IiwiY29tcHV0ZVBhdGhSYW5rIiwicmFua3MiLCJwYXRoR3JvdXBzIiwicGF0aCIsIm1heFBvc2l0aW9uIiwibCIsInBhdHRlcm4iLCJwYXR0ZXJuT3B0aW9ucyIsImdyb3VwIiwicG9zaXRpb24iLCJub2NvbW1lbnQiLCJjb21wdXRlUmFuayIsImltcG9ydEVudHJ5IiwiZXhjbHVkZWRJbXBvcnRUeXBlcyIsImlzU29ydGluZ1R5cGVzR3JvdXAiLCJpbXBUeXBlIiwiaXNUeXBlR3JvdXBJbkdyb3VwcyIsIm9taXR0ZWRUeXBlcyIsImlzVHlwZU9ubHlJbXBvcnQiLCJpc0V4Y2x1ZGVkRnJvbVBhdGhSYW5rIiwiaGFzIiwiZ3JvdXBzIiwic3RhcnRzV2l0aCIsInJlZ2lzdGVyTm9kZSIsImltcG9ydE5vZGUiLCJpc011bHRpbGluZSIsImdldFJlcXVpcmVCbG9jayIsIm4iLCJ0eXBlcyIsImNvbnZlcnRHcm91cHNUb1JhbmtzIiwicmFua09iamVjdCIsImluZGV4IiwiY29uY2F0IiwiZ3JvdXBJdGVtIiwiY29udmVydFBhdGhHcm91cHNGb3JSYW5rcyIsImFmdGVyIiwiYmVmb3JlIiwidHJhbnNmb3JtZWQiLCJwYXRoR3JvdXAiLCJwb3NpdGlvblN0cmluZyIsImdyb3VwTGVuZ3RoIiwiZ3JvdXBJbmRleCIsIm1heCIsImtleSIsImdyb3VwTmV4dFBvc2l0aW9uIiwicG93IiwiY2VpbCIsImxvZzEwIiwiZml4TmV3TGluZUFmdGVySW1wb3J0IiwicHJldmlvdXNJbXBvcnQiLCJwcmV2Um9vdCIsImVuZE9mTGluZSIsImluc2VydFRleHRBZnRlclJhbmdlIiwicmVtb3ZlTmV3TGluZUFmdGVySW1wb3J0IiwiY3VycmVudEltcG9ydCIsImN1cnJSb290IiwicmFuZ2VUb1JlbW92ZSIsInRlc3QiLCJyZW1vdmVSYW5nZSIsInVuZGVmaW5lZCIsIm1ha2VOZXdsaW5lc0JldHdlZW5SZXBvcnQiLCJuZXdsaW5lc0JldHdlZW5JbXBvcnRzXyIsIm5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0c18iLCJkaXN0aW5jdEdyb3VwIiwiaXNDb25zb2xpZGF0aW5nU3BhY2VCZXR3ZWVuSW1wb3J0cyIsImdldE51bWJlck9mRW1wdHlMaW5lc0JldHdlZW4iLCJsaW5lc0JldHdlZW5JbXBvcnRzIiwibGluZXMiLCJ0cmltIiwiZ2V0SXNTdGFydE9mRGlzdGluY3RHcm91cCIsImVtcHR5TGluZXNCZXR3ZWVuIiwiaXNTdGFydE9mRGlzdGluY3RHcm91cCIsImlzUHJldmlvdXNJbXBvcnRUeXBlT25seUltcG9ydCIsImlzTm9ybWFsSW1wb3J0TmV4dFRvVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudCIsImlzVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudCIsIm5ld2xpbmVzQmV0d2VlbkltcG9ydHMiLCJuZXdsaW5lc0JldHdlZW5UeXBlT25seUltcG9ydHMiLCJpc05vdElnbm9yZWQiLCJzaG91bGRBc3NlcnROZXdsaW5lQmV0d2Vlbkdyb3VwcyIsInNob3VsZEFzc2VydE5vTmV3bGluZVdpdGhpbkdyb3VwIiwic2hvdWxkQXNzZXJ0Tm9OZXdsaW5lQmV0d2Vlbkdyb3VwIiwiaXNUaGVOZXdsaW5lQmV0d2VlbkltcG9ydHNJblRoZVNhbWVHcm91cCIsImFscmVhZHlSZXBvcnRlZCIsImdldEFscGhhYmV0aXplQ29uZmlnIiwib3B0aW9ucyIsImFscGhhYmV0aXplIiwiZGVmYXVsdERpc3RpbmN0R3JvdXAiLCJtb2R1bGUiLCJtZXRhIiwiZG9jcyIsImRlc2NyaXB0aW9uIiwidXJsIiwiZml4YWJsZSIsInNjaGVtYSIsInByb3BlcnRpZXMiLCJ1bmlxdWVJdGVtcyIsIml0ZW1zIiwib25lT2YiLCJwYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyIsImFkZGl0aW9uYWxQcm9wZXJ0aWVzIiwicmVxdWlyZWQiLCJjb25zb2xpZGF0ZUlzbGFuZHMiLCJzb3J0VHlwZXNHcm91cCIsImVuYWJsZWQiLCJyZXF1aXJlIiwiY2pzRXhwb3J0cyIsIndhcm5PblVuYXNzaWduZWRJbXBvcnRzIiwiZGVwZW5kZW5jaWVzIiwibm90IiwidCIsImFueU9mIiwiY3JlYXRlIiwiU2V0IiwibmFtZWRHcm91cHMiLCJlcnJvciIsIlByb2dyYW0iLCJpbXBvcnRNYXAiLCJNYXAiLCJleHBvcnRNYXAiLCJnZXRCbG9ja0ltcG9ydHMiLCJzZXQiLCJnZXQiLCJnZXRCbG9ja0V4cG9ydHMiLCJtYWtlTmFtZWRPcmRlclJlcG9ydCIsIm5hbWVkSW1wb3J0cyIsImltcG9ydHMiLCJuYW1lZEltcG9ydCIsImtpbmQiLCJlbnRyeSIsIkltcG9ydERlY2xhcmF0aW9uIiwic291cmNlIiwic3BlY2lmaWVyIiwibG9jYWwiLCJUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uIiwiaXNFeHBvcnQiLCJnZXRUZXh0IiwiQ2FsbEV4cHJlc3Npb24iLCJibG9jayIsIlZhcmlhYmxlRGVjbGFyYXRvciIsInByb3AiLCJFeHBvcnROYW1lZERlY2xhcmF0aW9uIiwiZXhwb3J0ZWQiLCJBc3NpZ25tZW50RXhwcmVzc2lvbiIsImxlZnQiLCJyaWdodCIsIm5hbWVQYXJ0cyIsImpvaW4iLCJjbGVhciJdLCJtYXBwaW5ncyI6IkFBQUEsYTs7QUFFQSxzQztBQUNBOztBQUVBLGdEO0FBQ0Esc0Q7QUFDQSxxQzs7QUFFQSxJQUFNQSxhQUFhO0FBQ2pCQyxTQUFPLE9BRFU7QUFFakIsWUFBUSxRQUZTO0FBR2pCQyxXQUFTLFNBSFEsRUFBbkI7OztBQU1BLElBQU1DLGdCQUFnQixDQUFDLFNBQUQsRUFBWSxVQUFaLEVBQXdCLFFBQXhCLEVBQWtDLFNBQWxDLEVBQTZDLE9BQTdDLENBQXRCOztBQUVBOztBQUVBLFNBQVNDLE9BQVQsQ0FBaUJDLEtBQWpCLEVBQXdCO0FBQ3RCLFNBQU9BLE1BQU1DLEdBQU4sQ0FBVSxVQUFDQyxDQUFELDRCQUFhQSxDQUFiLElBQWdCQyxNQUFNLENBQUNELEVBQUVDLElBQXpCLEtBQVYsRUFBNENKLE9BQTVDLEVBQVA7QUFDRDs7QUFFRCxTQUFTSyx3QkFBVCxDQUFrQ0MsVUFBbEMsRUFBOENDLElBQTlDLEVBQW9EQyxLQUFwRCxFQUEyRDtBQUN6RCxNQUFJQyxxQkFBcUJGLElBQXpCO0FBQ0EsTUFBTUcsU0FBUyxFQUFmO0FBQ0EsT0FBSyxJQUFJQyxJQUFJLENBQWIsRUFBZ0JBLElBQUlILEtBQXBCLEVBQTJCRyxHQUEzQixFQUFnQztBQUM5QkYseUJBQXFCSCxXQUFXTSxzQkFBWCxDQUFrQ0gsa0JBQWxDLENBQXJCO0FBQ0EsUUFBSUEsc0JBQXNCLElBQTFCLEVBQWdDO0FBQzlCO0FBQ0Q7QUFDREMsV0FBT0csSUFBUCxDQUFZSixrQkFBWjtBQUNEO0FBQ0QsU0FBT0MsTUFBUDtBQUNEOztBQUVELFNBQVNJLHlCQUFULENBQW1DUixVQUFuQyxFQUErQ0MsSUFBL0MsRUFBcURDLEtBQXJELEVBQTREO0FBQzFELE1BQUlDLHFCQUFxQkYsSUFBekI7QUFDQSxNQUFNRyxTQUFT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QixFQUE4Qm9QLFFBQTlCLEVBQXdDNVQsV0FBV0UsT0FBbkQ7QUFDRDtBQUNGLGFBTEQ7O0FBT0FpUyxzQkFBVStCLEtBQVY7QUFDQTdCLHNCQUFVNkIsS0FBVjtBQUNELFdBbk5IOztBQXFORCxLQTNmYyxtQkFBakIiLCJmaWxlIjoib3JkZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJztcbmltcG9ydCB7IGdldFNjb3BlLCBnZXRTb3VyY2VDb2RlIH0gZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9jb250ZXh0Q29tcGF0JztcblxuaW1wb3J0IGltcG9ydFR5cGUgZnJvbSAnLi4vY29yZS9pbXBvcnRUeXBlJztcbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJztcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnO1xuXG5jb25zdCBjYXRlZ29yaWVzID0ge1xuICBuYW1lZDogJ25hbWVkJyxcbiAgaW1wb3J0OiAnaW1wb3J0JyxcbiAgZXhwb3J0czogJ2V4cG9ydHMnLFxufTtcblxuY29uc3QgZGVmYXVsdEdyb3VwcyA9IFsnYnVpbHRpbicsICdleHRlcm5hbCcsICdwYXJlbnQnLCAnc2libGluZycsICdpbmRleCddO1xuXG4vLyBSRVBPUlRJTkcgQU5EIEZJWElOR1xuXG5mdW5jdGlvbiByZXZlcnNlKGFycmF5KSB7XG4gIHJldHVybiBhcnJheS5tYXAoKHYpID0+ICh7IC4uLnYsIHJhbms6IC12LnJhbmsgfSkpLnJldmVyc2UoKTtcbn1cblxuZnVuY3Rpb24gZ2V0VG9rZW5zT3JDb21tZW50c0FmdGVyKHNvdXJjZUNvZGUsIG5vZGUsIGNvdW50KSB7XG4gIGxldCBjdXJyZW50Tm9kZU9yVG9rZW4gPSBub2RlO1xuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgY3VycmVudE5vZGVPclRva2VuID0gc291cmNlQ29kZS5nZXRUb2tlbk9yQ29tbWVudEFmdGVyKGN1cnJlbnROb2RlT3JUb2tlbik7XG4gICAgaWYgKGN1cnJlbnROb2RlT3JUb2tlbiA9PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmVzdWx0LnB1c2goY3VycmVudE5vZGVPclRva2VuKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRUb2tlbnNPckNvbW1lbnRzQmVmb3JlKHNvdXJjZUNvZGUsIG5vZGUsIGNvdW50KSB7XG4gIGxldCBjdXJyZW50Tm9kZU9yVG9rZW4gPSBub2RlO1xuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgY3VycmVudE5vZGVPclRva2VuID0gc291cmNlQ29kZS5nZXRUb2tlbk9yQ29tbWVudEJlZm9yZShjdXJyZW50Tm9kZU9yVG9rZW4pO1xuICAgIGlmIChjdXJyZW50Tm9kZU9yVG9rZW4gPT0gbnVsbCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJlc3VsdC5wdXNoKGN1cnJlbnROb2RlT3JUb2tlbik7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdC5yZXZlcnNlKCk7XG59XG5cbmZ1bmN0aW9uIHRha2VUb2tlbnNBZnRlcldoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbmRpdGlvbikge1xuICBjb25zdCB0b2tlbnMgPSBnZXRUb2tlbnNPckNvbW1lbnRzQWZ0ZXIoc291cmNlQ29kZSwgbm9kZSwgMTAwKTtcbiAgY29uc3QgcmVzdWx0ID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNvbmRpdGlvbih0b2tlbnNbaV0pKSB7XG4gICAgICByZXN1bHQucHVzaCh0b2tlbnNbaV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGFrZVRva2Vuc0JlZm9yZVdoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbmRpdGlvbikge1xuICBjb25zdCB0b2tlbnMgPSBnZXRUb2tlbnNPckNvbW1lbnRzQmVmb3JlKHNvdXJjZUNvZGUsIG5vZGUsIDEwMCk7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBmb3IgKGxldCBpID0gdG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGNvbmRpdGlvbih0b2tlbnNbaV0pKSB7XG4gICAgICByZXN1bHQucHVzaCh0b2tlbnNbaV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdC5yZXZlcnNlKCk7XG59XG5cbmZ1bmN0aW9uIGZpbmRPdXRPZk9yZGVyKGltcG9ydGVkKSB7XG4gIGlmIChpbXBvcnRlZC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgbGV0IG1heFNlZW5SYW5rTm9kZSA9IGltcG9ydGVkWzBdO1xuICByZXR1cm4gaW1wb3J0ZWQuZmlsdGVyKGZ1bmN0aW9uIChpbXBvcnRlZE1vZHVsZSkge1xuICAgIGNvbnN0IHJlcyA9IGltcG9ydGVkTW9kdWxlLnJhbmsgPCBtYXhTZWVuUmFua05vZGUucmFuaztcbiAgICBpZiAobWF4U2VlblJhbmtOb2RlLnJhbmsgPCBpbXBvcnRlZE1vZHVsZS5yYW5rKSB7XG4gICAgICBtYXhTZWVuUmFua05vZGUgPSBpbXBvcnRlZE1vZHVsZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGZpbmRSb290Tm9kZShub2RlKSB7XG4gIGxldCBwYXJlbnQgPSBub2RlO1xuICB3aGlsZSAocGFyZW50LnBhcmVudCAhPSBudWxsICYmIHBhcmVudC5wYXJlbnQuYm9keSA9PSBudWxsKSB7XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgfVxuICByZXR1cm4gcGFyZW50O1xufVxuXG5mdW5jdGlvbiBjb21tZW50T25TYW1lTGluZUFzKG5vZGUpIHtcbiAgcmV0dXJuICh0b2tlbikgPT4gKHRva2VuLnR5cGUgPT09ICdCbG9jaycgfHwgIHRva2VuLnR5cGUgPT09ICdMaW5lJylcbiAgICAgICYmIHRva2VuLmxvYy5zdGFydC5saW5lID09PSB0b2tlbi5sb2MuZW5kLmxpbmVcbiAgICAgICYmIHRva2VuLmxvYy5lbmQubGluZSA9PT0gbm9kZS5sb2MuZW5kLmxpbmU7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgbm9kZSkge1xuICBjb25zdCB0b2tlbnNUb0VuZE9mTGluZSA9IHRha2VUb2tlbnNBZnRlcldoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbW1lbnRPblNhbWVMaW5lQXMobm9kZSkpO1xuICBjb25zdCBlbmRPZlRva2VucyA9IHRva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCA+IDBcbiAgICA/IHRva2Vuc1RvRW5kT2ZMaW5lW3Rva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCAtIDFdLnJhbmdlWzFdXG4gICAgOiBub2RlLnJhbmdlWzFdO1xuICBsZXQgcmVzdWx0ID0gZW5kT2ZUb2tlbnM7XG4gIGZvciAobGV0IGkgPSBlbmRPZlRva2VuczsgaSA8IHNvdXJjZUNvZGUudGV4dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzb3VyY2VDb2RlLnRleHRbaV0gPT09ICdcXG4nKSB7XG4gICAgICByZXN1bHQgPSBpICsgMTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBpZiAoc291cmNlQ29kZS50ZXh0W2ldICE9PSAnICcgJiYgc291cmNlQ29kZS50ZXh0W2ldICE9PSAnXFx0JyAmJiBzb3VyY2VDb2RlLnRleHRbaV0gIT09ICdcXHInKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmVzdWx0ID0gaSArIDE7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIG5vZGUpIHtcbiAgY29uc3QgdG9rZW5zVG9FbmRPZkxpbmUgPSB0YWtlVG9rZW5zQmVmb3JlV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29tbWVudE9uU2FtZUxpbmVBcyhub2RlKSk7XG4gIGNvbnN0IHN0YXJ0T2ZUb2tlbnMgPSB0b2tlbnNUb0VuZE9mTGluZS5sZW5ndGggPiAwID8gdG9rZW5zVG9FbmRPZkxpbmVbMF0ucmFuZ2VbMF0gOiBub2RlLnJhbmdlWzBdO1xuICBsZXQgcmVzdWx0ID0gc3RhcnRPZlRva2VucztcbiAgZm9yIChsZXQgaSA9IHN0YXJ0T2ZUb2tlbnMgLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgaWYgKHNvdXJjZUNvZGUudGV4dFtpXSAhPT0gJyAnICYmIHNvdXJjZUNvZGUudGV4dFtpXSAhPT0gJ1xcdCcpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXN1bHQgPSBpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGZpbmRTcGVjaWZpZXJTdGFydChzb3VyY2VDb2RlLCBub2RlKSB7XG4gIGxldCB0b2tlbjtcblxuICBkbyB7XG4gICAgdG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuQmVmb3JlKG5vZGUpO1xuICB9IHdoaWxlICh0b2tlbi52YWx1ZSAhPT0gJywnICYmIHRva2VuLnZhbHVlICE9PSAneycpO1xuXG4gIHJldHVybiB0b2tlbi5yYW5nZVsxXTtcbn1cblxuZnVuY3Rpb24gZmluZFNwZWNpZmllckVuZChzb3VyY2VDb2RlLCBub2RlKSB7XG4gIGxldCB0b2tlbjtcblxuICBkbyB7XG4gICAgdG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuQWZ0ZXIobm9kZSk7XG4gIH0gd2hpbGUgKHRva2VuLnZhbHVlICE9PSAnLCcgJiYgdG9rZW4udmFsdWUgIT09ICd9Jyk7XG5cbiAgcmV0dXJuIHRva2VuLnJhbmdlWzBdO1xufVxuXG5mdW5jdGlvbiBpc1JlcXVpcmVFeHByZXNzaW9uKGV4cHIpIHtcbiAgcmV0dXJuIGV4cHIgIT0gbnVsbFxuICAgICYmIGV4cHIudHlwZSA9PT0gJ0NhbGxFeHByZXNzaW9uJ1xuICAgICYmIGV4cHIuY2FsbGVlICE9IG51bGxcbiAgICAmJiBleHByLmNhbGxlZS5uYW1lID09PSAncmVxdWlyZSdcbiAgICAmJiBleHByLmFyZ3VtZW50cyAhPSBudWxsXG4gICAgJiYgZXhwci5hcmd1bWVudHMubGVuZ3RoID09PSAxXG4gICAgJiYgZXhwci5hcmd1bWVudHNbMF0udHlwZSA9PT0gJ0xpdGVyYWwnO1xufVxuXG5mdW5jdGlvbiBpc1N1cHBvcnRlZFJlcXVpcmVNb2R1bGUobm9kZSkge1xuICBpZiAobm9kZS50eXBlICE9PSAnVmFyaWFibGVEZWNsYXJhdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKG5vZGUuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBkZWNsID0gbm9kZS5kZWNsYXJhdGlvbnNbMF07XG4gIGNvbnN0IGlzUGxhaW5SZXF1aXJlID0gZGVjbC5pZFxuICAgICYmIChkZWNsLmlkLnR5cGUgPT09ICdJZGVudGlmaWVyJyB8fCBkZWNsLmlkLnR5cGUgPT09ICdPYmplY3RQYXR0ZXJuJylcbiAgICAmJiBpc1JlcXVpcmVFeHByZXNzaW9uKGRlY2wuaW5pdCk7XG4gIGNvbnN0IGlzUmVxdWlyZVdpdGhNZW1iZXJFeHByZXNzaW9uID0gZGVjbC5pZFxuICAgICYmIChkZWNsLmlkLnR5cGUgPT09ICdJZGVudGlmaWVyJyB8fCBkZWNsLmlkLnR5cGUgPT09ICdPYmplY3RQYXR0ZXJuJylcbiAgICAmJiBkZWNsLmluaXQgIT0gbnVsbFxuICAgICYmIGRlY2wuaW5pdC50eXBlID09PSAnQ2FsbEV4cHJlc3Npb24nXG4gICAgJiYgZGVjbC5pbml0LmNhbGxlZSAhPSBudWxsXG4gICAgJiYgZGVjbC5pbml0LmNhbGxlZS50eXBlID09PSAnTWVtYmVyRXhwcmVzc2lvbidcbiAgICAmJiBpc1JlcXVpcmVFeHByZXNzaW9uKGRlY2wuaW5pdC5jYWxsZWUub2JqZWN0KTtcbiAgcmV0dXJuIGlzUGxhaW5SZXF1aXJlIHx8IGlzUmVxdWlyZVdpdGhNZW1iZXJFeHByZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBpc1BsYWluSW1wb3J0TW9kdWxlKG5vZGUpIHtcbiAgcmV0dXJuIG5vZGUudHlwZSA9PT0gJ0ltcG9ydERlY2xhcmF0aW9uJyAmJiBub2RlLnNwZWNpZmllcnMgIT0gbnVsbCAmJiBub2RlLnNwZWNpZmllcnMubGVuZ3RoID4gMDtcbn1cblxuZnVuY3Rpb24gaXNQbGFpbkltcG9ydEVxdWFscyhub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uJyAmJiBub2RlLm1vZHVsZVJlZmVyZW5jZS5leHByZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBpc0NKU0V4cG9ydHMoY29udGV4dCwgbm9kZSkge1xuICBpZiAoXG4gICAgbm9kZS50eXBlID09PSAnTWVtYmVyRXhwcmVzc2lvbidcbiAgICAmJiBub2RlLm9iamVjdC50eXBlID09PSAnSWRlbnRpZmllcidcbiAgICAmJiBub2RlLnByb3BlcnR5LnR5cGUgPT09ICdJZGVudGlmaWVyJ1xuICAgICYmIG5vZGUub2JqZWN0Lm5hbWUgPT09ICdtb2R1bGUnXG4gICAgJiYgbm9kZS5wcm9wZXJ0eS5uYW1lID09PSAnZXhwb3J0cydcbiAgKSB7XG4gICAgcmV0dXJuIGdldFNjb3BlKGNvbnRleHQsIG5vZGUpLnZhcmlhYmxlcy5maW5kSW5kZXgoKHZhcmlhYmxlKSA9PiB2YXJpYWJsZS5uYW1lID09PSAnbW9kdWxlJykgPT09IC0xO1xuICB9XG4gIGlmIChcbiAgICBub2RlLnR5cGUgPT09ICdJZGVudGlmaWVyJ1xuICAgICYmIG5vZGUubmFtZSA9PT0gJ2V4cG9ydHMnXG4gICkge1xuICAgIHJldHVybiBnZXRTY29wZShjb250ZXh0LCBub2RlKS52YXJpYWJsZXMuZmluZEluZGV4KCh2YXJpYWJsZSkgPT4gdmFyaWFibGUubmFtZSA9PT0gJ2V4cG9ydHMnKSA9PT0gLTE7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0TmFtZWRDSlNFeHBvcnRzKGNvbnRleHQsIG5vZGUpIHtcbiAgaWYgKG5vZGUudHlwZSAhPT0gJ01lbWJlckV4cHJlc3Npb24nKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBsZXQgcm9vdCA9IG5vZGU7XG4gIGxldCBwYXJlbnQgPSBudWxsO1xuICB3aGlsZSAocm9vdC50eXBlID09PSAnTWVtYmVyRXhwcmVzc2lvbicpIHtcbiAgICBpZiAocm9vdC5wcm9wZXJ0eS50eXBlICE9PSAnSWRlbnRpZmllcicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzdWx0LnVuc2hpZnQocm9vdC5wcm9wZXJ0eS5uYW1lKTtcbiAgICBwYXJlbnQgPSByb290O1xuICAgIHJvb3QgPSByb290Lm9iamVjdDtcbiAgfVxuXG4gIGlmIChpc0NKU0V4cG9ydHMoY29udGV4dCwgcm9vdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKGlzQ0pTRXhwb3J0cyhjb250ZXh0LCBwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdC5zbGljZSgxKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIobm9kZSkge1xuICByZXR1cm4gaXNTdXBwb3J0ZWRSZXF1aXJlTW9kdWxlKG5vZGUpIHx8IGlzUGxhaW5JbXBvcnRNb2R1bGUobm9kZSkgfHwgaXNQbGFpbkltcG9ydEVxdWFscyhub2RlKTtcbn1cblxuZnVuY3Rpb24gY2FuUmVvcmRlckl0ZW1zKGZpcnN0Tm9kZSwgc2Vjb25kTm9kZSkge1xuICBjb25zdCBwYXJlbnQgPSBmaXJzdE5vZGUucGFyZW50O1xuICBjb25zdCBbZmlyc3RJbmRleCwgc2Vjb25kSW5kZXhdID0gW1xuICAgIHBhcmVudC5ib2R5LmluZGV4T2YoZmlyc3ROb2RlKSxcbiAgICBwYXJlbnQuYm9keS5pbmRleE9mKHNlY29uZE5vZGUpLFxuICBdLnNvcnQoKTtcbiAgY29uc3Qgbm9kZXNCZXR3ZWVuID0gcGFyZW50LmJvZHkuc2xpY2UoZmlyc3RJbmRleCwgc2Vjb25kSW5kZXggKyAxKTtcbiAgZm9yIChjb25zdCBub2RlQmV0d2VlbiBvZiBub2Rlc0JldHdlZW4pIHtcbiAgICBpZiAoIWNhbkNyb3NzTm9kZVdoaWxlUmVvcmRlcihub2RlQmV0d2VlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG1ha2VJbXBvcnREZXNjcmlwdGlvbihub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgPT09ICdleHBvcnQnKSB7XG4gICAgaWYgKG5vZGUubm9kZS5leHBvcnRLaW5kID09PSAndHlwZScpIHtcbiAgICAgIHJldHVybiAndHlwZSBleHBvcnQnO1xuICAgIH1cbiAgICByZXR1cm4gJ2V4cG9ydCc7XG4gIH1cbiAgaWYgKG5vZGUubm9kZS5pbXBvcnRLaW5kID09PSAndHlwZScpIHtcbiAgICByZXR1cm4gJ3R5cGUgaW1wb3J0JztcbiAgfVxuICBpZiAobm9kZS5ub2RlLmltcG9ydEtpbmQgPT09ICd0eXBlb2YnKSB7XG4gICAgcmV0dXJuICd0eXBlb2YgaW1wb3J0JztcbiAgfVxuICByZXR1cm4gJ2ltcG9ydCc7XG59XG5cbmZ1bmN0aW9uIGZpeE91dE9mT3JkZXIoY29udGV4dCwgZmlyc3ROb2RlLCBzZWNvbmROb2RlLCBvcmRlciwgY2F0ZWdvcnkpIHtcbiAgY29uc3QgaXNOYW1lZCA9IGNhdGVnb3J5ID09PSBjYXRlZ29yaWVzLm5hbWVkO1xuICBjb25zdCBpc0V4cG9ydHMgPSBjYXRlZ29yeSA9PT0gY2F0ZWdvcmllcy5leHBvcnRzO1xuICBjb25zdCBzb3VyY2VDb2RlID0gZ2V0U291cmNlQ29kZShjb250ZXh0KTtcblxuICBjb25zdCB7XG4gICAgZmlyc3RSb290LFxuICAgIHNlY29uZFJvb3QsXG4gIH0gPSBpc05hbWVkID8ge1xuICAgIGZpcnN0Um9vdDogZmlyc3ROb2RlLm5vZGUsXG4gICAgc2Vjb25kUm9vdDogc2Vjb25kTm9kZS5ub2RlLFxuICB9IDoge1xuICAgIGZpcnN0Um9vdDogZmluZFJvb3ROb2RlKGZpcnN0Tm9kZS5ub2RlKSxcbiAgICBzZWNvbmRSb290OiBmaW5kUm9vdE5vZGUoc2Vjb25kTm9kZS5ub2RlKSxcbiAgfTtcblxuICBjb25zdCB7XG4gICAgZmlyc3RSb290U3RhcnQsXG4gICAgZmlyc3RSb290RW5kLFxuICAgIHNlY29uZFJvb3RTdGFydCxcbiAgICBzZWNvbmRSb290RW5kLFxuICB9ID0gaXNOYW1lZCA/IHtcbiAgICBmaXJzdFJvb3RTdGFydDogZmluZFNwZWNpZmllclN0YXJ0KHNvdXJjZUNvZGUsIGZpcnN0Um9vdCksXG4gICAgZmlyc3RSb290RW5kOiBmaW5kU3BlY2lmaWVyRW5kKHNvdXJjZUNvZGUsIGZpcnN0Um9vdCksXG4gICAgc2Vjb25kUm9vdFN0YXJ0OiBmaW5kU3BlY2lmaWVyU3RhcnQoc291cmNlQ29kZSwgc2Vjb25kUm9vdCksXG4gICAgc2Vjb25kUm9vdEVuZDogZmluZFNwZWNpZmllckVuZChzb3VyY2VDb2RlLCBzZWNvbmRSb290KSxcbiAgfSA6IHtcbiAgICBmaXJzdFJvb3RTdGFydDogZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGZpcnN0Um9vdCksXG4gICAgZmlyc3RSb290RW5kOiBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGZpcnN0Um9vdCksXG4gICAgc2Vjb25kUm9vdFN0YXJ0OiBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgc2Vjb25kUm9vdCksXG4gICAgc2Vjb25kUm9vdEVuZDogZmluZEVuZE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBzZWNvbmRSb290KSxcbiAgfTtcblxuICBpZiAoZmlyc3ROb2RlLmRpc3BsYXlOYW1lID09PSBzZWNvbmROb2RlLmRpc3BsYXlOYW1lKSB7XG4gICAgaWYgKGZpcnN0Tm9kZS5hbGlhcykge1xuICAgICAgZmlyc3ROb2RlLmRpc3BsYXlOYW1lID0gYCR7Zmlyc3ROb2RlLmRpc3BsYXlOYW1lfSBhcyAke2ZpcnN0Tm9kZS5hbGlhc31gO1xuICAgIH1cbiAgICBpZiAoc2Vjb25kTm9kZS5hbGlhcykge1xuICAgICAgc2Vjb25kTm9kZS5kaXNwbGF5TmFtZSA9IGAke3NlY29uZE5vZGUuZGlzcGxheU5hbWV9IGFzICR7c2Vjb25kTm9kZS5hbGlhc31gO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGZpcnN0SW1wb3J0ID0gYCR7bWFrZUltcG9ydERlc2NyaXB0aW9uKGZpcnN0Tm9kZSl9IG9mIFxcYCR7Zmlyc3ROb2RlLmRpc3BsYXlOYW1lfVxcYGA7XG4gIGNvbnN0IHNlY29uZEltcG9ydCA9IGBcXGAke3NlY29uZE5vZGUuZGlzcGxheU5hbWV9XFxgICR7bWFrZUltcG9ydERlc2NyaXB0aW9uKHNlY29uZE5vZGUpfWA7XG4gIGNvbnN0IG1lc3NhZ2UgPSBgJHtzZWNvbmRJbXBvcnR9IHNob3VsZCBvY2N1ciAke29yZGVyfSAke2ZpcnN0SW1wb3J0fWA7XG5cbiAgaWYgKGlzTmFtZWQpIHtcbiAgICBjb25zdCBmaXJzdENvZGUgPSBzb3VyY2VDb2RlLnRleHQuc2xpY2UoZmlyc3RSb290U3RhcnQsIGZpcnN0Um9vdC5yYW5nZVsxXSk7XG4gICAgY29uc3QgZmlyc3RUcml2aWEgPSBzb3VyY2VDb2RlLnRleHQuc2xpY2UoZmlyc3RSb290LnJhbmdlWzFdLCBmaXJzdFJvb3RFbmQpO1xuICAgIGNvbnN0IHNlY29uZENvZGUgPSBzb3VyY2VDb2RlLnRleHQuc2xpY2Uoc2Vjb25kUm9vdFN0YXJ0LCBzZWNvbmRSb290LnJhbmdlWzFdKTtcbiAgICBjb25zdCBzZWNvbmRUcml2aWEgPSBzb3VyY2VDb2RlLnRleHQuc2xpY2Uoc2Vjb25kUm9vdC5yYW5nZVsxXSwgc2Vjb25kUm9vdEVuZCk7XG5cbiAgICBpZiAob3JkZXIgPT09ICdiZWZvcmUnKSB7XG4gICAgICBjb25zdCB0cmltbWVkVHJpdmlhID0gc2Vjb25kVHJpdmlhLnRyaW1FbmQoKTtcbiAgICAgIGNvbnN0IGdhcENvZGUgPSBzb3VyY2VDb2RlLnRleHQuc2xpY2UoZmlyc3RSb290RW5kLCBzZWNvbmRSb290U3RhcnQgLSAxKTtcbiAgICAgIGNvbnN0IHdoaXRlc3BhY2VzID0gc2Vjb25kVHJpdmlhLnNsaWNlKHRyaW1tZWRUcml2aWEubGVuZ3RoKTtcbiAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgbm9kZTogc2Vjb25kTm9kZS5ub2RlLFxuICAgICAgICBtZXNzYWdlLFxuICAgICAgICBmaXg6IChmaXhlcikgPT4gZml4ZXIucmVwbGFjZVRleHRSYW5nZShcbiAgICAgICAgICBbZmlyc3RSb290U3RhcnQsIHNlY29uZFJvb3RFbmRdLFxuICAgICAgICAgIGAke3NlY29uZENvZGV9LCR7dHJpbW1lZFRyaXZpYX0ke2ZpcnN0Q29kZX0ke2ZpcnN0VHJpdmlhfSR7Z2FwQ29kZX0ke3doaXRlc3BhY2VzfWAsXG4gICAgICAgICksXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKG9yZGVyID09PSAnYWZ0ZXInKSB7XG4gICAgICBjb25zdCB0cmltbWVkVHJpdmlhID0gZmlyc3RUcml2aWEudHJpbUVuZCgpO1xuICAgICAgY29uc3QgZ2FwQ29kZSA9IHNvdXJjZUNvZGUudGV4dC5zbGljZShzZWNvbmRSb290RW5kICsgMSwgZmlyc3RSb290U3RhcnQpO1xuICAgICAgY29uc3Qgd2hpdGVzcGFjZXMgPSBmaXJzdFRyaXZpYS5zbGljZSh0cmltbWVkVHJpdmlhLmxlbmd0aCk7XG4gICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgIG5vZGU6IHNlY29uZE5vZGUubm9kZSxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgZml4OiAoZml4ZXMpID0+IGZpeGVzLnJlcGxhY2VUZXh0UmFuZ2UoXG4gICAgICAgICAgW3NlY29uZFJvb3RTdGFydCwgZmlyc3RSb290RW5kXSxcbiAgICAgICAgICBgJHtnYXBDb2RlfSR7Zmlyc3RDb2RlfSwke3RyaW1tZWRUcml2aWF9JHtzZWNvbmRDb2RlfSR7d2hpdGVzcGFjZXN9YCxcbiAgICAgICAgKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBjYW5GaXggPSBpc0V4cG9ydHMgfHwgY2FuUmVvcmRlckl0ZW1zKGZpcnN0Um9vdCwgc2Vjb25kUm9vdCk7XG4gICAgbGV0IG5ld0NvZGUgPSBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKHNlY29uZFJvb3RTdGFydCwgc2Vjb25kUm9vdEVuZCk7XG5cbiAgICBpZiAobmV3Q29kZVtuZXdDb2RlLmxlbmd0aCAtIDFdICE9PSAnXFxuJykge1xuICAgICAgbmV3Q29kZSA9IGAke25ld0NvZGV9XFxuYDtcbiAgICB9XG5cbiAgICBpZiAob3JkZXIgPT09ICdiZWZvcmUnKSB7XG4gICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgIG5vZGU6IHNlY29uZE5vZGUubm9kZSxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgZml4OiBjYW5GaXggJiYgKChmaXhlcikgPT4gZml4ZXIucmVwbGFjZVRleHRSYW5nZShcbiAgICAgICAgICBbZmlyc3RSb290U3RhcnQsIHNlY29uZFJvb3RFbmRdLFxuICAgICAgICAgIG5ld0NvZGUgKyBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKGZpcnN0Um9vdFN0YXJ0LCBzZWNvbmRSb290U3RhcnQpLFxuICAgICAgICApKSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAob3JkZXIgPT09ICdhZnRlcicpIHtcbiAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgbm9kZTogc2Vjb25kTm9kZS5ub2RlLFxuICAgICAgICBtZXNzYWdlLFxuICAgICAgICBmaXg6IGNhbkZpeCAmJiAoKGZpeGVyKSA9PiBmaXhlci5yZXBsYWNlVGV4dFJhbmdlKFxuICAgICAgICAgIFtzZWNvbmRSb290U3RhcnQsIGZpcnN0Um9vdEVuZF0sXG4gICAgICAgICAgc291cmNlQ29kZS50ZXh0LnN1YnN0cmluZyhzZWNvbmRSb290RW5kLCBmaXJzdFJvb3RFbmQpICsgbmV3Q29kZSxcbiAgICAgICAgKSksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVwb3J0T3V0T2ZPcmRlcihjb250ZXh0LCBpbXBvcnRlZCwgb3V0T2ZPcmRlciwgb3JkZXIsIGNhdGVnb3J5KSB7XG4gIG91dE9mT3JkZXIuZm9yRWFjaChmdW5jdGlvbiAoaW1wKSB7XG4gICAgY29uc3QgZm91bmQgPSBpbXBvcnRlZC5maW5kKGZ1bmN0aW9uIGhhc0hpZ2hlclJhbmsoaW1wb3J0ZWRJdGVtKSB7XG4gICAgICByZXR1cm4gaW1wb3J0ZWRJdGVtLnJhbmsgPiBpbXAucmFuaztcbiAgICB9KTtcbiAgICBmaXhPdXRPZk9yZGVyKGNvbnRleHQsIGZvdW5kLCBpbXAsIG9yZGVyLCBjYXRlZ29yeSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtYWtlT3V0T2ZPcmRlclJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCwgY2F0ZWdvcnkpIHtcbiAgY29uc3Qgb3V0T2ZPcmRlciA9IGZpbmRPdXRPZk9yZGVyKGltcG9ydGVkKTtcbiAgaWYgKCFvdXRPZk9yZGVyLmxlbmd0aCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFRoZXJlIGFyZSB0aGluZ3MgdG8gcmVwb3J0LiBUcnkgdG8gbWluaW1pemUgdGhlIG51bWJlciBvZiByZXBvcnRlZCBlcnJvcnMuXG4gIGNvbnN0IHJldmVyc2VkSW1wb3J0ZWQgPSByZXZlcnNlKGltcG9ydGVkKTtcbiAgY29uc3QgcmV2ZXJzZWRPcmRlciA9IGZpbmRPdXRPZk9yZGVyKHJldmVyc2VkSW1wb3J0ZWQpO1xuICBpZiAocmV2ZXJzZWRPcmRlci5sZW5ndGggPCBvdXRPZk9yZGVyLmxlbmd0aCkge1xuICAgIHJlcG9ydE91dE9mT3JkZXIoY29udGV4dCwgcmV2ZXJzZWRJbXBvcnRlZCwgcmV2ZXJzZWRPcmRlciwgJ2FmdGVyJywgY2F0ZWdvcnkpO1xuICAgIHJldHVybjtcbiAgfVxuICByZXBvcnRPdXRPZk9yZGVyKGNvbnRleHQsIGltcG9ydGVkLCBvdXRPZk9yZGVyLCAnYmVmb3JlJywgY2F0ZWdvcnkpO1xufVxuXG5jb25zdCBjb21wYXJlU3RyaW5nID0gKGEsIGIpID0+IHtcbiAgaWYgKGEgPCBiKSB7XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIGlmIChhID4gYikge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuLyoqIFNvbWUgcGFyc2VycyAobGFuZ3VhZ2VzIHdpdGhvdXQgdHlwZXMpIGRvbid0IHByb3ZpZGUgSW1wb3J0S2luZCAqL1xuY29uc3QgREVGQVVMVF9JTVBPUlRfS0lORCA9ICd2YWx1ZSc7XG5jb25zdCBnZXROb3JtYWxpemVkVmFsdWUgPSAobm9kZSwgdG9Mb3dlckNhc2UpID0+IHtcbiAgY29uc3QgdmFsdWUgPSBub2RlLnZhbHVlO1xuICByZXR1cm4gdG9Mb3dlckNhc2UgPyBTdHJpbmcodmFsdWUpLnRvTG93ZXJDYXNlKCkgOiB2YWx1ZTtcbn07XG5cbmZ1bmN0aW9uIGdldFNvcnRlcihhbHBoYWJldGl6ZU9wdGlvbnMpIHtcbiAgY29uc3QgbXVsdGlwbGllciA9IGFscGhhYmV0aXplT3B0aW9ucy5vcmRlciA9PT0gJ2FzYycgPyAxIDogLTE7XG4gIGNvbnN0IG9yZGVySW1wb3J0S2luZCA9IGFscGhhYmV0aXplT3B0aW9ucy5vcmRlckltcG9ydEtpbmQ7XG4gIGNvbnN0IG11bHRpcGxpZXJJbXBvcnRLaW5kID0gb3JkZXJJbXBvcnRLaW5kICE9PSAnaWdub3JlJ1xuICAgICYmIChhbHBoYWJldGl6ZU9wdGlvbnMub3JkZXJJbXBvcnRLaW5kID09PSAnYXNjJyA/IDEgOiAtMSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGltcG9ydHNTb3J0ZXIobm9kZUEsIG5vZGVCKSB7XG4gICAgY29uc3QgaW1wb3J0QSA9IGdldE5vcm1hbGl6ZWRWYWx1ZShub2RlQSwgYWxwaGFiZXRpemVPcHRpb25zLmNhc2VJbnNlbnNpdGl2ZSk7XG4gICAgY29uc3QgaW1wb3J0QiA9IGdldE5vcm1hbGl6ZWRWYWx1ZShub2RlQiwgYWxwaGFiZXRpemVPcHRpb25zLmNhc2VJbnNlbnNpdGl2ZSk7XG4gICAgbGV0IHJlc3VsdCA9IDA7XG5cbiAgICBpZiAoIWltcG9ydEEuaW5jbHVkZXMoJy8nKSAmJiAhaW1wb3J0Qi5pbmNsdWRlcygnLycpKSB7XG4gICAgICByZXN1bHQgPSBjb21wYXJlU3RyaW5nKGltcG9ydEEsIGltcG9ydEIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBBID0gaW1wb3J0QS5zcGxpdCgnLycpO1xuICAgICAgY29uc3QgQiA9IGltcG9ydEIuc3BsaXQoJy8nKTtcbiAgICAgIGNvbnN0IGEgPSBBLmxlbmd0aDtcbiAgICAgIGNvbnN0IGIgPSBCLmxlbmd0aDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihhLCBiKTsgaSsrKSB7XG4gICAgICAgIC8vIFNraXAgY29tcGFyaW5nIHRoZSBmaXJzdCBwYXRoIHNlZ21lbnQsIGlmIHRoZXkgYXJlIHJlbGF0aXZlIHNlZ21lbnRzIGZvciBib3RoIGltcG9ydHNcbiAgICAgICAgaWYgKGkgPT09IDAgJiYgKChBW2ldID09PSAnLicgfHwgQVtpXSA9PT0gJy4uJykgJiYgKEJbaV0gPT09ICcuJyB8fCBCW2ldID09PSAnLi4nKSkpIHtcbiAgICAgICAgICAvLyBJZiBvbmUgaXMgc2libGluZyBhbmQgdGhlIG90aGVyIHBhcmVudCBpbXBvcnQsIG5vIG5lZWQgdG8gY29tcGFyZSBhdCBhbGwsIHNpbmNlIHRoZSBwYXRocyBiZWxvbmcgaW4gZGlmZmVyZW50IGdyb3Vwc1xuICAgICAgICAgIGlmIChBW2ldICE9PSBCW2ldKSB7IGJyZWFrOyB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0ID0gY29tcGFyZVN0cmluZyhBW2ldLCBCW2ldKTtcbiAgICAgICAgaWYgKHJlc3VsdCkgeyBicmVhazsgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXJlc3VsdCAmJiBhICE9PSBiKSB7XG4gICAgICAgIHJlc3VsdCA9IGEgPCBiID8gLTEgOiAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdCA9IHJlc3VsdCAqIG11bHRpcGxpZXI7XG5cbiAgICAvLyBJbiBjYXNlIHRoZSBwYXRocyBhcmUgZXF1YWwgKHJlc3VsdCA9PT0gMCksIHNvcnQgdGhlbSBieSBpbXBvcnRLaW5kXG4gICAgaWYgKCFyZXN1bHQgJiYgbXVsdGlwbGllckltcG9ydEtpbmQpIHtcbiAgICAgIHJlc3VsdCA9IG11bHRpcGxpZXJJbXBvcnRLaW5kICogY29tcGFyZVN0cmluZyhcbiAgICAgICAgbm9kZUEubm9kZS5pbXBvcnRLaW5kIHx8IERFRkFVTFRfSU1QT1JUX0tJTkQsXG4gICAgICAgIG5vZGVCLm5vZGUuaW1wb3J0S2luZCB8fCBERUZBVUxUX0lNUE9SVF9LSU5ELFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG5mdW5jdGlvbiBtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUoaW1wb3J0ZWQsIGFscGhhYmV0aXplT3B0aW9ucykge1xuICBjb25zdCBncm91cGVkQnlSYW5rcyA9IE9iamVjdC5ncm91cEJ5KGltcG9ydGVkLCAoaXRlbSkgPT4gaXRlbS5yYW5rKTtcblxuICBjb25zdCBzb3J0ZXJGbiA9IGdldFNvcnRlcihhbHBoYWJldGl6ZU9wdGlvbnMpO1xuXG4gIC8vIHNvcnQgZ3JvdXAga2V5cyBzbyB0aGF0IHRoZXkgY2FuIGJlIGl0ZXJhdGVkIG9uIGluIG9yZGVyXG4gIGNvbnN0IGdyb3VwUmFua3MgPSBPYmplY3Qua2V5cyhncm91cGVkQnlSYW5rcykuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiBhIC0gYjtcbiAgfSk7XG5cbiAgLy8gc29ydCBpbXBvcnRzIGxvY2FsbHkgd2l0aGluIHRoZWlyIGdyb3VwXG4gIGdyb3VwUmFua3MuZm9yRWFjaChmdW5jdGlvbiAoZ3JvdXBSYW5rKSB7XG4gICAgZ3JvdXBlZEJ5UmFua3NbZ3JvdXBSYW5rXS5zb3J0KHNvcnRlckZuKTtcbiAgfSk7XG5cbiAgLy8gYXNzaWduIGdsb2JhbGx5IHVuaXF1ZSByYW5rIHRvIGVhY2ggaW1wb3J0XG4gIGxldCBuZXdSYW5rID0gMDtcbiAgY29uc3QgYWxwaGFiZXRpemVkUmFua3MgPSBncm91cFJhbmtzLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBncm91cFJhbmspIHtcbiAgICBncm91cGVkQnlSYW5rc1tncm91cFJhbmtdLmZvckVhY2goZnVuY3Rpb24gKGltcG9ydGVkSXRlbSkge1xuICAgICAgYWNjW2Ake2ltcG9ydGVkSXRlbS52YWx1ZX18JHtpbXBvcnRlZEl0ZW0ubm9kZS5pbXBvcnRLaW5kfWBdID0gcGFyc2VJbnQoZ3JvdXBSYW5rLCAxMCkgKyBuZXdSYW5rO1xuICAgICAgbmV3UmFuayArPSAxO1xuICAgIH0pO1xuICAgIHJldHVybiBhY2M7XG4gIH0sIHt9KTtcblxuICAvLyBtdXRhdGUgdGhlIG9yaWdpbmFsIGdyb3VwLXJhbmsgd2l0aCBhbHBoYWJldGl6ZWQtcmFua1xuICBpbXBvcnRlZC5mb3JFYWNoKGZ1bmN0aW9uIChpbXBvcnRlZEl0ZW0pIHtcbiAgICBpbXBvcnRlZEl0ZW0ucmFuayA9IGFscGhhYmV0aXplZFJhbmtzW2Ake2ltcG9ydGVkSXRlbS52YWx1ZX18JHtpbXBvcnRlZEl0ZW0ubm9kZS5pbXBvcnRLaW5kfWBdO1xuICB9KTtcbn1cblxuLy8gREVURUNUSU5HXG5cbmZ1bmN0aW9uIGNvbXB1dGVQYXRoUmFuayhyYW5rcywgcGF0aEdyb3VwcywgcGF0aCwgbWF4UG9zaXRpb24pIHtcbiAgZm9yIChsZXQgaSA9IDAsIGwgPSBwYXRoR3JvdXBzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGNvbnN0IHsgcGF0dGVybiwgcGF0dGVybk9wdGlvbnMsIGdyb3VwLCBwb3NpdGlvbiA9IDEgfSA9IHBhdGhHcm91cHNbaV07XG4gICAgaWYgKG1pbmltYXRjaChwYXRoLCBwYXR0ZXJuLCBwYXR0ZXJuT3B0aW9ucyB8fCB7IG5vY29tbWVudDogdHJ1ZSB9KSkge1xuICAgICAgcmV0dXJuIHJhbmtzW2dyb3VwXSArIHBvc2l0aW9uIC8gbWF4UG9zaXRpb247XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVSYW5rKGNvbnRleHQsIHJhbmtzLCBpbXBvcnRFbnRyeSwgZXhjbHVkZWRJbXBvcnRUeXBlcywgaXNTb3J0aW5nVHlwZXNHcm91cCkge1xuICBsZXQgaW1wVHlwZTtcbiAgbGV0IHJhbms7XG5cbiAgY29uc3QgaXNUeXBlR3JvdXBJbkdyb3VwcyA9IHJhbmtzLm9taXR0ZWRUeXBlcy5pbmRleE9mKCd0eXBlJykgPT09IC0xO1xuICBjb25zdCBpc1R5cGVPbmx5SW1wb3J0ID0gaW1wb3J0RW50cnkubm9kZS5pbXBvcnRLaW5kID09PSAndHlwZSc7XG4gIGNvbnN0IGlzRXhjbHVkZWRGcm9tUGF0aFJhbmsgPSBpc1R5cGVPbmx5SW1wb3J0ICYmIGlzVHlwZUdyb3VwSW5Hcm91cHMgJiYgZXhjbHVkZWRJbXBvcnRUeXBlcy5oYXMoJ3R5cGUnKTtcblxuICBpZiAoaW1wb3J0RW50cnkudHlwZSA9PT0gJ2ltcG9ydDpvYmplY3QnKSB7XG4gICAgaW1wVHlwZSA9ICdvYmplY3QnO1xuICB9IGVsc2UgaWYgKGlzVHlwZU9ubHlJbXBvcnQgJiYgaXNUeXBlR3JvdXBJbkdyb3VwcyAmJiAhaXNTb3J0aW5nVHlwZXNHcm91cCkge1xuICAgIGltcFR5cGUgPSAndHlwZSc7XG4gIH0gZWxzZSB7XG4gICAgaW1wVHlwZSA9IGltcG9ydFR5cGUoaW1wb3J0RW50cnkudmFsdWUsIGNvbnRleHQpO1xuICB9XG5cbiAgaWYgKCFleGNsdWRlZEltcG9ydFR5cGVzLmhhcyhpbXBUeXBlKSAmJiAhaXNFeGNsdWRlZEZyb21QYXRoUmFuaykge1xuICAgIHJhbmsgPSBjb21wdXRlUGF0aFJhbmsocmFua3MuZ3JvdXBzLCByYW5rcy5wYXRoR3JvdXBzLCBpbXBvcnRFbnRyeS52YWx1ZSwgcmFua3MubWF4UG9zaXRpb24pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiByYW5rID09PSAndW5kZWZpbmVkJykge1xuICAgIHJhbmsgPSByYW5rcy5ncm91cHNbaW1wVHlwZV07XG5cbiAgICBpZiAodHlwZW9mIHJhbmsgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaWYgKGlzVHlwZU9ubHlJbXBvcnQgJiYgaXNTb3J0aW5nVHlwZXNHcm91cCkge1xuICAgIHJhbmsgPSByYW5rcy5ncm91cHMudHlwZSArIHJhbmsgLyAxMDtcbiAgfVxuXG4gIGlmIChpbXBvcnRFbnRyeS50eXBlICE9PSAnaW1wb3J0JyAmJiAhaW1wb3J0RW50cnkudHlwZS5zdGFydHNXaXRoKCdpbXBvcnQ6JykpIHtcbiAgICByYW5rICs9IDEwMDtcbiAgfVxuXG4gIHJldHVybiByYW5rO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlck5vZGUoY29udGV4dCwgaW1wb3J0RW50cnksIHJhbmtzLCBpbXBvcnRlZCwgZXhjbHVkZWRJbXBvcnRUeXBlcywgaXNTb3J0aW5nVHlwZXNHcm91cCkge1xuICBjb25zdCByYW5rID0gY29tcHV0ZVJhbmsoY29udGV4dCwgcmFua3MsIGltcG9ydEVudHJ5LCBleGNsdWRlZEltcG9ydFR5cGVzLCBpc1NvcnRpbmdUeXBlc0dyb3VwKTtcbiAgaWYgKHJhbmsgIT09IC0xKSB7XG4gICAgbGV0IGltcG9ydE5vZGUgPSBpbXBvcnRFbnRyeS5ub2RlO1xuXG4gICAgaWYgKGltcG9ydEVudHJ5LnR5cGUgPT09ICdyZXF1aXJlJyAmJiBpbXBvcnROb2RlLnBhcmVudC5wYXJlbnQudHlwZSA9PT0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nKSB7XG4gICAgICBpbXBvcnROb2RlID0gaW1wb3J0Tm9kZS5wYXJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIGltcG9ydGVkLnB1c2goe1xuICAgICAgLi4uaW1wb3J0RW50cnksXG4gICAgICByYW5rLFxuICAgICAgaXNNdWx0aWxpbmU6IGltcG9ydE5vZGUubG9jLmVuZC5saW5lICE9PSBpbXBvcnROb2RlLmxvYy5zdGFydC5saW5lLFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFJlcXVpcmVCbG9jayhub2RlKSB7XG4gIGxldCBuID0gbm9kZTtcbiAgLy8gSGFuZGxlIGNhc2VzIGxpa2UgYGNvbnN0IGJheiA9IHJlcXVpcmUoJ2ZvbycpLmJhci5iYXpgXG4gIC8vIGFuZCBgY29uc3QgZm9vID0gcmVxdWlyZSgnZm9vJykoKWBcbiAgd2hpbGUgKFxuICAgIG4ucGFyZW50LnR5cGUgPT09ICdNZW1iZXJFeHByZXNzaW9uJyAmJiBuLnBhcmVudC5vYmplY3QgPT09IG5cbiAgICB8fCBuLnBhcmVudC50eXBlID09PSAnQ2FsbEV4cHJlc3Npb24nICYmIG4ucGFyZW50LmNhbGxlZSA9PT0gblxuICApIHtcbiAgICBuID0gbi5wYXJlbnQ7XG4gIH1cbiAgaWYgKFxuICAgIG4ucGFyZW50LnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0b3InXG4gICAgJiYgbi5wYXJlbnQucGFyZW50LnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJ1xuICAgICYmIG4ucGFyZW50LnBhcmVudC5wYXJlbnQudHlwZSA9PT0gJ1Byb2dyYW0nXG4gICkge1xuICAgIHJldHVybiBuLnBhcmVudC5wYXJlbnQucGFyZW50O1xuICB9XG59XG5cbmNvbnN0IHR5cGVzID0gWydidWlsdGluJywgJ2V4dGVybmFsJywgJ2ludGVybmFsJywgJ3Vua25vd24nLCAncGFyZW50JywgJ3NpYmxpbmcnLCAnaW5kZXgnLCAnb2JqZWN0JywgJ3R5cGUnXTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9iamVjdCB3aXRoIHR5cGUtcmFuayBwYWlycy5cbiAqXG4gKiBFeGFtcGxlOiB7IGluZGV4OiAwLCBzaWJsaW5nOiAxLCBwYXJlbnQ6IDEsIGV4dGVybmFsOiAxLCBidWlsdGluOiAyLCBpbnRlcm5hbDogMiB9XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRHcm91cHNUb1JhbmtzKGdyb3Vwcykge1xuICBjb25zdCByYW5rT2JqZWN0ID0gZ3JvdXBzLnJlZHVjZShmdW5jdGlvbiAocmVzLCBncm91cCwgaW5kZXgpIHtcbiAgICBbXS5jb25jYXQoZ3JvdXApLmZvckVhY2goZnVuY3Rpb24gKGdyb3VwSXRlbSkge1xuICAgICAgcmVzW2dyb3VwSXRlbV0gPSBpbmRleCAqIDI7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge30pO1xuXG4gIGNvbnN0IG9taXR0ZWRUeXBlcyA9IHR5cGVzLmZpbHRlcihmdW5jdGlvbiAodHlwZSkge1xuICAgIHJldHVybiB0eXBlb2YgcmFua09iamVjdFt0eXBlXSA9PT0gJ3VuZGVmaW5lZCc7XG4gIH0pO1xuXG4gIGNvbnN0IHJhbmtzID0gb21pdHRlZFR5cGVzLnJlZHVjZShmdW5jdGlvbiAocmVzLCB0eXBlKSB7XG4gICAgcmVzW3R5cGVdID0gZ3JvdXBzLmxlbmd0aCAqIDI7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwgcmFua09iamVjdCk7XG5cbiAgcmV0dXJuIHsgZ3JvdXBzOiByYW5rcywgb21pdHRlZFR5cGVzIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQYXRoR3JvdXBzRm9yUmFua3MocGF0aEdyb3Vwcykge1xuICBjb25zdCBhZnRlciA9IHt9O1xuICBjb25zdCBiZWZvcmUgPSB7fTtcblxuICBjb25zdCB0cmFuc2Zvcm1lZCA9IHBhdGhHcm91cHMubWFwKChwYXRoR3JvdXAsIGluZGV4KSA9PiB7XG4gICAgY29uc3QgeyBncm91cCwgcG9zaXRpb246IHBvc2l0aW9uU3RyaW5nIH0gPSBwYXRoR3JvdXA7XG4gICAgbGV0IHBvc2l0aW9uID0gMDtcbiAgICBpZiAocG9zaXRpb25TdHJpbmcgPT09ICdhZnRlcicpIHtcbiAgICAgIGlmICghYWZ0ZXJbZ3JvdXBdKSB7XG4gICAgICAgIGFmdGVyW2dyb3VwXSA9IDE7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbiA9IGFmdGVyW2dyb3VwXSsrO1xuICAgIH0gZWxzZSBpZiAocG9zaXRpb25TdHJpbmcgPT09ICdiZWZvcmUnKSB7XG4gICAgICBpZiAoIWJlZm9yZVtncm91cF0pIHtcbiAgICAgICAgYmVmb3JlW2dyb3VwXSA9IFtdO1xuICAgICAgfVxuICAgICAgYmVmb3JlW2dyb3VwXS5wdXNoKGluZGV4KTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5wYXRoR3JvdXAsIHBvc2l0aW9uIH07XG4gIH0pO1xuXG4gIGxldCBtYXhQb3NpdGlvbiA9IDE7XG5cbiAgT2JqZWN0LmtleXMoYmVmb3JlKS5mb3JFYWNoKChncm91cCkgPT4ge1xuICAgIGNvbnN0IGdyb3VwTGVuZ3RoID0gYmVmb3JlW2dyb3VwXS5sZW5ndGg7XG4gICAgYmVmb3JlW2dyb3VwXS5mb3JFYWNoKChncm91cEluZGV4LCBpbmRleCkgPT4ge1xuICAgICAgdHJhbnNmb3JtZWRbZ3JvdXBJbmRleF0ucG9zaXRpb24gPSAtMSAqIChncm91cExlbmd0aCAtIGluZGV4KTtcbiAgICB9KTtcbiAgICBtYXhQb3NpdGlvbiA9IE1hdGgubWF4KG1heFBvc2l0aW9uLCBncm91cExlbmd0aCk7XG4gIH0pO1xuXG4gIE9iamVjdC5rZXlzKGFmdGVyKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBjb25zdCBncm91cE5leHRQb3NpdGlvbiA9IGFmdGVyW2tleV07XG4gICAgbWF4UG9zaXRpb24gPSBNYXRoLm1heChtYXhQb3NpdGlvbiwgZ3JvdXBOZXh0UG9zaXRpb24gLSAxKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXRoR3JvdXBzOiB0cmFuc2Zvcm1lZCxcbiAgICBtYXhQb3NpdGlvbjogbWF4UG9zaXRpb24gPiAxMCA/IE1hdGgucG93KDEwLCBNYXRoLmNlaWwoTWF0aC5sb2cxMChtYXhQb3NpdGlvbikpKSA6IDEwLFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaXhOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgcHJldmlvdXNJbXBvcnQpIHtcbiAgY29uc3QgcHJldlJvb3QgPSBmaW5kUm9vdE5vZGUocHJldmlvdXNJbXBvcnQubm9kZSk7XG4gIGNvbnN0IHRva2Vuc1RvRW5kT2ZMaW5lID0gdGFrZVRva2Vuc0FmdGVyV2hpbGUoXG4gICAgZ2V0U291cmNlQ29kZShjb250ZXh0KSxcbiAgICBwcmV2Um9vdCxcbiAgICBjb21tZW50T25TYW1lTGluZUFzKHByZXZSb290KSxcbiAgKTtcblxuICBsZXQgZW5kT2ZMaW5lID0gcHJldlJvb3QucmFuZ2VbMV07XG4gIGlmICh0b2tlbnNUb0VuZE9mTGluZS5sZW5ndGggPiAwKSB7XG4gICAgZW5kT2ZMaW5lID0gdG9rZW5zVG9FbmRPZkxpbmVbdG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoIC0gMV0ucmFuZ2VbMV07XG4gIH1cbiAgcmV0dXJuIChmaXhlcikgPT4gZml4ZXIuaW5zZXJ0VGV4dEFmdGVyUmFuZ2UoW3ByZXZSb290LnJhbmdlWzBdLCBlbmRPZkxpbmVdLCAnXFxuJyk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCkge1xuICBjb25zdCBzb3VyY2VDb2RlID0gZ2V0U291cmNlQ29kZShjb250ZXh0KTtcbiAgY29uc3QgcHJldlJvb3QgPSBmaW5kUm9vdE5vZGUocHJldmlvdXNJbXBvcnQubm9kZSk7XG4gIGNvbnN0IGN1cnJSb290ID0gZmluZFJvb3ROb2RlKGN1cnJlbnRJbXBvcnQubm9kZSk7XG4gIGNvbnN0IHJhbmdlVG9SZW1vdmUgPSBbXG4gICAgZmluZEVuZE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBwcmV2Um9vdCksXG4gICAgZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGN1cnJSb290KSxcbiAgXTtcbiAgaWYgKCgvXlxccyokLykudGVzdChzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKHJhbmdlVG9SZW1vdmVbMF0sIHJhbmdlVG9SZW1vdmVbMV0pKSkge1xuICAgIHJldHVybiAoZml4ZXIpID0+IGZpeGVyLnJlbW92ZVJhbmdlKHJhbmdlVG9SZW1vdmUpO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG1ha2VOZXdsaW5lc0JldHdlZW5SZXBvcnQoY29udGV4dCwgaW1wb3J0ZWQsIG5ld2xpbmVzQmV0d2VlbkltcG9ydHNfLCBuZXdsaW5lc0JldHdlZW5UeXBlT25seUltcG9ydHNfLCBkaXN0aW5jdEdyb3VwLCBpc1NvcnRpbmdUeXBlc0dyb3VwLCBpc0NvbnNvbGlkYXRpbmdTcGFjZUJldHdlZW5JbXBvcnRzKSB7XG4gIGNvbnN0IGdldE51bWJlck9mRW1wdHlMaW5lc0JldHdlZW4gPSAoY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpID0+IHtcbiAgICBjb25zdCBsaW5lc0JldHdlZW5JbXBvcnRzID0gZ2V0U291cmNlQ29kZShjb250ZXh0KS5saW5lcy5zbGljZShcbiAgICAgIHByZXZpb3VzSW1wb3J0Lm5vZGUubG9jLmVuZC5saW5lLFxuICAgICAgY3VycmVudEltcG9ydC5ub2RlLmxvYy5zdGFydC5saW5lIC0gMSxcbiAgICApO1xuXG4gICAgcmV0dXJuIGxpbmVzQmV0d2VlbkltcG9ydHMuZmlsdGVyKChsaW5lKSA9PiAhbGluZS50cmltKCkubGVuZ3RoKS5sZW5ndGg7XG4gIH07XG4gIGNvbnN0IGdldElzU3RhcnRPZkRpc3RpbmN0R3JvdXAgPSAoY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpID0+IGN1cnJlbnRJbXBvcnQucmFuayAtIDEgPj0gcHJldmlvdXNJbXBvcnQucmFuaztcbiAgbGV0IHByZXZpb3VzSW1wb3J0ID0gaW1wb3J0ZWRbMF07XG5cbiAgaW1wb3J0ZWQuc2xpY2UoMSkuZm9yRWFjaChmdW5jdGlvbiAoY3VycmVudEltcG9ydCkge1xuICAgIGNvbnN0IGVtcHR5TGluZXNCZXR3ZWVuID0gZ2V0TnVtYmVyT2ZFbXB0eUxpbmVzQmV0d2VlbihcbiAgICAgIGN1cnJlbnRJbXBvcnQsXG4gICAgICBwcmV2aW91c0ltcG9ydCxcbiAgICApO1xuXG4gICAgY29uc3QgaXNTdGFydE9mRGlzdGluY3RHcm91cCA9IGdldElzU3RhcnRPZkRpc3RpbmN0R3JvdXAoXG4gICAgICBjdXJyZW50SW1wb3J0LFxuICAgICAgcHJldmlvdXNJbXBvcnQsXG4gICAgKTtcblxuICAgIGNvbnN0IGlzVHlwZU9ubHlJbXBvcnQgPSBjdXJyZW50SW1wb3J0Lm5vZGUuaW1wb3J0S2luZCA9PT0gJ3R5cGUnO1xuICAgIGNvbnN0IGlzUHJldmlvdXNJbXBvcnRUeXBlT25seUltcG9ydCA9IHByZXZpb3VzSW1wb3J0Lm5vZGUuaW1wb3J0S2luZCA9PT0gJ3R5cGUnO1xuXG4gICAgY29uc3QgaXNOb3JtYWxJbXBvcnROZXh0VG9UeXBlT25seUltcG9ydEFuZFJlbGV2YW50ID0gICAgICBpc1R5cGVPbmx5SW1wb3J0ICE9PSBpc1ByZXZpb3VzSW1wb3J0VHlwZU9ubHlJbXBvcnQgJiYgaXNTb3J0aW5nVHlwZXNHcm91cDtcblxuICAgIGNvbnN0IGlzVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudCA9IGlzVHlwZU9ubHlJbXBvcnQgJiYgaXNTb3J0aW5nVHlwZXNHcm91cDtcblxuICAgIC8vIEluIHRoZSBzcGVjaWFsIGNhc2Ugd2hlcmUgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyBhbmQgY29uc29saWRhdGVJc2xhbmRzXG4gICAgLy8gd2FudCB0aGUgb3Bwb3NpdGUgdGhpbmcsIGNvbnNvbGlkYXRlSXNsYW5kcyB3aW5zXG4gICAgY29uc3QgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9ICAgICAgaXNTb3J0aW5nVHlwZXNHcm91cFxuICAgICAgJiYgaXNDb25zb2xpZGF0aW5nU3BhY2VCZXR3ZWVuSW1wb3J0c1xuICAgICAgJiYgKHByZXZpb3VzSW1wb3J0LmlzTXVsdGlsaW5lIHx8IGN1cnJlbnRJbXBvcnQuaXNNdWx0aWxpbmUpXG4gICAgICAmJiBuZXdsaW5lc0JldHdlZW5JbXBvcnRzXyA9PT0gJ25ldmVyJ1xuICAgICAgPyAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJ1xuICAgICAgOiBuZXdsaW5lc0JldHdlZW5JbXBvcnRzXztcblxuICAgIC8vIEluIHRoZSBzcGVjaWFsIGNhc2Ugd2hlcmUgbmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzIGFuZFxuICAgIC8vIGNvbnNvbGlkYXRlSXNsYW5kcyB3YW50IHRoZSBvcHBvc2l0ZSB0aGluZywgY29uc29saWRhdGVJc2xhbmRzIHdpbnNcbiAgICBjb25zdCBuZXdsaW5lc0JldHdlZW5UeXBlT25seUltcG9ydHMgPSAgICAgIGlzU29ydGluZ1R5cGVzR3JvdXBcbiAgICAgICYmIGlzQ29uc29saWRhdGluZ1NwYWNlQmV0d2VlbkltcG9ydHNcbiAgICAgICYmIChpc05vcm1hbEltcG9ydE5leHRUb1R5cGVPbmx5SW1wb3J0QW5kUmVsZXZhbnRcbiAgICAgICAgfHwgcHJldmlvdXNJbXBvcnQuaXNNdWx0aWxpbmVcbiAgICAgICAgfHwgY3VycmVudEltcG9ydC5pc011bHRpbGluZSlcbiAgICAgICYmIG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0c18gPT09ICduZXZlcidcbiAgICAgID8gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcydcbiAgICAgIDogbmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzXztcblxuICAgIGNvbnN0IGlzTm90SWdub3JlZCA9ICAgICAgaXNUeXBlT25seUltcG9ydEFuZFJlbGV2YW50XG4gICAgICAgICYmIG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0cyAhPT0gJ2lnbm9yZSdcbiAgICAgIHx8ICFpc1R5cGVPbmx5SW1wb3J0QW5kUmVsZXZhbnQgJiYgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyAhPT0gJ2lnbm9yZSc7XG5cbiAgICBpZiAoaXNOb3RJZ25vcmVkKSB7XG4gICAgICBjb25zdCBzaG91bGRBc3NlcnROZXdsaW5lQmV0d2Vlbkdyb3VwcyA9ICAgICAgICAoaXNUeXBlT25seUltcG9ydEFuZFJlbGV2YW50IHx8IGlzTm9ybWFsSW1wb3J0TmV4dFRvVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudClcbiAgICAgICAgICAmJiAobmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzID09PSAnYWx3YXlzJ1xuICAgICAgICAgICAgfHwgbmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzID09PSAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJylcbiAgICAgICAgfHwgIWlzVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudCAmJiAhaXNOb3JtYWxJbXBvcnROZXh0VG9UeXBlT25seUltcG9ydEFuZFJlbGV2YW50XG4gICAgICAgICAgJiYgKG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPT09ICdhbHdheXMnXG4gICAgICAgICAgICB8fCBuZXdsaW5lc0JldHdlZW5JbXBvcnRzID09PSAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJyk7XG5cbiAgICAgIGNvbnN0IHNob3VsZEFzc2VydE5vTmV3bGluZVdpdGhpbkdyb3VwID0gICAgICAgIChpc1R5cGVPbmx5SW1wb3J0QW5kUmVsZXZhbnQgfHwgaXNOb3JtYWxJbXBvcnROZXh0VG9UeXBlT25seUltcG9ydEFuZFJlbGV2YW50KVxuICAgICAgICAgICYmIG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0cyAhPT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcydcbiAgICAgICAgfHwgIWlzVHlwZU9ubHlJbXBvcnRBbmRSZWxldmFudCAmJiAhaXNOb3JtYWxJbXBvcnROZXh0VG9UeXBlT25seUltcG9ydEFuZFJlbGV2YW50XG4gICAgICAgICAgJiYgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyAhPT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3Vwcyc7XG5cbiAgICAgIGNvbnN0IHNob3VsZEFzc2VydE5vTmV3bGluZUJldHdlZW5Hcm91cCA9ICAgICAgICAhaXNTb3J0aW5nVHlwZXNHcm91cFxuICAgICAgICB8fCAhaXNOb3JtYWxJbXBvcnROZXh0VG9UeXBlT25seUltcG9ydEFuZFJlbGV2YW50XG4gICAgICAgIHx8IG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0cyA9PT0gJ25ldmVyJztcblxuICAgICAgY29uc3QgaXNUaGVOZXdsaW5lQmV0d2VlbkltcG9ydHNJblRoZVNhbWVHcm91cCA9IGRpc3RpbmN0R3JvdXAgJiYgY3VycmVudEltcG9ydC5yYW5rID09PSBwcmV2aW91c0ltcG9ydC5yYW5rXG4gICAgICB8fCAhZGlzdGluY3RHcm91cCAmJiAhaXNTdGFydE9mRGlzdGluY3RHcm91cDtcblxuICAgICAgLy8gTGV0J3MgdHJ5IHRvIGN1dCBkb3duIG9uIGxpbnRpbmcgZXJyb3JzIHNlbnQgdG8gdGhlIHVzZXJcbiAgICAgIGxldCBhbHJlYWR5UmVwb3J0ZWQgPSBmYWxzZTtcblxuICAgICAgaWYgKHNob3VsZEFzc2VydE5ld2xpbmVCZXR3ZWVuR3JvdXBzKSB7XG4gICAgICAgIGlmIChjdXJyZW50SW1wb3J0LnJhbmsgIT09IHByZXZpb3VzSW1wb3J0LnJhbmsgJiYgZW1wdHlMaW5lc0JldHdlZW4gPT09IDApIHtcbiAgICAgICAgICBpZiAoZGlzdGluY3RHcm91cCB8fCBpc1N0YXJ0T2ZEaXN0aW5jdEdyb3VwKSB7XG4gICAgICAgICAgICBhbHJlYWR5UmVwb3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICBub2RlOiBwcmV2aW91c0ltcG9ydC5ub2RlLFxuICAgICAgICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBlbXB0eSBsaW5lIGJldHdlZW4gaW1wb3J0IGdyb3VwcycsXG4gICAgICAgICAgICAgIGZpeDogZml4TmV3TGluZUFmdGVySW1wb3J0KGNvbnRleHQsIHByZXZpb3VzSW1wb3J0KSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChlbXB0eUxpbmVzQmV0d2VlbiA+IDAgJiYgc2hvdWxkQXNzZXJ0Tm9OZXdsaW5lV2l0aGluR3JvdXApIHtcbiAgICAgICAgICBpZiAoaXNUaGVOZXdsaW5lQmV0d2VlbkltcG9ydHNJblRoZVNhbWVHcm91cCkge1xuICAgICAgICAgICAgYWxyZWFkeVJlcG9ydGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgICAgbm9kZTogcHJldmlvdXNJbXBvcnQubm9kZSxcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ1RoZXJlIHNob3VsZCBiZSBubyBlbXB0eSBsaW5lIHdpdGhpbiBpbXBvcnQgZ3JvdXAnLFxuICAgICAgICAgICAgICBmaXg6IHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZW1wdHlMaW5lc0JldHdlZW4gPiAwICYmIHNob3VsZEFzc2VydE5vTmV3bGluZUJldHdlZW5Hcm91cCkge1xuICAgICAgICBhbHJlYWR5UmVwb3J0ZWQgPSB0cnVlO1xuICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgbm9kZTogcHJldmlvdXNJbXBvcnQubm9kZSxcbiAgICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIG5vIGVtcHR5IGxpbmUgYmV0d2VlbiBpbXBvcnQgZ3JvdXBzJyxcbiAgICAgICAgICBmaXg6IHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWFscmVhZHlSZXBvcnRlZCAmJiBpc0NvbnNvbGlkYXRpbmdTcGFjZUJldHdlZW5JbXBvcnRzKSB7XG4gICAgICAgIGlmIChlbXB0eUxpbmVzQmV0d2VlbiA9PT0gMCAmJiBjdXJyZW50SW1wb3J0LmlzTXVsdGlsaW5lKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgbm9kZTogcHJldmlvdXNJbXBvcnQubm9kZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdUaGVyZSBzaG91bGQgYmUgYXQgbGVhc3Qgb25lIGVtcHR5IGxpbmUgYmV0d2VlbiB0aGlzIGltcG9ydCBhbmQgdGhlIG11bHRpLWxpbmUgaW1wb3J0IHRoYXQgZm9sbG93cyBpdCcsXG4gICAgICAgICAgICBmaXg6IGZpeE5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZW1wdHlMaW5lc0JldHdlZW4gPT09IDAgJiYgcHJldmlvdXNJbXBvcnQuaXNNdWx0aWxpbmUpIHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgICBub2RlOiBwcmV2aW91c0ltcG9ydC5ub2RlLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1RoZXJlIHNob3VsZCBiZSBhdCBsZWFzdCBvbmUgZW1wdHkgbGluZSBiZXR3ZWVuIHRoaXMgbXVsdGktbGluZSBpbXBvcnQgYW5kIHRoZSBpbXBvcnQgdGhhdCBmb2xsb3dzIGl0JyxcbiAgICAgICAgICAgIGZpeDogZml4TmV3TGluZUFmdGVySW1wb3J0KGNvbnRleHQsIHByZXZpb3VzSW1wb3J0KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICBlbXB0eUxpbmVzQmV0d2VlbiA+IDBcbiAgICAgICAgICAmJiAhcHJldmlvdXNJbXBvcnQuaXNNdWx0aWxpbmVcbiAgICAgICAgICAmJiAhY3VycmVudEltcG9ydC5pc011bHRpbGluZVxuICAgICAgICAgICYmIGlzVGhlTmV3bGluZUJldHdlZW5JbXBvcnRzSW5UaGVTYW1lR3JvdXBcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgbm9kZTogcHJldmlvdXNJbXBvcnQubm9kZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgICAgICdUaGVyZSBzaG91bGQgYmUgbm8gZW1wdHkgbGluZXMgYmV0d2VlbiB0aGlzIHNpbmdsZS1saW5lIGltcG9ydCBhbmQgdGhlIHNpbmdsZS1saW5lIGltcG9ydCB0aGF0IGZvbGxvd3MgaXQnLFxuICAgICAgICAgICAgZml4OiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcHJldmlvdXNJbXBvcnQgPSBjdXJyZW50SW1wb3J0O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0QWxwaGFiZXRpemVDb25maWcob3B0aW9ucykge1xuICBjb25zdCBhbHBoYWJldGl6ZSA9IG9wdGlvbnMuYWxwaGFiZXRpemUgfHwge307XG4gIGNvbnN0IG9yZGVyID0gYWxwaGFiZXRpemUub3JkZXIgfHwgJ2lnbm9yZSc7XG4gIGNvbnN0IG9yZGVySW1wb3J0S2luZCA9IGFscGhhYmV0aXplLm9yZGVySW1wb3J0S2luZCB8fCAnaWdub3JlJztcbiAgY29uc3QgY2FzZUluc2Vuc2l0aXZlID0gYWxwaGFiZXRpemUuY2FzZUluc2Vuc2l0aXZlIHx8IGZhbHNlO1xuXG4gIHJldHVybiB7IG9yZGVyLCBvcmRlckltcG9ydEtpbmQsIGNhc2VJbnNlbnNpdGl2ZSB9O1xufVxuXG4vLyBUT0RPLCBzZW12ZXItbWFqb3I6IENoYW5nZSB0aGUgZGVmYXVsdCBvZiBcImRpc3RpbmN0R3JvdXBcIiBmcm9tIHRydWUgdG8gZmFsc2VcbmNvbnN0IGRlZmF1bHREaXN0aW5jdEdyb3VwID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gICAgZG9jczoge1xuICAgICAgY2F0ZWdvcnk6ICdTdHlsZSBndWlkZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZm9yY2UgYSBjb252ZW50aW9uIGluIG1vZHVsZSBpbXBvcnQgb3JkZXIuJyxcbiAgICAgIHVybDogZG9jc1VybCgnb3JkZXInKSxcbiAgICB9LFxuXG4gICAgZml4YWJsZTogJ2NvZGUnLFxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIGdyb3Vwczoge1xuICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgIHVuaXF1ZUl0ZW1zOiB0cnVlLFxuICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICB7IGVudW06IHR5cGVzIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICAgIHVuaXF1ZUl0ZW1zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgZW51bTogdHlwZXMgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZGlzdGluY3RHcm91cDoge1xuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgZGVmYXVsdDogZGVmYXVsdERpc3RpbmN0R3JvdXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwYXRoR3JvdXBzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhdHRlcm5PcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdyb3VwOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgIGVudW06IHR5cGVzLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgZW51bTogWydhZnRlcicsICdiZWZvcmUnXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3BhdHRlcm4nLCAnZ3JvdXAnXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbmV3bGluZXMtYmV0d2Vlbic6IHtcbiAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgJ2lnbm9yZScsXG4gICAgICAgICAgICAgICdhbHdheXMnLFxuICAgICAgICAgICAgICAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJyxcbiAgICAgICAgICAgICAgJ25ldmVyJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbmV3bGluZXMtYmV0d2Vlbi10eXBlcyc6IHtcbiAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgJ2lnbm9yZScsXG4gICAgICAgICAgICAgICdhbHdheXMnLFxuICAgICAgICAgICAgICAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJyxcbiAgICAgICAgICAgICAgJ25ldmVyJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25zb2xpZGF0ZUlzbGFuZHM6IHtcbiAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgJ2luc2lkZS1ncm91cHMnLFxuICAgICAgICAgICAgICAnbmV2ZXInLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNvcnRUeXBlc0dyb3VwOiB7XG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIG5hbWVkOiB7XG4gICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICAgIG9uZU9mOiBbe1xuICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgZW5hYmxlZDogeyB0eXBlOiAnYm9vbGVhbicgfSxcbiAgICAgICAgICAgICAgICBpbXBvcnQ6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG4gICAgICAgICAgICAgICAgZXhwb3J0OiB7IHR5cGU6ICdib29sZWFuJyB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmU6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG4gICAgICAgICAgICAgICAgY2pzRXhwb3J0czogeyB0eXBlOiAnYm9vbGVhbicgfSxcbiAgICAgICAgICAgICAgICB0eXBlczoge1xuICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICAgICAgICdtaXhlZCcsXG4gICAgICAgICAgICAgICAgICAgICd0eXBlcy1maXJzdCcsXG4gICAgICAgICAgICAgICAgICAgICd0eXBlcy1sYXN0JyxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhbHBoYWJldGl6ZToge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIGNhc2VJbnNlbnNpdGl2ZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgb3JkZXI6IHtcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2lnbm9yZScsICdhc2MnLCAnZGVzYyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdpZ25vcmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBvcmRlckltcG9ydEtpbmQ6IHtcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2lnbm9yZScsICdhc2MnLCAnZGVzYyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdpZ25vcmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHdhcm5PblVuYXNzaWduZWRJbXBvcnRzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICAgIGRlcGVuZGVuY2llczoge1xuICAgICAgICAgIHNvcnRUeXBlc0dyb3VwOiB7XG4gICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gV2hlbiBzb3J0VHlwZXNHcm91cCBpcyB0cnVlLCBncm91cHMgbXVzdCBOT1QgYmUgYW4gYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluICd0eXBlJ1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNvcnRUeXBlc0dyb3VwOiB7IGVudW06IFt0cnVlXSB9LFxuICAgICAgICAgICAgICAgICAgZ3JvdXBzOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vdDoge1xuICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgICAgICAgdW5pcXVlSXRlbXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgZW51bTogdHlwZXMuZmlsdGVyKCh0KSA9PiB0ICE9PSAndHlwZScpIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZUl0ZW1zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7IGVudW06IHR5cGVzLmZpbHRlcigodCkgPT4gdCAhPT0gJ3R5cGUnKSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2dyb3VwcyddLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgc29ydFR5cGVzR3JvdXA6IHsgZW51bTogW2ZhbHNlXSB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ25ld2xpbmVzLWJldHdlZW4tdHlwZXMnOiB7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIHNvcnRUeXBlc0dyb3VwOiB7IGVudW06IFt0cnVlXSB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3NvcnRUeXBlc0dyb3VwJ10sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25zb2xpZGF0ZUlzbGFuZHM6IHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xpZGF0ZUlzbGFuZHM6IHsgZW51bTogWydpbnNpZGUtZ3JvdXBzJ10gfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGFueU9mOiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAnbmV3bGluZXMtYmV0d2Vlbic6IHsgZW51bTogWydhbHdheXMtYW5kLWluc2lkZS1ncm91cHMnXSB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWyduZXdsaW5lcy1iZXR3ZWVuJ10sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ25ld2xpbmVzLWJldHdlZW4tdHlwZXMnOiB7IGVudW06IFsnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbmV3bGluZXMtYmV0d2Vlbi10eXBlcyddLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgY29uc29saWRhdGVJc2xhbmRzOiB7IGVudW06IFsnbmV2ZXInXSB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlKGNvbnRleHQpIHtcbiAgICBjb25zdCBvcHRpb25zID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9O1xuICAgIGNvbnN0IG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPSBvcHRpb25zWyduZXdsaW5lcy1iZXR3ZWVuJ10gfHwgJ2lnbm9yZSc7XG4gICAgY29uc3QgbmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzID0gb3B0aW9uc1snbmV3bGluZXMtYmV0d2Vlbi10eXBlcyddIHx8IG5ld2xpbmVzQmV0d2VlbkltcG9ydHM7XG4gICAgY29uc3QgcGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXMgPSBuZXcgU2V0KG9wdGlvbnMucGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXMgfHwgWydidWlsdGluJywgJ2V4dGVybmFsJywgJ29iamVjdCddKTtcbiAgICBjb25zdCBzb3J0VHlwZXNHcm91cCA9IG9wdGlvbnMuc29ydFR5cGVzR3JvdXA7XG4gICAgY29uc3QgY29uc29saWRhdGVJc2xhbmRzID0gb3B0aW9ucy5jb25zb2xpZGF0ZUlzbGFuZHMgfHwgJ25ldmVyJztcblxuICAgIGNvbnN0IG5hbWVkID0ge1xuICAgICAgdHlwZXM6ICdtaXhlZCcsXG4gICAgICAuLi50eXBlb2Ygb3B0aW9ucy5uYW1lZCA9PT0gJ29iamVjdCcgPyB7XG4gICAgICAgIC4uLm9wdGlvbnMubmFtZWQsXG4gICAgICAgIGltcG9ydDogJ2ltcG9ydCcgaW4gb3B0aW9ucy5uYW1lZCA/IG9wdGlvbnMubmFtZWQuaW1wb3J0IDogb3B0aW9ucy5uYW1lZC5lbmFibGVkLFxuICAgICAgICBleHBvcnQ6ICdleHBvcnQnIGluIG9wdGlvbnMubmFtZWQgPyBvcHRpb25zLm5hbWVkLmV4cG9ydCA6IG9wdGlvbnMubmFtZWQuZW5hYmxlZCxcbiAgICAgICAgcmVxdWlyZTogJ3JlcXVpcmUnIGluIG9wdGlvbnMubmFtZWQgPyBvcHRpb25zLm5hbWVkLnJlcXVpcmUgOiBvcHRpb25zLm5hbWVkLmVuYWJsZWQsXG4gICAgICAgIGNqc0V4cG9ydHM6ICdjanNFeHBvcnRzJyBpbiBvcHRpb25zLm5hbWVkID8gb3B0aW9ucy5uYW1lZC5janNFeHBvcnRzIDogb3B0aW9ucy5uYW1lZC5lbmFibGVkLFxuICAgICAgfSA6IHtcbiAgICAgICAgaW1wb3J0OiBvcHRpb25zLm5hbWVkLFxuICAgICAgICBleHBvcnQ6IG9wdGlvbnMubmFtZWQsXG4gICAgICAgIHJlcXVpcmU6IG9wdGlvbnMubmFtZWQsXG4gICAgICAgIGNqc0V4cG9ydHM6IG9wdGlvbnMubmFtZWQsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBuYW1lZEdyb3VwcyA9IG5hbWVkLnR5cGVzID09PSAnbWl4ZWQnID8gW10gOiBuYW1lZC50eXBlcyA9PT0gJ3R5cGVzLWxhc3QnID8gWyd2YWx1ZSddIDogWyd0eXBlJ107XG4gICAgY29uc3QgYWxwaGFiZXRpemUgPSBnZXRBbHBoYWJldGl6ZUNvbmZpZyhvcHRpb25zKTtcbiAgICBjb25zdCBkaXN0aW5jdEdyb3VwID0gb3B0aW9ucy5kaXN0aW5jdEdyb3VwID09IG51bGwgPyBkZWZhdWx0RGlzdGluY3RHcm91cCA6ICEhb3B0aW9ucy5kaXN0aW5jdEdyb3VwO1xuICAgIGxldCByYW5rcztcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHBhdGhHcm91cHMsIG1heFBvc2l0aW9uIH0gPSBjb252ZXJ0UGF0aEdyb3Vwc0ZvclJhbmtzKG9wdGlvbnMucGF0aEdyb3VwcyB8fCBbXSk7XG4gICAgICBjb25zdCB7IGdyb3Vwcywgb21pdHRlZFR5cGVzIH0gPSBjb252ZXJ0R3JvdXBzVG9SYW5rcyhvcHRpb25zLmdyb3VwcyB8fCBkZWZhdWx0R3JvdXBzKTtcbiAgICAgIHJhbmtzID0ge1xuICAgICAgICBncm91cHMsXG4gICAgICAgIG9taXR0ZWRUeXBlcyxcbiAgICAgICAgcGF0aEdyb3VwcyxcbiAgICAgICAgbWF4UG9zaXRpb24sXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBNYWxmb3JtZWQgY29uZmlndXJhdGlvblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgUHJvZ3JhbShub2RlKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQobm9kZSwgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cbiAgICBjb25zdCBpbXBvcnRNYXAgPSBuZXcgTWFwKCk7XG4gICAgY29uc3QgZXhwb3J0TWFwID0gbmV3IE1hcCgpO1xuXG4gICAgY29uc3QgaXNUeXBlR3JvdXBJbkdyb3VwcyA9IHJhbmtzLm9taXR0ZWRUeXBlcy5pbmRleE9mKCd0eXBlJykgPT09IC0xO1xuICAgIGNvbnN0IGlzU29ydGluZ1R5cGVzR3JvdXAgPSBpc1R5cGVHcm91cEluR3JvdXBzICYmIHNvcnRUeXBlc0dyb3VwO1xuXG4gICAgZnVuY3Rpb24gZ2V0QmxvY2tJbXBvcnRzKG5vZGUpIHtcbiAgICAgIGlmICghaW1wb3J0TWFwLmhhcyhub2RlKSkge1xuICAgICAgICBpbXBvcnRNYXAuc2V0KG5vZGUsIFtdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbXBvcnRNYXAuZ2V0KG5vZGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEJsb2NrRXhwb3J0cyhub2RlKSB7XG4gICAgICBpZiAoIWV4cG9ydE1hcC5oYXMobm9kZSkpIHtcbiAgICAgICAgZXhwb3J0TWFwLnNldChub2RlLCBbXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwb3J0TWFwLmdldChub2RlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWtlTmFtZWRPcmRlclJlcG9ydChjb250ZXh0LCBuYW1lZEltcG9ydHMpIHtcbiAgICAgIGlmIChuYW1lZEltcG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCBpbXBvcnRzID0gbmFtZWRJbXBvcnRzLm1hcChcbiAgICAgICAgICAobmFtZWRJbXBvcnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGtpbmQgPSBuYW1lZEltcG9ydC5raW5kIHx8ICd2YWx1ZSc7XG4gICAgICAgICAgICBjb25zdCByYW5rID0gbmFtZWRHcm91cHMuZmluZEluZGV4KChlbnRyeSkgPT4gW10uY29uY2F0KGVudHJ5KS5pbmRleE9mKGtpbmQpID4gLTEpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogbmFtZWRJbXBvcnQudmFsdWUsXG4gICAgICAgICAgICAgIHJhbms6IHJhbmsgPT09IC0xID8gbmFtZWRHcm91cHMubGVuZ3RoIDogcmFuayxcbiAgICAgICAgICAgICAgLi4ubmFtZWRJbXBvcnQsXG4gICAgICAgICAgICAgIHZhbHVlOiBgJHtuYW1lZEltcG9ydC52YWx1ZX06JHtuYW1lZEltcG9ydC5hbGlhcyB8fCAnJ31gLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAoYWxwaGFiZXRpemUub3JkZXIgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgbXV0YXRlUmFua3NUb0FscGhhYmV0aXplKGltcG9ydHMsIGFscGhhYmV0aXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1ha2VPdXRPZk9yZGVyUmVwb3J0KGNvbnRleHQsIGltcG9ydHMsIGNhdGVnb3JpZXMubmFtZWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICAgIC8vIElnbm9yaW5nIHVuYXNzaWduZWQgaW1wb3J0cyB1bmxlc3Mgd2Fybk9uVW5hc3NpZ25lZEltcG9ydHMgaXMgc2V0XG4gICAgICAgIGlmIChub2RlLnNwZWNpZmllcnMubGVuZ3RoIHx8IG9wdGlvbnMud2Fybk9uVW5hc3NpZ25lZEltcG9ydHMpIHtcbiAgICAgICAgICBjb25zdCBuYW1lID0gbm9kZS5zb3VyY2UudmFsdWU7XG4gICAgICAgICAgcmVnaXN0ZXJOb2RlKFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgdmFsdWU6IG5hbWUsXG4gICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBuYW1lLFxuICAgICAgICAgICAgICB0eXBlOiAnaW1wb3J0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByYW5rcyxcbiAgICAgICAgICAgIGdldEJsb2NrSW1wb3J0cyhub2RlLnBhcmVudCksXG4gICAgICAgICAgICBwYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyxcbiAgICAgICAgICAgIGlzU29ydGluZ1R5cGVzR3JvdXAsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChuYW1lZC5pbXBvcnQpIHtcbiAgICAgICAgICAgIG1ha2VOYW1lZE9yZGVyUmVwb3J0KFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBub2RlLnNwZWNpZmllcnMuZmlsdGVyKFxuICAgICAgICAgICAgICAgIChzcGVjaWZpZXIpID0+IHNwZWNpZmllci50eXBlID09PSAnSW1wb3J0U3BlY2lmaWVyJykubWFwKFxuICAgICAgICAgICAgICAgIChzcGVjaWZpZXIpID0+ICh7XG4gICAgICAgICAgICAgICAgICBub2RlOiBzcGVjaWZpZXIsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogc3BlY2lmaWVyLmltcG9ydGVkLm5hbWUsXG4gICAgICAgICAgICAgICAgICB0eXBlOiAnaW1wb3J0JyxcbiAgICAgICAgICAgICAgICAgIGtpbmQ6IHNwZWNpZmllci5pbXBvcnRLaW5kLFxuICAgICAgICAgICAgICAgICAgLi4uc3BlY2lmaWVyLmxvY2FsLnJhbmdlWzBdICE9PSBzcGVjaWZpZXIuaW1wb3J0ZWQucmFuZ2VbMF0gJiYge1xuICAgICAgICAgICAgICAgICAgICBhbGlhczogc3BlY2lmaWVyLmxvY2FsLm5hbWUsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uKG5vZGUpIHtcbiAgICAgICAgLy8gc2tpcCBcImV4cG9ydCBpbXBvcnRcInNcbiAgICAgICAgaWYgKG5vZGUuaXNFeHBvcnQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGlzcGxheU5hbWU7XG4gICAgICAgIGxldCB2YWx1ZTtcbiAgICAgICAgbGV0IHR5cGU7XG4gICAgICAgIGlmIChub2RlLm1vZHVsZVJlZmVyZW5jZS50eXBlID09PSAnVFNFeHRlcm5hbE1vZHVsZVJlZmVyZW5jZScpIHtcbiAgICAgICAgICB2YWx1ZSA9IG5vZGUubW9kdWxlUmVmZXJlbmNlLmV4cHJlc3Npb24udmFsdWU7XG4gICAgICAgICAgZGlzcGxheU5hbWUgPSB2YWx1ZTtcbiAgICAgICAgICB0eXBlID0gJ2ltcG9ydCc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgICAgICBkaXNwbGF5TmFtZSA9IGdldFNvdXJjZUNvZGUoY29udGV4dCkuZ2V0VGV4dChub2RlLm1vZHVsZVJlZmVyZW5jZSk7XG4gICAgICAgICAgdHlwZSA9ICdpbXBvcnQ6b2JqZWN0JztcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZ2lzdGVyTm9kZShcbiAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJhbmtzLFxuICAgICAgICAgIGdldEJsb2NrSW1wb3J0cyhub2RlLnBhcmVudCksXG4gICAgICAgICAgcGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXMsXG4gICAgICAgICAgaXNTb3J0aW5nVHlwZXNHcm91cCxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbihub2RlKSB7XG4gICAgICAgIGlmICghaXNTdGF0aWNSZXF1aXJlKG5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJsb2NrID0gZ2V0UmVxdWlyZUJsb2NrKG5vZGUpO1xuICAgICAgICBpZiAoIWJsb2NrKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlLmFyZ3VtZW50c1swXS52YWx1ZTtcbiAgICAgICAgcmVnaXN0ZXJOb2RlKFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIHZhbHVlOiBuYW1lLFxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IG5hbWUsXG4gICAgICAgICAgICB0eXBlOiAncmVxdWlyZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByYW5rcyxcbiAgICAgICAgICBnZXRCbG9ja0ltcG9ydHMoYmxvY2spLFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzLFxuICAgICAgICAgIGlzU29ydGluZ1R5cGVzR3JvdXAsXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgLi4ubmFtZWQucmVxdWlyZSAmJiB7XG4gICAgICAgIFZhcmlhYmxlRGVjbGFyYXRvcihub2RlKSB7XG4gICAgICAgICAgaWYgKG5vZGUuaWQudHlwZSA9PT0gJ09iamVjdFBhdHRlcm4nICYmIGlzUmVxdWlyZUV4cHJlc3Npb24obm9kZS5pbml0KSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLmlkLnByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIG5vZGUuaWQucHJvcGVydGllc1tpXS5rZXkudHlwZSAhPT0gJ0lkZW50aWZpZXInXG4gICAgICAgICAgICAgICAgfHwgbm9kZS5pZC5wcm9wZXJ0aWVzW2ldLnZhbHVlLnR5cGUgIT09ICdJZGVudGlmaWVyJ1xuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1ha2VOYW1lZE9yZGVyUmVwb3J0KFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBub2RlLmlkLnByb3BlcnRpZXMubWFwKChwcm9wKSA9PiAoe1xuICAgICAgICAgICAgICAgIG5vZGU6IHByb3AsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHByb3Aua2V5Lm5hbWUsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3JlcXVpcmUnLFxuICAgICAgICAgICAgICAgIC4uLnByb3Aua2V5LnJhbmdlWzBdICE9PSBwcm9wLnZhbHVlLnJhbmdlWzBdICYmIHtcbiAgICAgICAgICAgICAgICAgIGFsaWFzOiBwcm9wLnZhbHVlLm5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLi4ubmFtZWQuZXhwb3J0ICYmIHtcbiAgICAgICAgRXhwb3J0TmFtZWREZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICAgICAgbWFrZU5hbWVkT3JkZXJSZXBvcnQoXG4gICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgbm9kZS5zcGVjaWZpZXJzLm1hcCgoc3BlY2lmaWVyKSA9PiAoe1xuICAgICAgICAgICAgICBub2RlOiBzcGVjaWZpZXIsXG4gICAgICAgICAgICAgIHZhbHVlOiBzcGVjaWZpZXIubG9jYWwubmFtZSxcbiAgICAgICAgICAgICAgdHlwZTogJ2V4cG9ydCcsXG4gICAgICAgICAgICAgIGtpbmQ6IHNwZWNpZmllci5leHBvcnRLaW5kLFxuICAgICAgICAgICAgICAuLi5zcGVjaWZpZXIubG9jYWwucmFuZ2VbMF0gIT09IHNwZWNpZmllci5leHBvcnRlZC5yYW5nZVswXSAmJiB7XG4gICAgICAgICAgICAgICAgYWxpYXM6IHNwZWNpZmllci5leHBvcnRlZC5uYW1lLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLi4ubmFtZWQuY2pzRXhwb3J0cyAmJiB7XG4gICAgICAgIEFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUpIHtcbiAgICAgICAgICBpZiAobm9kZS5wYXJlbnQudHlwZSA9PT0gJ0V4cHJlc3Npb25TdGF0ZW1lbnQnKSB7XG4gICAgICAgICAgICBpZiAoaXNDSlNFeHBvcnRzKGNvbnRleHQsIG5vZGUubGVmdCkpIHtcbiAgICAgICAgICAgICAgaWYgKG5vZGUucmlnaHQudHlwZSA9PT0gJ09iamVjdEV4cHJlc3Npb24nKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnJpZ2h0LnByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgIW5vZGUucmlnaHQucHJvcGVydGllc1tpXS5rZXlcbiAgICAgICAgICAgICAgICAgICAgfHwgbm9kZS5yaWdodC5wcm9wZXJ0aWVzW2ldLmtleS50eXBlICE9PSAnSWRlbnRpZmllcidcbiAgICAgICAgICAgICAgICAgICAgfHwgIW5vZGUucmlnaHQucHJvcGVydGllc1tpXS52YWx1ZVxuICAgICAgICAgICAgICAgICAgICB8fCBub2RlLnJpZ2h0LnByb3BlcnRpZXNbaV0udmFsdWUudHlwZSAhPT0gJ0lkZW50aWZpZXInXG4gICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1ha2VOYW1lZE9yZGVyUmVwb3J0KFxuICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgIG5vZGUucmlnaHQucHJvcGVydGllcy5tYXAoKHByb3ApID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIG5vZGU6IHByb3AsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwcm9wLmtleS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZXhwb3J0JyxcbiAgICAgICAgICAgICAgICAgICAgLi4ucHJvcC5rZXkucmFuZ2VbMF0gIT09IHByb3AudmFsdWUucmFuZ2VbMF0gJiYge1xuICAgICAgICAgICAgICAgICAgICAgIGFsaWFzOiBwcm9wLnZhbHVlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgbmFtZVBhcnRzID0gZ2V0TmFtZWRDSlNFeHBvcnRzKGNvbnRleHQsIG5vZGUubGVmdCk7XG4gICAgICAgICAgICAgIGlmIChuYW1lUGFydHMgJiYgbmFtZVBhcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gbmFtZVBhcnRzLmpvaW4oJy4nKTtcbiAgICAgICAgICAgICAgICBnZXRCbG9ja0V4cG9ydHMobm9kZS5wYXJlbnQucGFyZW50KS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogbmFtZSxcbiAgICAgICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgdHlwZTogJ2V4cG9ydCcsXG4gICAgICAgICAgICAgICAgICByYW5rOiAwLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgICdQcm9ncmFtOmV4aXQnKCkge1xuICAgICAgICBpbXBvcnRNYXAuZm9yRWFjaCgoaW1wb3J0ZWQpID0+IHtcbiAgICAgICAgICBpZiAobmV3bGluZXNCZXR3ZWVuSW1wb3J0cyAhPT0gJ2lnbm9yZScgfHwgbmV3bGluZXNCZXR3ZWVuVHlwZU9ubHlJbXBvcnRzICE9PSAnaWdub3JlJykge1xuICAgICAgICAgICAgbWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydChcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgaW1wb3J0ZWQsXG4gICAgICAgICAgICAgIG5ld2xpbmVzQmV0d2VlbkltcG9ydHMsXG4gICAgICAgICAgICAgIG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0cyxcbiAgICAgICAgICAgICAgZGlzdGluY3RHcm91cCxcbiAgICAgICAgICAgICAgaXNTb3J0aW5nVHlwZXNHcm91cCxcbiAgICAgICAgICAgICAgY29uc29saWRhdGVJc2xhbmRzID09PSAnaW5zaWRlLWdyb3VwcydcbiAgICAgICAgICAgICAgICAmJiAobmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9PT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcydcbiAgICAgICAgICAgICAgICAgIHx8IG5ld2xpbmVzQmV0d2VlblR5cGVPbmx5SW1wb3J0cyA9PT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcycpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYWxwaGFiZXRpemUub3JkZXIgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgICBtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUoaW1wb3J0ZWQsIGFscGhhYmV0aXplKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBtYWtlT3V0T2ZPcmRlclJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCwgY2F0ZWdvcmllcy5pbXBvcnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBleHBvcnRNYXAuZm9yRWFjaCgoZXhwb3J0ZWQpID0+IHtcbiAgICAgICAgICBpZiAoYWxwaGFiZXRpemUub3JkZXIgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgICBtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUoZXhwb3J0ZWQsIGFscGhhYmV0aXplKTtcbiAgICAgICAgICAgIG1ha2VPdXRPZk9yZGVyUmVwb3J0KGNvbnRleHQsIGV4cG9ydGVkLCBjYXRlZ29yaWVzLmV4cG9ydHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaW1wb3J0TWFwLmNsZWFyKCk7XG4gICAgICAgIGV4cG9ydE1hcC5jbGVhcigpO1xuICAgICAgfSxcbiAgICB9O1xuICB9LFxufTtcbiJdfQ==